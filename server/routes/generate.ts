import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateImage } from '../services/ai/provider.ts';
import { processHeightmap, saveOriginalImage } from '../services/heightmap.ts';
import type { GenerateImageRequest, GenerateImageResponse } from '../../shared/types.ts';
import { getTmpDir, storeHeightmapData, storeOriginalImage } from '../storage.ts';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { prompt, provider, config } = req.body as GenerateImageRequest;

    if (!prompt || !provider || !config) {
      res.status(400).json({ error: 'Missing prompt, provider, or config' });
      return;
    }

    const id = uuidv4();
    const tmpDir = getTmpDir();

    // Generate image with AI (pass card dimensions for aspect ratio)
    const imageBuffer = await generateImage(prompt, provider, config.width, config.height);

    // Save original (file + memory for re-processing)
    await saveOriginalImage(imageBuffer, tmpDir, id);
    storeOriginalImage(id, imageBuffer);

    // Process heightmap
    const heightmap = await processHeightmap(imageBuffer, config, tmpDir, id);

    // Store heightmap data for later export
    storeHeightmapData(id, heightmap.pixels, heightmap.width, heightmap.height);

    const response: GenerateImageResponse = {
      id,
      originalImageUrl: `/api/images/${id}-original.png`,
      heightmapUrl: `/api/images/${id}-heightmap.png`,
    };

    res.json(response);
  } catch (error) {
    console.error('Generation error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
