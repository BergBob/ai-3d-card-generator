interface Props {
  originalUrl: string | null;
  heightmapUrl: string | null;
}

export function ImagePreview({ originalUrl, heightmapUrl }: Props) {
  if (!originalUrl && !heightmapUrl) return null;

  return (
    <div className="panel">
      <h3>Bildvorschau</h3>
      <div className="image-preview-grid">
        {originalUrl && (
          <div className="image-preview-item">
            <span>Original</span>
            <img src={originalUrl} alt="KI-generiertes Bild" />
          </div>
        )}
        {heightmapUrl && (
          <div className="image-preview-item">
            <span>Heightmap</span>
            <img src={heightmapUrl} alt="Heightmap" />
          </div>
        )}
      </div>
    </div>
  );
}
