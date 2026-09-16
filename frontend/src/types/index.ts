export type ClassificationType = 'DRONE_DETECTED' | 'NO_DRONE' | 'UNCERTAIN';

export type AlertStatus = 'New' | 'Acknowledged' | 'Resolved';
export type AlertPriority = 'High' | 'Low' | 'Medium';

export interface SavedCustomSound {
  id: string;
  title: string;
  fileName: string;
  category: ClassificationType;
  categoryLabel: string;
  recordedAt: string;
  durationSec: number;
  description: string;
  fileObject?: File;
}

export interface TrainedSoundProfile {
  id: string;
  name: string;
  droneType: string;
  category: ClassificationType;
  categoryLabel: string;
  fundamentalFreqHz: number;
  harmonics: number[];
  bladeCount: number;
  motorRpmEst: number;
  confidenceBase: number;
  description: string;
  sampleDuration: number;
  createdAt: string;
  isCustom?: boolean;
}

export interface LiveAcousticMatchResult {
  matchedProfile: TrainedSoundProfile | null;
  matchScore: number; // 0 - 100
  calculatedBearing: number; // 0 - 359 degrees
  detectingSensorId?: string;
  detectingSensorName?: string;
  timestamp: string;
  dominantPeakHz: number;
  harmonicEnergyRatio: number;
}

export interface DemoAudioTrack {
  id: string;
  label: string;
  category: 'Drone' | 'Non-Drone' | 'Uncertain';
  isDrone: boolean | null; // null for ambiguous/uncertain
  description: string;
  duration: number; // in seconds
  fileName: string;
  defaultResult: ClassificationType;
  defaultConfidence: number;
  reasoning: string;
}

export interface AudioPreprocessing {
  sampleRate: string;
  duration: string;
  channels: string;
  noiseLevelEstimate: string;
}

export interface FeatureExtraction {
  frequencyPeak: string;
  spectrogramType: string;
  mfccCoefficients: string;
  acousticActivity: string;
}

export interface ClassificationProbabilities {
  droneProb: number;
  nonDroneProb: number;
  uncertaintyScore: number;
  modelStatus: string;
}

export interface AnalysisResult {
  id: string;
  fileName: string;
  classification: ClassificationType;
  confidence: number;
  soundClassification: string;
  testStatus: 'Completed';
  analysisDurationMs: number;
  timestamp: string;
  explanation: string;
  preprocessing: AudioPreprocessing;
  featureExtraction: FeatureExtraction;
  probabilities: ClassificationProbabilities;
  isDemoAnalysis: boolean;
}

export interface TestHistoryEntry {
  id: string;
  fileName: string;
  dateTime: string;
  audioType: string;
  classification: ClassificationType;
  confidence: number;
  status: string;
}

export interface SecurityAlert {
  id: string;
  source: string;
  fileName: string;
  confidence: number;
  timestamp: string;
  status: AlertStatus;
  priority: AlertPriority;
  action: string;
  details: string;
}

export interface ExecutiveMetrics {
  totalTests: number;
  droneDetections: number;
  nonDroneSounds: number;
  uncertainResults: number;
  detectionsToday: number;
  detectionsMonth: number;
  responseTimeMs: number;
  falsePositiveRate: number;
  uptimePct: number;
}

export interface AcousticSensor {
  id: string;
  name: string;
  location: string;
  status: 'Active' | 'Calibrating' | 'Standby';
  signalQuality: number; // percentage
  snrDb: number;
  lastUpdate: string;
  micArrayCount: number;
  bearingDeg?: number; // 0-360 degrees position on radar
  gainSensitivity?: number;
  windFilter?: boolean;
  azimuthCoverage?: string;
}

export interface DetectionEvent {
  id: string;
  timestamp: string;
  bearingDeg: number;
  distanceMeters: number;
  confidencePct: number;
  targetType: string;
  status: 'TRACKING' | 'SEARCHING' | 'LOCKED';
}
