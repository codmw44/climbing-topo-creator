import React from 'react';

type OverlaySizes = { labelFontPx: number; gradeFontPx: number; pxPerMm: number };

type Props = {
  x: number;
  y: number;
  sizes: OverlaySizes;
  number: number;
  grade: string;
  numberBg: string;
  gradeColor: string;
  isSelected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

export function RouteLabel({
  x, y, sizes, number, grade, numberBg, gradeColor,
  isSelected, onClick, onMouseEnter, onMouseLeave,
}: Props) {
  const mm = sizes.pxPerMm;
  const fontSize = sizes.labelFontPx;
  const gradeFontSize = sizes.gradeFontPx;

  const digits = String(number).length;
  const rectW = (digits > 2 ? digits * 1.8 + 4 : 5) * mm * 0.9;
  const rectH = 4.2 * mm * 0.9;
  const yOffset = 1.5 * mm;
  const rx = 0.8 * mm;
  const outline = 0.3 * mm;

  const numBg = isSelected ? '#fff' : numberBg;
  const numText = isSelected ? numberBg : '#fff';

  const gradeW = Math.max((grade.length * 1.5 + 1.5) * mm, 3 * mm);
  const gradeH = 3.5 * mm;
  const gradeY = y + yOffset + rectH + 0.3 * mm;

  return (
    <g onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{ cursor: 'pointer' }}>
      {/* Number badge outline */}
      <rect
        x={x - rectW / 2 - outline / 2} y={y + yOffset - outline / 2}
        width={rectW + outline} height={rectH + outline} rx={rx}
        fill={isSelected ? numberBg : 'rgba(0,0,0,0.6)'}
      />
      {/* Number badge fill */}
      <rect
        x={x - rectW / 2} y={y + yOffset}
        width={rectW} height={rectH} rx={rx * 0.8}
        fill={numBg}
      />
      <text
        x={x} y={y + yOffset + rectH * 0.68}
        textAnchor="middle" fontSize={fontSize}
        fontFamily="Inter, Roboto, sans-serif" fontWeight="700"
        fill={numText}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {number}
      </text>

      {grade && (
        <>
          <rect
            x={x - gradeW / 2 - outline / 2} y={gradeY - outline / 2}
            width={gradeW + outline} height={gradeH + outline} rx={rx * 0.7}
            fill="rgba(0,0,0,0.55)"
          />
          <rect
            x={x - gradeW / 2} y={gradeY}
            width={gradeW} height={gradeH} rx={rx * 0.6}
            fill={gradeColor} fillOpacity={0.9}
          />
          <text
            x={x} y={gradeY + gradeH * 0.7}
            textAnchor="middle" fontSize={gradeFontSize}
            fontFamily="Inter, Roboto, sans-serif" fontWeight="600"
            fill="#fff"
            style={{ userSelect: 'none', pointerEvents: 'none' }}
          >
            {grade}
          </text>
        </>
      )}
    </g>
  );
}
