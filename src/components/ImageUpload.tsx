import { useRef } from 'react';
import type { CardConfig, GenerateImageResponse } from '../../shared/types.ts';

interface Props {
  config: CardConfig;
  onUploadComplete: (data: GenerateImageResponse) => void;
  isUploading: boolean;
  setIsUploading: (v: boolean) => void;
}

export function ImageUpload({ config, onUploadComplete, isUploading, setIsUploading }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('config', JSON.stringify(config));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data: GenerateImageResponse = await response.json();
      onUploadComplete(data);
    } catch (error) {
      alert(`Upload error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="panel">
      <h3>Or: Upload Your Own Image</h3>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      <button
        className="upload-btn"
        onClick={() => fileRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? 'Uploading...' : 'Choose Image'}
      </button>
    </div>
  );
}
