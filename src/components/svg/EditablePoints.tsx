import React, { useCallback, useRef, useState } from 'react';
import { PathPoint, Position } from '../../types';
import { useEditor } from '../../context/EditorContext';

type OverlaySizes = { pointHandlePx: number; pxPerMm: number };

type PointMenuState = {
  x: number;
  y: number;
  routeId: string;
  pitchId: string;
  pointIndex: number;
};

type Props = {
  routeId: string;
  pitchId: string;
  points: PathPoint[];
  zoomScale: number;
  sizes: OverlaySizes;
  color: string;
  containerSize: { width: number; height: number };
};

export function EditablePoints({
  routeId, pitchId, points, zoomScale, sizes, color, containerSize,
}: Props) {
  const { toPixel, toPercent, movePoint, commitMove, removePoint, togglePointStation, toggleSegmentLineType } =
    useEditor();

  const [menu, setMenu] = useState<PointMenuState | null>(null);
  const draggingRef = useRef<{ index: number } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>, index: number) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      draggingRef.current = { index };
      setMenu(null);
    },
    [],
  );

  const getSvgCoord = useCallback(
    (e: React.PointerEvent<SVGElement>): Position | null => {
      const svg = e.currentTarget.ownerSVGElement;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / zoomScale;
      const rawY = (e.clientY - rect.top) / zoomScale;
      return toPercent({ x: rawX, y: rawY, units: 'px' }, containerSize);
    },
    [zoomScale, containerSize, toPercent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGElement>, index: number) => {
      if (!draggingRef.current || draggingRef.current.index !== index) return;
      const pos = getSvgCoord(e);
      if (!pos) return;
      movePoint(routeId, pitchId, index, pos);
    },
    [routeId, pitchId, getSvgCoord, movePoint],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGElement>, index: number) => {
      if (!draggingRef.current || draggingRef.current.index !== index) return;
      draggingRef.current = null;
      const pos = getSvgCoord(e);
      if (!pos) return;
      commitMove(routeId, pitchId, index, pos);
    },
    [routeId, pitchId, getSvgCoord, commitMove],
  );

  const handleShiftClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      if (!e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, routeId, pitchId, pointIndex: index });
    },
    [routeId, pitchId],
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  // sizes are already zoom-invariant (pre-divided by zoomScale in RoutesLayer)
  const r = sizes.pointHandlePx;
  const mm = sizes.pxPerMm;

  return (
    <>
      {points.map((pt, i) => {
        const px = toPixel(pt);
        const isStation = !!pt.isPitchStation;
        const isLast = i === points.length - 1;

        return (
          <g key={i}>
            <circle
              cx={px.x}
              cy={px.y}
              r={r + 0.8 * mm}
              fill="transparent"
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => handlePointerDown(e, i)}
              onPointerMove={(e) => handlePointerMove(e, i)}
              onPointerUp={(e) => handlePointerUp(e, i)}
              onClick={(e) => { e.stopPropagation(); handleShiftClick(e, i); }}
            />
            <circle
              cx={px.x}
              cy={px.y}
              r={r + 0.2 * mm}
              fill="none"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth={0.3 * mm}
              pointerEvents="none"
            />
            <circle
              cx={px.x}
              cy={px.y}
              r={r}
              fill={isStation || isLast ? 'none' : color}
              stroke={isStation || isLast ? color : '#fff'}
              strokeWidth={0.25 * mm}
              pointerEvents="none"
            />
            {(isStation || isLast) && (
              <circle cx={px.x} cy={px.y} r={r * 0.35} fill={color} pointerEvents="none" />
            )}
          </g>
        );
      })}

      {menu && (
        <PointContextMenu
          menu={menu}
          onClose={closeMenu}
          onDelete={() => { removePoint(menu.routeId, menu.pitchId, menu.pointIndex); closeMenu(); }}
          onToggleStation={() => { togglePointStation(menu.routeId, menu.pitchId, menu.pointIndex); closeMenu(); }}
          onToggleLineType={() => { toggleSegmentLineType(menu.routeId, menu.pitchId, menu.pointIndex); closeMenu(); }}
          isStation={!!points[menu.pointIndex]?.isPitchStation}
          lineType={points[menu.pointIndex]?.previousLineType ?? 'solid'}
        />
      )}
    </>
  );
}

type MenuProps = {
  menu: PointMenuState;
  onClose: () => void;
  onDelete: () => void;
  onToggleStation: () => void;
  onToggleLineType: () => void;
  isStation: boolean;
  lineType: 'solid' | 'dotted';
};

function PointContextMenu({ menu, onClose, onDelete, onToggleStation, onToggleLineType, isStation, lineType }: MenuProps) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onPointerDown={onClose} />
      <div
        style={{
          position: 'fixed',
          left: menu.x + 4,
          top: menu.y + 4,
          zIndex: 901,
          background: '#1a1a2e',
          border: '1px solid #333',
          borderRadius: 8,
          padding: '4px 0',
          minWidth: 185,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          fontSize: 13,
          color: '#e0e0e0',
        }}
      >
        <button className="menu-item" onClick={onToggleStation}>
          {isStation ? '✕ Remove station marker' : '⚓ Mark as station'}
        </button>
        <button className="menu-item" onClick={onToggleLineType}>
          {lineType === 'solid' ? '- - Make segment dashed' : '— Make segment solid'}
        </button>
        <div style={{ height: 1, background: '#333', margin: '4px 0' }} />
        <button className="menu-item menu-item--danger" onClick={onDelete}>
          🗑 Delete point
        </button>
      </div>
    </>
  );
}
