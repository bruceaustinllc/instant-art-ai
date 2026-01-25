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

export interface PuterGenerationResult {
  imageUrl: string;
}

/**
 * Generate an image using Puter's free AI image generation
 * Uses gpt-image-1-mini (default) for free generation
 */
export async function generateImageWithPuter(prompt: string): Promise<PuterGenerationResult> {
  if (!window.puter?.ai?.txt2img) {
    throw new Error('Puter.js is not loaded. Please refresh the page.');
  }

  try {
    // Use default model (gpt-image-1-mini) which is free
    // The txt2img function returns an HTMLImageElement
    const imgElement = await window.puter.ai.txt2img(prompt);

    // Wait for the image to be fully loaded
    await new Promise<void>((resolve, reject) => {
      if (imgElement.complete && imgElement.naturalWidth > 0) {
        resolve();
      } else {
        imgElement.onload = () => resolve();
        imgElement.onerror = () => reject(new Error('Failed to load generated image'));
        // Timeout after 30 seconds
        setTimeout(() => reject(new Error('Image generation timed out')), 30000);
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
    if (error instanceof Error) {
      // Check for specific Puter errors
      if (error.message.includes('not logged in') || error.message.includes('authentication')) {
        throw new Error('Please log in to Puter to generate images (click the Puter popup that appears)');
      }
      throw error;
    }
    throw new Error('Failed to generate image with Puter. Please try again.');
  }
}
