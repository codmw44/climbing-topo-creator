import React, { useEffect, useRef, useState } from 'react';
import { useEditor } from '../context/EditorContext';
import { loadProject, saveProject, exportImage } from '../utils/fileUtils';
import {
  isFsApiSupported,
  persistDirHandle,
  loadPersistedDirHandle,
  ensurePermission,
  readFileFromDir,
  scanImagesRecursively,
  FoundImage,
} from '../utils/fsApi';
import { loadCragCsv, refreshRoutesFromCsv } from '../utils/csvUtils';
import { useToast } from './Toast';

const HELP_CONTENT = [
  { section: 'Modes' },
  { key: 'V / Esc',       desc: 'Select mode' },
  { key: 'D',             desc: 'Draw mode' },
  { key: 'C',             desc: 'Crop mode' },
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
    cragCsvRoutes, setCragCsvRoutes,
    cropRect, setCropRect,
  } = useEditor();

  const { showToast } = useToast();

  const helpBtnRef = useRef<HTMLButtonElement>(null);

  // Root work folder the user picked, and every image found by recursively
  // scanning it (nested subfolders included, already-exported topos excluded).
  const [rootHandle,   setRootHandle]   = useState<FileSystemDirectoryHandle | null>(null);
  const [foundImages,  setFoundImages]  = useState<FoundImage[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [scanning,     setScanning]     = useState(false);

  // Directory handle of the currently *open* image (may be a nested subfolder
  // of rootHandle) — this is where Save/Export write sibling files.
  const [currentImageDir, setCurrentImageDir] = useState<FileSystemDirectoryHandle | null>(null);

  const [showHelp,   setShowHelp]   = useState(false);
  const [helpAnchor, setHelpAnchor] = useState({ top: 0, right: 0 });

  // Restore persisted folder handle on mount
  useEffect(() => {
    if (!isFsApiSupported()) return;
    loadPersistedDirHandle().then(async (h) => {
      if (!h) return;
      const ok = await ensurePermission(h).catch(() => false);
      if (ok) {
        setRootHandle(h);
        await rescan(h);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh linked routes' name/number/grade from the CSV every time a new
  // CSV loads (i.e. right after opening an image) — the CSV is the source of
  // truth for any route with a routeId, so edits made there since the topo
  // was last saved always win. Reads `routes` via a ref (rather than as a
  // direct effect dependency) so this only re-runs when the CSV itself
  // changes, not on every unrelated route edit.
  const routesRef = useRef(routes);
  routesRef.current = routes;
  const prevCsvRoutesRef = useRef(cragCsvRoutes);
  useEffect(() => {
    if (cragCsvRoutes === prevCsvRoutesRef.current) return;
    prevCsvRoutesRef.current = cragCsvRoutes;
    if (cragCsvRoutes.length === 0) return;
    const { routes: refreshed, staleRouteIds } = refreshRoutesFromCsv(routesRef.current, cragCsvRoutes);
    setRoutes(refreshed);
    if (staleRouteIds.length > 0) {
      showToast(`${staleRouteIds.length} route(s) reference a Route ID no longer in the CSV.`, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cragCsvRoutes]);

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

  // Crop rect loaded from a project file before its image has finished loading
  // (setImage() resets cropRect, so it's re-applied once the image is ready).
  const pendingCropRef = useRef<import('../types').CropRect | null>(null);

  async function rescan(handle: FileSystemDirectoryHandle) {
    setScanning(true);
    try {
      const images = await scanImagesRecursively(handle);
      setFoundImages(images);
      return images;
    } finally {
      setScanning(false);
    }
  }

  async function openFoundImage(found: FoundImage) {
    const file = await found.fileHandle.getFile();
    setCurrentImageDir(found.dirHandle);
    // Clear routes from whatever was previously open — loadImageFile only
    // repopulates them if the new image has its own sidecar .json project.
    setRoutes([]);
    await loadImageFile(file, found.dirHandle);
    const csvRoutes = await loadCragCsv(found.dirHandle, rootHandle).catch(() => []);
    setCragCsvRoutes(csvRoutes);
  }

  function loadImageFile(file: File, dirHandle: FileSystemDirectoryHandle | null): Promise<void> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const img = new Image();
        img.onload = async () => {
          setImage(dataUrl, file.name, { width: img.naturalWidth, height: img.naturalHeight });
          if (pendingCropRef.current) {
            setCropRect(pendingCropRef.current);
            pendingCropRef.current = null;
          }
          if (dirHandle) {
            const projectName = file.name.replace(/\.[^.]+$/, '') + '.json';
            const projectFile = await readFileFromDir(dirHandle, projectName);
            if (projectFile) {
              try { await loadJsonText(await projectFile.text(), dirHandle, true); } catch {}
            }
          }
          resolve();
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  // ── project load ────────────────────────────────────────────────────────────

  // `dirHandle` is the specific subfolder the referenced image lives in
  // (needed to resolve the saved imagePath if the image itself isn't open yet).
  async function loadJsonText(text: string, dirHandle: FileSystemDirectoryHandle | null, skipImageLoad = false) {
    const json = JSON.parse(text);
    const savedImageName = loadProject(json, setImage, setRoutes, setOverlayScale);
    if (skipImageLoad) {
      // Image is already loaded (setImage already ran) — apply crop directly.
      setCropRect(json.cropRect ?? null);
    } else {
      // setImage() (called from loadImageFile below) will reset cropRect,
      // so stash it and re-apply once that image finishes loading.
      pendingCropRef.current = json.cropRect ?? null;
    }
    if (!savedImageName || skipImageLoad) return;

    if (dirHandle) {
      const imageFile = await readFileFromDir(dirHandle, savedImageName);
      if (imageFile) {
        setCurrentImageDir(dirHandle);
        await loadImageFile(imageFile, dirHandle);
        return;
      }
    }
    showToast(`Project references "${savedImageName}", which wasn't found alongside it.`, 'error');
  }

  // ── folder actions ──────────────────────────────────────────────────────────

  const handlePickFolder = async () => {
    if (!isFsApiSupported()) { showToast('File System API not supported in this browser.', 'error'); return; }
    try {
      // @ts-expect-error — showDirectoryPicker is draft but widely supported
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await persistDirHandle(handle);
      setRootHandle(handle);
      setSelectedPath('');
      setCragCsvRoutes([]);
      const images = await rescan(handle);
      if (images.length === 0) showToast('No images found in this folder (or its subfolders).', 'error');
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') showToast(`Could not open folder: ${err.message}`, 'error');
    }
  };

  const handleSelectImage = async (relPath: string) => {
    setSelectedPath(relPath);
    if (!relPath) return;
    const found = foundImages.find((f) => f.relPath === relPath);
    if (found) await openFoundImage(found);
  };

  // ── save / export ───────────────────────────────────────────────────────────

  // Re-reads the crag CSV fresh from disk and refreshes linked routes' name/
  // number/grade from it — used right before save/export so those files
  // reflect the CSV's current contents even if it was edited outside the
  // topo tool since this image was opened. Also updates `cragCsvRoutes` so
  // the sidebar's picker stays in sync. Returns the refreshed routes.
  async function refreshFromCsvBeforeWrite(): Promise<import('../types').Route[]> {
    const freshCsvRoutes = await loadCragCsv(currentImageDir, rootHandle).catch(() => []);
    setCragCsvRoutes(freshCsvRoutes);
    if (freshCsvRoutes.length === 0) return routes;
    const { routes: refreshed, staleRouteIds } = refreshRoutesFromCsv(routes, freshCsvRoutes);
    if (staleRouteIds.length > 0) {
      showToast(`${staleRouteIds.length} route(s) reference a Route ID no longer in the CSV.`, 'error');
    }
    setRoutes(refreshed);
    return refreshed;
  }

  const handleSaveProject = async () => {
    const freshRoutes = await refreshFromCsvBeforeWrite();
    await saveProject({ imagePath, imageDataUrl, imageSize, routes: freshRoutes, overlayScale, cropRect, dirHandle: currentImageDir });
    showToast(currentImageDir ? `Saved to ${currentImageDir.name}` : 'Project downloaded');
  };

  const handleExport = async () => {
    if (!imageDataUrl) { showToast('No image loaded.', 'error'); return; }
    const freshRoutes = await refreshFromCsvBeforeWrite();
    await exportImage({ imageDataUrl, imageSize, routes: freshRoutes, overlayScale, imagePath, cropRect, dirHandle: currentImageDir });
    showToast(currentImageDir ? `Exported to ${currentImageDir.name}` : 'Image downloaded');
    if (rootHandle) await rescan(rootHandle); // drop the newly-exported "_withRoutes" file from the picker
  };

  const handleToggleCrop = () => {
    setMode(mode === 'crop' ? 'select' : 'crop');
  };

  const handleClearCrop = () => setCropRect(null);

  const toggleHelp = () => {
    if (!showHelp && helpBtnRef.current) {
      const r = helpBtnRef.current.getBoundingClientRect();
      setHelpAnchor({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setShowHelp(v => !v);
  };

  const canAddPitch = !!selectedRouteId;
  const folderName  = rootHandle?.name ?? null;

  return (
    <div className="toolbar">

      {/* ── Group 1: File operations ── */}
      <div className="toolbar-group">
        {isFsApiSupported() ? (
          <>
            <button
              className={`toolbar-btn${folderName ? ' toolbar-btn--active' : ''}`}
              onClick={handlePickFolder}
              title={folderName ? `Work folder: ${folderName}\nClick to change` : 'Pick a work folder to scan for images'}
            >
              📁 {folderName ? folderName : 'Pick work folder'}
            </button>
            <select
              className="toolbar-select"
              value={selectedPath}
              onChange={(e) => handleSelectImage(e.target.value)}
              disabled={!rootHandle || scanning || foundImages.length === 0}
              title="Choose an image to open"
            >
              <option value="" disabled>
                {scanning ? 'Scanning…' : foundImages.length === 0 ? 'No images found' : 'Select an image…'}
              </option>
              {foundImages.map((img) => (
                <option key={img.relPath} value={img.relPath}>{img.relPath}</option>
              ))}
            </select>
          </>
        ) : (
          <span className="toolbar-label">File System API not supported in this browser.</span>
        )}
        <button
          className="toolbar-btn"
          onClick={handleSaveProject}
          disabled={!imageDataUrl}
          title={currentImageDir ? `Save to ${currentImageDir.name}` : 'Save Project (JSON)'}
        >
          💾 Save
        </button>
        <button
          className="toolbar-btn toolbar-btn--accent"
          onClick={handleExport}
          disabled={!imageDataUrl}
          title={currentImageDir ? `Export to ${currentImageDir.name}` : 'Export JPEG with routes overlay'}
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
        <button
          className={`toolbar-btn ${mode === 'crop' ? 'toolbar-btn--active' : ''}`}
          onClick={handleToggleCrop}
          disabled={!imageDataUrl}
          title="Adjust export crop area"
        >
          ⛶ Crop
        </button>
        {cropRect && (
          <button
            className="toolbar-btn"
            onClick={handleClearCrop}
            title="Clear crop (export full image)"
          >
            ✕ Clear crop
          </button>
        )}
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
