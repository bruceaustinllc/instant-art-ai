import type { BorderTemplateId } from '@/lib/pageBorders';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function drawBorder(ctx: CanvasRenderingContext2D, w: number, h: number, border: BorderTemplateId) {
  if (border === 'none') return;

  // Use black strokes so it prints well as a coloring page.
  ctx.save();
  ctx.strokeStyle = '#000';
  ctx.fillStyle = '#000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const m = clamp(Math.round(Math.min(w, h) * 0.045), 18, 64); // margin
  const lw = clamp(Math.round(Math.min(w, h) * 0.006), 3, 12); // line width

  if (border === 'classic') {
    ctx.lineWidth = lw;
    ctx.setLineDash([]);
    ctx.strokeRect(m, m, w - m * 2, h - m * 2);
  }

  if (border === 'double') {
    ctx.lineWidth = lw;
    ctx.setLineDash([]);
    ctx.strokeRect(m, m, w - m * 2, h - m * 2);
    const gap = clamp(Math.round(lw * 2.5), 8, 24);
    ctx.strokeRect(m + gap, m + gap, w - (m + gap) * 2, h - (m + gap) * 2);
  }

  if (border === 'dotted') {
    ctx.lineWidth = lw;
    ctx.setLineDash([lw * 1.2, lw * 1.6]);
    ctx.strokeRect(m, m, w - m * 2, h - m * 2);
  }

  if (border === 'floral_corners') {
    // Subtle inner frame + corner vines
    ctx.lineWidth = lw;
    ctx.setLineDash([]);

    const inset = m;
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

    const cornerSize = clamp(Math.round(Math.min(w, h) * 0.12), 70, 160);
    const curl = cornerSize * 0.55;

    const drawCorner = (x: number, y: number, sx: 1 | -1, sy: 1 | -1) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx, sy);

      // Stem
      ctx.beginPath();
      ctx.moveTo(0, cornerSize);
      ctx.quadraticCurveTo(0, cornerSize * 0.35, curl * 0.65, curl * 0.65);
      ctx.quadraticCurveTo(cornerSize * 0.35, cornerSize * 0.35, cornerSize, 0);
      ctx.stroke();

      // Leaves
      const leaf = (lx: number, ly: number, r: number) => {
        ctx.beginPath();
        ctx.ellipse(lx, ly, r * 0.9, r * 0.55, -0.6, 0, Math.PI * 2);
        ctx.stroke();
      };
      leaf(cornerSize * 0.18, cornerSize * 0.72, lw * 3.3);
      leaf(cornerSize * 0.38, cornerSize * 0.5, lw * 3.1);
      leaf(cornerSize * 0.6, cornerSize * 0.3, lw * 2.9);

      // Small flower
      const fx = cornerSize * 0.32;
      const fy = cornerSize * 0.62;
      const pr = lw * 1.2;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(a) * pr * 1.8, fy + Math.sin(a) * pr * 1.8, pr * 1.3, pr * 0.9, a, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(fx, fy, pr * 0.75, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    };

    drawCorner(inset, inset, 1, 1);
    drawCorner(w - inset, inset, -1, 1);
    drawCorner(inset, h - inset, 1, -1);
    drawCorner(w - inset, h - inset, -1, -1);
  }

  ctx.restore();
}

export async function applyBorderToImage(imageUrl: string, border: BorderTemplateId): Promise<string> {
  if (!border || border === 'none') return imageUrl;

  return await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageUrl);

        // Base image
        ctx.drawImage(img, 0, 0);

        // Border overlay
        drawBorder(ctx, canvas.width, canvas.height, border);

        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageUrl);
      }
    };

    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
}
