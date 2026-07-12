/**
 * Shared route-label placement algorithm used by both the SVG web overlay
 * (RoutesLayer.tsx) and the canvas PNG export (fileUtils.ts).
 *
 * Pass segments=[] when path-overlap checking is not available (export).
 */
import { getRouteLabelLayout } from '../constants';

export type Seg = { x1: number; y1: number; x2: number; y2: number };

export type RouteLayoutInfo = {
  routeId: string;
  startX: number;
  startY: number;
  w: number;
  totalH: number;
  valid: boolean;
  segments: Seg[];
};

function segmentIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  left: number, top: number, right: number, bottom: number,
): boolean {
  if (x1 >= left && x1 <= right && y1 >= top && y1 <= bottom) return true;
  if (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom) return true;
  const dx = x2 - x1, dy = y2 - y1;
  let tMin = 0, tMax = 1;
  for (const [p, q] of [[-dx, x1 - left], [dx, right - x1], [-dy, y1 - top], [dy, bottom - y1]] as [number, number][]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > tMin) tMin = t; } else { if (t < tMax) tMax = t; }
    if (tMin > tMax) return false;
  }
  return true;
}

export function resolveLabels(
  infos: RouteLayoutInfo[],
  mm: number,
  imageWidth: number,
  imageHeight: number,
): Map<string, { x: number; y: number }> {
  const ROW_GAP = 0.1 * mm;
  const CLUSTER_DIST = 3 * mm;
  const { yOff } = getRouteLabelLayout(mm, 1, '');

  type Placed = { x: number; y: number; w: number; totalH: number };

  function getLabelBox(x: number, y: number, w: number, totalH: number) {
    return { left: x - w / 2, top: y + yOff, right: x + w / 2, bottom: y + totalH };
  }

  function overlapsOtherPaths(x: number, y: number, w: number, totalH: number, skipIdx: number): boolean {
    const { left, top, right, bottom } = getLabelBox(x, y, w, totalH);
    for (let i = 0; i < infos.length; i++) {
      if (i === skipIdx) continue;
      for (const seg of infos[i].segments) {
        if (segmentIntersectsRect(seg.x1, seg.y1, seg.x2, seg.y2, left, top, right, bottom)) return true;
      }
    }
    return false;
  }

  function overlapsPlaced(x: number, y: number, w: number, totalH: number, placed: Placed[]): boolean {
    const a = getLabelBox(x, y, w, totalH);
    for (const p of placed) {
      const b = getLabelBox(p.x, p.y, p.w, p.totalH);
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) return true;
    }
    return false;
  }

  function isClosestToOwnRoute(lx: number, ly: number, ownStartX: number, ownStartY: number, routeIdx: number): boolean {
    const d2own = (lx - ownStartX) ** 2 + (ly - ownStartY) ** 2;
    for (let i = 0; i < infos.length; i++) {
      if (i === routeIdx || !infos[i].valid) continue;
      if ((lx - infos[i].startX) ** 2 + (ly - infos[i].startY) ** 2 < d2own) return false;
    }
    return true;
  }

  // Clamp a candidate label position so its box always stays fully inside
  // the image, regardless of how close the route's anchor point is to an edge.
  function clampToImage(cx: number, cy: number, w: number, totalH: number) {
    return {
      x: Math.max(w / 2, Math.min(cx, imageWidth - w / 2)),
      y: Math.max(0, Math.min(cy, imageHeight - totalH)),
    };
  }

  function generateCandidates(startX: number, startY: number, w: number, totalH: number) {
    const maxDist = 30 * mm;
    const step = 1.5 * mm;
    const numAngles = 16;
    const seen = new Set<string>();
    const start = clampToImage(startX, startY, w, totalH);
    const cands: { x: number; y: number; dist: number }[] = [
      { x: start.x, y: start.y, dist: Math.hypot(start.x - startX, start.y - startY) },
    ];
    for (let dist = step; dist <= maxDist; dist += step) {
      for (let ai = 0; ai < numAngles; ai++) {
        const rad = ((90 + ai * (360 / numAngles)) % 360) * (Math.PI / 180);
        const cx = Math.max(w / 2, Math.min(startX + Math.cos(rad) * dist, imageWidth - w / 2));
        const cy = Math.max(0, Math.min(startY + Math.sin(rad) * dist, imageHeight - totalH));
        const key = `${Math.round(cx)},${Math.round(cy)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        cands.push({ x: cx, y: cy, dist: Math.hypot(cx - startX, cy - startY) });
      }
    }
    return cands.sort((a, b) => a.dist - b.dist);
  }

  // ── Union-find clustering by start-point proximity ────────────────────────
  const parent = Array.from({ length: infos.length }, (_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  for (let i = 0; i < infos.length; i++) {
    for (let j = i + 1; j < infos.length; j++) {
      if (!infos[i].valid || !infos[j].valid) continue;
      const d2 = (infos[i].startX - infos[j].startX) ** 2 + (infos[i].startY - infos[j].startY) ** 2;
      if (d2 <= CLUSTER_DIST * CLUSTER_DIST) parent[find(i)] = find(j);
    }
  }
  const clusterMap = new Map<number, number[]>();
  for (let i = 0; i < infos.length; i++) {
    const root = find(i);
    if (!clusterMap.has(root)) clusterMap.set(root, []);
    clusterMap.get(root)!.push(i);
  }

  const placed: Placed[] = [];
  const result = new Map<string, { x: number; y: number }>();

  for (let idx = 0; idx < infos.length; idx++) {
    const info = infos[idx];
    if (!info.valid) { result.set(info.routeId, { x: 0, y: 0 }); continue; }
    if (result.has(info.routeId)) continue; // already placed as part of a cluster row

    const cluster = clusterMap.get(find(idx))!;

    if (cluster.length > 1) {
      // ── Horizontal row for close-start routes ──────────────────────────
      const sorted = [...cluster].sort((a, b) => infos[a].startX - infos[b].startX);
      const totalW = sorted.reduce((sum, i) => sum + infos[i].w, 0) + (sorted.length - 1) * ROW_GAP;
      const centerX = sorted.reduce((sum, i) => sum + infos[i].startX, 0) / sorted.length;
      const cx = Math.max(totalW / 2, Math.min(centerX, imageWidth - totalW / 2));
      const baseY = Math.max(...sorted.map(i => infos[i].startY));
      const maxTotalH = Math.max(...sorted.map(i => infos[i].totalH));

      const rowXPositions = (rowCX: number): number[] => {
        const positions: number[] = [];
        let x = rowCX - totalW / 2;
        for (const i of sorted) { positions.push(x + infos[i].w / 2); x += infos[i].w + ROW_GAP; }
        return positions;
      };

      const yStep = 1.5 * mm;
      let rowY = baseY;
      let foundRow = false;
      for (let pass = 0; pass < 2 && !foundRow; pass++) {
        for (let t = 0; t <= 30; t++) {
          const y = baseY + t * yStep;
          if (y + maxTotalH > imageHeight) break;
          const xp = rowXPositions(cx);
          const clear = sorted.every((i, k) =>
            (pass > 0 || !overlapsOtherPaths(xp[k], y, infos[i].w, infos[i].totalH, i)) &&
            !overlapsPlaced(xp[k], y, infos[i].w, infos[i].totalH, placed),
          );
          if (clear) { rowY = y; foundRow = true; break; }
        }
      }
      // No clear row found below the cluster (e.g. cluster sits at the very
      // bottom of the image) — clamp so the row's box still fits fully
      // inside the image instead of drifting past the edge.
      if (!foundRow) rowY = Math.max(0, Math.min(baseY, imageHeight - maxTotalH));

      const xp = rowXPositions(cx);
      for (let k = 0; k < sorted.length; k++) {
        const i = sorted[k];
        result.set(infos[i].routeId, { x: xp[k], y: rowY });
        placed.push({ x: xp[k], y: rowY, w: infos[i].w, totalH: infos[i].totalH });
      }

    } else {
      // ── Radial placement for isolated routes ───────────────────────────
      const { startX, startY, w, totalH } = info;
      const candidates = generateCandidates(startX, startY, w, totalH);
      const fallback = clampToImage(startX, startY, w, totalH);
      let bestX = fallback.x, bestY = fallback.y;

      const tryFind = (checkPath: boolean, checkProximity: boolean) =>
        candidates.some((c) => {
          if (checkPath && overlapsOtherPaths(c.x, c.y, w, totalH, idx)) return false;
          if (overlapsPlaced(c.x, c.y, w, totalH, placed)) return false;
          if (checkProximity && !isClosestToOwnRoute(c.x, c.y, startX, startY, idx)) return false;
          bestX = c.x; bestY = c.y; return true;
        });

      tryFind(true, true) || tryFind(false, true) || tryFind(false, false);

      result.set(info.routeId, { x: bestX, y: bestY });
      placed.push({ x: bestX, y: bestY, w, totalH });
    }
  }

  return result;
}
