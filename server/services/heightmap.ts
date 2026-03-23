import sharp from 'sharp';
import { writeFile } from 'fs/promises';
import path from 'path';
import type { CardConfig } from '../../shared/types.ts';

export interface HeightmapResult {
  pixels: Uint8Array;
  width: number;
  height: number;
  pngPath: string;
}

export async function processHeightmap(
  imageBuffer: Buffer,
  config: CardConfig,
  outputDir: string,
  id: string,
): Promise<HeightmapResult> {
  const targetWidth = Math.round(config.width * config.resolution);
  const targetHeight = Math.round(config.height * config.resolution);

  const processed = sharp(imageBuffer)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .grayscale()
    .normalize();

  // Get raw pixel data
  const { data, info } = await processed
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Save as PNG for client preview
  const pngPath = path.join(outputDir, `${id}-heightmap.png`);
  await processed.png().toFile(pngPath);

  return {
    pixels: new Uint8Array(data),
    width: info.width,
    height: info.height,
    pngPath,
  };
}

export async function imageFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function saveOriginalImage(
  imageBuffer: Buffer,
  outputDir: string,
  id: string,
): Promise<string> {
  const pngPath = path.join(outputDir, `${id}-original.png`);
  await writeFile(pngPath, imageBuffer);
  return pngPath;
}
