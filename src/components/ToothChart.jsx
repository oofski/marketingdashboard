import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { ToothFindings } from '../services/db.js';

export const TOOTH_CONDITIONS = [
  { code: 'healthy',     label: 'Healthy',      color: '#ffffff' },
  { code: 'cavity',      label: 'Cavity / Caries', color: '#d98b2a' },
  { code: 'filled',      label: 'Filled',       color: '#1f6feb' },
  { code: 'crown',       label: 'Crown',        color: '#9c6cc7' },
  { code: 'missing',     label: 'Missing',      color: '#6a7585' },
  { code: 'implant',     label: 'Implant',      color: '#1f9d55' },
  { code: 'root_canal',  label: 'Root Canal',   color: '#b03a8a' },
  { code: 'sensitive',   label: 'Sensitive',    color: '#f4d03f' },
  { code: 'extraction',  label: 'Needs Extraction', color: '#c93b3b' },
  { code: 'watch',       label: 'Watch',        color: '#6cc7c0' },
];

export const SURFACES = [
  { code: 'occlusal',  label: 'Occlusal (O)' },
  { code: 'buccal',    label: 'Buccal (B)' },
  { code: 'lingual',   label: 'Lingual (L)' },
  { code: 'mesial',    label: 'Mesial (M)' },
  { code: 'distal',    label: 'Distal (D)' },
  { code: 'incisal',   label: 'Incisal (I)' },
];

function getConditionColor(code) {
  return TOOTH_CONDITIONS.find((c) => c.code === code)?.color;
}

export default function ToothChart({ visitId, onChange }) {
  const [findings, setFindings] = useState({});
  const [selected, setSelected] = useState(null);

  function refresh() {
    const all = ToothFindings.forVisit(visitId);
    const byTooth = {};
    for (const f of all) byTooth[f.tooth_number] = f;
    setFindings(byTooth);
  }

  useEffect(() => {
    refresh();
  }, [visitId]);

  function selectTooth(n) {
    setSelected(n);
  }

  function saveFinding(toothNumber, data) {
    if (!data.condition || data.condition === 'healthy') {
      ToothFindings.remove(visitId, toothNumber);
    } else {
      const color = getConditionColor(data.condition);
      ToothFindings.upsert(visitId, toothNumber, { ...data, color });
    }
    refresh();
    onChange?.();
  }

  function removeFinding(toothNumber) {
    ToothFindings.remove(visitId, toothNumber);
    refresh();
    onChange?.();
  }

  const selectedFinding = selected != null ? findings[selected] : null;

  return (
    <div>
      <div className="tooth-chart">
        <div className="tooth-chart-arch">
          <div className="tooth-chart-arch-label">Upper Arch — Right to Left (Universal #1-16)</div>
          <div className="tooth-row">
            {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
              <Tooth
                key={n}
                number={n}
                isUpper
                finding={findings[n]}
                selected={selected === n}
                onClick={() => selectTooth(n)}
              />
            ))}
          </div>
        </div>
        <div className="tooth-chart-arch">
          <div className="tooth-chart-arch-label">Lower Arch — Left to Right (Universal #17-32)</div>
          <div className="tooth-row">
            {Array.from({ length: 16 }, (_, i) => 32 - i).map((n) => (
              <Tooth
                key={n}
                number={n}
                finding={findings[n]}
                selected={selected === n}
                onClick={() => selectTooth(n)}
              />
            ))}
          </div>
        </div>

        <div className="tooth-legend">
          {TOOTH_CONDITIONS.filter((c) => c.code !== 'healthy').map((c) => (
            <div className="tooth-legend-item" key={c.code}>
              <div className="tooth-legend-swatch" style={{ background: c.color }} />
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {selected != null && (
        <ToothDetailEditor
          toothNumber={selected}
          finding={selectedFinding}
          onSave={(data) => saveFinding(selected, data)}
          onRemove={() => removeFinding(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Tooth({ number, finding, selected, isUpper, onClick }) {
  const hasFinding = !!finding && finding.condition && finding.condition !== 'healthy';
  const classNames = [
    'tooth',
    !isUpper && 'tooth-lower',
    selected && 'selected',
    hasFinding && 'has-finding',
  ].filter(Boolean).join(' ');

  const bg = hasFinding ? finding.color || getConditionColor(finding.condition) : null;
  const title = finding
    ? `Tooth #${number}: ${finding.condition || 'no finding'}${finding.surfaces ? ' (' + finding.surfaces + ')' : ''}`
    : `Tooth #${number}`;

  return (
    <div
      className={classNames}
      style={bg ? { background: bg } : undefined}
      onClick={onClick}
      title={title}
    >
      {!hasFinding && (
        <div className="tooth-surfaces">
          <div style={{ gridArea: 'o', textAlign: 'center' }}>O</div>
          <div style={{ gridArea: 'm', textAlign: 'left' }}>M</div>
          <div style={{ gridArea: 'd', textAlign: 'right' }}>D</div>
          <div style={{ gridArea: 'l', textAlign: 'center' }}>L</div>
        </div>
      )}
      <div className="tooth-number">{number}</div>
    </div>
  );
}

function ToothDetailEditor({ toothNumber, finding, onSave, onRemove, onClose }) {
  const [condition, setCondition] = useState(finding?.condition || 'healthy');
  const [surfaces, setSurfaces] = useState(() => {
    if (!finding?.surfaces) return new Set();
    return new Set(finding.surfaces.split(',').map((s) => s.trim()));
  });
  const [note, setNote] = useState(finding?.note || '');

  useEffect(() => {
    setCondition(finding?.condition || 'healthy');
    setSurfaces(new Set(finding?.surfaces?.split(',').map((s) => s.trim()).filter(Boolean) || []));
    setNote(finding?.note || '');
  }, [toothNumber, finding]);

  function toggleSurface(code) {
    setSurfaces((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleSave() {
    onSave({
      condition,
      surfaces: Array.from(surfaces).join(','),
      note,
    });
  }

  return (
    <div className="tooth-detail-panel mt-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Tooth #{toothNumber}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          {finding && (
            <button className="btn btn-sm btn-danger" onClick={onRemove}>
              <Trash2 size={12} /> Remove
            </button>
          )}
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label">Condition</label>
          <select className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>
            {TOOTH_CONDITIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">Surfaces affected</label>
          <div>
            {SURFACES.map((s) => (
              <span
                key={s.code}
                className={'surface-toggle' + (surfaces.has(s.code) ? ' active' : '')}
                onClick={() => toggleSurface(s.code)}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="field">
        <label className="label">Note</label>
        <textarea
          className="textarea"
          rows={2}
          placeholder="Optional finding note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={handleSave}>Save Finding</button>
      </div>
    </div>
  );
}
