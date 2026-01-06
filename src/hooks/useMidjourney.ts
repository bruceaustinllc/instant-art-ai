import { useState, useRef, useCallback } from 'react';
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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (taskId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('midjourney-generate', {
        body: { action: 'status', taskId },
      });

      if (error) throw error;

      console.log('Poll status:', data);

      if (data.status === 'finished' || data.status === 'Finished') {
        stopPolling();
        setResult({
          imageUrl: data.imageUrl,
          status: 'completed',
          progress: 100,
          error: null,
        });
        return;
      }

      if (data.status === 'failed' || data.status === 'Failed') {
        stopPolling();
        setResult({
          imageUrl: null,
          status: 'failed',
          progress: 0,
          error: 'Image generation failed',
        });
        return;
      }

      setResult(prev => ({
        ...prev,
        progress: data.progress || prev.progress,
      }));
    } catch (err) {
      console.error('Polling error:', err);
      stopPolling();
      setResult({
        imageUrl: null,
        status: 'failed',
        progress: 0,
        error: err instanceof Error ? err.message : 'Failed to check status',
      });
    }
  }, [stopPolling]);

  const generate = useCallback(async (prompt: string) => {
    stopPolling();
    setResult({
      imageUrl: null,
      status: 'processing',
      progress: 0,
      error: null,
    });

    try {
      const { data, error } = await supabase.functions.invoke('midjourney-generate', {
        body: { action: 'imagine', prompt },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      console.log('Generate response:', data);

      // Start polling for status
      pollingRef.current = setInterval(() => {
        pollStatus(data.taskId);
      }, 3000);

    } catch (err) {
      console.error('Generate error:', err);
      setResult({
        imageUrl: null,
        status: 'failed',
        progress: 0,
        error: err instanceof Error ? err.message : 'Failed to start generation',
      });
    }
  }, [pollStatus, stopPolling]);

  const upscale = useCallback(async (taskId: string, button: string) => {
    stopPolling();
    setResult(prev => ({
      ...prev,
      status: 'processing',
      progress: 0,
    }));

    try {
      const { data, error } = await supabase.functions.invoke('midjourney-generate', {
        body: { action: 'upscale', taskId, button },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Start polling for upscale status
      pollingRef.current = setInterval(() => {
        pollStatus(data.taskId);
      }, 3000);

    } catch (err) {
      console.error('Upscale error:', err);
      setResult(prev => ({
        ...prev,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Failed to upscale',
      }));
    }
  }, [pollStatus, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setResult({
      imageUrl: null,
      status: 'idle',
      progress: 0,
      error: null,
    });
  }, [stopPolling]);

  return {
    ...result,
    generate,
    upscale,
    reset,
    isLoading: result.status === 'processing',
  };
};
