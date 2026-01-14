import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Layers, Play, Square, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import BorderSelect from './BorderSelect';
import { applyBorderToImage } from '@/lib/applyBorderToImage';
import { getInvokeErrorMessage } from '@/lib/getInvokeErrorMessage';
import type { BorderTemplateId } from '@/lib/pageBorders';

interface BatchGeneratorProps {
  bookId: string;
  onPageGenerated: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
  currentPageCount: number;
}

const BatchGenerator = ({ bookId: _bookId, onPageGenerated, currentPageCount: _currentPageCount }: BatchGeneratorProps) => {
  const [promptsInput, setPromptsInput] = useState(''); // Changed from 'prompt' to 'promptsInput'
  const [border, setBorder] = useState<BorderTemplateId>('none');
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
        const generationPrompt = `Create a black and white coloring book page illustration: ${currentPrompt}. 
Style: Clean line art with clear outlines, no shading or gradients, no filled areas, 
simple and bold lines suitable for coloring. White background.
The image should have intricate but not overly complex details, perfect for a coloring book page.`;

        const { data, error } = await supabase.functions.invoke('generate-coloring-page', {
          body: { action: 'imagine', prompt: generationPrompt },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        if (data.status === 'completed' && data.imageUrl) {
          const imageWithBorder = await applyBorderToImage(data.imageUrl, border);
          await onPageGenerated(currentPrompt, imageWithBorder, 'line_art');
          successCount++;
        } else {
          throw new Error('No image generated');
        }
      } catch (err) {
        console.error(`Failed to generate page ${i + 1}:`, err);
        failures++;
        setFailedCount(failures);

        const errorMsg = getInvokeErrorMessage(err);
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
        await new Promise((resolve) => setTimeout(resolve, 1500));
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
          <p className="text-sm text-muted-foreground">Enter multiple prompts (one per line) to generate many pages</p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Each line in the prompt box will generate a unique page. Generation takes ~10 seconds per page. You can stop at any time.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <BorderSelect value={border} onChange={setBorder} disabled={generating} />

        <div className="space-y-2">
          <Label htmlFor="batch-prompts">Prompts (one per line)</Label>
          <Textarea
            id="batch-prompts"
            placeholder={`e.g.,
A whimsical forest scene with friendly animals
An intricate mandala with floral patterns
A brave knight fighting a dragon
A cute cat playing with yarn`}
            value={promptsInput}
            onChange={(e) => setPromptsInput(e.target.value)}
            rows={8}
            disabled={generating}
            className="resize-none"
          />
        </div>

        {totalPagesToGenerate > 0 && (
          <p className="text-sm text-muted-foreground">
            You have {totalPagesToGenerate} prompt(s) entered. Estimated time: ~{Math.ceil((totalPagesToGenerate * 12) / 60)} minutes
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