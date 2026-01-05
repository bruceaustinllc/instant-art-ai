import { Sparkles } from "lucide-react";

const Header = () => {
  return (
    <header className="text-center space-y-4 animate-fade-in">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
        <Sparkles className="w-4 h-4" />
        Powered by Midjourney
      </div>
      
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">
        <span className="gradient-text">Instant MJ</span>
      </h1>
      
      <p className="text-muted-foreground text-lg max-w-md mx-auto">
        Transform your ideas into stunning visuals with AI-powered image generation
      </p>
    </header>
  );
};

export default Header;
