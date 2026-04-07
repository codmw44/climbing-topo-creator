import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  EditorMode,
  FrenchGrade,
  PathPoint,
  Pitch,
  Position,
  PositionPx,
  Route,
  Size,
  ZoomState,
} from '../types';

// ── factory helpers ───────────────────────────────────────────────────────────

export function makeEmptyPitch(): Pitch {
  return { id: uuidv4(), grade: '' as FrenchGrade, points: [] };
}

export function makeRoute(number: number): Route {
  return {
    id: uuidv4(),
    name: `Route ${number}`,
    number,
    grade: '' as FrenchGrade,
    pitches: [makeEmptyPitch()],
  };
}

// ── context shape ─────────────────────────────────────────────────────────────

export type EditorContextType = {
  // Image
  imageDataUrl: string | null;
  imagePath: string;
  imageSize: Size;
  setImage: (dataUrl: string, path: string, size: Size) => void;

  // Zoom / pan
  zoom: ZoomState;
  setZoom: (z: ZoomState | ((prev: ZoomState) => ZoomState)) => void;

  // Routes
  routes: Route[];
  setRoutes: (routes: Route[]) => void;

  // Selection
  selectedRouteId: string | null;
  selectedPitchId: string | null;
  setSelectedRoute: (routeId: string | null, pitchId?: string | null) => void;

  // Editor mode
  mode: EditorMode;
  setMode: (mode: EditorMode) => void;

  // Active drawing line type
  drawingLineType: 'solid' | 'dotted';
  setDrawingLineType: (t: 'solid' | 'dotted') => void;

  // Overlay scale multiplier (1 = auto A5-based, range 0.5–2)
  overlayScale: number;
  setOverlayScale: (s: number) => void;

  // Coordinate conversion
  toPixel: (pos: Position) => PositionPx;
  toPercent: (px: PositionPx, containerSize: Size) => Position;

  // Route mutations
  addRoute: () => void;
  removeRoute: (routeId: string) => void;
  updateRoute: (routeId: string, patch: Partial<Omit<Route, 'id' | 'pitches'>>) => void;
  reorderRoutes: (fromIdx: number, toIdx: number) => void;

  // Pitch mutations
  addPitch: (routeId: string) => void;
  removePitch: (routeId: string, pitchId: string) => void;
  updatePitch: (routeId: string, pitchId: string, patch: Partial<Omit<Pitch, 'id' | 'points'>>) => void;

  // Point mutations
  addPoint: (routeId: string, pitchId: string, point: PathPoint) => void;
  removePoint: (routeId: string, pitchId: string, pointIndex: number) => void;
  movePoint: (routeId: string, pitchId: string, pointIndex: number, pos: Position) => void;
  commitMove: (routeId: string, pitchId: string, pointIndex: number, pos: Position) => void;
  togglePointStation: (routeId: string, pitchId: string, pointIndex: number) => void;
  toggleSegmentLineType: (routeId: string, pitchId: string, pointIndex: number) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Hover
  hoveredRouteId: string | null;
  setHoveredRouteId: (id: string | null) => void;

  // Container ref for coordinate math
  containerRef: React.RefObject<HTMLDivElement | null>;
};

const EditorContext = createContext<EditorContextType | null>(null);

