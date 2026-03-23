import { Router } from 'express';
import sharp from 'sharp';
import { generateVectorMesh } from '../services/vectorMeshGenerator.ts';
import { exportBinaryStl } from '../services/exportStl.ts';
import type { CardConfig } from '../../shared/types.ts';
import { getOriginalImage, getHeightmapData } from '../storage.ts';

const router = Router();

/**
 * POST /api/preview
 * Erzeugt eine binäre STL-Datei für die 3D-Vorschau.
 * Verarbeitet das Originalbild mit der aktuellen Config (inkl. Invert).
 */
router.post('/', async (req, res) => {
  try {
    const { id, config } = req.body as { id: string; config: CardConfig };

    if (!id || !config) {
      res.status(400).json({ error: 'Missing id or config' });
      return;
    }

    // Versuche Originalbild zu nutzen (für Invert-Neuberechnung)
    const originalBuffer = getOriginalImage(id);
    let pixels: Uint8Array;
    let width: number;
    let height: number;

    if (originalBuffer) {
      // Originalbild → Grayscale Heightmap mit aktueller Config
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
      // Fallback: bereits verarbeitete Heightmap
      const hmData = getHeightmapData(id);
      if (!hmData) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }
      pixels = hmData.pixels;
      width = hmData.width;
      height = hmData.height;
    }

    // Vektor-basiertes Mesh generieren (Preview-Modus)
    const mesh = await generateVectorMesh(pixels, width, height, config, true);

    // Als binäre STL exportieren
    const stl = exportBinaryStl(mesh);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(stl);
  } catch (error) {
    console.error('Preview error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
