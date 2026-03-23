import { mkdirSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface HeightmapEntry {
  pixels: Uint8Array;
  width: number;
  height: number;
  createdAt: number;
}

// Stores the original AI-generated image (before any processing)
const originalImageStore = new Map<string, { buffer: Buffer; createdAt: number }>();

const heightmapStore = new Map<string, HeightmapEntry>();

// Clean up entries older than 1 hour
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_AGE = 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of heightmapStore) {
    if (now - entry.createdAt > MAX_AGE) {
      heightmapStore.delete(id);
    }
  }
  for (const [id, entry] of originalImageStore) {
    if (now - entry.createdAt > MAX_AGE) {
      originalImageStore.delete(id);
    }
  }
}, CLEANUP_INTERVAL);

export function storeHeightmapData(
  id: string,
  pixels: Uint8Array,
  width: number,
  height: number,
) {
  heightmapStore.set(id, { pixels, width, height, createdAt: Date.now() });
}

export function getHeightmapData(
  id: string,
): { pixels: Uint8Array; width: number; height: number } | null {
  return heightmapStore.get(id) ?? null;
}

export function storeOriginalImage(id: string, buffer: Buffer) {
  originalImageStore.set(id, { buffer, createdAt: Date.now() });
}

export function getOriginalImage(id: string): Buffer | null {
  // Erst im RAM schauen
  const cached = originalImageStore.get(id)?.buffer;
  if (cached) return cached;

  // Fallback: Original-PNG von Disk laden (überlebt Server-Neustarts)
  const tmpDir = getTmpDir();
  const originalPath = path.join(tmpDir, `${id}-original.png`);
  if (existsSync(originalPath)) {
    const buffer = readFileSync(originalPath);
    // Im RAM cachen für nächsten Zugriff
    originalImageStore.set(id, { buffer, createdAt: Date.now() });
    return buffer;
  }

  return null;
}

export function getTmpDir(): string {
  const tmpDir = path.join(__dirname, '..', 'tmp');
  if (!existsSync(tmpDir)) {
    mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}
