import OpenAI from 'openai';
import { imageFromUrl } from '../heightmap.ts';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export async function generateWithDalle(prompt: string): Promise<Buffer> {
  const openai = getClient();

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'url',
  });

  const url = response.data?.[0]?.url;
  if (!url) {
    throw new Error('DALL-E returned no image URL');
  }

  return imageFromUrl(url);
}
