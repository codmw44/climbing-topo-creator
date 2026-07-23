/**
 * Dashed approach-trail path — white outline underneath a dashed colored
 * line, matching the "approach trail" look from the maps tool.
 */
import React from 'react';
import { PositionPx } from '../../types';
import { getAnnotationOutlineColor } from '../../constants';

type Props = {
  pointsPx: PositionPx[];
  color: string;
  isSelected: boolean;
  pxPerMm: number;
  onClick?: (e: React.MouseEvent) => void;
};

export function TrailAnnotationView({ pointsPx, color, isSelected, pxPerMm, onClick }: Props) {
  if (pointsPx.length < 2) return null;
  const d = pointsPx.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const mm = pxPerMm;

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <path d={d} fill="none" stroke={getAnnotationOutlineColor(color)} strokeWidth={0.9 * mm} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={isSelected ? 0.7 * mm : 0.5 * mm}
        strokeDasharray={`${0.9 * mm} ${0.9 * mm}`}
        strokeLinecap="round"
      />
    </g>
  );
}
