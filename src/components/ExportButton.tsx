import { useState } from 'react';
import type { CardConfig } from '../../shared/types.ts';

interface Props {
  generationId: string | null;
  config: CardConfig;
}

type ExportFormat = '3mf' | 'stl';

export function ExportButton({ generationId, config }: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    if (!generationId) return;
    setIsExporting(true);

    const endpoint = format === 'stl' ? '/api/export-stl' : '/api/export';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: generationId, config }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `card.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Export error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="panel export-panel">
      <button
        className="export-btn"
        onClick={() => handleExport('3mf')}
        disabled={!generationId || isExporting}
      >
        {isExporting ? 'Exporting...' : 'Download 3MF'}
      </button>
      <button
        className="export-btn export-btn-secondary"
        onClick={() => handleExport('stl')}
        disabled={!generationId || isExporting}
      >
        {isExporting ? 'Exporting...' : 'Download STL'}
      </button>
    </div>
  );
}
