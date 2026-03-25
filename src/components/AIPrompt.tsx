import { useState, useRef, useEffect } from 'react';
import type { AIProvider } from '../../shared/types.ts';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
}

interface Props {
  onGenerate: (prompt: string, provider: AIProvider) => void;
  isGenerating: boolean;
  chatHistory: ChatMessage[];
  onOpenSettings: () => void;
  hostedMode?: boolean;
}

interface AvailableModel {
  value: AIProvider;
  label: string;
}

const ALL_MODELS: { value: AIProvider; label: string; keyField: string }[] = [
  // Gemini via OpenRouter
  { value: 'openrouter', label: 'Gemini 2.5 Flash (OpenRouter)', keyField: 'openrouterKey' },
  { value: 'openrouter-gemini-pro', label: 'Gemini 3 Pro (OpenRouter)', keyField: 'openrouterKey' },
  { value: 'openrouter-gemini-31', label: 'Gemini 3.1 Flash (OpenRouter)', keyField: 'openrouterKey' },
  // Gemini via Google AI Studio (direct)
  { value: 'google-imagen', label: 'Gemini 2.5 Flash (Google AI)', keyField: 'googleAiKey' },
];

export function AIPrompt({ onGenerate, isGenerating, chatHistory, onOpenSettings, hostedMode }: Props) {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<AIProvider>('openrouter');
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch available keys to filter models
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((keys) => {
        const available = ALL_MODELS.filter((m) => {
          const val = keys[m.keyField];
          return val && val.length > 0;
        });
        setAvailableModels(available);
        // If current provider not available, switch to first available
        if (available.length > 0 && !available.find((m) => m.value === provider)) {
          setProvider(available[0].value);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onGenerate(prompt.trim(), provider);
      setPrompt('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="panel chat-panel">
      <h3>Design Chat</h3>

      <div className="chat-history">
        {chatHistory.length === 0 && (
          <div className="chat-empty">
            Describe your card design — you can refine the result in the chat afterwards.
          </div>
        )}
        {chatHistory.filter(m => m.text !== '__RATE_LIMIT__').map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-label">
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className="chat-msg-text">{msg.text}</div>
            {msg.imageUrl && (
              <img src={msg.imageUrl} alt="Generated image" className="chat-msg-img" />
            )}
          </div>
        ))}
        {isGenerating && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-label">AI</div>
            <div className="chat-msg-text generating">Generating image...</div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatHistory.length === 0
              ? 'e.g.: Birthday cake with candles and balloons'
              : 'e.g.: Make the flowers bigger and add stars...'}
            rows={2}
            disabled={isGenerating}
          />
          <button type="submit" disabled={!prompt.trim() || isGenerating}>
            ➤
          </button>
        </div>
        {hostedMode && (
          <p className="chat-consent-hint">
            By clicking Generate, you agree that your input will be sent to OpenRouter/Google (USA) for processing.{' '}
            <a href="https://borishaggenmueller.de/datenschutz.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </p>
        )}
        {!hostedMode && (
          <>
            {availableModels.length > 0 ? (
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as AIProvider)}
                disabled={isGenerating}
                className="chat-provider-select"
              >
                {availableModels.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            ) : (
              <button type="button" className="chat-add-key-btn" onClick={onOpenSettings}>
                Add API key to get started
              </button>
            )}
            {availableModels.length > 0 && (
              <button type="button" className="chat-more-models" onClick={onOpenSettings}>
                More models? Add API keys
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}
