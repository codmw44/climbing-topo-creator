/**
 * Crop-rectangle editor overlay, shown over the image when mode === 'crop'.
 * Rect is stored/edited in percentage-of-image units (see CropRect in types.ts)
 * so it survives independent of zoom and is easy to persist/export against.
 */
import React, { useCallback, useRef } from 'react';
import { useEditor } from '../context/EditorContext';
import { CropRect } from '../types';

const HANDLES = [
  'nw', 'n', 'ne',
  'w',        'e',
  'sw', 's', 'se',
] as const;
type Handle = typeof HANDLES[number];

const MIN_SIZE_PCT = 5;

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export function CropOverlay() {
  const { imageSize, zoom, cropRect, setCropRect, mode } = useEditor();
  const dragRef = useRef<{
    handle: Handle | 'move';
    startX: number; // client px
    startY: number;
    rect: CropRect;
  } | null>(null);

  const rect: CropRect = cropRect ?? { x: 0, y: 0, width: 100, height: 100 };

  const onPointerDown = useCallback(
    (handle: Handle | 'move') => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragRef.current = { handle, startX: e.clientX, startY: e.clientY, rect };
    },
    [rect],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dxPct = ((e.clientX - drag.startX) / zoom.scale / imageSize.width) * 100;
      const dyPct = ((e.clientY - drag.startY) / zoom.scale / imageSize.height) * 100;

      let { x, y, width, height } = drag.rect;
      const x0 = drag.rect.x, y0 = drag.rect.y;
      const x1 = drag.rect.x + drag.rect.width, y1 = drag.rect.y + drag.rect.height;

      if (drag.handle === 'move') {
        x = clamp(x0 + dxPct, 0, 100 - width);
        y = clamp(y0 + dyPct, 0, 100 - height);
      } else {
        let nx0 = x0, ny0 = y0, nx1 = x1, ny1 = y1;
        if (drag.handle.includes('w')) nx0 = clamp(x0 + dxPct, 0, x1 - MIN_SIZE_PCT);
        if (drag.handle.includes('e')) nx1 = clamp(x1 + dxPct, x0 + MIN_SIZE_PCT, 100);
        if (drag.handle.includes('n')) ny0 = clamp(y0 + dyPct, 0, y1 - MIN_SIZE_PCT);
        if (drag.handle.includes('s')) ny1 = clamp(y1 + dyPct, y0 + MIN_SIZE_PCT, 100);
        x = nx0; y = ny0; width = nx1 - nx0; height = ny1 - ny0;
      }

      setCropRect({ x, y, width, height });
    },
    [zoom.scale, imageSize, setCropRect],
  );

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  if (mode !== 'crop' || !imageSize.width) return null;

  const px = (rect.x / 100) * imageSize.width;
  const py = (rect.y / 100) * imageSize.height;
  const pw = (rect.width / 100) * imageSize.width;
  const ph = (rect.height / 100) * imageSize.height;

  const handleSizePx = 9 / zoom.scale;

  const handlePos: Record<Handle, { left: number; top: number; cursor: string }> = {
    nw: { left: px, top: py, cursor: 'nwse-resize' },
    n:  { left: px + pw / 2, top: py, cursor: 'ns-resize' },
    ne: { left: px + pw, top: py, cursor: 'nesw-resize' },
    w:  { left: px, top: py + ph / 2, cursor: 'ew-resize' },
    e:  { left: px + pw, top: py + ph / 2, cursor: 'ew-resize' },
    sw: { left: px, top: py + ph, cursor: 'nesw-resize' },
    s:  { left: px + pw / 2, top: py + ph, cursor: 'ns-resize' },
    se: { left: px + pw, top: py + ph, cursor: 'nwse-resize' },
  };

  return (
    <div
      style={{ position: 'absolute', top: 0, left: 0, width: imageSize.width, height: imageSize.height }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Dim mask outside crop rect, using 4 rectangles around the hole */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: imageSize.width, height: py, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{ position: 'absolute', left: 0, top: py + ph, width: imageSize.width, height: imageSize.height - py - ph, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{ position: 'absolute', left: 0, top: py, width: px, height: ph, background: 'rgba(0,0,0,0.55)' }} />
      <div style={{ position: 'absolute', left: px + pw, top: py, width: imageSize.width - px - pw, height: ph, background: 'rgba(0,0,0,0.55)' }} />

      {/* Crop rect border, draggable to move */}
      <div
        onPointerDown={onPointerDown('move')}
        style={{
          position: 'absolute',
          left: px, top: py, width: pw, height: ph,
          border: `${2 / zoom.scale}px solid #fff`,
          boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
          cursor: 'move',
        }}
      />

      {/* Resize handles */}
      {HANDLES.map((h) => {
        const p = handlePos[h];
        return (
          <div
            key={h}
            onPointerDown={onPointerDown(h)}
            style={{
              position: 'absolute',
              left: p.left - handleSizePx / 2,
              top: p.top - handleSizePx / 2,
              width: handleSizePx,
              height: handleSizePx,
              background: '#fff',
              border: `${1.5 / zoom.scale}px solid #1a1a2e`,
              borderRadius: 2,
              cursor: p.cursor,
            }}
          />
        );
      })}
    </div>
  );
}
