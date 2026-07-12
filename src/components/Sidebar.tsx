/**
 * Right-side panel: route list + selected route/pitch editor.
 */
import React, { useRef } from 'react';
import { useEditor } from '../context/EditorContext';
import { FrenchGrade, Route, Pitch } from '../types';
import { FRENCH_GRADES, getDisplayNumber, getGradeColor } from '../constants';

export function Sidebar() {
  const {
    routes,
    selectedRouteId,
    selectedPitchId,
    setSelectedRoute,
    mode,
    setMode,
    removeRoute,
    updateRoute,
    reorderRoutes,
    addPitch,
    removePitch,
    updatePitch,
    hoveredRouteId,
    setHoveredRouteId,
  } = useEditor();

  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);
  const [showNames, setShowNames] = React.useState(true);

  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? null;
  const selectedPitch = selectedRoute?.pitches.find((p) => p.id === selectedPitchId) ?? null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Routes</span>
        <span className="sidebar-count">{routes.length}</span>
        <button
          className={`sidebar-names-btn${showNames ? '' : ' sidebar-names-btn--hidden'}`}
          onClick={() => setShowNames(v => !v)}
          title={showNames ? 'Hide route names' : 'Show route names'}
        >
          {showNames ? '𝐓' : '𝐓̶'}
        </button>
      </div>

      {/* Route list */}
      <div className="route-list">
        {routes.length === 0 && (
          <p className="route-list-empty">No routes yet. Click "+ Route" to start.</p>
        )}
        {routes.map((route, idx) => (
          <RouteRow
            key={route.id}
            route={route}
            isSelected={route.id === selectedRouteId}
            isHovered={route.id === hoveredRouteId}
            isDragOver={dragOver === idx}
            selectedPitchId={selectedPitchId}
            showName={showNames}
            onSelect={(pitchId) => {
              setSelectedRoute(route.id, pitchId ?? null);
              setMode('draw');
            }}
            onHover={(hov) => setHoveredRouteId(hov ? route.id : null)}
            onDelete={() => removeRoute(route.id)}
            onUpdate={(patch) => updateRoute(route.id, patch)}
            onAddPitch={() => addPitch(route.id)}
            onRemovePitch={(pitchId) => removePitch(route.id, pitchId)}
            onUpdatePitch={(pitchId, patch) => updatePitch(route.id, pitchId, patch)}
            onDragStart={() => { dragIdx.current = idx; }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(idx); }}
            onDrop={() => {
              if (dragIdx.current !== null && dragIdx.current !== idx) {
                reorderRoutes(dragIdx.current, idx);
              }
              dragIdx.current = null;
              setDragOver(null);
            }}
            onDragEnd={() => { dragIdx.current = null; setDragOver(null); }}
          />
        ))}
      </div>

      {/* Grade legend */}
      <GradeLegend />
    </aside>
  );
}

// ── Route row ─────────────────────────────────────────────────────────────────

type RouteRowProps = {
  route: Route;
  isSelected: boolean;
  isHovered: boolean;
  isDragOver: boolean;
  selectedPitchId: string | null;
  showName: boolean;
  onSelect: (pitchId?: string) => void;
  onHover: (hov: boolean) => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Omit<Route, 'id' | 'pitches'>>) => void;
  onAddPitch: () => void;
  onRemovePitch: (pitchId: string) => void;
  onUpdatePitch: (pitchId: string, patch: Partial<Omit<Pitch, 'id' | 'points'>>) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
};

