/**
 * Add a white bleed margin around an image for KDP printing
 * Standard bleed is 0.125 inches on each side
 */

const BLEED_RATIO = 0.03; // ~3% margin on each side for 0.125" bleed on 8.5x11

export async function addBleedMargin(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Calculate new dimensions with bleed
        const bleedX = Math.round(img.width * BLEED_RATIO);
        const bleedY = Math.round(img.height * BLEED_RATIO);
        const newWidth = img.width + bleedX * 2;
        const newHeight = img.height + bleedY * 2;

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Fill with white for the bleed area
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, newWidth, newHeight);

        // Draw the image centered (leaving bleed margins)
        ctx.drawImage(img, bleedX, bleedY, img.width, img.height);

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for bleed processing'));
    img.src = imageUrl;
  });
}

/**
 * Remove bleed by cropping to fill the entire canvas
 * This makes the image fill the full page edge-to-edge
 */
export async function removeBleedMargin(imageUrl: string): Promise<string> {
  // For no-bleed, we just return the original image
  // The image already fills the page
  return imageUrl;
}
