import { Button } from "@/components/ui/button";
import { ArrowUpCircle, RefreshCw, Download } from "lucide-react";

interface ImageDisplayProps {
  imageUrl: string;
  prompt: string;
  onUpscale: () => void;
  onNewImage: () => void;
  isUpscaling: boolean;
}

const ImageDisplay = ({ 
  imageUrl, 
  prompt, 
  onUpscale, 
  onNewImage,
  isUpscaling 
}: ImageDisplayProps) => {
  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `instant-mj-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto animate-scale-in">
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Image */}
        <div className="relative group">
          <img
            src={imageUrl}
            alt={prompt}
            className="w-full h-auto object-cover"
          />
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <Button
              variant="glass"
              size="lg"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="w-5 h-5" />
              Download
            </Button>
          </div>
        </div>
        
        {/* Prompt and actions */}
        <div className="p-6 space-y-4">
          <p className="text-muted-foreground text-sm line-clamp-2">
            {prompt}
          </p>
          
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={onUpscale}
              disabled={isUpscaling}
              className="flex-1 sm:flex-none"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Upscale
            </Button>
            
            <Button
              variant="glass"
              onClick={onNewImage}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className="w-4 h-4" />
              New Image
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageDisplay;