// ── provider ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 80;

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState('');
  const [imageSize, setImageSize] = useState<Size>({ width: 0, height: 0 });
  const [zoom, setZoomRaw] = useState<ZoomState>({ scale: 1, offsetX: 0, offsetY: 0 });
  const setZoom = setZoomRaw as (z: ZoomState | ((prev: ZoomState) => ZoomState)) => void;

  const [routes, setRoutesRaw] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedPitchId, setSelectedPitchId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('select');
  const [drawingLineType, setDrawingLineType] = useState<'solid' | 'dotted'>('solid');
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  const [overlayScale, setOverlayScale] = useState(1.0);

  const historyRef = useRef<Route[][]>([[]]);
  const historyIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((newRoutes: Route[]) => {
    const trimmed = historyRef.current.slice(0, historyIdxRef.current + 1);
    trimmed.push(newRoutes);
    if (trimmed.length > MAX_HISTORY) trimmed.shift();
    historyRef.current = trimmed;
    historyIdxRef.current = trimmed.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }, []);

  const setRoutes = useCallback(
    (newRoutes: Route[]) => {
      setRoutesRaw(newRoutes);
      pushHistory(newRoutes);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const state = historyRef.current[historyIdxRef.current];
    setRoutesRaw(state);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const state = historyRef.current[historyIdxRef.current];
    setRoutesRaw(state);
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  const setImage = useCallback((dataUrl: string, path: string, size: Size) => {
    setImageDataUrl(dataUrl);
    setImagePath(path);
    setImageSize(size);
  }, []);

  const toPixel = useCallback(
    (pos: Position): PositionPx => ({
      x: (pos.x / 100) * imageSize.width,
      y: (pos.y / 100) * imageSize.height,
      units: 'px',
      previousLineType: pos.previousLineType,
    }),
    [imageSize],
  );

  const toPercent = useCallback(
    (px: PositionPx, containerSize: Size): Position => ({
      x: (px.x / containerSize.width) * 100,
      y: (px.y / containerSize.height) * 100,
      units: 'percentage',
      previousLineType: px.previousLineType,
    }),
    [],
  );

  const setSelectedRoute = useCallback(
    (routeId: string | null, pitchId: string | null = null) => {
      setSelectedRouteId(routeId);
      if (routeId && pitchId === null) {
        const route = routes.find((r) => r.id === routeId);
        setSelectedPitchId(route?.pitches[route.pitches.length - 1]?.id ?? null);
      } else {
        setSelectedPitchId(pitchId);
      }
    },
    [routes],
  );

  // ── route mutations ──────────────────────────────────────────────────────────

  const addRoute = useCallback(() => {
    const number = routes.length + 1;
    const newRoute = makeRoute(number);
    const newRoutes = [...routes, newRoute];
    setRoutes(newRoutes);
    setSelectedRouteId(newRoute.id);
    setSelectedPitchId(newRoute.pitches[0].id);
    setMode('draw');
  }, [routes, setRoutes]);

  const removeRoute = useCallback(
    (routeId: string) => {
      const newRoutes = routes
        .filter((r) => r.id !== routeId)
        .map((r, i) => ({ ...r, number: i + 1 }));
      setRoutes(newRoutes);
      if (selectedRouteId === routeId) {
        setSelectedRouteId(null);
        setSelectedPitchId(null);
        setMode('select');
      }
    },
    [routes, setRoutes, selectedRouteId],
  );

  const updateRoute = useCallback(
    (routeId: string, patch: Partial<Omit<Route, 'id' | 'pitches'>>) => {
      setRoutes(routes.map((r) => (r.id === routeId ? { ...r, ...patch } : r)));
    },
    [routes, setRoutes],
  );

  const reorderRoutes = useCallback(
    (fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return;
      const reordered = [...routes];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      setRoutes(reordered.map((r, i) => ({ ...r, number: i + 1 })));
    },
    [routes, setRoutes],
  );

  // ── pitch mutations ──────────────────────────────────────────────────────────

  const addPitch = useCallback(
    (routeId: string) => {
      const pitch = makeEmptyPitch();
      setRoutes(
        routes.map((r) =>
          r.id === routeId ? { ...r, pitches: [...r.pitches, pitch] } : r,
        ),
      );
      setSelectedPitchId(pitch.id);
      setMode('draw');
    },
    [routes, setRoutes],
  );

  const removePitch = useCallback(
    (routeId: string, pitchId: string) => {
      setRoutes(
        routes.map((r) => {
          if (r.id !== routeId) return r;
          const pitches = r.pitches.filter((p) => p.id !== pitchId);
          return { ...r, pitches: pitches.length ? pitches : [makeEmptyPitch()] };
        }),
      );
    },
    [routes, setRoutes],
  );

  const updatePitch = useCallback(
    (routeId: string, pitchId: string, patch: Partial<Omit<Pitch, 'id' | 'points'>>) => {
      setRoutes(
        routes.map((r) => {
          if (r.id !== routeId) return r;
          return {
            ...r,
            pitches: r.pitches.map((p) =>
              p.id === pitchId ? { ...p, ...patch } : p,
            ),
          };
        }),
      );
    },
    [routes, setRoutes],
  );

  // ── point mutations ──────────────────────────────────────────────────────────

  const addPoint = useCallback(
    (routeId: string, pitchId: string, point: PathPoint) => {
      setRoutes(
        routes.map((r) => {
          if (r.id !== routeId) return r;
          return {
            ...r,
            pitches: r.pitches.map((p) =>
              p.id === pitchId ? { ...p, points: [...p.points, point] } : p,
            ),
          };
        }),
      );
    },
    [routes, setRoutes],
  );

  const removePoint = useCallback(
    (routeId: string, pitchId: string, pointIndex: number) => {
      setRoutes(
        routes.map((r) => {
          if (r.id !== routeId) return r;
          return {
            ...r,
            pitches: r.pitches.map((p) => {
              if (p.id !== pitchId) return p;
              return { ...p, points: p.points.filter((_, i) => i !== pointIndex) };
            }),
          };
        }),
      );
    },
    [routes, setRoutes],
  );

  // Live drag — no history push
  const movePoint = useCallback(
    (routeId: string, pitchId: string, pointIndex: number, pos: Position) => {
      setRoutesRaw((prev) =>
        prev.map((r) => {
          if (r.id !== routeId) return r;
          return {
            ...r,
            pitches: r.pitches.map((p) => {
              if (p.id !== pitchId) return p;
              return {
                ...p,
                points: p.points.map((pt, i) =>
                  i === pointIndex ? { ...pt, x: pos.x, y: pos.y } : pt,
                ),
              };
            }),
          };
        }),
      );
    },
    [],
  );

  // Drag end — push to history
  const commitMove = useCallback(
    (routeId: string, pitchId: string, pointIndex: number, pos: Position) => {
      setRoutesRaw((prev) => {
        const updated = prev.map((r) => {
          if (r.id !== routeId) return r;
          return {
            ...r,
            pitches: r.pitches.map((p) => {
              if (p.id !== pitchId) return p;
              return {
                ...p,
                points: p.points.map((pt, i) =>
                  i === pointIndex ? { ...pt, x: pos.x, y: pos.y } : pt,
                ),
              };
            }),
          };
        });
        pushHistory(updated);
        return updated;
      });
    },
    [pushHistory],
  );

  const togglePointStation = useCallback(
    (routeId: string, pitchId: string, pointIndex: number) => {
      setRoutes(
        routes.map((r) => {
          if (r.id !== routeId) return r;
          return {
            ...r,
            pitches: r.pitches.map((p) => {
              if (p.id !== pitchId) return p;
              return {
                ...p,
                points: p.points.map((pt, i) =>
                  i === pointIndex
                    ? { ...pt, isPitchStation: !pt.isPitchStation }
                    : pt,
                ),
              };
            }),
          };
        }),
      );
    },
    [routes, setRoutes],
  );

  const toggleSegmentLineType = useCallback(
    (routeId: string, pitchId: string, pointIndex: number) => {
      setRoutes(
        routes.map((r) => {
          if (r.id !== routeId) return r;
          return {
            ...r,
            pitches: r.pitches.map((p) => {
              if (p.id !== pitchId) return p;
              return {
                ...p,
                points: p.points.map((pt, i) => {
                  if (i !== pointIndex) return pt;
                  const cur = pt.previousLineType ?? 'solid';
                  return { ...pt, previousLineType: cur === 'solid' ? 'dotted' : 'solid' };
                }),
              };
            }),
          };
        }),
      );
    },
    [routes, setRoutes],
  );

  const value: EditorContextType = {
    imageDataUrl,
    imagePath,
    imageSize,
    setImage,
    zoom,
    setZoom,
    routes,
    setRoutes,
    selectedRouteId,
    selectedPitchId,
    setSelectedRoute,
    mode,
    setMode,
    drawingLineType,
    setDrawingLineType,
    overlayScale,
    setOverlayScale,
    toPixel,
    toPercent,
    addRoute,
    removeRoute,
    updateRoute,
    reorderRoutes,
    addPitch,
    removePitch,
    updatePitch,
    addPoint,
    removePoint,
    movePoint,
    commitMove,
    togglePointStation,
    toggleSegmentLineType,
    undo,
    redo,
    canUndo,
    canRedo,
    hoveredRouteId,
    setHoveredRouteId,
    containerRef,
  };

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor(): EditorContextType {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be inside EditorProvider');
  return ctx;
}
