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
import { useToast } from './Toast';

const HELP_CONTENT = [
  { section: 'Modes' },
  { key: 'V / Esc',       desc: 'Select mode' },
  { key: 'D',             desc: 'Draw mode' },
  { section: 'History' },
  { key: 'Ctrl+Z',        desc: 'Undo' },
  { key: 'Ctrl+Y / Ctrl+Shift+Z', desc: 'Redo' },
  { key: 'Backspace / Del', desc: 'Remove last point' },
  { section: 'Navigation' },
  { key: 'Two-finger scroll', desc: 'Pan' },
  { key: 'Pinch / Ctrl+scroll', desc: 'Zoom' },
  { key: 'Space + drag',  desc: 'Pan' },
  { key: 'Middle-click drag', desc: 'Pan' },
  { section: 'Drawing' },
  { key: 'Click canvas',  desc: 'Add waypoint' },
  { key: 'Shift+click point', desc: 'Point options menu' },
];

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

  const { showToast } = useToast();

  const imageInputRef   = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const helpBtnRef      = useRef<HTMLButtonElement>(null);

  const [loadedImageName,  setLoadedImageName]  = useState<string | null>(null);
  const [pendingImageName, setPendingImageName] = useState<string | null>(null);
  const [folderHandle,     setFolderHandle]     = useState<FileSystemDirectoryHandle | null>(null);
  const [showHelp,         setShowHelp]         = useState(false);
  const [helpAnchor,       setHelpAnchor]       = useState({ top: 0, right: 0 });

  // Restore persisted folder handle on mount
  useEffect(() => {
    if (!isFsApiSupported()) return;
    loadPersistedDirHandle().then(async (h) => {
      if (!h) return;
      const ok = await ensurePermission(h).catch(() => false);
      if (ok) setFolderHandle(h);
    });
  }, []);

  // Close help popup on outside click
  useEffect(() => {
    if (!showHelp) return;
    const handler = (e: MouseEvent) => {
      if (helpBtnRef.current && !helpBtnRef.current.closest('.help-wrapper')?.contains(e.target as Node)) {
        setShowHelp(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHelp]);

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
    if (skipImageLoad) return;

    setLoadedImageName(null);

    if (folderHandle) {
      const imageFile = await readFileFromDir(folderHandle, savedImageName);
      if (imageFile) {
        loadImageFile(imageFile);
        return;
      }
    }
    setPendingImageName(savedImageName);
    setTimeout(() => imageInputRef.current?.click(), 50);
  }

  const handleOpenProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try { await loadJsonText(ev.target?.result as string); }
      catch { showToast('Failed to load project file.', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── folder actions ──────────────────────────────────────────────────────────

  const handlePickFolder = async () => {
    if (!isFsApiSupported()) { showToast('File System API not supported in this browser.', 'error'); return; }
    try {
      // @ts-expect-error — showDirectoryPicker is draft but widely supported
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await persistDirHandle(handle);
      setFolderHandle(handle);

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
      if (err instanceof Error && err.name !== 'AbortError') showToast(`Could not open folder: ${err.message}`, 'error');
    }
  };

  // ── save / export ───────────────────────────────────────────────────────────

  const handleSaveProject = async () => {
    await saveProject({ imagePath, imageDataUrl, imageSize, routes, overlayScale, dirHandle: folderHandle });
    showToast(folderHandle ? `Saved to ${folderHandle.name}` : 'Project downloaded');
  };

  const handleExport = async () => {
    if (!imageDataUrl) { showToast('No image loaded.', 'error'); return; }
    await exportImage({ imageDataUrl, imageSize, routes, overlayScale, imagePath, dirHandle: folderHandle });
    showToast(folderHandle ? `Exported to ${folderHandle.name}` : 'Image downloaded');
  };

  const toggleHelp = () => {
    if (!showHelp && helpBtnRef.current) {
      const r = helpBtnRef.current.getBoundingClientRect();
      setHelpAnchor({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setShowHelp(v => !v);
  };

  const canAddPitch = !!selectedRouteId;
  const folderName  = folderHandle?.name ?? null;

  return (
    <div className="toolbar">

      {/* ── Group 1: File operations ── */}
      <div className="toolbar-group">
        {isFsApiSupported() && (
          <button
            className={`toolbar-btn${folderName ? ' toolbar-btn--active' : ''}`}
            onClick={handlePickFolder}
            title={folderName ? `Folder: ${folderName}\nClick to change` : 'Open project folder for direct file access'}
          >
            📁 {folderName ? folderName : 'Folder'}
          </button>
        )}
        <button
          className={`toolbar-btn${pendingImageName ? ' toolbar-btn--warn' : ''}`}
          onClick={() => imageInputRef.current?.click()}
          title={pendingImageName ? `Open image: ${pendingImageName}` : 'Open Image'}
        >
          🖼 {pendingImageName ? `Open: ${pendingImageName}` : (loadedImageName ?? 'Image')}
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOpenImage} />
        <button className="toolbar-btn" onClick={() => projectInputRef.current?.click()} title="Open Project (.json)">
          📂 Open
        </button>
        <input ref={projectInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleOpenProject} />
        <button
          className="toolbar-btn"
          onClick={handleSaveProject}
          title={folderHandle ? `Save to ${folderName}` : 'Save Project (JSON)'}
        >
          💾 Save
        </button>
        <button
          className="toolbar-btn toolbar-btn--accent"
          onClick={handleExport}
          title={folderHandle ? `Export to ${folderName}` : 'Export JPEG with routes overlay'}
        >
          📤 Export
        </button>
      </div>

      {/* Break between file ops and editing tools */}
      <div className="toolbar-row-break toolbar-row-break--1" />

      {/* ── Group 2: Mode + line type + add route/pitch ── */}
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
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <button className="toolbar-btn toolbar-btn--primary" onClick={addRoute} title="Add new route">
          + Route
        </button>
        <button
          className="toolbar-btn"
          onClick={() => canAddPitch && addPitch(selectedRouteId!)}
          disabled={!canAddPitch}
          title="Add pitch to selected route"
        >
          + Pitch
        </button>
      </div>

      {/* Break between editing tools and history/scale */}
      <div className="toolbar-row-break toolbar-row-break--2" />

      {/* ── Group 3: Undo/Redo + Scale ── */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ↩ Undo
        </button>
        <button className="toolbar-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          ↪ Redo
        </button>
      </div>
      <div className="toolbar-divider" />
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

      {/* Help button — absolutely pinned to top-right corner */}
      <div className="help-wrapper">
        <button
          ref={helpBtnRef}
          className={`toolbar-btn help-btn${showHelp ? ' toolbar-btn--active' : ''}`}
          onClick={toggleHelp}
          title="Keyboard shortcuts & help"
        >
          ?
        </button>
      </div>

      {/* Help popup */}
      {showHelp && (
        <div
          className="help-popup"
          style={{ top: helpAnchor.top, right: helpAnchor.right }}
        >
          <div className="help-popup-title">Keyboard Shortcuts</div>
          <table className="help-table">
            <tbody>
              {HELP_CONTENT.map((item, i) =>
                'section' in item ? (
                  <tr key={i} className="help-section-row">
                    <td colSpan={2}>{item.section}</td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td className="help-key">{item.key}</td>
                    <td className="help-desc">{item.desc}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
