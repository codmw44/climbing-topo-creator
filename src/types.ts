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
  number: number;
  grade: FrenchGrade; // Overall grade (usually hardest pitch)
  pitches: Pitch[];
};

// Saved project state — written to JSON file
export type ProjectState = {
  version: 1;
  imagePath: string; // Original filename (user must re-open image on load)
  routes: Route[];
  overlayScale?: number;
  cropRect?: CropRect;
};

// Editor interaction modes
export type EditorMode =
  | 'select'       // Pointer mode: click to select routes/points
  | 'draw'         // Click on image to add points to current pitch
  | 'move'         // Drag existing points
  | 'crop';        // Adjust export crop rectangle

export type ZoomState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};
