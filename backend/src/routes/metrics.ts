import { Router } from 'express';

export const metricsRouter = Router();

let metricsState = {
  totalTests: 1,
  droneDetections: 1,
  nonDroneSounds: 0,
  uncertainResults: 0,
  detectionsToday: 1,
  detectionsMonth: 5,
  responseTimeMs: 120,
  falsePositiveRate: 1.4,
  uptimePct: 99.94
};

metricsRouter.get('/', (_req, res) => {
  res.json(metricsState);
});

metricsRouter.post('/update', (req, res) => {
  const { classification } = req.body;
  metricsState.totalTests += 1;
  if (classification === 'DRONE_DETECTED') {
    metricsState.droneDetections += 1;
    metricsState.detectionsToday += 1;
    metricsState.detectionsMonth += 1;
  } else if (classification === 'NO_DRONE') {
    metricsState.nonDroneSounds += 1;
  } else if (classification === 'UNCERTAIN') {
    metricsState.uncertainResults += 1;
  }
  res.json(metricsState);
});
