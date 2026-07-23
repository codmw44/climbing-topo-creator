/**
 * Draggable vertex handles for the selected area/trail annotation — same
 * drag/commit split as routes' EditablePoints.tsx, minus the station/line-type
 * context menu (not applicable to annotations).
 */
import React, { useCallback, useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { Position } from '../../types';

type Props = {
  annotationId: string;
  zoomScale: number;
  pxPerMm: number;
};

export function AnnotationEditablePoints({ annotationId, zoomScale, pxPerMm }: Props) {
  const { annotations, toPixel, toPercent, imageSize, moveAnnotationPoint, commitAnnotationPoint, removeAnnotationPoint } =
    useEditor();

  const draggingRef = useRef<{ index: number } | null>(null);

  const annotation = annotations.find((a) => a.id === annotationId);

  const getSvgCoord = useCallback(
    (e: React.PointerEvent<SVGElement>): Position | null => {
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / zoomScale;
      const rawY = (e.clientY - rect.top) / zoomScale;
      return toPercent({ x: rawX, y: rawY, units: 'px' }, imageSize);
    },
    [zoomScale, imageSize, toPercent],
  );

  if (!annotation || (annotation.type !== 'area' && annotation.type !== 'trail')) return null;

  const r = 5 / zoomScale;

  return (
    <>
      {annotation.points.map((pt, i) => {
        const p = toPixel(pt);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={r}
            fill={annotation.color}
            stroke="#fff"
            strokeWidth={1.5 / zoomScale}
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              draggingRef.current = { index: i };
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current || draggingRef.current.index !== i) return;
              const pos = getSvgCoord(e);
              if (pos) moveAnnotationPoint(annotationId, i, pos);
            }}
            onPointerUp={(e) => {
              if (!draggingRef.current || draggingRef.current.index !== i) return;
              draggingRef.current = null;
              const pos = getSvgCoord(e);
              if (pos) commitAnnotationPoint(annotationId, i, pos);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (annotation.points.length > 2) removeAnnotationPoint(annotationId, i);
            }}
          />
        );
      })}
    </>
  );
}
