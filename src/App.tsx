import React, { useEffect } from 'react';
import { EditorProvider, useEditor } from './context/EditorContext';
import { ToastProvider } from './components/Toast';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { ImageCanvas } from './components/ImageCanvas';

function KeyboardShortcuts() {
  const { mode, setMode, undo, redo, canUndo, canRedo,
    selectedRouteId, selectedPitchId, routes, removePoint,
    annotations, selectedAnnotationId, setSelectedAnnotationId,
    inProgressAnnotationId, finishAnnotationPath, removeAnnotationPoint, removeAnnotation } = useEditor();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === 'v' || e.key === 'V' || e.key === 'Escape') { setMode('select'); setSelectedAnnotationId(null); }
      if (e.key === 'd' || e.key === 'D') setMode('draw');
      if (e.key === 'c' || e.key === 'C') setMode('crop');
      if (e.key === 'a' || e.key === 'A') setMode('annotate');

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); if (canUndo) undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); if (canRedo) redo();
      }

      // Enter commits the in-progress area/trail shape
      if (e.key === 'Enter' && inProgressAnnotationId) {
        e.preventDefault();
        finishAnnotationPath();
      }

      // Backspace = remove last point of selected pitch, or last vertex of the
      // in-progress/selected area/trail annotation, or delete a selected
      // point-shaped annotation (text/arrow) outright.
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const activeAnnoId = inProgressAnnotationId ?? selectedAnnotationId;
        if (activeAnnoId) {
          const anno = annotations.find((a) => a.id === activeAnnoId);
          if (anno && (anno.type === 'area' || anno.type === 'trail')) {
            if (anno.points.length > 0) removeAnnotationPoint(activeAnnoId, anno.points.length - 1);
          } else if (anno) {
            removeAnnotation(activeAnnoId);
          }
          return;
        }
        if (!selectedRouteId || !selectedPitchId) return;
        const route = routes.find((r) => r.id === selectedRouteId);
        const pitch = route?.pitches.find((p) => p.id === selectedPitchId);
        if (pitch && pitch.points.length > 0) {
          removePoint(selectedRouteId, selectedPitchId, pitch.points.length - 1);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode, setMode, undo, redo, canUndo, canRedo, selectedRouteId, selectedPitchId, routes, removePoint,
      annotations, selectedAnnotationId, setSelectedAnnotationId, inProgressAnnotationId, finishAnnotationPath,
      removeAnnotationPoint, removeAnnotation]);

  return null;
}

function AppInner() {
  return (
    <div className="app-layout">
      <KeyboardShortcuts />
      <Toolbar />
      <div className="app-body">
        <ImageCanvas />
        <Sidebar />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <EditorProvider>
        <AppInner />
      </EditorProvider>
    </ToastProvider>
  );
}
