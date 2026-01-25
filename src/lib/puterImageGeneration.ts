// Puter.js image generation utility
// Uses the free "User-Pays" model where users authenticate with Puter

declare global {
  interface Window {
    puter: {
      ai: {
        txt2img: (prompt: string, options?: Record<string, unknown>) => Promise<HTMLImageElement>;
      };
    };
  }
}

export type ImageModel = 
  | 'dall-e-3'
  | 'stabilityai/stable-diffusion-3-medium'
  | 'black-forest-labs/FLUX.1-schnell'
  | 'gpt-image-1'
  | 'gpt-image-1-mini';

export interface PuterGenerationOptions {
  model?: ImageModel;
  quality?: 'low' | 'medium' | 'high' | 'hd';
}

export interface PuterGenerationResult {
  imageUrl: string;
}

/**
 * Generate an image using Puter's free AI image generation
 * Uses DALL-E 3 for high quality adult coloring pages by default
 */
export async function generateImageWithPuter(
  prompt: string, 
  options: PuterGenerationOptions = {}
): Promise<PuterGenerationResult> {
  if (!window.puter?.ai?.txt2img) {
    throw new Error('Puter.js is not loaded. Please refresh the page.');
  }

  // Use DALL-E 3 with HD quality for detailed adult coloring pages
  const model = options.model || 'dall-e-3';
  const quality = options.quality || 'hd';

  // Puter is sometimes sensitive to very long / heavily formatted prompts.
  // Keep it as a single line and within a reasonable length.
  const safePrompt = String(prompt ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);

  if (!safePrompt) {
    throw new Error('Please enter a prompt first.');
  }

  try {
    const result = await window.puter.ai.txt2img(safePrompt, {
      model,
      quality,
    });

    // Puter sometimes throws/rejects with a plain object like:
    // { success: false, error: "..." }
    const anyResult: any = result as any;
    if (anyResult && typeof anyResult === 'object' && anyResult.success === false) {
      const msg =
        typeof anyResult.error === 'string'
          ? anyResult.error
          : anyResult.error?.message
            ? String(anyResult.error.message)
            : 'Puter failed to generate an image.';
      throw new Error(msg);
    }

    // Normal successful path: HTMLImageElement
    const imgElement = result as unknown as HTMLImageElement;

    // Wait for the image to be fully loaded
    await new Promise<void>((resolve, reject) => {
      if (imgElement.complete && imgElement.naturalWidth > 0) {
        resolve();
      } else {
        imgElement.onload = () => resolve();
        imgElement.onerror = () => reject(new Error('Failed to load generated image'));
        // Timeout after 60 seconds for HD images
        setTimeout(() => reject(new Error('Image generation timed out')), 60000);
      }
    });

    // The imgElement.src already contains a data URL
    const imageUrl = imgElement.src;

    if (!imageUrl || !imageUrl.startsWith('data:')) {
      throw new Error('No valid image data received from Puter');
    }

    return { imageUrl };
  } catch (error) {
    console.error('Puter image generation error:', error);

    // If Puter gives us a plain object, surface its message.
    const anyErr: any = error as any;
    if (anyErr && typeof anyErr === 'object' && typeof anyErr.error === 'string') {
      throw new Error(anyErr.error);
    }

    if (error instanceof Error) {
      const msg = error.message || 'Failed to generate image with Puter.';
      if (msg.toLowerCase().includes('not logged in') || msg.toLowerCase().includes('authentication')) {
        throw new Error('Please log in to Puter to generate images (a Puter popup may appear).');
      }
      if (msg.toLowerCase().includes('first argument must be of type string')) {
        throw new Error('Puter did not return a usable image. Please try again (or shorten your prompt).');
      }
      throw new Error(msg);
    }

    throw new Error('Failed to generate image with Puter. Please try again.');
  }
}
