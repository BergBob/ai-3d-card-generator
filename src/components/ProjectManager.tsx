import { useState, useEffect, useCallback } from 'react';
import type { CardConfig } from '../../shared/types.ts';
import type { ChatMessage } from './AIPrompt.tsx';

interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  lastModified: number;
  prompt: string;
}

interface ProjectData {
  name: string;
  config: CardConfig;
  generationId: string | null;
  chatHistory: ChatMessage[];
  originalImageUrl: string | null;
  heightmapUrl: string | null;
}

interface Props {
  config: CardConfig;
  generationId: string | null;
  chatHistory: ChatMessage[];
  onLoad: (data: ProjectData) => void;
}

export function ProjectManager({ config, generationId, chatHistory, onLoad }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [showDialog, setShowDialog] = useState<'save' | 'load' | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadProjectList = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) setProjects(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (showDialog === 'load') loadProjectList();
  }, [showDialog, loadProjectList]);

  const handleSave = async () => {
    if (!projectName.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          config,
          generationId,
          chatHistory,
        }),
      });
      if (res.ok) {
        setShowDialog(null);
        setProjectName('');
      }
    } catch (err) {
      alert('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoad = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Load failed');
      const data = await res.json();
      onLoad({
        name: data.name,
        config: data.config,
        generationId: data.generationId,
        chatHistory: data.chatHistory || [],
        originalImageUrl: data.originalImageUrl,
        heightmapUrl: data.heightmapUrl,
      });
      setShowDialog(null);
    } catch {
      alert('Failed to load project');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      loadProjectList();
    } catch { /* ignore */ }
  };

  return (
    <>
      <div className="project-buttons">
        <button className="project-btn" onClick={() => setShowDialog('save')}>Save</button>
        <button className="project-btn" onClick={() => setShowDialog('load')}>Load</button>
      </div>

      {showDialog && (
        <div className="dialog-overlay" onClick={() => setShowDialog(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            {showDialog === 'save' ? (
              <>
                <h3>Save Project</h3>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name..."
                  className="dialog-input"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                />
                <div className="dialog-actions">
                  <button onClick={() => setShowDialog(null)} className="dialog-cancel">Cancel</button>
                  <button onClick={handleSave} disabled={!projectName.trim() || isSaving}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>Load Project</h3>
                {projects.length === 0 ? (
                  <p className="dialog-empty">No saved projects yet.</p>
                ) : (
                  <div className="project-list">
                    {projects.map((p) => (
                      <div key={p.id} className="project-list-item">
                        <div className="project-list-info" onClick={() => handleLoad(p.id)}>
                          <strong>{p.name}</strong>
                          <span>{new Date(p.lastModified).toLocaleDateString()}</span>
                        </div>
                        <button className="project-list-delete" onClick={() => handleDelete(p.id)}>x</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="dialog-actions">
                  <button onClick={() => setShowDialog(null)} className="dialog-cancel">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
