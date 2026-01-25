import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Upload, Loader2, ImageIcon, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BorderSelect from './BorderSelect';
import { applyBorderToImage } from '@/lib/applyBorderToImage';
import { convertToLineArt } from '@/lib/convertToLineArt';
import type { BorderTemplateId } from '@/lib/pageBorders';

interface ImageUploadConverterProps {
  bookId: string;
  onPageGenerated: (prompt: string, imageUrl: string, artStyle: string) => Promise<any>;
}

const ImageUploadConverter = ({ bookId: _bookId, onPageGenerated }: ImageUploadConverterProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [convertedPreview, setConvertedPreview] = useState<string | null>(null);
  const [border, setBorder] = useState<BorderTemplateId>('none');
  const [threshold, setThreshold] = useState([128]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file (JPG, PNG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setConvertedPreview(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConvert = async () => {
    if (!selectedFile) return;

    setConverting(true);
    try {
      const lineArt = await convertToLineArt(selectedFile, {
        threshold: threshold[0],
        invert: true,
        blur: 1,
      });
      setConvertedPreview(lineArt);
    } catch (err) {
      console.error('Conversion error:', err);
      toast({
        title: 'Conversion failed',
        description: err instanceof Error ? err.message : 'Failed to convert image',
        variant: 'destructive',
      });
    } finally {
      setConverting(false);
    }
  };

  const handleAddToBook = async () => {
    if (!convertedPreview || !selectedFile) return;

    setLoading(true);
    try {
      const imageWithBorder = await applyBorderToImage(convertedPreview, border);
      await onPageGenerated(
        `Converted from: ${selectedFile.name}`,
        imageWithBorder,
        'converted'
      );

      // Reset state
      setSelectedFile(null);
      setPreview(null);
      setConvertedPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast({
        title: 'Page added!',
        description: 'Your converted coloring page has been added to the book.',
      });
    } catch (err) {
      console.error('Add page error:', err);
      toast({
        title: 'Failed to add page',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setConvertedPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ImageIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Upload & Convert</h3>
          <p className="text-sm text-muted-foreground">Convert any image to clean line art</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* File Input */}
        <div className="space-y-2">
          <Label>Select Image</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <Upload className="mr-2 h-4 w-4" />
              {selectedFile ? selectedFile.name : 'Choose Image'}
            </Button>
            {selectedFile && (
              <Button variant="ghost" size="icon" onClick={handleClear}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Preview */}
        {preview && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Original</Label>
              <div className="aspect-square rounded-lg border bg-muted/30 overflow-hidden">
                <img
                  src={preview}
                  alt="Original"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Line Art</Label>
              <div className="aspect-square rounded-lg border bg-white overflow-hidden flex items-center justify-center">
                {convertedPreview ? (
                  <img
                    src={convertedPreview}
                    alt="Converted"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Click "Convert" to preview
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Threshold Slider */}
        {preview && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Sensitivity</Label>
              <span className="text-sm text-muted-foreground">{threshold[0]}</span>
            </div>
            <Slider
              value={threshold}
              onValueChange={setThreshold}
              min={50}
              max={200}
              step={10}
              disabled={converting}
            />
            <p className="text-xs text-muted-foreground">
              Lower = more detail, Higher = cleaner lines
            </p>
          </div>
        )}

        <BorderSelect value={border} onChange={setBorder} disabled={loading} />

        {/* Action Buttons */}
        {preview && (
          <div className="flex gap-2">
            <Button
              onClick={handleConvert}
              disabled={converting || !selectedFile}
              variant="secondary"
              className="flex-1"
            >
              {converting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Convert
                </>
              )}
            </Button>
            <Button
              onClick={handleAddToBook}
              disabled={loading || !convertedPreview}
              className="flex-1 glow-effect"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Add to Book
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploadConverter;
