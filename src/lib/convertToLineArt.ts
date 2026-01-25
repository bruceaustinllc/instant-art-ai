/**
 * Convert an image to clean line art suitable for coloring pages
 * Uses edge detection and thresholding for a sketch-like effect
 */

export interface LineArtOptions {
  threshold?: number; // 0-255, controls line darkness threshold
  invert?: boolean; // Invert colors (black lines on white)
  blur?: number; // Pre-blur amount for smoother edges
}

export async function convertToLineArt(
  imageSource: string | File,
  options: LineArtOptions = {}
): Promise<string> {
  const { threshold = 128, invert = true, blur = 1 } = options;

  // Load the image
  const img = await loadImage(imageSource);
  
  // Create canvas at reasonable size for coloring pages
  const maxSize = 1024;
  let width = img.width;
  let height = img.height;
  
  if (width > maxSize || height > maxSize) {
    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  // Draw and get image data
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Convert to grayscale first
  const grayscale = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    // Weighted grayscale conversion
    grayscale[i / 4] = Math.round(
      data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    );
  }

  // Apply optional blur for smoother edges
  const blurred = blur > 0 ? applyGaussianBlur(grayscale, width, height, blur) : grayscale;

  // Apply Sobel edge detection
  const edges = applySobelEdgeDetection(blurred, width, height);

  // Threshold and apply to image
  for (let i = 0; i < edges.length; i++) {
    const edgeValue = edges[i];
    const isEdge = edgeValue > threshold;
    
    // For coloring pages: black lines on white background
    const pixelValue = invert 
      ? (isEdge ? 0 : 255) // Black lines on white
      : (isEdge ? 255 : 0); // White lines on black
    
    const idx = i * 4;
    data[idx] = pixelValue;     // R
    data[idx + 1] = pixelValue; // G
    data[idx + 2] = pixelValue; // B
    data[idx + 3] = 255;        // A
  }

  ctx.putImageData(imageData, 0, 0);
  
  // Clean up thin lines and noise
  cleanupLineArt(ctx, width, height);
  
  return canvas.toDataURL('image/png');
}

function loadImage(source: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    
    if (source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(source);
    } else {
      img.src = source;
    }
  });
}

function applyGaussianBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(data.length);
  const kernel = createGaussianKernel(radius);
  const kSize = kernel.length;
  const kHalf = Math.floor(kSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let weightSum = 0;

      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const px = x + kx - kHalf;
          const py = y + ky - kHalf;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const weight = kernel[ky][kx];
            sum += data[py * width + px] * weight;
            weightSum += weight;
          }
        }
      }

      result[y * width + x] = Math.round(sum / weightSum);
    }
  }

  return result;
}

function createGaussianKernel(radius: number): number[][] {
  const size = radius * 2 + 1;
  const kernel: number[][] = [];
  const sigma = radius / 2;
  
  for (let y = 0; y < size; y++) {
    kernel[y] = [];
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      kernel[y][x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }
  
  return kernel;
}

function applySobelEdgeDetection(
  grayscale: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const edges = new Uint8ClampedArray(width * height);
  
  // Sobel kernels
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
  ];
  
  const sobelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1]
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = grayscale[(y + ky) * width + (x + kx)];
          gx += pixel * sobelX[ky + 1][kx + 1];
          gy += pixel * sobelY[ky + 1][kx + 1];
        }
      }

      // Magnitude of gradient
      edges[y * width + x] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }

  return edges;
}

function cleanupLineArt(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Apply slight dilation to thicken lines, then erosion to clean up
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const temp = new Uint8ClampedArray(data.length);

  // Copy data
  for (let i = 0; i < data.length; i++) {
    temp[i] = data[i];
  }

  // Dilation (thicken black lines)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Check if any neighbor is black
      let hasBlackNeighbor = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nIdx = ((y + dy) * width + (x + dx)) * 4;
          if (temp[nIdx] === 0) {
            hasBlackNeighbor = true;
            break;
          }
        }
        if (hasBlackNeighbor) break;
      }

      if (hasBlackNeighbor) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}
