import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, Layers, Play, Square, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BatchGeneratorProps {
  bookId: string;
  onPageGenerated: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
  currentPageCount: number;
}

const BatchGenerator = ({ bookId, onPageGenerated, currentPageCount }: BatchGeneratorProps) => {
  const [prompt, setPrompt] = useState('');
  const [pageCount, setPageCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const abortRef = useRef(false);
  const { toast } = useToast();

  const handleBatchGenerate = async () => {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    setProgress(0);
    setCurrentPage(0);
    setFailedCount(0);
    abortRef.current = false;

    let successCount = 0;
    let failures = 0;

    for (let i = 0; i < pageCount; i++) {
      if (abortRef.current) {
        toast({
          title: 'Generation stopped',
          description: `Generated ${successCount} pages before stopping.`,
        });
        break;
      }

      setCurrentPage(i + 1);

      try {
        // Add variation to each prompt
        const variationPrompt = `${prompt.trim()} (Variation ${i + 1} of ${pageCount}, unique design)`;
        
        const generationPrompt = `Create a black and white coloring book page illustration: ${variationPrompt}. 
Style: Clean line art with clear outlines, no shading or gradients, no filled areas, 
simple and bold lines suitable for coloring. White background.
The image should have intricate but not overly complex details, perfect for a coloring book page.`;

        const { data, error } = await supabase.functions.invoke('generate-coloring-page', {
          body: { action: 'imagine', prompt: generationPrompt },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        if (data.status === 'completed' && data.imageUrl) {
          await onPageGenerated(`${prompt.trim()} (${i + 1})`, data.imageUrl, 'line_art');
          successCount++;
        } else {
          throw new Error('No image generated');
        }
      } catch (err) {
        console.error(`Failed to generate page ${i + 1}:`, err);
        failures++;
        setFailedCount(failures);
        
        // Check for rate limit or payment errors
        const errorMsg = err instanceof Error ? err.message : '';
        if (errorMsg.includes('Rate limit') || errorMsg.includes('Usage limit') || errorMsg.includes('credits')) {
          toast({
            title: 'Generation paused',
            description: errorMsg,
            variant: 'destructive',
          });
          break;
        }
        
        // Add a small delay before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      setProgress(((i + 1) / pageCount) * 100);
      
      // Add delay between generations to avoid rate limiting
      if (i < pageCount - 1 && !abortRef.current) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setGenerating(false);
    
    if (!abortRef.current && successCount > 0) {
      toast({
        title: 'Batch generation complete!',
        description: `Successfully generated ${successCount} pages${failures > 0 ? ` (${failures} failed)` : ''}.`,
      });
    }

    setPrompt('');
  };

  const handleStop = () => {
    abortRef.current = true;
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Layers className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Batch Generate Pages</h3>
          <p className="text-sm text-muted-foreground">
            Generate multiple unique variations from one prompt
          </p>
        </div>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Each page will be a unique variation. Generation takes ~10 seconds per page.
          You can stop at any time.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="batch-prompt">Base Prompt</Label>
          <Textarea
            id="batch-prompt"
            placeholder="e.g., Generate unique full-page black-and-white line art mandalas—no text, no grayscale fill, thick clean lines suitable for adult coloring, varied complexity, calming themes like flowers, geometry, nature elements."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            disabled={generating}
            className="resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="page-count">Number of Pages</Label>
          <Input
            id="page-count"
            type="number"
            min={1}
            max={100}
            value={pageCount}
            onChange={(e) => setPageCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
            disabled={generating}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Estimated time: ~{Math.ceil(pageCount * 12 / 60)} minutes
          </p>
        </div>

        {generating && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Generating page {currentPage} of {pageCount}...
              </span>
              <span className="font-medium">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            {failedCount > 0 && (
              <p className="text-xs text-destructive">
                {failedCount} page(s) failed to generate
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          {generating ? (
            <Button
              onClick={handleStop}
              variant="destructive"
              className="flex-1"
            >
              <Square className="mr-2 h-4 w-4" />
              Stop Generation
            </Button>
          ) : (
            <Button
              onClick={handleBatchGenerate}
              disabled={!prompt.trim()}
              className="flex-1 glow-effect"
            >
              <Play className="mr-2 h-4 w-4" />
              Generate {pageCount} Pages
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchGenerator;
