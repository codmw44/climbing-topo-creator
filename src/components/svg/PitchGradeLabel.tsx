import React from 'react';

type OverlaySizes = { gradeFontPx: number; pxPerMm: number };

type Props = {
  x: number;
  y: number;
  sizes: OverlaySizes;
  grade: string;
  color: string;
};

export function PitchGradeLabel({ x, y, sizes, grade, color }: Props) {
  if (!grade) return null;
  const mm = sizes.pxPerMm;
  const fontSize = sizes.gradeFontPx;
  const padH = 0.8 * mm;
  const padV = 0.5 * mm;
  const w = grade.length * fontSize * 0.62 + padH * 2;
  const h = fontSize + padV * 2;
  const offsetX = 1.8 * mm;

  return (
    <g transform={`translate(${x + offsetX} ${y - h / 2})`}>
      <rect x={-0.2 * mm} y={-0.2 * mm} width={w + 0.4 * mm} height={h + 0.4 * mm} rx={0.6 * mm} fill="rgba(0,0,0,0.45)" />
      <rect x={0} y={0} width={w} height={h} rx={0.5 * mm} fill={color} fillOpacity={0.88} />
      <text
        x={w / 2} y={h * 0.7}
        textAnchor="middle" fontSize={fontSize}
        fontFamily="Inter, Roboto, sans-serif" fontWeight="600"
        fill="#fff"
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {grade}
      </text>
    </g>
  );
}
