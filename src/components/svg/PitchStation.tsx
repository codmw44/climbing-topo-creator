/**
 * Pitch-station markers:
 *  - Triangle (▼): final anchor at end of route — red fill, white outline
 *  - Rectangle: intermediate pitch break — red fill, white outline, pitch number inside
 *
 * Outline thickness matches the route line border (sizes.borderPx).
 * Uses SVG paintOrder="stroke fill" so the stroke paints behind the fill,
 * giving a perfectly uniform outer outline on all sides.
 */
import React from 'react';

const ANCHOR_RED = '#e53935';
const OUTLINE_WHITE = '#ffffff';

type OverlaySizes = { anchorSize: number; borderPx: number; pxPerMm: number };

type Props = {
  x: number;
  y: number;
  sizes: OverlaySizes;
  color?: string;       // unused — always red
  borderColor?: string; // unused — always white
  isAutoAnchor?: boolean;
  /** When set, renders the rectangle pitch-break marker instead of the triangle */
  pitchNumber?: number;
};

export function PitchStation({ x, y, sizes, isAutoAnchor, pitchNumber }: Props) {
  const a = sizes.anchorSize;
  // strokeWidth is 2× the desired outline thickness because paintOrder="stroke fill"
  // paints the stroke behind the fill — the inner half is covered, outer half = borderPx
  const sw = sizes.borderPx * (2 / 3);
  const opacity = isAutoAnchor ? 0.9 : 1;

  if (pitchNumber !== undefined) {
    // ── Vertical rectangle pitch-break marker ────────────────────────────────
    const rw = a * 2;
    const rh = a * 3.5;
    const fontSize = a * 1.6;
    const mm = sizes.pxPerMm;
    return (
      <g transform={`translate(${x} ${y})`} opacity={opacity} pointerEvents="none">
        <rect
          x={-rw / 2} y={-rh / 2}
          width={rw} height={rh}
          rx={0.35 * mm}
          fill={ANCHOR_RED}
          stroke={OUTLINE_WHITE}
          strokeWidth={sw}
          paintOrder="stroke fill"
        />
        <text
          x={0} y={fontSize * 0.38}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily="Inter, Roboto, sans-serif"
          fontWeight="700"
          fill={OUTLINE_WHITE}
          style={{ userSelect: 'none' }}
        >
          {pitchNumber}
        </text>
      </g>
    );
  }

  // ── Downward triangle anchor ──────────────────────────────────────────────
  const pts = `0,${a} ${-a},${-a} ${a},${-a}`;
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity} pointerEvents="none">
      <polygon
        points={pts}
        fill={ANCHOR_RED}
        stroke={OUTLINE_WHITE}
        strokeWidth={sw}
        strokeLinejoin="miter"
        paintOrder="stroke fill"
      />
    </g>
  );
}
