import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Play, Square, AlertCircle, Mail, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BorderSelect from './BorderSelect';
import { applyBorderToImage } from '@/lib/applyBorderToImage';
import { generateImageWithPuter, type ImageModel } from '@/lib/puterImageGeneration';
import { addBleedMargin } from '@/lib/addBleedMargin';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BorderTemplateId } from '@/lib/pageBorders';

interface BatchGeneratorProps {
  bookId: string;
  onPageGenerated: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
  currentPageCount: number;
}

type GenerationMode = 'realtime' | 'background';

const BatchGenerator = ({ bookId, onPageGenerated, currentPageCount: _currentPageCount }: BatchGeneratorProps) => {
  const [promptsInput, setPromptsInput] = useState('');
  const [border, setBorder] = useState<BorderTemplateId>('none');
  const [model, setModel] = useState<ImageModel>('dall-e-3');
  const [addBleed, setAddBleed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('realtime');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [jobSubmitted, setJobSubmitted] = useState(false);
  const abortRef = useRef(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Background job submission
  const handleBackgroundGenerate = async () => {
    const individualPrompts = promptsInput.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    if (individualPrompts.length === 0 || !user) return;

    try {
      // Create the job in the database
      const { data: job, error } = await supabase
        .from('generation_jobs')
        .insert({
          user_id: user.id,
          book_id: bookId,
          prompts: individualPrompts,
          total_count: individualPrompts.length,
          model,
          border,
          add_bleed: addBleed,
          notify_email: notifyEmail || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger the background processor
      const { error: invokeError } = await supabase.functions.invoke('process-generation-job', {
        body: { jobId: job.id },
      });

      if (invokeError) {
        console.error('Failed to invoke processor:', invokeError);
        // Job is created, it will be picked up later or can be manually triggered
      }

      setJobSubmitted(true);
      setPromptsInput('');
      
      toast({
        title: 'Background job started!',
        description: notifyEmail 
          ? `We'll email you at ${notifyEmail} when complete.`
          : 'Check back later for your generated pages.',
      });
    } catch (err) {
      console.error('Failed to create job:', err);
      toast({
        title: 'Failed to start background job',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Realtime generation (existing logic)
  const handleRealtimeGenerate = async () => {
    const individualPrompts = promptsInput.split('\n').map(p => p.trim()).filter(p => p.length > 0);
    if (individualPrompts.length === 0 || generating) return;

    setGenerating(true);
    setProgress(0);
    setCurrentPage(0);
    setFailedCount(0);
    abortRef.current = false;

    let successCount = 0;
    let failures = 0;
    const totalPagesToGenerate = individualPrompts.length;

    for (let i = 0; i < totalPagesToGenerate; i++) {
      if (abortRef.current) {
        toast({
          title: 'Generation stopped',
          description: `Generated ${successCount} pages before stopping.`,
        });
        break;
      }

      setCurrentPage(i + 1);
      const currentPrompt = individualPrompts[i];

      try {
        const generationPrompt = `Create a highly detailed, intricate black and white coloring page illustration for adults of: ${currentPrompt}. 
Style: Ultra-detailed line art with precise, clean outlines. Include intricate patterns, fine details, and realistic proportions. 
No shading, no gradients, no filled solid areas - only outlines and patterns. Pure white background.
The design should fill the ENTIRE image edge-to-edge with no borders or margins.
Art style: Professional adult coloring book quality with zen-tangle inspired details and sophisticated artistic complexity.
Ultra high resolution.`;

        const result = await generateImageWithPuter(generationPrompt, {
          model,
          quality: 'hd',
        });

        if (result.imageUrl) {
          let finalImage = result.imageUrl;
          
          if (border !== 'none') {
            finalImage = await applyBorderToImage(finalImage, border);
          }
          
          if (addBleed) {
            finalImage = await addBleedMargin(finalImage);
          }
          
          await onPageGenerated(currentPrompt, finalImage, 'line_art');
          successCount++;
        } else {
          throw new Error('No image generated');
        }
      } catch (err) {
        console.error(`Failed to generate page ${i + 1}:`, err);
        failures++;
        setFailedCount(failures);

        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        if (errorMsg.includes('Rate limit') || errorMsg.includes('Usage limit') || errorMsg.includes('credits')) {
          toast({
            title: 'Generation paused',
            description: errorMsg,
            variant: 'destructive',
          });
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      setProgress(((i + 1) / totalPagesToGenerate) * 100);

      if (i < totalPagesToGenerate - 1 && !abortRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setGenerating(false);

    if (!abortRef.current && successCount > 0) {
      toast({
        title: 'Batch generation complete!',
        description: `Successfully generated ${successCount} pages${failures > 0 ? ` (${failures} failed)` : ''}.`,
      });
    }

    setPromptsInput('');
  };

  const handleBatchGenerate = () => {
    if (generationMode === 'background') {
      handleBackgroundGenerate();
    } else {
      handleRealtimeGenerate();
    }
  };

  const handleStop = () => {
    abortRef.current = true;
  };

  const totalPagesToGenerate = promptsInput.split('\n').map(p => p.trim()).filter(p => p.length > 0).length;

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Batch Generate Pages</h3>
          <p className="text-sm text-muted-foreground">Generate multiple detailed adult coloring pages</p>
        </div>
      </div>

      {/* Mode Selection */}
      <Tabs value={generationMode} onValueChange={(v) => setGenerationMode(v as GenerationMode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="realtime" className="flex items-center gap-2" disabled={generating}>
            <Play className="h-4 w-4" />
            Realtime
          </TabsTrigger>
          <TabsTrigger value="background" className="flex items-center gap-2" disabled={generating}>
            <Clock className="h-4 w-4" />
            Background
          </TabsTrigger>
        </TabsList>

        <TabsContent value="realtime" className="mt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Keep this page open. Generation takes ~15-20 seconds per page. You can stop at any time.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="background" className="mt-4 space-y-4">
          <Alert className="border-primary/30 bg-primary/5">
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Close the app and we'll email you when complete. Pages generate in the background.
            </AlertDescription>
          </Alert>
          
          {jobSubmitted ? (
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg text-center">
              <p className="text-primary font-medium">✅ Job submitted!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {notifyEmail ? `We'll email ${notifyEmail} when complete.` : 'Check back later for your pages.'}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => setJobSubmitted(false)}
              >
                Submit another batch
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="notify-email">Notification Email (optional)</Label>
              <Input
                id="notify-email"
                type="email"
                placeholder="you@example.com"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                disabled={generating}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to skip email notification
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {!jobSubmitted && (
        <div className="space-y-4">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label>AI Model</Label>
            <Select value={model} onValueChange={(v) => setModel(v as ImageModel)} disabled={generating}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                <SelectItem value="dall-e-3">DALL-E 3 (Best Quality)</SelectItem>
                <SelectItem value="stabilityai/stable-diffusion-3-medium">Stable Diffusion 3</SelectItem>
                <SelectItem value="black-forest-labs/FLUX.1-schnell">Flux.1 Schnell (Fast)</SelectItem>
                <SelectItem value="gpt-image-1">GPT Image</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <BorderSelect value={border} onChange={setBorder} disabled={generating} />

          {/* Bleed Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="batch-bleed-toggle" className="cursor-pointer">Add Bleed Margin</Label>
              <p className="text-xs text-muted-foreground">
                White border for KDP print bleed (0.125")
              </p>
            </div>
            <Switch
              id="batch-bleed-toggle"
              checked={addBleed}
              onCheckedChange={setAddBleed}
              disabled={generating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch-prompts">Prompts (one per line)</Label>
            <Textarea
              id="batch-prompts"
              placeholder={`e.g.,
A majestic lion with intricate mane patterns in African savanna
A detailed steampunk owl with mechanical gears and feathers
An ornate Victorian mansion with elaborate architectural details
A realistic wolf surrounded by forest flora with detailed textures`}
              value={promptsInput}
              onChange={(e) => setPromptsInput(e.target.value)}
              rows={8}
              disabled={generating}
              className="resize-none"
            />
          </div>

          {totalPagesToGenerate > 0 && (
            <p className="text-sm text-muted-foreground">
              You have {totalPagesToGenerate} prompt(s) entered. 
              {generationMode === 'realtime' && ` Estimated time: ~${Math.ceil((totalPagesToGenerate * 20) / 60)} minutes`}
            </p>
          )}

          {generating && generationMode === 'realtime' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Generating page {currentPage} of {totalPagesToGenerate}...
                </span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {failedCount > 0 && <p className="text-xs text-destructive">{failedCount} page(s) failed to generate</p>}
            </div>
          )}

          <div className="flex gap-3">
            {generating ? (
              <Button onClick={handleStop} variant="destructive" className="flex-1">
                <Square className="mr-2 h-4 w-4" />
                Stop Generation
              </Button>
            ) : (
              <Button 
                onClick={handleBatchGenerate} 
                disabled={totalPagesToGenerate === 0 || (generationMode === 'background' && !user)} 
                className="flex-1 glow-effect"
              >
                {generationMode === 'background' ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Queue {totalPagesToGenerate} Pages
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Generate {totalPagesToGenerate} Pages
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchGenerator;
