import React, { useEffect } from 'react';
import { EditorProvider, useEditor } from './context/EditorContext';
import { ToastProvider } from './components/Toast';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { ImageCanvas } from './components/ImageCanvas';

function KeyboardShortcuts() {
  const { mode, setMode, undo, redo, canUndo, canRedo,
    selectedRouteId, selectedPitchId, routes, removePoint } = useEditor();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === 'v' || e.key === 'V' || e.key === 'Escape') setMode('select');
      if (e.key === 'd' || e.key === 'D') setMode('draw');

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); if (canUndo) undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); if (canRedo) redo();
      }

      // Backspace = remove last point of selected pitch
      if (e.key === 'Backspace' || e.key === 'Delete') {
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
  }, [mode, setMode, undo, redo, canUndo, canRedo, selectedRouteId, selectedPitchId, routes, removePoint]);

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
