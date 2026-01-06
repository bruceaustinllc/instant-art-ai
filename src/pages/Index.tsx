import Header from "@/components/Header";
import PromptInput from "@/components/PromptInput";
import ImageDisplay from "@/components/ImageDisplay";
import LoadingState from "@/components/LoadingState";
import { useToast } from "@/hooks/use-toast";
import { useMidjourney } from "@/hooks/useMidjourney";
import { useEffect } from "react";

const Index = () => {
  const { toast } = useToast();
  const { 
    imageUrl, 
    status, 
    progress, 
    error, 
    generate, 
    reset, 
    isLoading 
  } = useMidjourney();

  useEffect(() => {
    if (status === 'completed' && imageUrl) {
      toast({
        title: "Image generated!",
        description: "Your creation is ready.",
      });
    }
    if (status === 'failed' && error) {
      toast({
        title: "Generation failed",
        description: error,
        variant: "destructive",
      });
    }
  }, [status, imageUrl, error, toast]);

  const handleGenerate = (prompt: string) => {
    generate(prompt);
  };

  const handleUpscale = () => {
    toast({
      title: "Upscale coming soon",
      description: "This feature will be available once you have a generated image.",
    });
  };

  const handleNewImage = () => {
    reset();
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
          
          {status === 'idle' && (
            <PromptInput onGenerate={handleGenerate} isLoading={isLoading} />
          )}
          
          {isLoading && <LoadingState progress={progress} />}
          
          {status === 'completed' && imageUrl && (
            <>
              <ImageDisplay
                imageUrl={imageUrl}
                prompt=""
                onUpscale={handleUpscale}
                onNewImage={handleNewImage}
                isUpscaling={false}
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
