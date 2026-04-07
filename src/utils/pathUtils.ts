import { PathPoint, PositionPx } from '../types';

/**
 * Build a smooth SVG path string through a set of pixel-space points.
 * Uses cardinal spline (Catmull-Rom) interpolation so the curve passes
 * through every waypoint with smooth tangents.
 *
 * Returns an array of SVG path data strings, one per continuous solid/dotted
 * segment group, along with the dasharray for each.
 */
export type SegmentPath = {
  d: string;
  isDotted: boolean;
};

export function buildSegmentPaths(pointsPx: PositionPx[]): SegmentPath[] {
  if (pointsPx.length < 2) return [];

  const segments: SegmentPath[] = [];
  let groupStart = 0;

  for (let i = 1; i <= pointsPx.length; i++) {
    const isDotted = pointsPx[i]?.previousLineType === 'dotted';
    const prevIsDotted = pointsPx[i - 1]?.previousLineType === 'dotted';

    const isEnd = i === pointsPx.length;
    const typeChanged = !isEnd && isDotted !== prevIsDotted;

    if (isEnd || typeChanged) {
      const group = pointsPx.slice(groupStart, i);
      segments.push({
        d: smoothPath(group),
        isDotted: group[1]?.previousLineType === 'dotted',
      });
      groupStart = i - 1; // next group shares endpoint
    }
  }

  return segments;
}

/**
 * Generate a smooth SVG cubic bezier path through the given pixel points.
 * Tension controls how tightly the curve follows straight lines (0 = very curved).
 */
function smoothPath(pts: PositionPx[], tension = 0.12): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x} ${p2.y}`;
  }

  return d;
}

/**
 * Compute a label position near the start of the path (below the first point).
 */
export function getLabelPosition(
  points: PathPoint[],
  toPixel: (p: PathPoint) => { x: number; y: number },
): { x: number; y: number } | null {
  if (!points.length) return null;
  return toPixel(points[0]);
}
