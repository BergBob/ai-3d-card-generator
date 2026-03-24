import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ApiKeys {
  openrouterKey: string;
  openaiKey: string;
  stabilityKey: string;
  googleAiKey: string;
}

const KEY_CONFIGS = [
  { field: 'openrouterKey' as const, label: 'OpenRouter', placeholder: 'sk-or-...', url: 'https://openrouter.ai/keys', urlLabel: 'openrouter.ai/keys', hint: 'Gemini 2.5 Flash, 3 Pro, 3.1 Flash' },
  { field: 'googleAiKey' as const, label: 'Google AI Studio', placeholder: 'AI...', url: 'https://aistudio.google.com/apikey', urlLabel: 'aistudio.google.com', hint: 'Gemini Flash (direct)' },
];

export function SettingsDialog({ isOpen, onClose }: Props) {
  const [keys, setKeys] = useState<ApiKeys>({ openrouterKey: '', openaiKey: '', stabilityKey: '', googleAiKey: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings')
        .then((r) => r.json())
        .then((data) => setKeys({
          openrouterKey: data.openrouterKey || '',
          openaiKey: data.openaiKey || '',
          stabilityKey: data.stabilityKey || '',
          googleAiKey: data.googleAiKey || '',
        }))
        .catch(() => {});
      setSaved(false);
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => onClose(), 1000);
      }
    } catch {
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog settings-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>API Keys</h3>
        {KEY_CONFIGS.map(({ field, label, placeholder, url, urlLabel, hint }) => (
          <div key={field} className="settings-key-row">
            <label className="settings-label">{label} <span className="settings-model-hint">{hint}</span></label>
            <input
              type="password"
              value={keys[field] || ''}
              onChange={(e) => setKeys({ ...keys, [field]: e.target.value })}
              placeholder={placeholder}
              className="dialog-input"
            />
            <p className="settings-hint">
              <a href={url} target="_blank" rel="noreferrer">{urlLabel}</a>
            </p>
          </div>
        ))}
        <div className="dialog-actions">
          <button onClick={onClose} className="dialog-cancel">Cancel</button>
          <button onClick={handleSave} disabled={isSaving}>
            {saved ? 'Saved!' : isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
