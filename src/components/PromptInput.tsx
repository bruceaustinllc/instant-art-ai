import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface PromptInputProps {
  onGenerate: (prompt: string) => void;
  isLoading: boolean;
}

const PromptInput = ({ onGenerate, isLoading }: PromptInputProps) => {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isLoading) {
      onGenerate(prompt.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="glass-card rounded-2xl p-6 space-y-4 animate-fade-in">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe the image you want to create..."
          className="bg-secondary/50 border-border/50 min-h-[120px] text-lg"
          disabled={isLoading}
        />
        
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground hidden sm:block">
            Press <kbd className="px-2 py-1 rounded bg-secondary text-xs">⌘</kbd> + <kbd className="px-2 py-1 rounded bg-secondary text-xs">Enter</kbd> to generate
          </p>
          
          <Button
            type="submit"
            variant="glow"
            size="lg"
            disabled={!prompt.trim() || isLoading}
            className="ml-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default PromptInput;
