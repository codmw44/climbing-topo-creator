/**
 * Canvas area: image + SVG overlay + pan/zoom.
 *
 * Mac trackpad:  two-finger scroll = pan, pinch = zoom
 * Mouse:         Ctrl+scroll = zoom, left-drag on bg (select mode) = pan
 * Any mode:      Space + left-drag = pan
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { RoutesLayer } from './svg/RoutesLayer';
import { CropOverlay } from './CropOverlay';

export function ImageCanvas() {
  const { imageDataUrl, imageSize, zoom, setZoom, containerRef, mode } = useEditor();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const fitToScreen = useCallback(() => {
    if (!imageSize.width || !containerSize.width) return;
    const scale = Math.min(
      containerSize.width / imageSize.width,
      containerSize.height / imageSize.height,
    );
    setZoom({
      scale,
      offsetX: (containerSize.width - imageSize.width * scale) / 2,
      offsetY: (containerSize.height - imageSize.height * scale) / 2,
    });
  }, [imageSize, containerSize, setZoom]);
  const spaceDownRef = useRef(false);
  const dragRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  // ── container size ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setContainerSize({ width: r.width, height: r.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Center image on load
  useEffect(() => {
    if (!imageSize.width || !containerSize.width) return;
    const scale = Math.min(
      containerSize.width / imageSize.width,
      containerSize.height / imageSize.height,
      1,
    );
    setZoom({
      scale,
      offsetX: (containerSize.width - imageSize.width * scale) / 2,
      offsetY: (containerSize.height - imageSize.height * scale) / 2,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSize, containerSize.width, containerSize.height]);

  // ── Space key ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement).matches('input,select,textarea')) {
        e.preventDefault();
        spaceDownRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDownRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ── Wheel: non-passive so we can preventDefault ────────────────────────────
  // IMPORTANT: attach to the wrapperRef element directly (not via React onWheel)
  // so we can pass { passive: false }.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;

      if (e.ctrlKey) {
        // Pinch-to-zoom (trackpad) or Ctrl+scroll (mouse)
        // Use deltaY magnitude for smooth trackpad, clamped for mouse wheel
        const raw = e.deltaY;
        const factor = Math.pow(0.999, raw); // smooth for trackpad (raw ~1-5), works for mouse too
        setZoom((prev) => {
          const newScale = Math.min(Math.max(prev.scale * factor, 0.05), 15);
          return {
            scale: newScale,
            offsetX: cx - (cx - prev.offsetX) * (newScale / prev.scale),
            offsetY: cy - (cy - prev.offsetY) * (newScale / prev.scale),
          };
        });
      } else {
        // Two-finger scroll = pan
        setZoom((prev) => ({
          ...prev,
          offsetX: prev.offsetX - e.deltaX,
          offsetY: prev.offsetY - e.deltaY,
        }));
      }
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  // Re-attach whenever setZoom identity changes (stable, but be explicit)
  }, [setZoom]);

  // ── Pointer drag = pan ─────────────────────────────────────────────────────
  const shouldPan = useCallback((e: React.PointerEvent): boolean => {
    if (e.button === 1) return true;
    if (e.button === 0 && spaceDownRef.current) return true;
    if (e.button === 0 && mode === 'select') {
      const target = e.target as Element;
      return !target.closest('circle,rect[rx],text,g[data-interactive]');
    }
    return false;
  }, [mode]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!shouldPan(e)) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
  }, [shouldPan]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current.x = e.clientX;
    dragRef.current.y = e.clientY;
    setZoom((prev) => ({ ...prev, offsetX: prev.offsetX + dx, offsetY: prev.offsetY + dy }));
  }, [setZoom]);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  // ── render ─────────────────────────────────────────────────────────────────
  // Always render the outer wrapper so wrapperRef is always attached
  // (fixes wheel listener attaching to null on first render)
  return (
    <div
      ref={wrapperRef}
      className="canvas-wrapper"
      style={{ cursor: dragRef.current ? 'grabbing' : mode === 'draw' ? 'crosshair' : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {!imageDataUrl ? (
        <div className="canvas-placeholder">
          <p>Open an image to start drawing routes</p>
          <p className="canvas-placeholder-hint">Use the 🖼 Image button in the toolbar</p>
        </div>
      ) : (
        <div
          ref={containerRef as React.RefObject<HTMLDivElement>}
          style={{
            position: 'absolute',
            transform: `translate(${zoom.offsetX}px, ${zoom.offsetY}px) scale(${zoom.scale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <img
            src={imageDataUrl}
            alt="Climbing wall"
            style={{
              display: 'block',
              width: imageSize.width,
              height: imageSize.height,
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
          <RoutesLayer />
          <CropOverlay />
        </div>
      )}
      <div className="zoom-controls">
        <span className="zoom-indicator">{Math.round(zoom.scale * 100)}%</span>
        {imageDataUrl && (
          <button className="zoom-fit-btn" onClick={fitToScreen} title="Fit image to screen">⊡</button>
        )}
      </div>
    </div>
  );
}
