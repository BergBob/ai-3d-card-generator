import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import generateRouter from './routes/generate.ts';
import exportRouter from './routes/export.ts';
import exportStlRouter from './routes/exportStlRoute.ts';
import uploadRouter from './routes/upload.ts';
import previewRouter from './routes/preview.ts';
import projectsRouter from './routes/projects.ts';
import settingsRouter from './routes/settings.ts';
import { getTmpDir } from './storage.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// Serve generated images
app.use('/api/images', express.static(getTmpDir()));

// API routes
app.use('/api/generate', generateRouter);
app.use('/api/export', exportRouter);
app.use('/api/export-stl', exportStlRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/preview', previewRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/settings', settingsRouter);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
