/**
 * Sector-area highlight: freeform polygon fill, matching the "sector area"
 * highlight look from the maps tool — a soft translucent fill with a
 * slightly stronger outline so the boundary reads on top of a photo.
 */
import React from 'react';
import { PositionPx } from '../../types';
import { getAnnotationOutlineColor } from '../../constants';

type Props = {
  pointsPx: PositionPx[];
  color: string;
  isSelected: boolean;
  isInProgress: boolean;
  onClick?: (e: React.MouseEvent) => void;
};

export function AreaAnnotationView({ pointsPx, color, isSelected, isInProgress, onClick }: Props) {
  if (pointsPx.length < 2) return null;
  const d = pointsPx.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (isInProgress ? '' : ' Z');
  const isBlack = color.toLowerCase() === '#000000';

  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      {/* Black fill has no natural contrast against its own boundary, so it
          gets an extra faint white halo underneath the usual color stroke. */}
      {isBlack && (
        <path d={d} fill="none" stroke={getAnnotationOutlineColor(color)} strokeWidth={(isSelected ? 2.5 : 1.5) + 1.5} />
      )}
      <path
        d={d}
        fill={isInProgress ? 'none' : color}
        fillOpacity={0.28}
        stroke={color}
        strokeOpacity={0.9}
        strokeWidth={isSelected ? 2.5 : 1.5}
        strokeDasharray={isInProgress ? '4 4' : undefined}
      />
    </g>
  );
}
