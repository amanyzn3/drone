import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AcousticEngine } from '../services/acousticEngine.js';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

export const audioRouter = Router();

// POST /api/audio/analyze — Analyze uploaded audio file
audioRouter.post('/analyze', upload.single('audioFile'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }
    const result = await AcousticEngine.analyzeUploadedFile(file.originalname, file.size);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to analyze audio file', details: String(err) });
  }
});

// POST /api/audio/demo — Analyze demo track
audioRouter.post('/demo', async (req, res) => {
  try {
    const { demoId, fileName } = req.body;
    if (!demoId) {
      return res.status(400).json({ error: 'Missing demoId parameter' });
    }
    const result = await AcousticEngine.analyzeDemoTrack(demoId, fileName);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to analyze demo track', details: String(err) });
  }
});
