import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Play, Square, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import BorderSelect from './BorderSelect';
import { applyBorderToImage } from '@/lib/applyBorderToImage';
import { generateImageWithPuter, type ImageModel } from '@/lib/puterImageGeneration';
import { addBleedMargin } from '@/lib/addBleedMargin';
import type { BorderTemplateId } from '@/lib/pageBorders';

interface BatchGeneratorProps {
  bookId: string;
  onPageGenerated: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
  currentPageCount: number;
}

const BatchGenerator = ({ bookId: _bookId, onPageGenerated, currentPageCount: _currentPageCount }: BatchGeneratorProps) => {
  const [promptsInput, setPromptsInput] = useState('');
  const [border, setBorder] = useState<BorderTemplateId>('none');
  const [model, setModel] = useState<ImageModel>('dall-e-3');
  const [addBleed, setAddBleed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const abortRef = useRef(false);
  const { toast } = useToast();

  const handleBatchGenerate = async () => {
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
        // Adult-focused detailed prompt
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
          
          // Apply border if selected
          if (border !== 'none') {
            finalImage = await applyBorderToImage(finalImage, border);
          }
          
          // Add bleed margin if toggled on
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
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Slightly longer delay for HD
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

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Each line generates a unique HD page. Generation takes ~15-20 seconds per page for high quality. You can stop at any time.
        </AlertDescription>
      </Alert>

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
            You have {totalPagesToGenerate} prompt(s) entered. Estimated time: ~{Math.ceil((totalPagesToGenerate * 20) / 60)} minutes
          </p>
        )}

        {generating && (
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
            <Button onClick={handleBatchGenerate} disabled={totalPagesToGenerate === 0} className="flex-1 glow-effect">
              <Play className="mr-2 h-4 w-4" />
              Generate {totalPagesToGenerate} Pages
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchGenerator;
