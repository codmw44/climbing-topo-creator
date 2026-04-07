import { FrenchGrade } from './types';

// French grade difficulty bands → route color
// 5a–5c+: green, 6a–6b+: blue, 6c–7a+: orange, 7b–7c: red, 7c+: purple
export const GRADE_COLORS: Record<string, string> = {
  '3':    '#9E9E9E',
  '4':    '#9E9E9E',
  '4+':   '#9E9E9E',
  '5a':   '#4CAF50',
  '5b':   '#4CAF50',
  '5b+':  '#4CAF50',
  '5c':   '#4CAF50',
  '5c+':  '#4CAF50',
  '6a':   '#2196F3',
  '6a+':  '#2196F3',
  '6b':   '#2196F3',
  '6b+':  '#2196F3',
  '6c':   '#FF9800',
  '6c+':  '#FF9800',
  '7a':   '#FF9800',
  '7a+':  '#FF9800',
  '7b':   '#F44336',
  '7b+':  '#F44336',
  '7c':   '#F44336',
  '7c+':  '#9C27B0',
  '8a':   '#9C27B0',
  '8a+':  '#9C27B0',
  '8b':   '#9C27B0',
  '8b+':  '#9C27B0',
  '8c':   '#9C27B0',
  '8c+':  '#9C27B0',
  '9a':   '#9C27B0',
  '9a+':  '#9C27B0',
  '':     '#BDBDBD',
};

export const GRADE_BAND_LABEL: Record<string, string> = {
  '3':    'Facile',
  '4':    'Facile',
  '4+':   'Facile',
  '5a':   'Assez Difficile',
  '5b':   'Assez Difficile',
  '5b+':  'Assez Difficile',
  '5c':   'Assez Difficile',
  '5c+':  'Assez Difficile',
  '6a':   'Difficile',
  '6a+':  'Difficile',
  '6b':   'Difficile',
  '6b+':  'Difficile',
  '6c':   'Très Difficile',
  '6c+':  'Très Difficile',
  '7a':   'Très Difficile',
  '7a+':  'Très Difficile',
  '7b':   'Extrêmement Difficile',
  '7b+':  'Extrêmement Difficile',
  '7c':   'Extrêmement Difficile',
  '7c+':  'Résistance',
  '8a':   'Résistance',
};

// All French grades in order
export const FRENCH_GRADES: FrenchGrade[] = [
  '', '3', '4', '4+',
  '5a', '5b', '5b+', '5c', '5c+',
  '6a', '6a+', '6b', '6b+',
  '6c', '6c+', '7a', '7a+',
  '7b', '7b+', '7c', '7c+',
  '8a', '8a+', '8b', '8b+', '8c', '8c+',
  '9a', '9a+',
];

export function getGradeColor(grade: FrenchGrade): string {
  return GRADE_COLORS[grade] ?? '#BDBDBD';
}

// ── Route label geometry ──────────────────────────────────────────────────────
// Single source of truth for all label sizing — used by RouteLabel.tsx (SVG),
// fileUtils.ts (canvas export), and RoutesLayer.tsx (collision resolution).
// Change values here and every consumer stays in sync automatically.
export function getRouteLabelLayout(mm: number, digits: number, grade: string) {
  const rectW   = (digits > 2 ? digits * 1.8 + 4 : 5) * mm * 0.9;
  const rectH   = 4.2 * mm * 0.9;
  const yOff    = 1.5 * mm;
  const rx      = 0.8 * mm;
  const outline = 0.3 * mm;
  const gradeW  = grade ? Math.max((grade.length + 2.5) * mm, 3 * mm) : 0;
  const gradeH  = 3.5 * mm;
  const gradeGap = 0.3 * mm;
  const totalH  = yOff + rectH + (grade ? gradeGap + gradeH : 0);
  const w       = Math.max(rectW, gradeW);
  return { rectW, rectH, yOff, rx, outline, gradeW, gradeH, gradeGap, totalH, w };
}

// ── Screen rendering sizes ────────────────────────────────────────────────────
// Fixed pixel values at 100% zoom, zoom-invariant (divide SVG units by zoomScale).
// These are used for the live editor canvas — independent of image resolution.
export const SCREEN = {
  strokePx:      2.2,   // route line thickness on screen
  borderPx:      3.8,   // outline behind route line
  anchorSize:    7,     // half-height of anchor triangle (px on screen)
  labelFontPx:   11,    // route number font size
  gradeFontPx:   9,     // grade badge font size
  handlePx:      5,     // draggable point radius
  pxPerUnit:     1,     // convenience: 1 screen-px = 1 screen-px
} as const;

// ── Export sizes (A5-proportional) ───────────────────────────────────────────
// A5 portrait = 148 mm wide. These sizes scale with image resolution so the
// exported PNG looks correct when printed on A5 paper.
const A5_WIDTH_MM = 148;

export function getOverlaySizes(imageWidth: number, overlayScale: number) {
  const pxPerMm = (imageWidth / A5_WIDTH_MM) * overlayScale;
  return {
    strokePx:      0.55 * pxPerMm,
    borderPx:      0.90 * pxPerMm,
    anchorSize:    1.0  * pxPerMm,   // triangle half-height
    labelFontPx:   2.38 * pxPerMm,   // 2.8 * 0.85 — 15% smaller than before
    gradeFontPx:   1.87 * pxPerMm,   // 2.2 * 0.85
    pxPerMm,
  };
}
