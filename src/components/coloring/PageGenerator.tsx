import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Wand2, Palette, PenTool } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BorderSelect from './BorderSelect';
import { applyBorderToImage } from '@/lib/applyBorderToImage';
import { generateImageWithPuter } from '@/lib/puterImageGeneration';
import type { BorderTemplateId } from '@/lib/pageBorders';

interface PageGeneratorProps {
  bookId: string;
  onPageGenerated: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
}

const PageGenerator = ({ bookId: _bookId, onPageGenerated }: PageGeneratorProps) => {
  const [prompt, setPrompt] = useState('');
  const [artStyle, setArtStyle] = useState<'line_art' | 'convert'>('line_art');
  const [border, setBorder] = useState<BorderTemplateId>('none');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      // Build the generation prompt based on art style
      let generationPrompt = prompt.trim();

      if (artStyle === 'line_art') {
        generationPrompt = `Create a black and white coloring book page illustration of: ${prompt}. 
Style: Clean line art with clear outlines, no shading or gradients, no filled areas, 
simple and bold lines suitable for children to color. White background.
The image should have intricate but not overly complex details, perfect for a coloring book page.`;
      } else {
        generationPrompt = `Create an illustration of: ${prompt}. 
Then convert it to a black and white coloring book style with clean outlines only, 
no shading, no filled areas, white background. Bold clear lines suitable for coloring.`;
      }

      // Use Puter's free AI image generation
      const result = await generateImageWithPuter(generationPrompt);

      if (result.imageUrl) {
        const imageWithBorder = await applyBorderToImage(result.imageUrl, border);
        await onPageGenerated(prompt.trim(), imageWithBorder, artStyle);
        setPrompt('');
        toast({
          title: 'Page created!',
          description: 'Your coloring page has been added to the book.',
        });
      } else {
        throw new Error('No image was generated');
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast({
        title: 'Generation failed',
        description: err instanceof Error ? err.message : 'Failed to generate image',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Wand2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Generate New Page</h3>
          <p className="text-sm text-muted-foreground">Describe what you want on this coloring page</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Art Style</Label>
          <RadioGroup
            value={artStyle}
            onValueChange={(v) => setArtStyle(v as 'line_art' | 'convert')}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="line_art" id="line_art" />
              <Label htmlFor="line_art" className="flex items-center gap-2 cursor-pointer">
                <PenTool className="h-4 w-4" />
                Generate as line art
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="convert" id="convert" />
              <Label htmlFor="convert" className="flex items-center gap-2 cursor-pointer">
                <Palette className="h-4 w-4" />
                Generate & convert to outline
              </Label>
            </div>
          </RadioGroup>
        </div>

        <BorderSelect value={border} onChange={setBorder} disabled={loading} />

        <div className="space-y-2">
          <Label htmlFor="prompt">Page Description</Label>
          <Textarea
            id="prompt"
            placeholder="e.g., A majestic unicorn standing in an enchanted forest with magical flowers..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            disabled={loading}
            className="resize-none"
          />
        </div>

        <Button onClick={handleGenerate} disabled={loading || !prompt.trim()} className="w-full glow-effect">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating page...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Generate Coloring Page
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PageGenerator;
