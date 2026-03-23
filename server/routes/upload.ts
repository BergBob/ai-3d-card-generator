import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { processHeightmap, saveOriginalImage } from '../services/heightmap.ts';
import type { CardConfig } from '../../shared/types.ts';
import { getTmpDir, storeHeightmapData } from '../storage.ts';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);

    // Parse multipart form data manually (simple approach)
    // The body contains the raw image after the multipart boundary
    const contentType = req.headers['content-type'] || '';

    let imageBuffer: Buffer;
    let config: CardConfig;

    if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        res.status(400).json({ error: 'Missing boundary' });
        return;
      }
      const parts = parseMultipart(body, boundary);
      const imagePart = parts.find((p) => p.name === 'image');
      const configPart = parts.find((p) => p.name === 'config');

      if (!imagePart || !configPart) {
        res.status(400).json({ error: 'Missing image or config' });
        return;
      }

      imageBuffer = imagePart.data;
      config = JSON.parse(configPart.data.toString());
    } else {
      res.status(400).json({ error: 'Expected multipart/form-data' });
      return;
    }

    const id = uuidv4();
    const tmpDir = getTmpDir();

    await saveOriginalImage(imageBuffer, tmpDir, id);
    const heightmap = await processHeightmap(imageBuffer, config, tmpDir, id);
    storeHeightmapData(id, heightmap.pixels, heightmap.width, heightmap.height);

    res.json({
      id,
      originalImageUrl: `/api/images/${id}-original.png`,
      heightmapUrl: `/api/images/${id}-heightmap.png`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

interface MultipartPart {
  name: string;
  filename?: string;
  data: Buffer;
}

function parseMultipart(body: Buffer, boundary: string): MultipartPart[] {
  const parts: MultipartPart[] = [];
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const endBuf = Buffer.from(`--${boundary}--`);

  let start = body.indexOf(boundaryBuf) + boundaryBuf.length;

  while (start < body.length) {
    const nextBoundary = body.indexOf(boundaryBuf, start);
    if (nextBoundary === -1) break;

    const partData = body.subarray(start, nextBoundary);
    const headerEnd = partData.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      start = nextBoundary + boundaryBuf.length;
      continue;
    }

    const headers = partData.subarray(0, headerEnd).toString();
    const data = partData.subarray(headerEnd + 4, partData.length - 2); // remove trailing \r\n

    const nameMatch = headers.match(/name="([^"]+)"/);
    const filenameMatch = headers.match(/filename="([^"]+)"/);

    if (nameMatch) {
      parts.push({
        name: nameMatch[1],
        filename: filenameMatch?.[1],
        data,
      });
    }

    start = nextBoundary + boundaryBuf.length;
    if (body.indexOf(endBuf, nextBoundary) === nextBoundary) break;
  }

  return parts;
}

export default router;
