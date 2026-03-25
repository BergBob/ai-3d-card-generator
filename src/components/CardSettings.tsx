import { useState } from 'react';
import type { CardConfig } from '../../shared/types.ts';

interface Props {
  config: CardConfig;
  onChange: (config: CardConfig) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="setting-row">
      <label>
        {label}: <strong>{value ?? 0}{unit}</strong>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export function CardSettings({ config, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const update = (key: keyof CardConfig, value: number) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="panel">
      <h3 className="collapsible-header" onClick={() => setCollapsed(!collapsed)}>
        Card Settings
        <span className={`collapse-arrow ${collapsed ? '' : 'open'}`}>▸</span>
      </h3>
      {!collapsed && <>
      <Slider
        label="Width"
        value={config.width}
        min={40}
        max={256}
        step={1}
        unit="mm"
        onChange={(v) => update('width', v)}
      />
      <Slider
        label="Height"
        value={config.height}
        min={40}
        max={256}
        step={1}
        unit="mm"
        onChange={(v) => update('height', v)}
      />
      <Slider
        label="Base Thickness"
        value={config.baseThickness}
        min={0.4}
        max={3}
        step={0.2}
        unit="mm"
        onChange={(v) => update('baseThickness', v)}
      />
      <Slider
        label="Relief Height"
        value={config.reliefHeight}
        min={0.4}
        max={4}
        step={0.2}
        unit="mm"
        onChange={(v) => update('reliefHeight', v)}
      />
      <Slider
        label="Corner Radius"
        value={config.cornerRadius}
        min={0}
        max={15}
        step={0.5}
        unit="mm"
        onChange={(v) => update('cornerRadius', v)}
      />
      <div className="setting-row toggle-row">
        <span>Invert</span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={config.invert ?? true}
            onChange={(e) => onChange({ ...config, invert: e.target.checked })}
          />
          <span className="toggle-slider" />
        </label>
      </div>
      <div className="setting-row toggle-row">
        <span>Border</span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={config.border?.enabled ?? false}
            onChange={(e) => onChange({ ...config, border: { ...config.border ?? { width: 3, height: 1.2 }, enabled: e.target.checked } })}
          />
          <span className="toggle-slider" />
        </label>
      </div>
      {config.border?.enabled && (
        <>
          <Slider
            label="Border Width"
            value={config.border.width}
            min={1}
            max={10}
            step={0.5}
            unit="mm"
            onChange={(v) => onChange({ ...config, border: { ...config.border!, width: v } })}
          />
          <Slider
            label="Border Height"
            value={config.border.height}
            min={0.4}
            max={4}
            step={0.2}
            unit="mm"
            onChange={(v) => onChange({ ...config, border: { ...config.border!, height: v } })}
          />
        </>
      )}
      <div className="color-row">
        <span>Preview Colors</span>
        <div className="color-pickers">
          <label className="color-picker">
            <span>Base</span>
            <input
              type="color"
              value={config.baseColor ?? '#e0e0e0'}
              onChange={(e) => onChange({ ...config, baseColor: e.target.value })}
            />
          </label>
          <label className="color-picker">
            <span>Relief</span>
            <input
              type="color"
              value={config.reliefColor ?? '#818cf8'}
              onChange={(e) => onChange({ ...config, reliefColor: e.target.value })}
            />
          </label>
        </div>
      </div>
      </>}
    </div>
  );
}