function RouteRow({
  route, isSelected, isHovered, isDragOver, selectedPitchId, showName,
  onSelect, onHover, onDelete, onUpdate, onAddPitch, onRemovePitch, onUpdatePitch,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: RouteRowProps) {
  const color = getGradeColor(route.grade);

  return (
    <div
      className={`route-row ${isSelected ? 'route-row--selected' : ''} ${isHovered ? 'route-row--hovered' : ''} ${isDragOver ? 'route-row--drag-over' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Route header */}
      <div className="route-row-header" onClick={() => onSelect()}>
        <span className="drag-handle" title="Drag to reorder">⠿</span>
        <span
          className="route-swatch"
          style={{ background: color }}
        />
        <span className="route-number-prefix">#</span>
        <input
          className={`route-number-input${route.numberOverride != null ? ' route-number-input--override' : ''}`}
          type="number"
          min={1}
          value={getDisplayNumber(route)}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') { onUpdate({ numberOverride: undefined }); return; }
            const n = parseInt(raw, 10);
            if (!Number.isNaN(n)) onUpdate({ numberOverride: n });
          }}
          onClick={(e) => e.stopPropagation()}
          title="Route number shown on the topo (overrides auto position-based numbering; clear to reset)"
        />
        {route.numberOverride != null && (
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); onUpdate({ numberOverride: undefined }); }}
            title={`Reset to auto number (#${route.number})`}
          >
            ↺
          </button>
        )}

        {/* Route name (editable, hideable) */}
        {showName && (
          <input
            className="route-name-input"
            value={route.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Route name"
          />
        )}

        {/* Route grade selector */}
        <GradeSelect
          value={route.grade}
          onChange={(g) => onUpdate({ grade: g })}
        />

        {/* Delete button */}
        <button
          className="icon-btn icon-btn--danger"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete route"
        >
          ×
        </button>
      </div>

      {/* Pitch list (expanded when route selected) */}
      {isSelected && (
        <div className="pitch-list">
          {route.pitches.map((pitch, idx) => (
            <PitchRow
              key={pitch.id}
              pitch={pitch}
              index={idx + 1}
              isSelected={pitch.id === selectedPitchId}
              onSelect={() => onSelect(pitch.id)}
              onDelete={() => onRemovePitch(pitch.id)}
              onUpdate={(patch) => onUpdatePitch(pitch.id, patch)}
            />
          ))}
          <button className="add-pitch-btn" onClick={onAddPitch}>
            + Add pitch
          </button>
        </div>
      )}
    </div>
  );
}

// ── Pitch row ─────────────────────────────────────────────────────────────────

type PitchRowProps = {
  pitch: Pitch;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Omit<Pitch, 'id' | 'points'>>) => void;
};

function PitchRow({ pitch, index, isSelected, onSelect, onDelete, onUpdate }: PitchRowProps) {
  return (
    <div
      className={`pitch-row ${isSelected ? 'pitch-row--selected' : ''}`}
      onClick={onSelect}
    >
      <span className="pitch-label">P{index}</span>
      <span className="pitch-points">{pitch.points.length} pts</span>
      <GradeSelect
        value={pitch.grade}
        onChange={(g) => onUpdate({ grade: g })}
        compact
      />
      <button
        className="icon-btn icon-btn--danger"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete pitch"
      >
        ×
      </button>
    </div>
  );
}

// ── Grade selector ────────────────────────────────────────────────────────────

type GradeSelectProps = {
  value: FrenchGrade;
  onChange: (g: FrenchGrade) => void;
  compact?: boolean;
};

function GradeSelect({ value, onChange, compact }: GradeSelectProps) {
  return (
    <select
      className={`grade-select ${compact ? 'grade-select--compact' : ''}`}
      value={value}
      onChange={(e) => onChange(e.target.value as FrenchGrade)}
      onClick={(e) => e.stopPropagation()}
      style={{ '--grade-color': getGradeColor(value) } as React.CSSProperties}
    >
      {FRENCH_GRADES.map((g) => (
        <option key={g} value={g}>
          {g || '— Grade'}
        </option>
      ))}
    </select>
  );
}

// ── Grade legend ──────────────────────────────────────────────────────────────

const LEGEND = [
  { label: '5a – 5c+', color: '#4CAF50' },
  { label: '6a – 6b+', color: '#2196F3' },
  { label: '6c – 7a+', color: '#FF9800' },
  { label: '7b – 7c',  color: '#F44336' },
  { label: '7c+',       color: '#9C27B0' },
];

function GradeLegend() {
  return (
    <div className="grade-legend">
      <div className="grade-legend-title">Grade Colors</div>
      {LEGEND.map((l) => (
        <div key={l.label} className="grade-legend-row">
          <span className="grade-legend-swatch" style={{ background: l.color }} />
          <span className="grade-legend-label">{l.label}</span>
        </div>
      ))}
    </div>
  );
}
