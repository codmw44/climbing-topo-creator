/**
 * SVG overlay rendered on top of the climbing photo.
 *
 * Rendered in two passes so anchor/station icons always appear above route lines:
 *   Pass 1 — all route lines (every route, every pitch)
 *   Pass 2 — all decorations (anchors, labels, handles)
 */
import React, { useCallback, useRef } from 'react';
import { Route, Pitch, Position, PositionPx } from '../../types';
import { useEditor } from '../../context/EditorContext';
import { getGradeColor, SCREEN, getOverlaySizes } from '../../constants';
import { RouteLine } from './RouteLine';
import { PitchStation } from './PitchStation';
import { RouteLabel } from './RouteLabel';
import { PitchGradeLabel } from './PitchGradeLabel';
import { EditablePoints } from './EditablePoints';

const BORDER_COLOR = 'rgba(0,0,0,0.65)';
const ROUTE_NUMBER_BG = '#1a1a2e';

// ── Label collision resolution ────────────────────────────────────────────────

type LabelPos = { x: number; y: number };

function resolveRouteLabels(
  routes: Route[],
  toPixelFn: (p: Position) => PositionPx,
  mm: number,
  imageWidth: number,
): Map<string, LabelPos> {
  const yOff = 1.5 * mm;
  const rectH = 4.2 * mm * 0.9; // matches RouteLabel reduced margins
  const gradeH = 3.5 * mm;

  const boxes = routes.map((route) => {
    const fp = route.pitches[0];
    const pt = fp?.points[0];
    if (!pt) return { routeId: route.id, x: 0, y: 0, w: 0, totalH: 0 };
    const { x, y } = toPixelFn(pt);
    const digits = String(route.number).length;
    const rectW = (digits > 2 ? digits * 1.8 + 5 : 6) * mm * 0.9;
    const gradeW = route.grade ? Math.max((route.grade.length * 1.5 + 3.5) * mm, 5 * mm) : 0;
    const w = Math.max(rectW, gradeW);
    const totalH = yOff + rectH + (route.grade ? 0.3 * mm + gradeH : 0);
    return { routeId: route.id, x, y, w, totalH };
  });

  const placed: typeof boxes = [];
  const result = new Map<string, LabelPos>();

  for (const box of boxes) {
    if (!box.w) { result.set(box.routeId, { x: box.x, y: box.y }); continue; }
    let x = box.x;
    const y = box.y; // y stays fixed — labels push sideways, not down
    for (let iter = 0; iter < 40; iter++) {
      const top = y + yOff;
      const bot = y + box.totalH;
      const left = x - box.w / 2;
      const right = x + box.w / 2;
      let pushed = false;
      for (const p of placed) {
        if (!p.w) continue;
        const pTop = p.y + yOff;
        const pBot = p.y + p.totalH;
        const pLeft = p.x - p.w / 2;
        const pRight = p.x + p.w / 2;
        if (left < pRight && right > pLeft && top < pBot && bot > pTop) {
          // Push sideways based on relative position
          x = x <= p.x ? p.x - p.w / 2 - box.w / 2 : p.x + p.w / 2 + box.w / 2;
          pushed = true;
          break;
        }
      }
      if (!pushed) break;
    }
    // Clamp so label stays inside image width
    x = Math.max(box.w / 2, Math.min(x, imageWidth - box.w / 2));
    result.set(box.routeId, { x, y: box.y });
    placed.push({ ...box, x });
  }

  return result;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns the display points for a pitch, prepending the last point of the
 *  previous pitch so consecutive pitches visually connect. */
function getPitchDisplayPoints(route: Route, pitchIdx: number) {
  const pitch = route.pitches[pitchIdx];
  const prevPitch = pitchIdx > 0 ? route.pitches[pitchIdx - 1] : null;
  const joinPoint = prevPitch?.points[prevPitch.points.length - 1];
  if (!joinPoint) return pitch.points;
  return [
    { ...joinPoint, previousLineType: pitch.points[0]?.previousLineType ?? ('solid' as const) },
    ...pitch.points,
  ];
}

// ── component ─────────────────────────────────────────────────────────────────

export function RoutesLayer() {
  const {
    imageSize, routes,
    selectedRouteId, selectedPitchId,
    hoveredRouteId, setHoveredRouteId, setSelectedRoute,
    mode, drawingLineType, addPoint,
    toPixel, toPercent, zoom, overlayScale,
  } = useEditor();

  const svgRef = useRef<SVGSVGElement>(null);

  const getSvgPos = useCallback(
    (e: React.MouseEvent): Position | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / zoom.scale;
      const rawY = (e.clientY - rect.top) / zoom.scale;
      return toPercent({ x: rawX, y: rawY, units: 'px' }, imageSize);
    },
    [zoom.scale, imageSize, toPercent],
  );

  const handleSvgClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== 'draw' || !selectedRouteId || !selectedPitchId) return;
      const pos = getSvgPos(e);
      if (!pos) return;
      addPoint(selectedRouteId, selectedPitchId, { ...pos, previousLineType: drawingLineType });
    },
    [mode, selectedRouteId, selectedPitchId, drawingLineType, getSvgPos, addPoint],
  );

  if (!imageSize.width) return null;

  // WYSIWYG: use the same A5-proportional sizes as the PNG export.
  // The CSS transform already scales everything, so what you see on screen
  // at any zoom level is proportional to what's in the exported image.
  // Only the interactive handles stay zoom-invariant (constant click target).
  const zoomScale = zoom.scale;
  const exportSizes = getOverlaySizes(imageSize.width, overlayScale);
  const sizes = {
    ...exportSizes,
    pointHandlePx: SCREEN.handlePx / zoomScale,  // constant pixel size on screen
  };

  const labelPositions = resolveRouteLabels(routes, toPixel, sizes.pxPerMm, imageSize.width);

  const routeOpacity = (route: Route) => {
    const isOtherSelected = !!selectedRouteId && route.id !== selectedRouteId;
    return isOtherSelected ? (route.id === hoveredRouteId ? 0.7 : 0.3) : 1;
  };

  const routeHandlers = (route: Route) => ({
    onMouseEnter: () => setHoveredRouteId(route.id),
    onMouseLeave: () => setHoveredRouteId(null),
    onClick: (e: React.MouseEvent) => {
      if (mode !== 'draw') { e.stopPropagation(); setSelectedRoute(route.id); }
    },
    style: { cursor: mode === 'draw' ? 'crosshair' : 'pointer' } as React.CSSProperties,
  });

  return (
    <svg
      ref={svgRef}
      width={imageSize.width}
      height={imageSize.height}
      style={{ position: 'absolute', top: 0, left: 0,
        cursor: mode === 'draw' ? 'crosshair' : 'default',
        overflow: 'visible' }}
      onClick={handleSvgClick}
    >
      {/* ── Pass 1: route lines only ───────────────────────────────────────── */}
      {routes.map((route) => {
        const opacity = routeOpacity(route);
        const isSelected = route.id === selectedRouteId;
        return (
          <g key={`lines-${route.id}`} {...routeHandlers(route)}>
            {route.pitches.map((pitch, pitchIdx) => {
              const pitchColor = getGradeColor(pitch.grade || route.grade);
              const isPitchSelected = isSelected && pitch.id === selectedPitchId;
              const displayPoints = getPitchDisplayPoints(route, pitchIdx);
              const pts: PositionPx[] = displayPoints.map((p) => toPixel(p));
              return (
                <g key={pitch.id}>
                  <RouteLine
                    pointsPx={pts}
                    stroke={pitchColor}
                    strokeWidth={sizes.strokePx}
                    borderWidth={sizes.borderPx}
                    borderColor={BORDER_COLOR}
                    opacity={opacity}
                    pxPerMm={sizes.pxPerMm}
                  />
                  {isPitchSelected && pts.length >= 2 && (
                    <RouteLine
                      pointsPx={pts}
                      stroke="#fff"
                      strokeWidth={sizes.strokePx * 0.4}
                      opacity={0.35}
                      pxPerMm={sizes.pxPerMm}
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* ── Pass 2: decorations on top of all lines ────────────────────────── */}
      {routes.map((route) => {
        const opacity = routeOpacity(route);
        const isSelected = route.id === selectedRouteId;
        return (
          <g key={`deco-${route.id}`} opacity={opacity} {...routeHandlers(route)}>
            {route.pitches.map((pitch, pitchIdx) => {
              const pitchColor = getGradeColor(pitch.grade || route.grade);
              const isLastPitch = pitchIdx === route.pitches.length - 1;
              const displayPoints = getPitchDisplayPoints(route, pitchIdx);
              const pts: PositionPx[] = displayPoints.map((p) => toPixel(p));
              const midPt = pts[Math.floor(pts.length / 2)];
              const lastPt = pts.length > 0 ? pts[pts.length - 1] : null;
              const lastPoint = pitch.points[pitch.points.length - 1];

              return (
                <g key={pitch.id}>
                  {/* Manual station markers */}
                  {pitch.points.map((pt, ptIdx) => {
                    if (!pt.isPitchStation) return null;
                    const px = toPixel(pt);
                    return <PitchStation key={ptIdx} x={px.x} y={px.y} sizes={sizes} />;
                  })}

                  {/* End-of-pitch marker */}
                  {lastPt && lastPoint && !lastPoint.isPitchStation && (
                    isLastPitch
                      ? <PitchStation x={lastPt.x} y={lastPt.y} sizes={sizes} isAutoAnchor />
                      : <PitchStation x={lastPt.x} y={lastPt.y} sizes={sizes} pitchNumber={pitchIdx + 2} />
                  )}

                  {/* Pitch grade label */}
                  {pitch.grade && midPt && (
                    <PitchGradeLabel x={midPt.x} y={midPt.y} sizes={sizes} grade={pitch.grade} color={getGradeColor(pitch.grade as any)} />
                  )}

                  {/* Editable handles */}
                  {isSelected && (
                    <EditablePoints
                      routeId={route.id}
                      pitchId={pitch.id}
                      points={pitch.points}
                      zoomScale={zoomScale}
                      sizes={sizes}
                      color={pitchColor}
                      containerSize={imageSize}
                    />
                  )}
                </g>
              );
            })}

            {/* Route label at collision-resolved position */}
            {(() => {
              const lp = labelPositions.get(route.id);
              if (!lp) return null;
              return (
                <RouteLabel
                  key="label"
                  x={lp.x} y={lp.y}
                  sizes={sizes}
                  number={route.number}
                  grade={route.grade}
                  numberBg={ROUTE_NUMBER_BG}
                  gradeColor={getGradeColor(route.grade)}
                  isSelected={isSelected}
                  onClick={(e) => { if (mode !== 'draw') { e.stopPropagation(); setSelectedRoute(route.id); } }}
                  onMouseEnter={() => setHoveredRouteId(route.id)}
                  onMouseLeave={() => setHoveredRouteId(null)}
                />
              );
            })()}
          </g>
        );
      })}
    </svg>
  );
}
