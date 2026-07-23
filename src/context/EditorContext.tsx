import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Annotation,
  AnnotationTool,
  AreaAnnotation,
  ArrowAnnotation,
  CropRect,
  EditorMode,
  FrenchGrade,
  PathPoint,
  Pitch,
  Position,
  PositionPx,
  Route,
  Size,
  TextAnnotation,
  TrailAnnotation,
  ZoomState,
} from '../types';
import { CsvRoute } from '../utils/csvUtils';
import { DEFAULT_ANNOTATION_COLOR } from '../constants';

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

export function makeTextAnnotation(pos: Position): TextAnnotation {
  return {
    id: uuidv4(),
    type: 'text',
    x: pos.x,
    y: pos.y,
    units: 'percentage',
    text: 'Label',
    color: DEFAULT_ANNOTATION_COLOR.text,
    fontSize: 1,
  };
}

export function makeAreaAnnotation(): AreaAnnotation {
  return { id: uuidv4(), type: 'area', points: [], color: DEFAULT_ANNOTATION_COLOR.area };
}

export function makeTrailAnnotation(): TrailAnnotation {
  return { id: uuidv4(), type: 'trail', points: [], color: DEFAULT_ANNOTATION_COLOR.trail };
}

export function makeArrowAnnotation(from: Position, to: Position): ArrowAnnotation {
  return { id: uuidv4(), type: 'arrow', from, to, color: DEFAULT_ANNOTATION_COLOR.arrow };
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

  // Routes parsed from the crag's sibling <Name>_routes.csv (if found next to
  // the open image) — powers the "pick from CSV" dropdown in the sidebar.
  cragCsvRoutes: CsvRoute[];
  setCragCsvRoutes: (routes: CsvRoute[]) => void;

  // Export crop rectangle (percentage of image, null = no crop / full image)
  cropRect: CropRect | null;
  setCropRect: (r: CropRect | null) => void;

  // Coordinate conversion
  toPixel: (pos: Position) => PositionPx;
  toPercent: (px: PositionPx, containerSize: Size) => Position;

  // Annotations (area highlights, text labels, arrows, dashed trails)
  annotations: Annotation[];
  setAnnotations: (annotations: Annotation[]) => void;
  annotationTool: AnnotationTool;
  setAnnotationTool: (t: AnnotationTool) => void;
  selectedAnnotationId: string | null;
  setSelectedAnnotationId: (id: string | null) => void;
  inProgressAnnotationId: string | null; // area/trail currently being clicked out, finish with Enter/dblclick
  addAnnotationPoint: (pos: Position) => void; // area/trail: append vertex (or start new one)
  finishAnnotationPath: () => void;            // area/trail: commit in-progress shape
  addTextAnnotation: (pos: Position) => void;
  addArrowAnnotation: (from: Position, to: Position) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  moveAnnotationPoint: (id: string, pointIndex: number, pos: Position) => void;
  commitAnnotationPoint: (id: string, pointIndex: number, pos: Position) => void;
  removeAnnotationPoint: (id: string, pointIndex: number) => void;
  // Whole-shape drag (text position, arrow endpoints/rotation) — live variant
  // during pointermove, commit variant on pointerup (pushes undo history).
  moveAnnotation: (id: string, patch: Partial<Annotation>) => void;
  commitAnnotationMove: (id: string, patch: Partial<Annotation>) => void;

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
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [cragCsvRoutes, setCragCsvRoutes] = useState<CsvRoute[]>([]);

  const [annotations, setAnnotationsRaw] = useState<Annotation[]>([]);
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>('area');
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [inProgressAnnotationId, setInProgressAnnotationId] = useState<string | null>(null);

  // Undo/redo covers both routes and annotations as one combined history —
  // every user-visible edit to either (add/remove/reorder/finish-drag) pushes
  // one combined snapshot, so Ctrl+Z always undoes the single most recent
  // change regardless of which list it touched.
  type HistoryState = { routes: Route[]; annotations: Annotation[] };
  const historyRef = useRef<HistoryState[]>([{ routes: [], annotations: [] }]);
  const historyIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((state: HistoryState) => {
    const trimmed = historyRef.current.slice(0, historyIdxRef.current + 1);
    trimmed.push(state);
    if (trimmed.length > MAX_HISTORY) trimmed.shift();
    historyRef.current = trimmed;
    historyIdxRef.current = trimmed.length - 1;
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(false);
  }, []);

  const routesRef = useRef(routes);
  routesRef.current = routes;
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  const setRoutes = useCallback(
    (newRoutes: Route[]) => {
      setRoutesRaw(newRoutes);
      pushHistory({ routes: newRoutes, annotations: annotationsRef.current });
    },
    [pushHistory],
  );

  const setAnnotations = useCallback(
    (newAnnotations: Annotation[]) => {
      setAnnotationsRaw(newAnnotations);
      pushHistory({ routes: routesRef.current, annotations: newAnnotations });
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current -= 1;
    const state = historyRef.current[historyIdxRef.current];
    setRoutesRaw(state.routes);
    setAnnotationsRaw(state.annotations);
    setCanUndo(historyIdxRef.current > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current += 1;
    const state = historyRef.current[historyIdxRef.current];
    setRoutesRaw(state.routes);
    setAnnotationsRaw(state.annotations);
    setCanUndo(true);
    setCanRedo(historyIdxRef.current < historyRef.current.length - 1);
  }, []);

  const setImage = useCallback((dataUrl: string, path: string, size: Size) => {
    setImageDataUrl(dataUrl);
    setImagePath(path);
    setImageSize(size);
    setCropRect(null);
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
        pushHistory({ routes: updated, annotations: annotationsRef.current });
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

  // ── annotation mutations ─────────────────────────────────────────────────────
  // Area/trail are built the same way routes/pitches are: click adds a vertex to
  // the in-progress shape, Enter/double-click/mode-switch commits it. Text and
  // arrow are placed in one shot (no multi-click path).

  const addAnnotationPoint = useCallback(
    (pos: Position) => {
      if (annotationTool !== 'area' && annotationTool !== 'trail') return;
      if (inProgressAnnotationId) {
        setAnnotations(
          annotations.map((a) =>
            a.id === inProgressAnnotationId && (a.type === 'area' || a.type === 'trail')
              ? { ...a, points: [...a.points, pos] }
              : a,
          ),
        );
        return;
      }
      const created = annotationTool === 'area' ? makeAreaAnnotation() : makeTrailAnnotation();
      created.points = [pos];
      setAnnotations([...annotations, created]);
      setInProgressAnnotationId(created.id);
      setSelectedAnnotationId(created.id);
    },
    [annotations, annotationTool, inProgressAnnotationId],
  );

  const finishAnnotationPath = useCallback(() => {
    if (!inProgressAnnotationId) return;
    // Drop shapes finished with fewer than 2 vertices — nothing to draw.
    const shape = annotations.find((a) => a.id === inProgressAnnotationId);
    if (shape && (shape.type === 'area' || shape.type === 'trail') && shape.points.length < 2) {
      setAnnotations(annotations.filter((a) => a.id !== inProgressAnnotationId));
      setSelectedAnnotationId(null);
    }
    setInProgressAnnotationId(null);
  }, [annotations, inProgressAnnotationId]);

  const addTextAnnotation = useCallback(
    (pos: Position) => {
      const created = makeTextAnnotation(pos);
      setAnnotations([...annotations, created]);
      setSelectedAnnotationId(created.id);
    },
    [annotations],
  );

  const addArrowAnnotation = useCallback(
    (from: Position, to: Position) => {
      const created = makeArrowAnnotation(from, to);
      setAnnotations([...annotations, created]);
      setSelectedAnnotationId(created.id);
    },
    [annotations],
  );

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      setAnnotations(
        annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
      );
    },
    [annotations],
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      setAnnotations(annotations.filter((a) => a.id !== id));
      if (selectedAnnotationId === id) setSelectedAnnotationId(null);
      if (inProgressAnnotationId === id) setInProgressAnnotationId(null);
    },
    [annotations, selectedAnnotationId, inProgressAnnotationId],
  );

  // Live drag (pointermove) vs. commit (pointerup) split, same reasoning as
  // routes' movePoint/commitMove: dragging fires on every pointer move and
  // would otherwise flood undo history with one entry per pixel. Only the
  // commit variants push to history; the live variants mutate state directly.

  const moveAnnotationPoint = useCallback(
    (id: string, pointIndex: number, pos: Position) => {
      setAnnotationsRaw((prev) =>
        prev.map((a) => {
          if (a.id !== id || (a.type !== 'area' && a.type !== 'trail')) return a;
          return { ...a, points: a.points.map((p, i) => (i === pointIndex ? pos : p)) };
        }),
      );
    },
    [],
  );

  const commitAnnotationPoint = useCallback(
    (id: string, pointIndex: number, pos: Position) => {
      setAnnotationsRaw((prev) => {
        const updated = prev.map((a) => {
          if (a.id !== id || (a.type !== 'area' && a.type !== 'trail')) return a;
          return { ...a, points: a.points.map((p, i) => (i === pointIndex ? pos : p)) };
        });
        pushHistory({ routes: routesRef.current, annotations: updated });
        return updated;
      });
    },
    [pushHistory],
  );

  const removeAnnotationPoint = useCallback(
    (id: string, pointIndex: number) => {
      setAnnotations(
        annotations.map((a) => {
          if (a.id !== id || (a.type !== 'area' && a.type !== 'trail')) return a;
          return { ...a, points: a.points.filter((_, i) => i !== pointIndex) };
        }),
      );
    },
    [annotations],
  );

  // Whole-shape move: text (x/y) and arrow (from/to endpoints, dragged
  // independently — which also re-angles the arrow, i.e. "rotates" it).
  const moveAnnotation = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      setAnnotationsRaw((prev) =>
        prev.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
      );
    },
    [],
  );

  const commitAnnotationMove = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      setAnnotationsRaw((prev) => {
        const updated = prev.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a));
        pushHistory({ routes: routesRef.current, annotations: updated });
        return updated;
      });
    },
    [pushHistory],
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
    cragCsvRoutes,
    setCragCsvRoutes,
    cropRect,
    setCropRect,
    toPixel,
    toPercent,
    annotations,
    setAnnotations,
    annotationTool,
    setAnnotationTool,
    selectedAnnotationId,
    setSelectedAnnotationId,
    inProgressAnnotationId,
    addAnnotationPoint,
    finishAnnotationPath,
    addTextAnnotation,
    addArrowAnnotation,
    updateAnnotation,
    removeAnnotation,
    moveAnnotationPoint,
    commitAnnotationPoint,
    removeAnnotationPoint,
    moveAnnotation,
    commitAnnotationMove,
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
