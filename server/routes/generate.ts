import { Router } from 'express';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { generateImage } from '../services/ai/provider.ts';
import { processHeightmap, saveOriginalImage } from '../services/heightmap.ts';
import type { GenerateImageRequest, GenerateImageResponse } from '../../shared/types.ts';
import { getTmpDir, storeHeightmapData, storeOriginalImage } from '../storage.ts';

const router = Router();

// --- Rate Limiting (in-memory, resets on restart) ---
const DAILY_LIMIT = 5;
const usageMap = new Map<string, { count: number; resetAt: number }>();

function hashIp(ip: string): string {
  return createHash('sha256').update(ip + 'card-gen-salt').digest('hex').slice(0, 16);
}

function getRemainingCount(ip: string): number {
  const hash = hashIp(ip);
  const now = Date.now();
  const entry = usageMap.get(hash);
  if (!entry || now > entry.resetAt) return DAILY_LIMIT;
  return Math.max(0, DAILY_LIMIT - entry.count);
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const hash = hashIp(ip);
  const now = Date.now();
  const entry = usageMap.get(hash);

  if (!entry || now > entry.resetAt) {
    // New day or first request
    usageMap.set(hash, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}

// Only apply rate limiting in hosted mode
function isHostedMode(): boolean {
  return !!(process.env.OPENROUTER_API_KEY || process.env.GOOGLE_AI_API_KEY);
}

// GET: check remaining quota (hosted mode only)
router.get('/quota', (req, res) => {
  if (!isHostedMode()) {
    res.json({ limited: false });
    return;
  }
  const ip = req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
  const remaining = getRemainingCount(ip);
  res.json({ limited: true, remaining, total: DAILY_LIMIT });
});

router.post('/', async (req, res) => {
  try {
    // Rate limiting in hosted mode
    if (isHostedMode()) {
      const ip = req.headers['x-forwarded-for'] as string || req.ip || 'unknown';
      const { allowed, remaining } = checkRateLimit(ip);
      if (!allowed) {
        res.status(429).json({
          error: 'RATE_LIMIT',
          remaining: 0,
          total: DAILY_LIMIT,
        });
        return;
      }
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
    }

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
