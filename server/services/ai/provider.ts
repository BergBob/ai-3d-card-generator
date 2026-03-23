import type { AIProvider } from '../../../shared/types.ts';
import { generateWithDalle } from './dalle.ts';
import { generateWithStability } from './stability.ts';
import { generateWithOpenRouter } from './openrouter.ts';
import { generateWithGoogleImagen } from './googleImagen.ts';

export interface AIImageResult {
  imageBuffer: Buffer;
}

const PROMPT_PREFIX =
  'Create a high-contrast relief-style image suitable for embossing on a greeting card. ' +
  'Use strong contrast between foreground elements and background. ' +
  'The image should work well as a heightmap where bright/white areas will be raised and dark/black areas will be flat. ' +
  'Style: clean, bold shapes with clear edges. ';

export function augmentPrompt(userPrompt: string): string {
  return PROMPT_PREFIX + userPrompt;
}

// OpenRouter model IDs per provider variant
const OPENROUTER_MODELS: Record<string, string> = {
  'openrouter': 'google/gemini-2.5-flash-image',
  'openrouter-flash-image': 'google/gemini-2.5-flash-image-preview:free',
  'openrouter-gemini-pro': 'google/gemini-3-pro-image-preview',
  'openrouter-gemini-31': 'google/gemini-3.1-flash-image-preview',
};

export async function generateImage(
  prompt: string,
  provider: AIProvider,
): Promise<Buffer> {
  const augmented = augmentPrompt(prompt);

  if (provider.startsWith('openrouter')) {
    const model = OPENROUTER_MODELS[provider] || OPENROUTER_MODELS['openrouter'];
    return generateWithOpenRouter(augmented, model);
  }

  switch (provider) {
    case 'dalle3':
      return generateWithDalle(augmented);
    case 'stability':
      return generateWithStability(augmented);
    case 'google-imagen':
      return generateWithGoogleImagen(augmented);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
