import React from 'react';
import { PositionPx } from '../../types';
import { buildSegmentPaths } from '../../utils/pathUtils';

type Props = {
  pointsPx: PositionPx[];
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  borderWidth?: number;
  borderColor?: string;
  /** pixels per mm at current zoom — used to scale dash pattern */
  pxPerMm?: number;
};

export function RouteLine({
  pointsPx,
  stroke,
  strokeWidth,
  opacity = 1,
  borderWidth,
  borderColor = '#000000',
  pxPerMm = 11,
}: Props) {
  const segments = buildSegmentPaths(pointsPx);
  // Dash: ~1.2mm filled, ~3mm gap
  const dashArray = `${0.6 * pxPerMm} ${1.4 * pxPerMm}`;

  return (
    <>
      {borderWidth &&
        segments.map((seg, i) => (
          <path
            key={`border-${i}`}
            d={seg.d}
            fill="none"
            stroke={borderColor}
            strokeWidth={borderWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={opacity}
            strokeDasharray={seg.isDotted ? dashArray : undefined}
          />
        ))}

      {segments.map((seg, i) => (
        <path
          key={`line-${i}`}
          d={seg.d}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
          strokeDasharray={seg.isDotted ? dashArray : undefined}
        />
      ))}
    </>
  );
}
