import { ProjectState, Route, Size } from '../types';
import { buildSegmentPaths } from './pathUtils';
import { getGradeColor, getOverlaySizes, getRouteLabelLayout } from '../constants';
import { resolveLabels, RouteLayoutInfo } from './labelLayout';
import { writeTextToDir, writeBlobToDir } from './fsApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip directory and extension, e.g. "photos/wall.jpg" → "wall" */
function baseName(filePath: string): string {
  const name = filePath.split(/[/\\]/).pop() ?? filePath;
  return name.replace(/\.[^.]+$/, '');
}

// ── Save ─────────────────────────────────────────────────────────────────────
// Image is NOT embedded — save only the filename. Load image separately.

export async function saveProject({
  imagePath,
  routes,
  overlayScale,
  dirHandle,
}: {
  imagePath: string;
  imageDataUrl: string | null; // ignored — kept for call-site compat
  imageSize: Size;             // ignored
  routes: Route[];
  overlayScale: number;
  dirHandle?: FileSystemDirectoryHandle | null;
}): Promise<void> {
  const filename = (baseName(imagePath) || 'beta-creator-project') + '.json';
  const text = JSON.stringify({ version: 1, imagePath, routes, overlayScale } as ProjectState, null, 2);

  if (dirHandle) {
    await writeTextToDir(dirHandle, filename, text);
    return;
  }
  // Fallback: browser download
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Load ─────────────────────────────────────────────────────────────────────

export function loadProject(
  json: unknown,
  _setImage: (dataUrl: string, path: string, size: Size) => void,
  setRoutes: (routes: Route[]) => void,
  setOverlayScale: (s: number) => void,
): string {
  const state = json as ProjectState;
  if (state.version !== 1) throw new Error('Unknown project version');
  setRoutes(state.routes ?? []);
  if (state.overlayScale != null) setOverlayScale(state.overlayScale);
  // Return the saved image filename so the UI can prompt the user
  return state.imagePath ?? '';
}

// ── Label collision resolution ────────────────────────────────────────────────

function resolveExportLabels(
  routes: Route[],
  imageSize: Size,
  mm: number,
): Map<string, { px: number; py: number }> {
  const infos: RouteLayoutInfo[] = routes.map((route) => {
    const fp = route.pitches[0];
    const sp = fp?.points[0];
    if (!sp) return { routeId: route.id, startX: 0, startY: 0, w: 0, totalH: 0, valid: false, segments: [] };
    const { w, totalH } = getRouteLabelLayout(mm, String(route.number).length, route.grade);
    return {
      routeId: route.id,
      startX: (sp.x / 100) * imageSize.width,
      startY: (sp.y / 100) * imageSize.height,
      w, totalH, valid: true, segments: [],
    };
  });
  const positions = resolveLabels(infos, mm, imageSize.width, imageSize.height);
  const result = new Map<string, { px: number; py: number }>();
  for (const [id, pos] of positions) result.set(id, { px: pos.x, py: pos.y });
  return result;
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportImage({
  imageDataUrl,
  imageSize,
  routes,
  overlayScale,
  imagePath,
  dirHandle,
}: {
  imageDataUrl: string;
  imageSize: Size;
  routes: Route[];
  overlayScale: number;
  imagePath: string;
  dirHandle?: FileSystemDirectoryHandle | null;
}) {
  const canvas = document.createElement('canvas');
  canvas.width = imageSize.width;
  canvas.height = imageSize.height;
  const ctx = canvas.getContext('2d')!;

  const img = await loadImg(imageDataUrl);
  ctx.drawImage(img, 0, 0, imageSize.width, imageSize.height);

  const sizes = getOverlaySizes(imageSize.width, overlayScale);

  // Helper: compute display points for a pitch (auto-join from previous pitch end)
  function getDisplayPts(route: Route, pitchIdx: number) {
    const pitch = route.pitches[pitchIdx];
    const prevPitch = pitchIdx > 0 ? route.pitches[pitchIdx - 1] : null;
    const joinPt = prevPitch?.points[prevPitch.points.length - 1];
    const displayPoints = joinPt
      ? [{ ...joinPt, previousLineType: pitch.points[0]?.previousLineType ?? 'solid' as const }, ...pitch.points]
      : pitch.points;
    return displayPoints.map((p) => ({
      x: (p.x / 100) * imageSize.width,
      y: (p.y / 100) * imageSize.height,
      units: 'px' as const,
      previousLineType: p.previousLineType,
    }));
  }

  const dashArr = [0.6 * sizes.pxPerMm, 1.4 * sizes.pxPerMm];

  // ── Pass 1: draw all route lines ────────────────────────────────────────────
  for (const route of routes) {
    for (let pitchIdx = 0; pitchIdx < route.pitches.length; pitchIdx++) {
      const pitch = route.pitches[pitchIdx];
      if (pitch.points.length < 1) continue;
      const pitchColor = getGradeColor(pitch.grade || route.grade);
      const ptsPx = getDisplayPts(route, pitchIdx);
      if (ptsPx.length < 2) continue;
      const segments = buildSegmentPaths(ptsPx);
      for (const seg of segments) {
        drawPath(ctx, seg.d, 'rgba(0,0,0,0.65)', sizes.borderPx, seg.isDotted, dashArr);
        drawPath(ctx, seg.d, pitchColor, sizes.strokePx, seg.isDotted, dashArr);
      }
    }
  }

  const labelPositions = resolveExportLabels(routes, imageSize, sizes.pxPerMm);

  // ── Pass 2: draw all decorations on top of lines ────────────────────────────
  for (const route of routes) {
    for (let pitchIdx = 0; pitchIdx < route.pitches.length; pitchIdx++) {
      const pitch = route.pitches[pitchIdx];
      if (pitch.points.length < 1) continue;
      const isLastPitch = pitchIdx === route.pitches.length - 1;
      const ptsPx = getDisplayPts(route, pitchIdx);

      // Manual station markers
      for (const pt of pitch.points) {
        if (!pt.isPitchStation) continue;
        drawStation(ctx, (pt.x / 100) * imageSize.width, (pt.y / 100) * imageSize.height, sizes);
      }

      // End-of-pitch marker
      const lastPt = pitch.points[pitch.points.length - 1];
      if (lastPt && !lastPt.isPitchStation) {
        const lx = (lastPt.x / 100) * imageSize.width;
        const ly = (lastPt.y / 100) * imageSize.height;
        if (isLastPitch) {
          drawStation(ctx, lx, ly, sizes, true);
        } else {
          drawPitchRect(ctx, lx, ly, pitchIdx + 2, sizes);
        }
      }

      // Pitch grade label at midpoint
      if (pitch.grade && ptsPx.length >= 2) {
        const midPx = ptsPx[Math.floor(ptsPx.length / 2)];
        if (midPx) drawPitchGrade(ctx, midPx.x + 1.8 * sizes.pxPerMm, midPx.y, pitch.grade, getGradeColor(pitch.grade as any), sizes);
      }
    }

    // Route number + grade label at resolved position (collision-avoided)
    const lp = labelPositions.get(route.id);
    if (lp) drawRouteLabel(ctx, lp.px, lp.py, route.number, route.grade, getGradeColor(route.grade), sizes);
  }

  const filename = (baseName(imagePath) || 'topo') + '_withRoutes.jpg';

  // Export as JPEG with medium compression (85% quality)
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    if (dirHandle) {
      await writeBlobToDir(dirHandle, filename, blob);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/jpeg', 0.85);
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  d: string,
  color: string,
  lineWidth: number,
  isDotted: boolean,
  dashArr: number[],
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(isDotted ? dashArr : []);
  ctx.stroke(new Path2D(d));
  ctx.restore();
}

type Sizes = ReturnType<typeof getOverlaySizes>;

function drawStation(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  sizes: Sizes,
  faded = false,
) {
  const a = sizes.anchorSize;
  const b = sizes.borderPx; // outline same thickness as route line border
  ctx.save();
  ctx.globalAlpha = faded ? 0.85 : 1;

  // White outline then red fill — Canvas lacks paintOrder, so draw outline first
  ctx.beginPath();
  ctx.moveTo(x, y + a);
  ctx.lineTo(x - a, y - a);
  ctx.lineTo(x + a, y - a);
  ctx.closePath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = b * (2 / 3);  // thinner outline matching SVG PitchStation
  ctx.lineJoin = 'miter';
  ctx.stroke();
  ctx.fillStyle = '#e53935';
  ctx.fill();

  ctx.restore();
}

function drawPitchRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  pitchNumber: number,
  sizes: Sizes,
) {
  const a = sizes.anchorSize;
  const mm = sizes.pxPerMm;
  const b = sizes.borderPx;
  const rw = a * 2;
  const rh = a * 3.5;
  const fontSize = a * 1.6;

  ctx.save();

  // White outline then red fill
  roundRect(ctx, x - rw / 2, y - rh / 2, rw, rh, 0.35 * mm);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = b * (2 / 3);
  ctx.stroke();
  ctx.fillStyle = '#e53935';
  ctx.fill();

  // Pitch number
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${fontSize}px Inter, Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(pitchNumber), x, y);

  ctx.restore();
}

function drawPitchGrade(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  grade: string, color: string, sizes: Sizes,
) {
  const mm = sizes.pxPerMm;
  const fs = sizes.gradeFontPx;
  const padH = 0.8 * mm;
  const padV = 0.5 * mm;
  const w = grade.length * fs * 0.62 + padH * 2;
  const h = fs + padV * 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, x - 0.2 * mm, y - h / 2 - 0.2 * mm, w + 0.4 * mm, h + 0.4 * mm, 0.6 * mm);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.88;
  roundRect(ctx, x, y - h / 2, w, h, 0.5 * mm);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#fff';
  ctx.font = `600 ${fs}px Inter, Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(grade, x + w / 2, y);
  ctx.restore();
}

function drawRouteLabel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  number: number, grade: string, gradeColor: string, sizes: Sizes,
) {
  const mm = sizes.pxPerMm;
  const fs = sizes.labelFontPx;
  const gradeFontSize = sizes.gradeFontPx;
  const { rectW, rectH, yOff, rx, outline, gradeW, gradeH, gradeGap } =
    getRouteLabelLayout(mm, String(number).length, grade);

  ctx.save();

  // Outline
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, x - rectW / 2 - outline / 2, y + yOff - outline / 2, rectW + outline, rectH + outline, rx);
  ctx.fill();

  // Fill (neutral dark)
  ctx.fillStyle = '#1a1a2e';
  roundRect(ctx, x - rectW / 2, y + yOff, rectW, rectH, rx * 0.8);
  ctx.fill();

  // Number
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${fs}px Inter, Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), x, y + yOff + rectH / 2);

  // Grade badge
  if (grade) {
    const gy = y + yOff + rectH + gradeGap;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, x - gradeW / 2 - outline / 2, gy - outline / 2, gradeW + outline, gradeH + outline, rx * 0.7);
    ctx.fill();

    ctx.fillStyle = gradeColor;
    ctx.globalAlpha = 0.9;
    roundRect(ctx, x - gradeW / 2, gy, gradeW, gradeH, rx * 0.6);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#fff';
    ctx.font = `600 ${gradeFontSize}px Inter, Roboto, sans-serif`;
    ctx.fillText(grade, x, gy + gradeH / 2);
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
