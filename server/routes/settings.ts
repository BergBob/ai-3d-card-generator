import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '..', '.env');

const KEY_MAP: Record<string, string> = {
  openrouterKey: 'OPENROUTER_API_KEY',
  openaiKey: 'OPENAI_API_KEY',
  stabilityKey: 'STABILITY_API_KEY',
  googleAiKey: 'GOOGLE_AI_API_KEY',
};

function maskKey(key: string): string {
  if (!key) return '';
  return '•'.repeat(Math.max(0, key.length - 4)) + key.slice(-4);
}

const router = Router();

// GET: return masked keys
router.get('/', (_req, res) => {
  try {
    const result: Record<string, string> = {};
    for (const [jsonKey, envKey] of Object.entries(KEY_MAP)) {
      result[jsonKey] = maskKey(process.env[envKey] || '');
    }
    res.json(result);
  } catch {
    res.json({});
  }
});

// POST: save keys to .env and update process.env
router.post('/', (req, res) => {
  try {
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    for (const [jsonKey, envKey] of Object.entries(KEY_MAP)) {
      const value = req.body[jsonKey];
      if (!value || value.includes('•')) continue; // Skip masked/empty values

      if (envContent.includes(`${envKey}=`)) {
        envContent = envContent.replace(
          new RegExp(`${envKey}=.*`),
          `${envKey}=${value}`
        );
      } else {
        envContent = envContent.trimEnd() + `\n${envKey}=${value}\n`;
      }

      process.env[envKey] = value;
    }

    fs.writeFileSync(ENV_PATH, envContent);
    res.json({ success: true });
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
