import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { loadProject, saveProject, exportImage } from '../utils/fileUtils';
import {
  isFsApiSupported,
  persistDirHandle,
  loadPersistedDirHandle,
  ensurePermission,
  readFileFromDir,
  listFilesInDir,
} from '../utils/fsApi';

export function Toolbar() {
  const {
    mode, setMode,
    drawingLineType, setDrawingLineType,
    undo, redo, canUndo, canRedo,
    addRoute,
    selectedRouteId,
    addPitch,
    imageDataUrl, imagePath, imageSize, routes,
    setImage, setRoutes,
    overlayScale, setOverlayScale,
  } = useEditor();

  const imageInputRef   = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  const [loadedImageName,  setLoadedImageName]  = useState<string | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string | null>(null);
  const [folderHandle,     setFolderHandle]     = useState<FileSystemDirectoryHandle | null>(null);
  const [saveStatus,       setSaveStatus]       = useState<string | null>(null);

  // Restore persisted folder handle on mount
  useEffect(() => {
    if (!isFsApiSupported()) return;
    loadPersistedDirHandle().then(async (h) => {
      if (!h) return;
      const ok = await ensurePermission(h).catch(() => false);
      if (ok) setFolderHandle(h);
    });
  }, []);

  // ── image helpers ───────────────────────────────────────────────────────────

  function loadImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = async () => {
        setImage(dataUrl, file.name, { width: img.naturalWidth, height: img.naturalHeight });
        setLoadedImageName(file.name);
        setPendingImageName(null);
        // Auto-load project with matching name from folder if available
        if (folderHandle) {
          const projectName = file.name.replace(/\.[^.]+$/, '') + '.json';
          const projectFile = await readFileFromDir(folderHandle, projectName);
          if (projectFile) {
            try { await loadJsonText(await projectFile.text(), true); } catch {}
          }
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  const handleOpenImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
    e.target.value = '';
  };

  // ── project load ────────────────────────────────────────────────────────────

  async function loadJsonText(text: string, skipImageLoad = false) {
    const json = JSON.parse(text);
    const savedImageName = loadProject(json, setImage, setRoutes, setOverlayScale);
    if (!savedImageName) return;
    if (skipImageLoad) return; // image already loaded by caller

    setLoadedImageName(null);

    // If we have a folder, try to auto-load the image from it
    if (folderHandle) {
      const imageFile = await readFileFromDir(folderHandle, savedImageName);
      if (imageFile) {
        loadImageFile(imageFile);
        return;
      }
    }
    // Fallback: prompt user to pick the image file
    setPendingImageName(savedImageName);
    setTimeout(() => imageInputRef.current?.click(), 50);
  }

  const handleOpenProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try { await loadJsonText(ev.target?.result as string); }
      catch { alert('Failed to load project file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── folder actions ──────────────────────────────────────────────────────────

  const handlePickFolder = async () => {
    if (!isFsApiSupported()) { alert('File System API not supported in this browser.'); return; }
    try {
      // @ts-expect-error — showDirectoryPicker is draft but widely supported
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await persistDirHandle(handle);
      setFolderHandle(handle);

      // Auto-load the first (or only) .json project found in the folder
      const jsons = await listFilesInDir(handle, '.json');
      if (jsons.length === 1) {
        const f = await (await handle.getFileHandle(jsons[0])).getFile();
        await loadJsonText(await f.text());
      } else if (jsons.length > 1) {
        const choice = window.prompt(
          `Multiple projects found:\n${jsons.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nEnter number to open (or cancel to skip):`,
        );
        const idx = parseInt(choice ?? '', 10) - 1;
        if (idx >= 0 && idx < jsons.length) {
          const f = await (await handle.getFileHandle(jsons[idx])).getFile();
          await loadJsonText(await f.text());
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') alert(`Could not open folder: ${err.message}`);
    }
  };

  // ── save / export ───────────────────────────────────────────────────────────

  const handleSaveProject = async () => {
    await saveProject({ imagePath, imageDataUrl, imageSize, routes, overlayScale, dirHandle: folderHandle });
    if (folderHandle) flash('Saved ✓');
  };

  const handleExport = async () => {
    if (!imageDataUrl) { alert('No image loaded.'); return; }
    await exportImage({ imageDataUrl, imageSize, routes, overlayScale, imagePath, dirHandle: folderHandle });
    if (folderHandle) flash('Exported ✓');
  };

  function flash(msg: string) {
    setSaveStatus(msg);
    setTimeout(() => setSaveStatus(null), 2000);
  }

  const canAddPitch = !!selectedRouteId;
  const folderName  = folderHandle?.name ?? null;

  return (
    <div className="toolbar">
      {/* File operations */}
      <div className="toolbar-group">
        {/* Folder button — shown when FS API is available */}
        {isFsApiSupported() && (
          <button
            className={`toolbar-btn${folderName ? ' toolbar-btn--active' : ''}`}
            onClick={handlePickFolder}
            title={folderName ? `Folder: ${folderName}\nClick to change` : 'Open project folder for direct file access'}
          >
            📁 {folderName ? folderName : 'Folder'}
          </button>
        )}

        {/* Image button — always shown */}
        <button
          className={`toolbar-btn${pendingImageName ? ' toolbar-btn--warn' : ''}`}
          onClick={() => imageInputRef.current?.click()}
          title={pendingImageName ? `Open image: ${pendingImageName}` : 'Open Image'}
        >
          🖼 {pendingImageName ? `Open: ${pendingImageName}` : (loadedImageName ?? 'Image')}
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOpenImage} />

        {/* Open project button — always shown */}
        <button className="toolbar-btn" onClick={() => projectInputRef.current?.click()} title="Open Project (.json)">
          📂 Open
        </button>
        <input ref={projectInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleOpenProject} />

        <button
          className="toolbar-btn"
          onClick={handleSaveProject}
          title={folderHandle ? `Save to ${folderName}` : 'Save Project (JSON)'}
        >
          {saveStatus === 'Saved ✓' ? '✓ Saved' : '💾 Save'}
        </button>

        <button
          className="toolbar-btn toolbar-btn--accent"
          onClick={handleExport}
          title={folderHandle ? `Export to ${folderName}` : 'Export JPEG with routes overlay'}
        >
          {saveStatus === 'Exported ✓' ? '✓ Exported' : '📤 Export'}
        </button>

        {/* Status flash for folder writes */}
        {saveStatus && folderHandle && (
          <span className="toolbar-save-status">{saveStatus}</span>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Undo / Redo */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ↩ Undo
        </button>
        <button className="toolbar-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          ↪ Redo
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Mode buttons */}
      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${mode === 'select' ? 'toolbar-btn--active' : ''}`}
          onClick={() => setMode('select')}
          title="Select mode (V / Esc)"
        >
          ↖ Select
        </button>
        <button
          className={`toolbar-btn ${mode === 'draw' ? 'toolbar-btn--active' : ''}`}
          onClick={() => setMode('draw')}
          title="Draw mode (D)"
        >
          ✏ Draw
        </button>
      </div>

      {/* Line type */}
      {mode === 'draw' && (
        <>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button
              className={`toolbar-btn ${drawingLineType === 'solid' ? 'toolbar-btn--active' : ''}`}
              onClick={() => setDrawingLineType('solid')}
              title="Solid line"
            >
              — Solid
            </button>
            <button
              className={`toolbar-btn ${drawingLineType === 'dotted' ? 'toolbar-btn--active' : ''}`}
              onClick={() => setDrawingLineType('dotted')}
              title="Dashed line (hidden section)"
            >
              - - Dashed
            </button>
          </div>
        </>
      )}

      <div className="toolbar-divider" />

      {/* Route/pitch actions */}
      <div className="toolbar-group">
        <button className="toolbar-btn toolbar-btn--primary" onClick={addRoute} title="Add new route">
          + Route
        </button>
        {canAddPitch && (
          <button className="toolbar-btn" onClick={() => addPitch(selectedRouteId!)} title="Add pitch to route">
            + Pitch
          </button>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Overlay scale */}
      <div className="toolbar-group toolbar-scale-group" title="Overlay size (auto = A5-page assumption)">
        <span className="toolbar-label">Scale</span>
        <input
          type="range"
          min={0.4}
          max={2.5}
          step={0.05}
          value={overlayScale}
          onChange={(e) => setOverlayScale(parseFloat(e.target.value))}
          className="toolbar-slider"
          title={`Overlay scale: ${Math.round(overlayScale * 100)}%`}
        />
        <span className="toolbar-label">{Math.round(overlayScale * 100)}%</span>
        <button
          className="toolbar-btn"
          style={{ fontSize: 11, padding: '3px 6px' }}
          onClick={() => setOverlayScale(1.0)}
          title="Reset scale to auto"
        >
          Auto
        </button>
      </div>

      <div className="toolbar-hints">
        Two-finger scroll = pan · Pinch = zoom · Space+drag = pan · Shift+click point = options
      </div>
    </div>
  );
}
