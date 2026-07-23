/**
 * SVG overlay for annotations (area highlights, text, arrows, dashed trails) —
 * rendered as its own layer above RoutesLayer's routes/labels.
 *
 * Click-to-place logic lives in RoutesLayer's <svg onClick> (the shared outer
 * element, since an empty <g> here has no hit-testable area of its own and
 * would never receive clicks on blank canvas — every annotation starts as a
 * click on blank canvas). This layer additionally owns post-placement editing
 * once an annotation is selected: dragging a text label or arrow endpoint, and
 * rotating a text label via its handle.
 */
import React, { useCallback, useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { Position, PositionPx } from '../../types';
import { getOverlaySizes } from '../../constants';
import { AreaAnnotationView } from './AreaAnnotationView';
import { TrailAnnotationView } from './TrailAnnotationView';
import { ArrowAnnotationView } from './ArrowAnnotationView';
import { TextAnnotationView } from './TextAnnotationView';
import { AnnotationEditablePoints } from './AnnotationEditablePoints';

type Props = {
  zoomScale: number;
};

// What's being dragged right now, so pointermove/pointerup know which
// annotation + which part of it (whole-body move, or one specific endpoint)
// to update, and whether to compute a position or an angle.
type DragState =
  | { kind: 'text-move'; id: string }
  | { kind: 'text-rotate'; id: string; anchor: Position }
  | { kind: 'arrow-move'; id: string; startPointer: Position; startFrom: Position; startTo: Position }
  | { kind: 'arrow-endpoint'; id: string; end: 'from' | 'to' };

export function AnnotationsLayer({ zoomScale }: Props) {
  const {
    imageSize, annotations, overlayScale,
    mode, inProgressAnnotationId,
    selectedAnnotationId, setSelectedAnnotationId,
    toPixel, toPercent,
    moveAnnotation, commitAnnotationMove,
  } = useEditor();

  const dragRef = useRef<DragState | null>(null);

  const getPercentPos = useCallback(
    (e: React.PointerEvent): Position | null => {
      const svg = (e.target as SVGElement).ownerSVGElement;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / zoomScale;
      const rawY = (e.clientY - rect.top) / zoomScale;
      return toPercent({ x: rawX, y: rawY, units: 'px' }, imageSize);
    },
    [zoomScale, imageSize, toPercent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pos = getPercentPos(e);
      if (!pos) return;

      if (drag.kind === 'text-move') {
        moveAnnotation(drag.id, { x: pos.x, y: pos.y });
      } else if (drag.kind === 'text-rotate') {
        const angle = (Math.atan2(pos.y - drag.anchor.y, pos.x - drag.anchor.x) * 180) / Math.PI + 90;
        moveAnnotation(drag.id, { rotation: angle });
      } else if (drag.kind === 'arrow-endpoint') {
        moveAnnotation(drag.id, { [drag.end]: pos } as Partial<import('../../types').Annotation>);
      } else if (drag.kind === 'arrow-move') {
        const dx = pos.x - drag.startPointer.x;
        const dy = pos.y - drag.startPointer.y;
        moveAnnotation(drag.id, {
          from: { x: drag.startFrom.x + dx, y: drag.startFrom.y + dy, units: 'percentage' },
          to: { x: drag.startTo.x + dx, y: drag.startTo.y + dy, units: 'percentage' },
        });
      }
    },
    [getPercentPos, moveAnnotation],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      const pos = getPercentPos(e);
      if (!pos) return;

      if (drag.kind === 'text-move') {
        commitAnnotationMove(drag.id, { x: pos.x, y: pos.y });
      } else if (drag.kind === 'text-rotate') {
        const angle = (Math.atan2(pos.y - drag.anchor.y, pos.x - drag.anchor.x) * 180) / Math.PI + 90;
        commitAnnotationMove(drag.id, { rotation: angle });
      } else if (drag.kind === 'arrow-endpoint') {
        commitAnnotationMove(drag.id, { [drag.end]: pos } as Partial<import('../../types').Annotation>);
      } else if (drag.kind === 'arrow-move') {
        const dx = pos.x - drag.startPointer.x;
        const dy = pos.y - drag.startPointer.y;
        commitAnnotationMove(drag.id, {
          from: { x: drag.startFrom.x + dx, y: drag.startFrom.y + dy, units: 'percentage' },
          to: { x: drag.startTo.x + dx, y: drag.startTo.y + dy, units: 'percentage' },
        });
      }
    },
    [getPercentPos, commitAnnotationMove],
  );

  const startDrag = useCallback(
    (e: React.PointerEvent, drag: DragState) => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragRef.current = drag;
    },
    [],
  );

  if (!imageSize.width) return null;

  const sizes = getOverlaySizes(imageSize.width, overlayScale);

  return (
    <g onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}>
      {annotations.map((a) => {
        const isSelected = a.id === selectedAnnotationId;
        const select = (e: React.MouseEvent) => {
          if (mode === 'annotate') return; // clicks in annotate mode place points, not select
          e.stopPropagation();
          setSelectedAnnotationId(a.id);
        };

        if (a.type === 'area') {
          const pointsPx: PositionPx[] = a.points.map(toPixel);
          return (
            <AreaAnnotationView
              key={a.id}
              pointsPx={pointsPx}
              color={a.color}
              isSelected={isSelected}
              isInProgress={a.id === inProgressAnnotationId}
              onClick={select}
            />
          );
        }
        if (a.type === 'trail') {
          const pointsPx: PositionPx[] = a.points.map(toPixel);
          return (
            <TrailAnnotationView
              key={a.id}
              pointsPx={pointsPx}
              color={a.color}
              isSelected={isSelected}
              pxPerMm={sizes.pxPerMm}
              onClick={select}
            />
          );
        }
        if (a.type === 'arrow') {
          return (
            <ArrowAnnotationView
              key={a.id}
              fromPx={toPixel(a.from)}
              toPx={toPixel(a.to)}
              color={a.color}
              isSelected={isSelected}
              pxPerMm={sizes.pxPerMm}
              onClick={select}
              onDragFrom={isSelected ? (e) => startDrag(e, { kind: 'arrow-endpoint', id: a.id, end: 'from' }) : undefined}
              onDragTo={isSelected ? (e) => startDrag(e, { kind: 'arrow-endpoint', id: a.id, end: 'to' }) : undefined}
              onDragBody={
                isSelected
                  ? (e) => {
                      const pos = getPercentPos(e);
                      if (!pos) return;
                      startDrag(e, { kind: 'arrow-move', id: a.id, startPointer: pos, startFrom: a.from, startTo: a.to });
                    }
                  : undefined
              }
            />
          );
        }
        // text
        return (
          <TextAnnotationView
            key={a.id}
            px={toPixel({ x: a.x, y: a.y, units: 'percentage' })}
            text={a.text}
            textAr={a.textAr}
            color={a.color}
            fontSizeMul={a.fontSize}
            rotation={a.rotation}
            pxPerMm={sizes.pxPerMm}
            isSelected={isSelected}
            onClick={select}
            onDragBody={isSelected ? (e) => startDrag(e, { kind: 'text-move', id: a.id }) : undefined}
            onDragRotateHandle={
              isSelected
                ? (e) => startDrag(e, { kind: 'text-rotate', id: a.id, anchor: { x: a.x, y: a.y, units: 'percentage' } })
                : undefined
            }
          />
        );
      })}

      {/* Editable vertex handles for the selected area/trail shape */}
      {selectedAnnotationId && (
        <AnnotationEditablePoints
          annotationId={selectedAnnotationId}
          zoomScale={zoomScale}
          pxPerMm={sizes.pxPerMm}
        />
      )}
    </g>
  );
}
