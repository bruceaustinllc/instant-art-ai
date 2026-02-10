import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MidjourneyResult {
  imageUrl: string | null;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  progress: number;
  error: string | null;
}

export const useMidjourney = () => {
  const [result, setResult] = useState<MidjourneyResult>({
    imageUrl: null,
    status: 'idle',
    progress: 0,
    error: null,
  });

  const generate = useCallback(async (prompt: string) => {
    setResult({
      imageUrl: null,
      status: 'processing',
      progress: 50,
      error: null,
    });

    try {
      const { data, error } = await supabase.functions.invoke('generate-coloring-page', {
        body: { action: 'imagine', prompt },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      console.log('Generate response:', data);

      // Lovable AI returns the image directly (synchronous)
      if (data.status === 'completed' && data.imageUrl) {
        setResult({
          imageUrl: data.imageUrl,
          status: 'completed',
          progress: 100,
          error: null,
        });
      } else {
        throw new Error('No image was generated');
      }

    } catch (err) {
      console.error('Generate error:', err);
      setResult({
        imageUrl: null,
        status: 'failed',
        progress: 0,
        error: err instanceof Error ? err.message : 'Failed to generate image',
      });
    }
  }, []);

  const upscale = useCallback(async (_taskId: string, _button: string) => {
    // Upscale not supported with Lovable AI
    setResult(prev => ({
      ...prev,
      error: 'Upscale is not available with this model',
    }));
  }, []);

  const reset = useCallback(() => {
    setResult({
      imageUrl: null,
      status: 'idle',
      progress: 0,
      error: null,
    });
  }, []);

  return {
    ...result,
    generate,
    upscale,
    reset,
    isLoading: result.status === 'processing',
  };
};
