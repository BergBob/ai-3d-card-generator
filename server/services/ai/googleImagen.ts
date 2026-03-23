export async function generateWithGoogleImagen(prompt: string): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not set. Add it in Settings.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '3:2',
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Imagen error: ${error}`);
  }

  const data = await response.json() as {
    predictions?: Array<{ bytesBase64Encoded: string }>;
  };

  if (!data.predictions || data.predictions.length === 0) {
    throw new Error('Google Imagen returned no image');
  }

  return Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
}
