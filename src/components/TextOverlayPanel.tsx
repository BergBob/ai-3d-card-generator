import { useState } from 'react';
import type { CardConfig, TextOverlay } from '../../shared/types.ts';

interface Props {
  config: CardConfig;
  onChange: (config: CardConfig) => void;
}

const FONTS = ['Helvetica', 'Arial', 'Courier', 'Times'];

export function TextOverlayPanel({ config, onChange }: Props) {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(10);
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [x, setX] = useState(10);
  const [y, setY] = useState(10);

  const overlays = config.textOverlays ?? [];

  const addOverlay = () => {
    if (!text.trim()) return;
    const newOverlay: TextOverlay = { text: text.trim(), x, y, fontSize, fontFamily };
    onChange({ ...config, textOverlays: [...overlays, newOverlay] });
    setText('');
  };

  const removeOverlay = (index: number) => {
    onChange({ ...config, textOverlays: overlays.filter((_, i) => i !== index) });
  };

  return (
    <div className="panel text-overlay-panel">
      <h3>Text Overlay</h3>

      {overlays.length > 0 && (
        <div className="text-overlay-list">
          {overlays.map((o, i) => (
            <div key={i} className="text-overlay-item">
              <span className="text-overlay-preview">"{o.text}"</span>
              <button className="text-overlay-remove" onClick={() => removeOverlay(i)}>x</button>
            </div>
          ))}
        </div>
      )}

      <div className="text-overlay-form">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text..."
          className="text-overlay-input"
          onKeyDown={(e) => { if (e.key === 'Enter') addOverlay(); }}
        />
        <div className="text-overlay-controls">
          <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
            {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label>
            Size
            <input type="number" value={fontSize} min={3} max={30} step={1}
              onChange={(e) => setFontSize(parseFloat(e.target.value))} />
          </label>
          <label>
            X
            <input type="number" value={x} min={0} max={config.width} step={1}
              onChange={(e) => setX(parseFloat(e.target.value))} />
          </label>
          <label>
            Y
            <input type="number" value={y} min={0} max={config.height} step={1}
              onChange={(e) => setY(parseFloat(e.target.value))} />
          </label>
        </div>
        <button className="text-overlay-add" onClick={addOverlay} disabled={!text.trim()}>
          Add Text
        </button>
      </div>
    </div>
  );
}
