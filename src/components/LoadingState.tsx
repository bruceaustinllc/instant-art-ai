import { Sparkles } from "lucide-react";

const LoadingState = () => {
  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in">
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Shimmer placeholder for image */}
        <div className="aspect-square w-full animate-shimmer flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center animate-pulse-glow">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-foreground font-medium">Creating your image...</p>
              <p className="text-muted-foreground text-sm">This may take a moment</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
