import { useState, useCallback, useEffect, useRef } from 'react';
import type { CardConfig, AIProvider, GenerateImageResponse } from '../shared/types.ts';
import { DEFAULT_CONFIG } from '../shared/types.ts';
import { CardSettings } from './components/CardSettings.tsx';
import { AIPrompt, type ChatMessage } from './components/AIPrompt.tsx';
import { Preview3D } from './components/Preview3D.tsx';
import { ExportButton } from './components/ExportButton.tsx';
import { HistoryGallery, type HistoryEntry } from './components/HistoryGallery.tsx';
import { ProjectManager } from './components/ProjectManager.tsx';
import { SettingsDialog } from './components/SettingsDialog.tsx';
import './App.css';

function App() {
  const [config, setConfig] = useState<CardConfig>(DEFAULT_CONFIG);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [heightmapUrl, setHeightmapUrl] = useState<string | null>(null);
  const [stlUrl, setStlUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreviewImages, setShowPreviewImages] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [generationHistory, setGenerationHistory] = useState<HistoryEntry[]>([]);

  const [hostedMode, setHostedMode] = useState(false);
  const [quota, setQuota] = useState<{ limited: boolean; remaining: number; total: number } | null>(null);
  const [rateLimitReached, setRateLimitReached] = useState(false);

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStlUrlRef = useRef<string | null>(null);

  // Check if running in hosted mode + quota
  useEffect(() => {
    fetch('/api/settings/mode')
      .then(r => r.json())
      .then(data => setHostedMode(data.hosted))
      .catch(() => {});
    fetch('/api/generate/quota')
      .then(r => r.json())
      .then(data => {
        setQuota(data);
        if (data.limited && data.remaining === 0) setRateLimitReached(true);
      })
      .catch(() => {});
  }, []);

  const refreshQuota = useCallback(() => {
    fetch('/api/generate/quota')
      .then(r => r.json())
      .then(data => {
        setQuota(data);
        if (data.limited && data.remaining === 0) setRateLimitReached(true);
      })
      .catch(() => {});
  }, []);

  const loadPreview = useCallback(async (id: string, cfg: CardConfig) => {
    try {
      const response = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, config: cfg }),
      });

      if (!response.ok) return;

      const blob = await response.blob();
      if (prevStlUrlRef.current) {
        URL.revokeObjectURL(prevStlUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      prevStlUrlRef.current = url;
      setStlUrl(url);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!generationId) return;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      loadPreview(generationId, config);
    }, 300);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [config, generationId, loadPreview]);

  const saveToHistory = useCallback(() => {
    if (!generationId || !originalUrl || !heightmapUrl) return;
    const lastPrompt = promptHistory[promptHistory.length - 1] || 'Uploaded image';
    setGenerationHistory((prev) => {
      const filtered = prev.filter((e) => e.id !== generationId);
      const updated = [
        { id: generationId, prompt: lastPrompt, originalUrl, heightmapUrl, timestamp: Date.now() },
        ...filtered,
      ];
      return updated.slice(0, 20);
    });
  }, [generationId, originalUrl, heightmapUrl, promptHistory]);

  const applyGeneration = useCallback((data: GenerateImageResponse) => {
    // Save current generation to history before switching
    saveToHistory();
    setGenerationId(data.id);
    setOriginalUrl(data.originalImageUrl);
    setHeightmapUrl(data.heightmapUrl);
  }, [saveToHistory]);

  const handleRestore = useCallback((entry: HistoryEntry) => {
    // Save current before restoring
    saveToHistory();
    setGenerationId(entry.id);
    setOriginalUrl(entry.originalUrl);
    setHeightmapUrl(entry.heightmapUrl);
  }, [saveToHistory]);

  const handleGenerate = useCallback(
    async (prompt: string, provider: AIProvider) => {
      setIsGenerating(true);
      setError(null);
      setChatHistory((prev) => [...prev, { role: 'user', text: prompt }]);

      const allPrompts = [...promptHistory, prompt];
      const fullPrompt = allPrompts.length > 1
        ? `Previous description: ${allPrompts.slice(0, -1).join('. ')}. New change: ${prompt}`
        : prompt;

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: fullPrompt, provider, config }),
        });

        if (!response.ok) {
          const err = await response.json();
          if (err.error === 'RATE_LIMIT') {
            setRateLimitReached(true);
            refreshQuota();
            setChatHistory((prev) => [...prev, { role: 'assistant', text: '__RATE_LIMIT__' }]);
            setIsGenerating(false);
            return;
          }
          throw new Error(err.error || 'Generation failed');
        }

        const data: GenerateImageResponse = await response.json();
        applyGeneration(data);
        setPromptHistory(allPrompts);
        refreshQuota();

        setChatHistory((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'Image generated. You can keep refining — just describe what you\'d like to change.',
            imageUrl: data.originalImageUrl,
          },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', text: `Error: ${msg}` },
        ]);
      } finally {
        setIsGenerating(false);
      }
    },
    [config, applyGeneration, promptHistory],
  );

  const handleNewCard = useCallback(() => {
    setGenerationId(null);
    setOriginalUrl(null);
    setHeightmapUrl(null);
    setStlUrl(null);
    setChatHistory([]);
    setPromptHistory([]);
    setError(null);
    setConfig(DEFAULT_CONFIG);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>AI 3D Card Generator</h1>
        <div className="header-spacer" />
        <button className="project-btn" onClick={handleNewCard} title="Reset / New Card">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
        </button>
        {!hostedMode && (
          <>
            <button className="project-btn" onClick={() => setShowSettings(true)} title="Settings">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <ProjectManager
              config={config}
              generationId={generationId}
              chatHistory={chatHistory}
              onLoad={(data) => {
                setConfig(data.config);
                setGenerationId(data.generationId);
                setOriginalUrl(data.originalImageUrl);
                setHeightmapUrl(data.heightmapUrl);
                setChatHistory(data.chatHistory);
              }}
            />
          </>
        )}
      </header>
      <main className="app-main">
        <aside className="sidebar">
          <CardSettings config={config} onChange={setConfig} />
          {quota?.limited && (
            <div className="quota-bar">
              {quota.remaining} of {quota.total} images remaining today
            </div>
          )}
          {rateLimitReached && (
            <div className="rate-limit-box">
              <div className="rate-limit-icon">⏳</div>
              <div className="rate-limit-title">Daily limit reached</div>
              <p>You've used all {quota?.total ?? 5} free images for today. Come back tomorrow for more!</p>
              <p className="rate-limit-alt">Want unlimited access? Run the app locally — it's free and open source:</p>
              <a href="https://github.com/BergBob/ai-3d-card-generator" target="_blank" rel="noopener noreferrer" className="rate-limit-link">
                ⬇ Download from GitHub
              </a>
            </div>
          )}
          {!rateLimitReached && (
            <AIPrompt
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              chatHistory={chatHistory}
              onOpenSettings={() => setShowSettings(true)}
              hostedMode={hostedMode}
            />
          )}
          <HistoryGallery
            history={generationHistory}
            currentId={generationId}
            onRestore={handleRestore}
          />
          {error && !rateLimitReached && <div className="error-msg">{error}</div>}
          <ExportButton generationId={generationId} config={config} />
        </aside>
        <section className="preview-area">
          <div className="preview-3d-container">
            <Preview3D stlUrl={stlUrl} config={config} />
          </div>
          {originalUrl && (
            <div className="preview-images-section">
              <h3 className="collapsible-header" onClick={() => setShowPreviewImages(!showPreviewImages)}>
                Source Images
                <span className={`collapse-arrow ${showPreviewImages ? 'open' : ''}`}>▸</span>
              </h3>
              {showPreviewImages && (
                <div className="preview-images">
                  <div className="preview-image-item">
                    <span>Original</span>
                    <img src={originalUrl} alt="Original" />
                  </div>
                  <div className="preview-image-item">
                    <span>Heightmap (Relief)</span>
                    <img src={heightmapUrl!} alt="Heightmap" />
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <SettingsDialog isOpen={showSettings} onClose={() => setShowSettings(false)} />
      {hostedMode && (
        <footer className="app-footer">
          <a href="https://borishaggenmueller.de/impressum.html" target="_blank" rel="noopener noreferrer">Impressum</a>
          <span className="footer-sep">·</span>
          <a href="https://borishaggenmueller.de/datenschutz.html" target="_blank" rel="noopener noreferrer">Datenschutz</a>
        </footer>
      )}
    </div>
  );
}

export default App;
