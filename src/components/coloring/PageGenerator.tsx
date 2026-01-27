import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wand2, Palette, PenTool, Sun, Brush } from 'lucide-react';
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

type ArtStyle = 'simple' | 'detailed' | 'realistic_shading' | 'bold_shapes';

const artStyleInfo: Record<ArtStyle, { label: string; icon: React.ReactNode; description: string }> = {
  simple: {
    label: 'Simple & Relaxing',
    icon: <Sun className="h-4 w-4" />,
    description: 'Clean, minimal lines for a calming experience',
  },
  detailed: {
    label: 'Detailed Line Art',
    icon: <PenTool className="h-4 w-4" />,
    description: 'Intricate patterns for experienced colorists',
  },
  realistic_shading: {
    label: 'Learn to Shade',
    icon: <Brush className="h-4 w-4" />,
    description: 'Grayscale zones to practice realistic shading',
  },
  bold_shapes: {
    label: 'Bold Shapes',
    icon: <Palette className="h-4 w-4" />,
    description: 'Large, defined areas with clear boundaries',
  },
};

const PageGenerator = ({ bookId: _bookId, onPageGenerated }: PageGeneratorProps) => {
  const [prompt, setPrompt] = useState('');
  const [artStyle, setArtStyle] = useState<ArtStyle>('simple');
  const [border, setBorder] = useState<BorderTemplateId>('none');
  const [model, setModel] = useState<ImageModel>('dall-e-3');
  const [addBleed, setAddBleed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const buildPrompt = (basePrompt: string, style: ArtStyle): string => {
    const prompts: Record<ArtStyle, string> = {
      simple: `Create a simple, relaxing black and white coloring page of: ${basePrompt}. 
Style: Clean, minimal outlines with LARGE open spaces to color. Use thick, smooth lines. 
Avoid fine details, thin lines, or crowded patterns. Keep it calming and easy to color.
No shading, no gradients - only simple outlines. Pure white background.
The design should be beginner-friendly and stress-relieving.
Ultra high resolution.`,

      detailed: `Create a detailed black and white coloring page illustration for adults of: ${basePrompt}. 
Style: Intricate line art with precise, clean outlines. Include patterns and fine details. 
No shading, no gradients, no filled solid areas - only outlines and patterns. Pure white background.
The design should fill the entire image edge-to-edge with no borders.
Professional adult coloring book quality with sophisticated artistic complexity.
Ultra high resolution.`,

      realistic_shading: `Create a realistic grayscale reference illustration of: ${basePrompt} designed to teach shading techniques.
Style: Divide the image into clearly numbered or labeled ZONES showing different gray tones (light, medium, dark).
Include a small legend showing the grayscale values for each zone.
The zones should have clear outlines so users can practice matching the shading.
Think of it as a "paint by numbers" but for learning realistic shading and tonal values.
Show how light hits the subject with distinct shadow zones and highlight areas.
Educational style that teaches value and form. Pure white background.
Ultra high resolution.`,

      bold_shapes: `Create a bold, graphic black and white coloring page of: ${basePrompt}.
Style: Large, clearly defined shapes with THICK black outlines. 
Use geometric simplification - break the subject into big, easy-to-color sections.
No thin lines, no intricate details. Think poster-style or stained-glass effect.
Each section should be large enough for markers or even paint.
Relaxing and satisfying to color. Pure white background.
Ultra high resolution.`,
    };

    return prompts[style];
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    try {
      const generationPrompt = buildPrompt(prompt.trim(), artStyle);

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
        
        await onPageGenerated(prompt.trim(), finalImage, artStyle);
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
          <p className="text-sm text-muted-foreground">Choose a style that fits your mood</p>
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

        {/* Art Style Selection */}
        <div className="space-y-3">
          <Label>Coloring Style</Label>
          <RadioGroup
            value={artStyle}
            onValueChange={(v) => setArtStyle(v as ArtStyle)}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {(Object.entries(artStyleInfo) as [ArtStyle, typeof artStyleInfo[ArtStyle]][]).map(([value, info]) => (
              <div key={value} className="relative">
                <RadioGroupItem value={value} id={value} className="peer sr-only" />
                <Label
                  htmlFor={value}
                  className="flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all
                    peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                    hover:bg-muted/50 border-border"
                >
                  <div className="flex items-center gap-2 font-medium">
                    {info.icon}
                    {info.label}
                  </div>
                  <p className="text-xs text-muted-foreground">{info.description}</p>
                </Label>
              </div>
            ))}
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
          <Label htmlFor="prompt">What would you like to color?</Label>
          <Textarea
            id="prompt"
            placeholder={artStyle === 'realistic_shading' 
              ? "e.g., A single apple with clear light and shadow zones..."
              : "e.g., A peaceful cat sleeping in a sunny window..."}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
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
