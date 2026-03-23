export interface HistoryEntry {
  id: string;
  prompt: string;
  originalUrl: string;
  heightmapUrl: string;
  timestamp: number;
}

interface Props {
  history: HistoryEntry[];
  currentId: string | null;
  onRestore: (entry: HistoryEntry) => void;
}

export function HistoryGallery({ history, currentId, onRestore }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="panel history-panel">
      <h3>History</h3>
      <div className="history-grid">
        {history.map((entry) => (
          <button
            key={entry.id}
            className={`history-item ${entry.id === currentId ? 'active' : ''}`}
            onClick={() => onRestore(entry)}
            title={entry.prompt}
          >
            <img src={entry.originalUrl} alt={entry.prompt} />
          </button>
        ))}
      </div>
    </div>
  );
}
