export interface CardConfig {
  width: number;         // mm
  height: number;        // mm
  baseThickness: number; // mm
  reliefHeight: number;  // mm
  resolution: number;    // pixels per mm for heightmap
  threshold: number;     // 0-1: 0 = weicher Verlauf, 1 = komplett binär
  invert: boolean;       // true = dunkle Bereiche werden erhöht
  cornerRadius: number;  // mm, 0 = keine Abrundung
  border?: {
    enabled: boolean;
    width: number;    // mm
    height: number;   // mm (relief height of border)
  };
  textOverlays?: TextOverlay[];
  baseColor?: string;    // Hex color for base in preview (e.g. '#ffffff')
  reliefColor?: string;  // Hex color for relief in preview (e.g. '#cc3333')
}

export interface TextOverlay {
  text: string;
  x: number;          // mm from left
  y: number;          // mm from bottom
  fontSize: number;   // mm
  fontFamily: string; // font name
}

export type AIProvider = 'openrouter' | 'openrouter-gemini-pro' | 'openrouter-gemini-31' | 'openrouter-flux2-pro' | 'openrouter-flux2-max' | 'openrouter-flux2-flex' | 'openrouter-flux2-klein' | 'openrouter-seedream' | 'openrouter-riverflow-pro' | 'openrouter-riverflow-fast' | 'openrouter-riverflow-max' | 'openrouter-riverflow-std' | 'openrouter-gemini-nano' | 'openrouter-gpt5-image' | 'openrouter-gpt5-image-mini' | 'dalle3' | 'stability' | 'google-imagen';

export interface GenerateImageRequest {
  prompt: string;
  provider: AIProvider;
  config: CardConfig;
}

export interface GenerateImageResponse {
  id: string;
  originalImageUrl: string;
  heightmapUrl: string;
}

export interface ExportRequest {
  id: string;
  config: CardConfig;
}

export const DEFAULT_CONFIG: CardConfig = {
  width: 150,
  height: 100,
  baseThickness: 1.0,
  reliefHeight: 1.2,
  resolution: 8,
  threshold: 0.7,
  invert: false,
  cornerRadius: 5,
  border: { enabled: false, width: 3, height: 1.2 },
  baseColor: '#e0e0e0',
  reliefColor: '#818cf8',
};
