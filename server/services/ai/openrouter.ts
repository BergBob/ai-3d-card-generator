export interface OpenRouterOptions {
  aspectRatio?: string;
  imageOnly?: boolean;  // true for pure image gen models (FLUX, Seedream etc.)
}

export async function generateWithOpenRouter(
  prompt: string,
  model: string = 'google/gemini-2.5-flash-image',
  options: OpenRouterOptions = {},
): Promise<Buffer> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set. Add it in Settings.');
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    modalities: options.imageOnly ? ['image'] : ['image', 'text'],
  };

  // Add image_config with aspect_ratio if provided
  if (options.aspectRatio) {
    body.image_config = {
      aspect_ratio: options.aspectRatio,
    };
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${error}`);
  }

  const data = await response.json() as Record<string, unknown>;
  console.log('OpenRouter response:', JSON.stringify(data, null, 2).substring(0, 2000));

  // Try 1: images field (OpenRouter native)
  const choices = (data.choices as Array<Record<string, unknown>>) || [];
  const message = (choices[0]?.message as Record<string, unknown>) || {};
  const images = message.images as Array<{ image_url: { url: string } }> | undefined;

  if (images && images.length > 0) {
    const dataUrl = images[0].image_url.url;
    const base64Match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
    if (base64Match) {
      return Buffer.from(base64Match[1], 'base64');
    }
  }

  // Try 2: Inline base64 in content (Gemini-Style multipart)
  const content = message.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        const match = part.image_url.url.match(/^data:image\/\w+;base64,(.+)$/);
        if (match) return Buffer.from(match[1], 'base64');
      }
      if (part.type === 'image' && part.source?.data) {
        return Buffer.from(part.source.data, 'base64');
      }
    }
  }

  // Try 3: Inline base64 in content string
  if (typeof content === 'string') {
    const match = content.match(/data:image\/\w+;base64,([A-Za-z0-9+/=]+)/);
    if (match) return Buffer.from(match[1], 'base64');
  }

  throw new Error('OpenRouter returned no image. Response structure: ' +
    JSON.stringify(Object.keys(message)));
}
