import { useEffect, useRef } from "react";
import { COLORS, type Tier } from "../types";

type Props = {
  tier: Tier;
  onChange: (patch: Partial<Tier>) => void;
  onClose: () => void;
  onAddAbove: () => void;
  onAddBelow: () => void;
  onClear: () => void;
  onDelete: () => void;
};

export function SettingsModal({ tier, onChange, onClose, onAddAbove, onAddBelow, onClear, onDelete }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <button className="modal-close" onClick={onClose} aria-label="Закрыть">
          &times;
        </button>
        <h2>Настройки ряда</h2>

        <label className="field-label" htmlFor="labelInput">
          Название
        </label>
        <textarea
          id="labelInput"
          ref={inputRef}
          rows={2}
          value={tier.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />

        <div className="field-label">Цвет</div>
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch${c.toLowerCase() === tier.color.toLowerCase() ? " active" : ""}`}
              style={{ background: c }}
              onClick={() => onChange({ color: c })}
              aria-label={c}
            />
          ))}
          <input type="color" title="Свой цвет" value={tier.color} onChange={(e) => onChange({ color: e.target.value })} />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onAddAbove}>Добавить ряд выше</button>
          <button className="btn" onClick={onAddBelow}>Добавить ряд ниже</button>
          <button className="btn" onClick={onClear}>Очистить ряд</button>
          <button className="btn danger" onClick={onDelete}>Удалить ряд</button>
        </div>
      </div>
    </div>
  );
}
