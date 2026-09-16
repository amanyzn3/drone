import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { audioRouter } from './routes/audio.js';
import { alertsRouter } from './routes/alerts.js';
import { sensorsRouter } from './routes/sensors.js';
import { metricsRouter } from './routes/metrics.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded audio files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Healthcheck Endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'SkyGuard Acoustic Drone Detection Backend',
    version: '2.4.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/audio', audioRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/sensors', sensorsRouter);
app.use('/api/metrics', metricsRouter);

app.listen(PORT, () => {
  console.log(`[SkyGuard Backend] Server running on http://localhost:${PORT}`);
});
