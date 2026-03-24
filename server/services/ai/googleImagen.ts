export async function generateWithGoogleImagen(
  prompt: string,
  aspectRatio: string = '3:2',
): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not set. Add it in Settings.');
  }

  const model = 'gemini-2.5-flash-image';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio,
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google AI error: ${error}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const candidates = (data.candidates as Array<Record<string, unknown>>) || [];
  const content = candidates[0]?.content as Record<string, unknown> | undefined;
  const parts = (content?.parts as Array<Record<string, unknown>>) || [];

  for (const part of parts) {
    if (part.inlineData) {
      const inlineData = part.inlineData as { data: string; mimeType: string };
      return Buffer.from(inlineData.data, 'base64');
    }
  }

  throw new Error('Google AI returned no image. Response: ' +
    JSON.stringify(data).substring(0, 500));
}
