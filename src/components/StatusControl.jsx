import { TASK_STATUSES } from '../services/format.js';

// Segmented Pending / Done / N/A control used on every task row.
export default function StatusControl({ value, onChange, disabled = false }) {
  return (
    <div className={'status-control' + (disabled ? ' disabled' : '')}>
      {TASK_STATUSES.map((s) => (
        <button
          key={s.value}
          type="button"
          disabled={disabled}
          className={'status-option status-' + s.value + (value === s.value ? ' active' : '')}
          onClick={() => !disabled && onChange(s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
