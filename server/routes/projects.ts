import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storeHeightmapData, getHeightmapData, getTmpDir } from '../storage.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');

// Ensure projects dir exists
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

const router = Router();

// List all projects
router.get('/', (_req, res) => {
  try {
    const dirs = fs.readdirSync(PROJECTS_DIR).filter(d =>
      fs.existsSync(path.join(PROJECTS_DIR, d, 'project.json'))
    );

    const projects = dirs.map(d => {
      const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, d, 'project.json'), 'utf-8'));
      return {
        id: d,
        name: data.name || 'Untitled',
        createdAt: data.createdAt,
        lastModified: data.lastModified,
        prompt: data.prompt || '',
      };
    }).sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));

    res.json(projects);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// Save project
router.post('/', (req, res) => {
  try {
    const { name, config, generationId, prompt, chatHistory } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    // Create project directory
    const projectId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const projectDir = path.join(PROJECTS_DIR, projectId);
    fs.mkdirSync(projectDir, { recursive: true });

    // Save project metadata
    const project = {
      name,
      config,
      generationId,
      prompt,
      chatHistory,
      createdAt: Date.now(),
      lastModified: Date.now(),
    };
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(project, null, 2));

    // Copy images if they exist
    if (generationId) {
      const tmpDir = getTmpDir();
      const origPath = path.join(tmpDir, `${generationId}-original.png`);
      const hmPath = path.join(tmpDir, `${generationId}-heightmap.png`);

      if (fs.existsSync(origPath)) {
        fs.copyFileSync(origPath, path.join(projectDir, 'original.png'));
      }
      if (fs.existsSync(hmPath)) {
        fs.copyFileSync(hmPath, path.join(projectDir, 'heightmap.png'));
      }

      // Save raw heightmap data
      const hmData = getHeightmapData(generationId);
      if (hmData) {
        const rawBuffer = Buffer.from(hmData.pixels.buffer);
        fs.writeFileSync(path.join(projectDir, 'heightmap.raw'), rawBuffer);
        fs.writeFileSync(path.join(projectDir, 'heightmap-meta.json'), JSON.stringify({
          width: hmData.width,
          height: hmData.height,
        }));
      }
    }

    res.json({ id: projectId, name });
  } catch (error) {
    console.error('Save project error:', error);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

// Load project
router.get('/:id', (req, res) => {
  try {
    const projectDir = path.join(PROJECTS_DIR, req.params.id);
    if (!fs.existsSync(path.join(projectDir, 'project.json'))) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const project = JSON.parse(fs.readFileSync(path.join(projectDir, 'project.json'), 'utf-8'));

    // Restore heightmap data to memory store
    const rawPath = path.join(projectDir, 'heightmap.raw');
    const metaPath = path.join(projectDir, 'heightmap-meta.json');
    if (project.generationId && fs.existsSync(rawPath) && fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const rawBuffer = fs.readFileSync(rawPath);
      storeHeightmapData(project.generationId, new Uint8Array(rawBuffer), meta.width, meta.height);

      // Also copy images to tmp so they're servable
      const tmpDir = getTmpDir();
      const origSrc = path.join(projectDir, 'original.png');
      const hmSrc = path.join(projectDir, 'heightmap.png');
      if (fs.existsSync(origSrc)) {
        fs.copyFileSync(origSrc, path.join(tmpDir, `${project.generationId}-original.png`));
      }
      if (fs.existsSync(hmSrc)) {
        fs.copyFileSync(hmSrc, path.join(tmpDir, `${project.generationId}-heightmap.png`));
      }
    }

    res.json({
      ...project,
      originalImageUrl: project.generationId ? `/api/images/${project.generationId}-original.png` : null,
      heightmapUrl: project.generationId ? `/api/images/${project.generationId}-heightmap.png` : null,
    });
  } catch (error) {
    console.error('Load project error:', error);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

// Delete project
router.delete('/:id', (req, res) => {
  try {
    const projectDir = path.join(PROJECTS_DIR, req.params.id);
    if (fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
