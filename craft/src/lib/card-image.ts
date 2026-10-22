'use client';

import type { CardData } from '@/components/card/membership-card';

export interface CardImageLabels {
  product: string;
  brandLine: string;
  tierBadge: string;
  nameLabel: string;
  classification: string;
  memberNo: string;
  since: string;
  active: string;
  scan: string;
  dir: 'rtl' | 'ltr';
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draws the member card to a PNG in the browser (canvas text shaping handles Arabic), so a craftsman
 * can save it to the gallery or send it on WhatsApp. Same layout as the on-screen card.
 */
export async function renderCardPng(data: CardData, l: CardImageLabels): Promise<Blob | null> {
  const W = 1012;
  const H = 638;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const mono = `"Space Grotesk", ${font}`;
  const rtl = l.dir === 'rtl';
  const start = (x: number) => (rtl ? W - x : x);
  const P = 56;

  // Body: deep navy with a warm light from the top corner and a thin gold rim.
  roundRect(ctx, 0, 0, W, H, 40);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#00152a';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(rtl ? W : 0, 0, 0, rtl ? W : 0, 0, W * 0.75);
  glow.addColorStop(0, 'rgba(251,191,36,0.22)');
  glow.addColorStop(1, 'rgba(251,191,36,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  roundRect(ctx, 1, 1, W - 2, H - 2, 40);
  ctx.strokeStyle = 'rgba(251,191,36,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.direction = l.dir;
  ctx.textBaseline = 'alphabetic';

  // Brand row
  const logo = await loadImage('/icon.svg');
  const logoX = rtl ? W - P - 72 : P;
  if (logo) ctx.drawImage(logo, logoX, P - 6, 72, 72);
  ctx.textAlign = 'start';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 34px ${font}`;
  ctx.fillText(l.product, start(P + 90), P + 26);
  ctx.fillStyle = '#7a92b0';
  ctx.font = `500 22px ${font}`;
  ctx.fillText(l.brandLine, start(P + 90), P + 60);
  ctx.textAlign = 'end';
  ctx.font = `700 22px ${font}`;
  const badgeW = ctx.measureText(l.tierBadge).width + 40;
  const bx = rtl ? P : W - P - badgeW;
  roundRect(ctx, bx, P + 4, badgeW, 44, 22);
  ctx.fillStyle = 'rgba(251,191,36,0.16)';
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.textAlign = 'center';
  ctx.fillText(l.tierBadge, bx + badgeW / 2, P + 34);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(P, P + 92, W - 2 * P, 2);

  // Photo, name, classification
  const photoSize = 168;
  const py = 200;
  const px = rtl ? W - P - photoSize : P;
  roundRect(ctx, px, py, photoSize, photoSize, 32);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  const photo = data.photoUrl ? await loadImage(data.photoUrl) : null;
  ctx.save();
  roundRect(ctx, px + 8, py + 8, photoSize - 16, photoSize - 16, 26);
  ctx.clip();
  if (photo) {
    const side = Math.min(photo.width, photo.height);
    ctx.drawImage(photo, (photo.width - side) / 2, (photo.height - side) / 2, side, side, px + 8, py + 8, photoSize - 16, photoSize - 16);
  } else {
    ctx.fillStyle = '#102a43';
    ctx.fillRect(px, py, photoSize, photoSize);
    ctx.fillStyle = '#f9bd22';
    ctx.font = `700 60px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(data.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join(''), px + photoSize / 2, py + photoSize / 2 + 22);
  }
  ctx.restore();

  const tx = P + photoSize + 32;
  ctx.textAlign = 'start';
  ctx.fillStyle = '#7a92b0';
  ctx.font = `500 22px ${font}`;
  ctx.fillText(l.nameLabel, start(tx), py + 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 46px ${font}`;
  ctx.fillText(data.name, start(tx), py + 92, W - tx - P - 200);
  ctx.fillStyle = '#b0c9e8';
  ctx.font = `500 24px ${font}`;
  ctx.fillText(l.classification, start(tx), py + 134, W - tx - P - 200);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(data.city, start(tx), py + 168);

  // QR tile on the far side
  const qr = await loadImage(`/api/v1/craftsmen/${data.code}/qr?target=profile&src=qr`);
  const q = 168;
  const qx = rtl ? P : W - P - q;
  roundRect(ctx, qx, py - 6, q, q + 34, 22);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  if (qr) ctx.drawImage(qr, qx + 14, py + 8, q - 28, q - 28);
  ctx.fillStyle = '#102a43';
  ctx.font = `600 18px ${font}`;
  ctx.textAlign = 'center';
  ctx.fillText(l.scan, qx + q / 2, py + q + 16);

  // Member number and validity
  ctx.textAlign = 'start';
  ctx.fillStyle = '#7a92b0';
  ctx.font = `500 22px ${font}`;
  ctx.fillText(l.memberNo, start(P), H - P - 74);
  ctx.fillStyle = '#f9bd22';
  ctx.font = `700 64px ${mono}`;
  ctx.save();
  ctx.direction = 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.fillText(data.code.replace(/(\d{3})(?=\d)/g, '$1 '), rtl ? W - P : P, H - P - 6);
  ctx.restore();
  ctx.textAlign = 'end';
  ctx.fillStyle = '#7a92b0';
  ctx.font = `500 22px ${font}`;
  ctx.fillText(l.active, start(W - P), H - P - 40);
  ctx.fillText(l.since, start(W - P), H - P - 6);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
