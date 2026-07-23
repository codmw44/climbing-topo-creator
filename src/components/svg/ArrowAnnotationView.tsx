/**
 * Directional arrow annotation — outlined shaft + triangular head, same
 * outline-then-fill contrast convention as route lines / PitchStation.
 * When selected, both endpoints become draggable handles — dragging either
 * one repositions and/or re-angles ("rotates") the arrow around the other.
 */
import React from 'react';
import { PositionPx } from '../../types';
import { getAnnotationOutlineColor } from '../../constants';

type Props = {
  fromPx: PositionPx;
  toPx: PositionPx;
  color: string;
  isSelected: boolean;
  pxPerMm: number;
  onClick?: (e: React.MouseEvent) => void;
  onDragFrom?: (e: React.PointerEvent) => void;
  onDragTo?: (e: React.PointerEvent) => void;
  onDragBody?: (e: React.PointerEvent) => void;
};

export function ArrowAnnotationView({
  fromPx, toPx, color, isSelected, pxPerMm, onClick, onDragFrom, onDragTo, onDragBody,
}: Props) {
  const mm = pxPerMm;
  const lineW = isSelected ? 0.7 * mm : 0.55 * mm;
  const headLen = 2.6 * mm;
  const angle = Math.atan2(toPx.y - fromPx.y, toPx.x - fromPx.x);
  const a1 = angle + Math.PI - Math.PI / 7;
  const a2 = angle + Math.PI + Math.PI / 7;
  const head = `${toPx.x},${toPx.y} ${toPx.x + headLen * Math.cos(a1)},${toPx.y + headLen * Math.sin(a1)} ${toPx.x + headLen * Math.cos(a2)},${toPx.y + headLen * Math.sin(a2)}`;
  const outline = getAnnotationOutlineColor(color);
  const handleR = 0.9 * mm;

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      {/* Wider invisible hit-target for grabbing/dragging the whole arrow */}
      <line
        x1={fromPx.x} y1={fromPx.y} x2={toPx.x} y2={toPx.y}
        stroke="transparent" strokeWidth={lineW + 3 * mm} strokeLinecap="round"
        style={{ cursor: onDragBody ? 'move' : undefined }}
        onPointerDown={onDragBody}
      />
      <line x1={fromPx.x} y1={fromPx.y} x2={toPx.x} y2={toPx.y} stroke={outline} strokeWidth={lineW + 0.9 * mm} strokeLinecap="round" pointerEvents="none" />
      <line x1={fromPx.x} y1={fromPx.y} x2={toPx.x} y2={toPx.y} stroke={color} strokeWidth={lineW} strokeLinecap="round" pointerEvents="none" />
      <polygon points={head} fill={color} stroke={outline} strokeWidth={0.3 * mm} strokeLinejoin="round" paintOrder="stroke fill" pointerEvents="none" />

      {isSelected && (
        <>
          <circle cx={fromPx.x} cy={fromPx.y} r={handleR} fill="#fff" stroke={color} strokeWidth={0.25 * mm} style={{ cursor: 'grab' }} onPointerDown={onDragFrom} />
          <circle cx={toPx.x} cy={toPx.y} r={handleR} fill="#fff" stroke={color} strokeWidth={0.25 * mm} style={{ cursor: 'grab' }} onPointerDown={onDragTo} />
        </>
      )}
    </g>
  );
}
