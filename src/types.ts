// Core types for Beta Creator — adapted from openclimbing-master

export type LineType = 'solid' | 'dotted';

// Coordinates stored as percentage of image size (0–100)
export type Position = {
  x: number;
  y: number;
  units: 'percentage';
  previousLineType?: LineType;
};

// Coordinates in pixels
export type PositionPx = {
  x: number;
  y: number;
  units: 'px';
  previousLineType?: LineType;
};

export type Size = {
  width: number;
  height: number;
};

// Crop rectangle, stored as percentage of full image size (0–100)
export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// A waypoint on a pitch path
export type PathPoint = Position & {
  isPitchStation?: boolean; // true = belay/rappel anchor station marker
};

export type PathPoints = PathPoint[];

// French climbing grade system
export type FrenchGrade =
  | '3'
  | '4'
  | '4+'
  | '5a'
  | '5b'
  | '5b+'
  | '5c'
  | '5c+'
  | '6a'
  | '6a+'
  | '6b'
  | '6b+'
  | '6c'
  | '6c+'
  | '7a'
  | '7a+'
  | '7b'
  | '7b+'
  | '7c'
  | '7c+'
  | '8a'
  | '8a+'
  | '8b'
  | '8b+'
  | '8c'
  | '8c+'
  | '9a'
  | '9a+'
  | '';

// A single pitch within a multi-pitch route
export type Pitch = {
  id: string;
  grade: FrenchGrade;
  points: PathPoints;
};

// A climbing route (can be single or multi-pitch)
export type Route = {
  id: string;
  name: string;
  number: number; // auto-assigned position (1-based); recomputed on add/remove/reorder
  numberOverride?: number; // manual override — wins over `number` for display/export
  grade: FrenchGrade; // Overall grade (usually hardest pitch)
  pitches: Pitch[];
  // Links this route to a specific "Route ID" row in the crag's <Name>_routes.csv
  // (the CSV's first column, unique per crag). When set, name/number/grade are
  // refreshed from that CSV row on topo open and on export — the CSV is the
  // source of truth once a route is linked. Unset for routes never linked to a
  // CSV row (drawn freehand, or from a topo predating this feature).
  routeId?: number;
};

// Saved project state — written to JSON file
export type ProjectState = {
  version: 1;
  imagePath: string; // Original filename (user must re-open image on load)
  routes: Route[];
  annotations?: Annotation[];
  overlayScale?: number;
  cropRect?: CropRect;
};

// Editor interaction modes
export type EditorMode =
  | 'select'       // Pointer mode: click to select routes/points
  | 'draw'         // Click on image to add points to current pitch
  | 'move'         // Drag existing points
  | 'crop'         // Adjust export crop rectangle
  | 'annotate';    // Place/edit non-route annotations (area/text/arrow/trail)

export type ZoomState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

// ── Annotations ───────────────────────────────────────────────────────────────
// Freeform extras drawn on top of a topo, alongside routes: sector-area
// highlights, bilingual text callouts, arrows, and dashed approach trails.

export type AnnotationType = 'area' | 'text' | 'arrow' | 'trail';

// Sub-tool active while in 'annotate' mode — which kind of annotation a click
// on the canvas will create/continue.
export type AnnotationTool = AnnotationType;

export type AreaAnnotation = {
  id: string;
  type: 'area';
  points: Position[]; // polygon vertices, percentage-of-image, closed implicitly
  color: string;       // fill/stroke color, e.g. '#ffeb3b'
  label?: string;
  labelAr?: string;
};

export type TextAnnotation = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  units: 'percentage';
  text: string;
  textAr?: string;
  color: string;      // text fill color
  fontSize: number;   // multiplier applied on top of the overlay's base mm size (1 = default)
  rotation?: number;  // degrees, clockwise, about (x, y) — 0/undefined = horizontal
};

export type ArrowAnnotation = {
  id: string;
  type: 'arrow';
  from: Position;
  to: Position;
  color: string;
};

export type TrailAnnotation = {
  id: string;
  type: 'trail';
  points: Position[]; // waypoints, percentage-of-image
  color: string;
};

export type Annotation = AreaAnnotation | TextAnnotation | ArrowAnnotation | TrailAnnotation;
