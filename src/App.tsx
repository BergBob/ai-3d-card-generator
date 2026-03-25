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
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [generationHistory, setGenerationHistory] = useState<HistoryEntry[]>([]);

  const [hostedMode, setHostedMode] = useState(false);

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStlUrlRef = useRef<string | null>(null);

  // Check if running in hosted mode
  useEffect(() => {
    fetch('/api/settings/mode')
      .then(r => r.json())
      .then(data => setHostedMode(data.hosted))
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
          throw new Error(err.error || 'Generation failed');
        }

        const data: GenerateImageResponse = await response.json();
        applyGeneration(data);
        setPromptHistory(allPrompts);

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
        <button className="project-btn" onClick={handleNewCard} title="New Card">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        {!hostedMode && (
          <button className="project-btn" onClick={() => setShowSettings(true)} title="Settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        )}
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
      </header>
      <main className="app-main">
        <aside className="sidebar">
          <CardSettings config={config} onChange={setConfig} />
          <AIPrompt
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            chatHistory={chatHistory}
            onOpenSettings={() => setShowSettings(true)}
            hostedMode={hostedMode}
          />
          <HistoryGallery
            history={generationHistory}
            currentId={generationId}
            onRestore={handleRestore}
          />
          {error && <div className="error-msg">{error}</div>}
          <ExportButton generationId={generationId} config={config} />
        </aside>
        <section className="preview-area">
          <div className="preview-3d-container">
            <Preview3D stlUrl={stlUrl} config={config} />
          </div>
          {originalUrl && (
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
        </section>
      </main>
      <SettingsDialog isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

export default App;
