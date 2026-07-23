/**
 * Canvas (export) rendering for annotations — area highlights, text labels,
 * arrows, dashed trails. Mirrors the SVG components under components/svg/
 * (AreaAnnotation.tsx, TextAnnotationView.tsx, etc.) so the exported JPEG
 * matches the live editor exactly (same mm-based sizing via getOverlaySizes).
 */
import { Annotation } from '../types';
import { getAnnotationOutlineColor } from '../constants';

type Sizes = { pxPerMm: number; strokePx: number; borderPx: number };
type Size = { width: number; height: number };

function px(p: { x: number; y: number }, imageSize: Size) {
  return { x: (p.x / 100) * imageSize.width, y: (p.y / 100) * imageSize.height };
}

export function drawAnnotationsToCanvas(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  imageSize: Size,
  sizes: Sizes,
) {
  for (const a of annotations) {
    if (a.type === 'area') drawArea(ctx, a.points.map((p) => px(p, imageSize)), a.color);
    else if (a.type === 'trail') drawTrail(ctx, a.points.map((p) => px(p, imageSize)), a.color, sizes);
    else if (a.type === 'arrow') drawArrow(ctx, px(a.from, imageSize), px(a.to, imageSize), a.color, sizes);
    else if (a.type === 'text') drawText(ctx, px(a, imageSize), a.text, a.textAr, a.color, a.fontSize, a.rotation, sizes);
  }
}

function drawArea(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], color: string) {
  if (pts.length < 2) return;
  const outline = getAnnotationOutlineColor(color);
  const isBlack = color.toLowerCase() === '#000000';
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  // Black fill has no natural contrast against its own boundary — add a
  // white halo stroke underneath the usual color stroke (matches
  // AreaAnnotationView.tsx's isBlack branch).
  if (isBlack) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.28;
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  color: string,
  sizes: Sizes,
) {
  if (pts.length < 2) return;
  const mm = sizes.pxPerMm;
  const dash = [0.9 * mm, 0.9 * mm];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  // Outline first (contrast against any background), then dashed color line on top.
  ctx.strokeStyle = getAnnotationOutlineColor(color);
  ctx.lineWidth = 0.9 * mm;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5 * mm;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.restore();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  sizes: Sizes,
) {
  const mm = sizes.pxPerMm;
  const lineW = 0.55 * mm;
  const headLen = 2.6 * mm;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const outline = getAnnotationOutlineColor(color);

  ctx.save();
  // Outline for contrast, matching route-line convention.
  ctx.strokeStyle = outline;
  ctx.lineWidth = lineW + 0.9 * mm;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  // Arrowhead
  const a1 = angle + Math.PI - Math.PI / 7;
  const a2 = angle + Math.PI + Math.PI / 7;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x + headLen * Math.cos(a1), to.y + headLen * Math.sin(a1));
  ctx.lineTo(to.x + headLen * Math.cos(a2), to.y + headLen * Math.sin(a2));
  ctx.closePath();
  ctx.fillStyle = outline;
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  text: string,
  textAr: string | undefined,
  color: string,
  fontSizeMul: number,
  rotation: number | undefined,
  sizes: Sizes,
) {
  const mm = sizes.pxPerMm;
  const fs = 3.2 * mm * fontSizeMul;
  const lines = [text, textAr].filter((t): t is string => !!t && t.length > 0);
  if (lines.length === 0) return;

  ctx.save();
  if (rotation) {
    ctx.translate(pos.x, pos.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-pos.x, -pos.y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  lines.forEach((line, i) => {
    const font = i === 1 ? `600 ${fs}px 'Noto Kufi Arabic', Arial, sans-serif` : `700 ${fs}px Inter, Roboto, sans-serif`;
    ctx.font = font;
    const y = pos.y + (i - (lines.length - 1) / 2) * fs * 1.25;
    // High-contrast outline so text reads over any photo background.
    ctx.strokeStyle = getAnnotationOutlineColor(color);
    ctx.lineWidth = fs * 0.22;
    ctx.strokeText(line, pos.x, y);
    ctx.fillStyle = color;
    ctx.fillText(line, pos.x, y);
  });

  ctx.restore();
}
