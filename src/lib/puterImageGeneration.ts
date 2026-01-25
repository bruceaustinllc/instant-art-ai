// Puter.js image generation utility
// Uses the free "User-Pays" model where users authenticate with Puter

declare global {
  interface Window {
    puter: {
      ai: {
        txt2img: (prompt: string, options?: { model?: string }) => Promise<HTMLImageElement>;
      };
    };
  }
}

export interface PuterGenerationResult {
  imageUrl: string;
}

/**
 * Generate an image using Puter's free AI image generation
 * Uses the FLUX.1-schnell model for fast, free generation
 */
export async function generateImageWithPuter(prompt: string): Promise<PuterGenerationResult> {
  if (!window.puter?.ai?.txt2img) {
    throw new Error('Puter.js is not loaded. Please refresh the page.');
  }

  try {
    // Use FLUX.1-schnell for free, fast generation
    const imgElement = await window.puter.ai.txt2img(prompt, {
      model: 'black-forest-labs/FLUX.1-schnell',
    });

    // Convert the image element to a data URL
    const canvas = document.createElement('canvas');
    canvas.width = imgElement.naturalWidth || imgElement.width || 1024;
    canvas.height = imgElement.naturalHeight || imgElement.height || 1024;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }
    
    ctx.drawImage(imgElement, 0, 0);
    const imageUrl = canvas.toDataURL('image/png');

    return { imageUrl };
  } catch (error) {
    console.error('Puter image generation error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate image with Puter');
  }
}
