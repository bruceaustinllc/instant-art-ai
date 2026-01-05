import { useState } from "react";
import Header from "@/components/Header";
import PromptInput from "@/components/PromptInput";
import ImageDisplay from "@/components/ImageDisplay";
import LoadingState from "@/components/LoadingState";
import { useToast } from "@/hooks/use-toast";

interface GeneratedImage {
  url: string;
  prompt: string;
}

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const { toast } = useToast();

  const handleGenerate = async (prompt: string) => {
    setIsLoading(true);
    
    try {
      // TODO: Replace with actual Midjourney webhook integration
      // For now, simulate with a placeholder response
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Placeholder image for demo
      setGeneratedImage({
        url: `https://picsum.photos/seed/${Date.now()}/1024/1024`,
        prompt,
      });
      
      toast({
        title: "Image generated!",
        description: "Your creation is ready.",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpscale = async () => {
    setIsUpscaling(true);
    
    try {
      // TODO: Implement upscale via webhook
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Upscale complete!",
        description: "Your image has been enhanced.",
      });
    } catch (error) {
      toast({
        title: "Upscale failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleNewImage = () => {
    setGeneratedImage(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background gradient effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <main className="flex-1 container mx-auto px-4 py-12 sm:py-16 md:py-20">
        <div className="space-y-12 sm:space-y-16">
          <Header />
          
          {!generatedImage && !isLoading && (
            <PromptInput onGenerate={handleGenerate} isLoading={isLoading} />
          )}
          
          {isLoading && <LoadingState />}
          
          {generatedImage && !isLoading && (
            <>
              <ImageDisplay
                imageUrl={generatedImage.url}
                prompt={generatedImage.prompt}
                onUpscale={handleUpscale}
                onNewImage={handleNewImage}
                isUpscaling={isUpscaling}
              />
              
              <PromptInput onGenerate={handleGenerate} isLoading={isLoading} />
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-muted-foreground text-sm">
        <p>Built with ✨ Instant MJ</p>
      </footer>
    </div>
  );
};

export default Index;
