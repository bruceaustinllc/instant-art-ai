import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, Palette, PenTool } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BorderSelect from './BorderSelect';
import { applyBorderToImage } from '@/lib/applyBorderToImage';
import { generateImageWithPuter, type ImageModel } from '@/lib/puterImageGeneration';
import { addBleedMargin } from '@/lib/addBleedMargin';
import type { BorderTemplateId } from '@/lib/pageBorders';

interface PageGeneratorProps {
  bookId: string;
  onPageGenerated: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
}

const PageGenerator = ({ bookId: _bookId, onPageGenerated }: PageGeneratorProps) => {
  const [prompt, setPrompt] = useState('');
  const [artStyle, setArtStyle] = useState<'line_art' | 'convert'>('line_art');
  const [border, setBorder] = useState<BorderTemplateId>('none');
  const [model, setModel] = useState<ImageModel>('dall-e-3');
  const [addBleed, setAddBleed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      // Build adult-focused, detailed coloring page prompt
      let generationPrompt = prompt.trim();

      if (artStyle === 'line_art') {
        generationPrompt = `Create a highly detailed, intricate black and white coloring page illustration for adults of: ${prompt}. 
Style: Ultra-detailed line art with precise, clean outlines. Include intricate patterns, fine details, and realistic proportions. 
No shading, no gradients, no filled solid areas - only outlines and patterns. Pure white background.
The design should fill the ENTIRE image edge-to-edge with no borders or margins.
Art style: Professional adult coloring book quality with zen-tangle inspired details, mandala patterns where appropriate, and sophisticated artistic complexity.
Ultra high resolution.`;
      } else {
        generationPrompt = `Create a photorealistic, highly detailed illustration of: ${prompt}. 
Then render it as a sophisticated black and white coloring page for adults.
Include intricate details, realistic proportions, and fine linework.
Style: Clean precise outlines only, no shading or solid fills. Pure white background.
The design should fill the ENTIRE image edge-to-edge.
Adult coloring book quality with complex patterns and details.
Ultra high resolution.`;
      }

      // Use selected model with HD quality
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
        
        await onPageGenerated(prompt.trim(), finalImage, artStyle);
        setPrompt('');
        toast({
          title: 'Page created!',
          description: 'Your detailed coloring page has been added to the book.',
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
          <p className="text-sm text-muted-foreground">Create detailed adult coloring pages</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Model Selection */}
        <div className="space-y-2">
          <Label>AI Model</Label>
          <Select value={model} onValueChange={(v) => setModel(v as ImageModel)}>
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

        {/* Art Style */}
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
                Intricate line art
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="convert" id="convert" />
              <Label htmlFor="convert" className="flex items-center gap-2 cursor-pointer">
                <Palette className="h-4 w-4" />
                Realistic to outline
              </Label>
            </div>
          </RadioGroup>
        </div>

        <BorderSelect value={border} onChange={setBorder} disabled={loading} />

        {/* Bleed Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="bleed-toggle" className="cursor-pointer">Add Bleed Margin</Label>
            <p className="text-xs text-muted-foreground">
              White border for KDP print bleed (0.125")
            </p>
          </div>
          <Switch
            id="bleed-toggle"
            checked={addBleed}
            onCheckedChange={setAddBleed}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt">Page Description</Label>
          <Textarea
            id="prompt"
            placeholder="e.g., A majestic lion with intricate mane patterns, realistic anatomy, surrounded by African savanna flora with detailed leaves and grass..."
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
              Generating detailed page...
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
