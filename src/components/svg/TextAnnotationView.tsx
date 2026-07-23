/**
 * Bilingual text callout — high-contrast outlined text (no background chip),
 * so it stays legible over any part of a photo without obscuring detail.
 * English line above, Arabic line below when both are set. Supports rotation
 * about its own anchor point (px), and (when selected) drag-to-move plus a
 * small rotation handle.
 */
import React from 'react';
import { PositionPx } from '../../types';
import { getAnnotationOutlineColor } from '../../constants';

type Props = {
  px: PositionPx;
  text: string;
  textAr?: string;
  color: string;
  fontSizeMul: number;
  rotation?: number;
  pxPerMm: number;
  isSelected: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDragBody?: (e: React.PointerEvent) => void;
  onDragRotateHandle?: (e: React.PointerEvent) => void;
};

export function TextAnnotationView({
  px, text, textAr, color, fontSizeMul, rotation = 0, pxPerMm, isSelected,
  onClick, onDragBody, onDragRotateHandle,
}: Props) {
  const mm = pxPerMm;
  const fs = 3.2 * mm * fontSizeMul;
  const lines: { str: string; ar: boolean }[] = [];
  if (text) lines.push({ str: text, ar: false });
  if (textAr) lines.push({ str: textAr, ar: true });
  if (lines.length === 0) return null;

  const outline = getAnnotationOutlineColor(color);
  const handleDist = 1.2 * mm + fs * (lines.length - 1) * 0.625 + fs * 0.9;

  return (
    <g
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined }}
      transform={rotation ? `rotate(${rotation} ${px.x} ${px.y})` : undefined}
    >
      {isSelected && (
        <>
          <circle cx={px.x} cy={px.y} r={1.2 * mm} fill="none" stroke={color} strokeWidth={0.3 * mm} strokeDasharray={`${0.5 * mm} ${0.5 * mm}`} />
          {/* Rotation handle: small circle above the text, drag to rotate about px */}
          <line x1={px.x} y1={px.y - 1.2 * mm} x2={px.x} y2={px.y - handleDist} stroke={color} strokeWidth={0.2 * mm} strokeDasharray={`${0.3 * mm} ${0.3 * mm}`} />
          <circle
            cx={px.x}
            cy={px.y - handleDist}
            r={0.9 * mm}
            fill={color}
            stroke={outline}
            strokeWidth={0.25 * mm}
            style={{ cursor: 'grab' }}
            onPointerDown={onDragRotateHandle}
          />
        </>
      )}
      {lines.map((line, i) => {
        const y = px.y + (i - (lines.length - 1) / 2) * fs * 1.25;
        return (
          <text
            key={i}
            x={px.x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fs}
            fontFamily={line.ar ? "'Noto Kufi Arabic', Arial, sans-serif" : 'Inter, Roboto, sans-serif'}
            fontWeight={line.ar ? 600 : 700}
            direction={line.ar ? 'rtl' : 'ltr'}
            fill={color}
            stroke={outline}
            strokeWidth={fs * 0.22}
            paintOrder="stroke fill"
            style={{ userSelect: 'none', cursor: onDragBody ? 'move' : undefined }}
            onPointerDown={onDragBody}
          >
            {line.str}
          </text>
        );
      })}
    </g>
  );
}
