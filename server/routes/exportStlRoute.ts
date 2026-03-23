import { Router } from 'express';
import sharp from 'sharp';
import { generateVectorMesh } from '../services/vectorMeshGenerator.ts';
import { exportBinaryStl } from '../services/exportStl.ts';
import type { ExportRequest } from '../../shared/types.ts';
import { getOriginalImage, getHeightmapData } from '../storage.ts';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { id, config } = req.body as ExportRequest;

    if (!id || !config) {
      res.status(400).json({ error: 'Missing id or config' });
      return;
    }

    let pixels: Uint8Array;
    let width: number;
    let height: number;

    const originalBuffer = getOriginalImage(id);
    if (originalBuffer) {
      const metadata = await sharp(originalBuffer).metadata();
      const imgW = metadata.width || 800;
      const imgH = metadata.height || 600;
      const { data } = await sharp(originalBuffer)
        .resize(imgW, imgH)
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });
      pixels = new Uint8Array(data);
      width = imgW;
      height = imgH;
    } else {
      const hmData = getHeightmapData(id);
      if (!hmData) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }
      pixels = hmData.pixels;
      width = hmData.width;
      height = hmData.height;
    }

    const mesh = await generateVectorMesh(pixels, width, height, config, false);
    const stl = exportBinaryStl(mesh);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="card.stl"');
    res.send(stl);
  } catch (error) {
    console.error('STL Export error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
