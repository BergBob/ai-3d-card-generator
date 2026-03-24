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

// Supported aspect ratios for OpenRouter image_config and Google AI
const SUPPORTED_RATIOS = ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16'];

function getBestAspectRatio(widthMm?: number, heightMm?: number): string {
  if (!widthMm || !heightMm) return '3:2';
  const target = widthMm / heightMm;
  const ratioValues: Record<string, number> = {
    '1:1': 1, '3:2': 1.5, '2:3': 0.667, '4:3': 1.333,
    '3:4': 0.75, '16:9': 1.778, '9:16': 0.5625,
  };
  let best = '3:2';
  let bestDiff = Infinity;
  for (const [ratio, value] of Object.entries(ratioValues)) {
    const diff = Math.abs(target - value);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = ratio;
    }
  }
  return best;
}

// OpenRouter model configurations
interface ModelConfig {
  modelId: string;
  imageOnly: boolean;  // true = pure image gen (FLUX, Seedream), false = chat model (Gemini)
}

const OPENROUTER_MODELS: Record<string, ModelConfig> = {
  // Gemini chat models (support text + image)
  'openrouter':             { modelId: 'google/gemini-2.5-flash-image', imageOnly: false },
  'openrouter-gemini-pro':  { modelId: 'google/gemini-3-pro-image-preview', imageOnly: false },
  'openrouter-gemini-31':   { modelId: 'google/gemini-3.1-flash-image-preview', imageOnly: false },
  // Free image generation models
  'openrouter-flux2-pro':       { modelId: 'black-forest-labs/flux.2-pro', imageOnly: true },
  'openrouter-flux2-max':       { modelId: 'black-forest-labs/flux.2-max', imageOnly: true },
  'openrouter-flux2-flex':      { modelId: 'black-forest-labs/flux.2-flex', imageOnly: true },
  'openrouter-flux2-klein':     { modelId: 'black-forest-labs/flux.2-klein-4b', imageOnly: true },
  'openrouter-seedream':        { modelId: 'bytedance-seed/seedream-4.5', imageOnly: true },
  'openrouter-riverflow-pro':   { modelId: 'sourceful/riverflow-v2-pro', imageOnly: true },
  'openrouter-riverflow-fast':  { modelId: 'sourceful/riverflow-v2-fast', imageOnly: true },
  'openrouter-riverflow-max':   { modelId: 'sourceful/riverflow-v2-max-preview', imageOnly: true },
  'openrouter-riverflow-std':   { modelId: 'sourceful/riverflow-v2-standard-preview', imageOnly: true },
  // Paid image models
  'openrouter-gemini-nano':     { modelId: 'google/nano-banana-2', imageOnly: false },
  'openrouter-gpt5-image':      { modelId: 'openai/gpt-5-image', imageOnly: false },
  'openrouter-gpt5-image-mini': { modelId: 'openai/gpt-5-image-mini', imageOnly: false },
};

export async function generateImage(
  prompt: string,
  provider: AIProvider,
  widthMm?: number,
  heightMm?: number,
): Promise<Buffer> {
  const augmented = augmentPrompt(prompt);
  const aspectRatio = getBestAspectRatio(widthMm, heightMm);
  console.log('Augmented prompt:', augmented);
  console.log('Aspect ratio:', aspectRatio);

  if (provider.startsWith('openrouter')) {
    const config = OPENROUTER_MODELS[provider] || OPENROUTER_MODELS['openrouter'];
    return generateWithOpenRouter(augmented, config.modelId, {
      aspectRatio,
      imageOnly: config.imageOnly,
    });
  }

  switch (provider) {
    case 'dalle3':
      return generateWithDalle(augmented);
    case 'stability':
      return generateWithStability(augmented);
    case 'google-imagen':
      return generateWithGoogleImagen(augmented, aspectRatio);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}
