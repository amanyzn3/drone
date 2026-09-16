import { Router } from 'express';

export interface SecurityAlert {
  id: string;
  source: string;
  fileName: string;
  confidence: number;
  timestamp: string;
  status: 'New' | 'Acknowledged' | 'Resolved';
  priority: 'High' | 'Low' | 'Medium';
  action: string;
  details: string;
}

let alertsStore: SecurityAlert[] = [
  {
    id: 'ALT-101',
    source: 'Live Detection Simulation',
    fileName: 'quadcopter_hover_stationary.wav',
    confidence: 94,
    timestamp: '11:42:15 AM',
    status: 'New',
    priority: 'High',
    action: 'Review recording and inspect perimeter camera feed at 114° bearing.',
    details: 'The audio contains features consistent with a possible drone sound.'
  }
];

export const alertsRouter = Router();

// GET /api/alerts — Get all security alerts
alertsRouter.get('/', (_req, res) => {
  res.json(alertsStore);
});

// POST /api/alerts — Create new alert
alertsRouter.post('/', (req, res) => {
  const newAlert: SecurityAlert = req.body;
  if (!newAlert.id) {
    newAlert.id = `ALT-${Math.floor(100 + Math.random() * 900)}`;
  }
  alertsStore.unshift(newAlert);
  res.status(201).json(newAlert);
});

// PUT /api/alerts/:id — Update alert status
alertsRouter.put('/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const alert = alertsStore.find(a => a.id === id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  alert.status = status;
  res.json(alert);
});
