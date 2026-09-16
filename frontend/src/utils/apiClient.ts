import { AnalysisResult, SecurityAlert, ExecutiveMetrics, AcousticSensor, AlertStatus } from '../types';
import { analyzeAudioFile } from './audioClassifier';

const BACKEND_URL = 'http://localhost:5000/api';

export async function analyzeAudioViaBackend(
  fileOrDemoId: File | string,
  fileNameDisplay: string
): Promise<AnalysisResult> {
  try {
    if (typeof fileOrDemoId === 'string') {
      const response = await fetch(`${BACKEND_URL}/audio/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demoId: fileOrDemoId, fileName: fileNameDisplay })
      });
      if (response.ok) {
        return await response.json();
      }
    } else {
      const formData = new FormData();
      formData.append('audioFile', fileOrDemoId);
      const response = await fetch(`${BACKEND_URL}/audio/analyze`, {
        method: 'POST',
        body: formData
      });
      if (response.ok) {
        return await response.json();
      }
    }
  } catch {
    console.warn('[SkyGuard Frontend] Backend server unreachable, falling back to Web Audio client classification engine.');
  }

  // Fallback to client-side engine if backend offline
  return analyzeAudioFile(fileOrDemoId, fileNameDisplay);
}

export async function fetchAlerts(): Promise<SecurityAlert[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/alerts`);
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return [];
}

export async function updateAlertStatusApi(alertId: string, status: AlertStatus): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_URL}/alerts/${alertId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchSensors(): Promise<AcousticSensor[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/sensors`);
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return [];
}

export async function fetchMetrics(): Promise<ExecutiveMetrics | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/metrics`);
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return null;
}
