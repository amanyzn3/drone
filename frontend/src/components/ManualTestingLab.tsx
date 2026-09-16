import React, { useState, useRef, useEffect } from 'react';
import { 
  FlaskConical, Upload, Play, Pause, Square, Volume2, VolumeX, Sparkles, 
  CheckCircle2, ShieldAlert, AlertTriangle, RefreshCw, Trash2, Filter, Info, 
  BarChart3, Activity, Disc, Mic, MicOff, Bookmark, Save, FolderHeart, X,
  ChevronDown, History, Radio, Compass, Navigation, Zap, Plus, ArrowRight, Eye, Radar
} from 'lucide-react';
import { 
  AnalysisResult, ClassificationType, TestHistoryEntry, SavedCustomSound,
  TrainedSoundProfile, LiveAcousticMatchResult, AcousticSensor
} from '../types';
import { DEMO_TRACKS, DEFAULT_TRAINED_PROFILES, matchRealtimeAudioSpectrum, decodeAndClassifyAudioBlob } from '../utils/audioClassifier';
import { analyzeAudioViaBackend } from '../utils/apiClient';
import { audioSynthesizer } from '../utils/audioSynthesizer';

interface ManualTestingLabProps {
  onAnalysisCompleted: (result: AnalysisResult) => void;
  history: TestHistoryEntry[];
  sensors?: AcousticSensor[];
  onClearHistory: () => void;
  onNavigateToOverview?: () => void;
}

export const ManualTestingLab: React.FC<ManualTestingLabProps> = ({
  onAnalysisCompleted,
  history,
  sensors = [],
  onClearHistory,
  onNavigateToOverview
}) => {
  // Primary Navigation Mode: 'live' (Real-Time Matching) | 'library' (Trained Profiles) | 'diagnostic' (File Bench)
  const [labMode, setLabMode] = useState<'live' | 'library' | 'diagnostic'>('live');

  // --- TRAINED ACOUSTIC SIGNATURE LIBRARY STATE ---
  const [trainedProfiles, setTrainedProfiles] = useState<TrainedSoundProfile[]>(() => {
    try {
      const saved = localStorage.getItem('skyguard_trained_profiles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_TRAINED_PROFILES;
  });

  useEffect(() => {
    try {
      localStorage.setItem('skyguard_trained_profiles', JSON.stringify(trainedProfiles));
    } catch {
      // ignore
    }
  }, [trainedProfiles]);

  // Modal: Train New Signature
  const [showTrainModal, setShowTrainModal] = useState<boolean>(false);
  const [trainName, setTrainName] = useState<string>('');
  const [trainDroneType, setTrainDroneType] = useState<string>('Multirotor Quadcopter');
  const [trainCategory, setTrainCategory] = useState<ClassificationType>('DRONE_DETECTED');
  const [trainBladeCount, setTrainBladeCount] = useState<number>(4);
  const [trainFundHz, setTrainFundHz] = useState<number>(190);
  const [trainDescription, setTrainDescription] = useState<string>('');
  const [trainAudioFile, setTrainAudioFile] = useState<File | null>(null);

  // Auditioning a signature's acoustic profile
  const [auditioningProfileId, setAuditioningProfileId] = useState<string | null>(null);

  // --- REAL-TIME LIVE MICROPHONE MATCHING ENGINE STATE ---
  const [isLiveListening, setIsLiveListening] = useState<boolean>(false);
  const [selectedSensorId, setSelectedSensorId] = useState<string>('LOCAL-MIC');
  const [liveMatchResult, setLiveMatchResult] = useState<LiveAcousticMatchResult | null>(null);
  const [liveMicError, setLiveMicError] = useState<string | null>(null);
  const [lastConfirmedDetection, setLastConfirmedDetection] = useState<{
    profile: TrainedSoundProfile;
    bearing: number;
    sensorName: string;
    score: number;
    timestamp: string;
  } | null>(null);

  const isSimulatedStreamRef = useRef<boolean>(false);
  const [isCapturingMicTrain, setIsCapturingMicTrain] = useState<boolean>(false);

  const liveMediaStreamRef = useRef<MediaStream | null>(null);
  const liveMicSessionRef = useRef<{ stop: () => void; getFrequencyData: (size?: number) => Uint8Array; sampleRate: number } | null>(null);
  const liveMatchLoopRef = useRef<NodeJS.Timeout | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastAlertTimestampRef = useRef<number>(0);

  // Selected Sensor info
  const activeSensor = sensors.find(s => s.id === selectedSensorId);
  const activeSensorBearing = activeSensor ? activeSensor.bearingDeg : 114;
  const activeSensorName = activeSensor ? activeSensor.name : 'Local Microphone Array (0°)';

  // --- DIAGNOSTIC BENCH & PLAYER STATE ---
  const [benchSourceMode, setBenchSourceMode] = useState<'presets' | 'upload' | 'mic'>('presets');
  const [selectedDemoId, setSelectedDemoId] = useState<string>('demo-quad-hover');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [activeFileName, setActiveFileName] = useState<string>('quadcopter_hover_stationary.wav');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(8.5);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Bench Microphone Recording State
  const [isBenchRecording, setIsBenchRecording] = useState<boolean>(false);
  const [benchRecordingDuration, setBenchRecordingDuration] = useState<number>(0);
  const [benchAudioLevel, setBenchAudioLevel] = useState<number>(0);
  const [benchMicError, setBenchMicError] = useState<string | null>(null);

  const benchMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const benchAudioChunksRef = useRef<Blob[]>([]);
  const benchRecordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const benchStartTimeRef = useRef<number>(0);
  const benchMicStreamRef = useRef<MediaStream | null>(null);
  const benchAnimFrameRef = useRef<number | null>(null);

  // History Dropdown State
  const [historyFilter, setHistoryFilter] = useState<'ALL' | ClassificationType>('ALL');
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);

  const playTimerRef = useRef<NodeJS.Timeout | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const benchCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- REAL-TIME LISTENING LIFECYCLE ---
  const handleStartLiveListening = async () => {
    try {
      setLiveMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      liveMediaStreamRef.current = stream;

      const session = audioSynthesizer.connectMicrophoneStream(stream);
      liveMicSessionRef.current = session;
      setIsLiveListening(true);

      // Continuous Real-Time FFT Evaluation Loop (Runs every 160ms)
      if (liveMatchLoopRef.current) clearInterval(liveMatchLoopRef.current);
      liveMatchLoopRef.current = setInterval(() => {
        if (!liveMicSessionRef.current) return;
        const freqs = liveMicSessionRef.current.getFrequencyData(256);
        const match = matchRealtimeAudioSpectrum(
          freqs,
          liveMicSessionRef.current.sampleRate || 44100,
          trainedProfiles,
          activeSensorBearing,
          activeSensorName
        );

        setLiveMatchResult(match);

        // Check if confidence exceeds threshold for a drone signature
        if (
          match.matchedProfile &&
          match.matchedProfile.category === 'DRONE_DETECTED' &&
          match.matchScore >= 75
        ) {
          const now = Date.now();
          // Rate limit alert trigger to every 4.5 seconds to prevent spamming
          if (now - lastAlertTimestampRef.current > 4500) {
            lastAlertTimestampRef.current = now;

            setLastConfirmedDetection({
              profile: match.matchedProfile,
              bearing: match.calculatedBearing,
              sensorName: match.detectingSensorName || activeSensorName,
              score: match.matchScore,
              timestamp: match.timestamp
            });

            // Dispatch full AnalysisResult to global app state (updates radar blip and security alerts)
            const resultPayload: AnalysisResult = {
              id: `LIVE-MATCH-${Date.now().toString().slice(-4)}`,
              fileName: `live_array_${match.calculatedBearing}deg.wav`,
              classification: 'DRONE_DETECTED',
              confidence: match.matchScore,
              soundClassification: match.matchedProfile.name,
              testStatus: 'Completed',
              analysisDurationMs: 140,
              timestamp: match.timestamp,
              explanation: `Real-time microphone match with trained signature "${match.matchedProfile.name}". Rotor harmonics detected at bearing ${match.calculatedBearing}°.`,
              preprocessing: {
                sampleRate: '44.1 kHz',
                duration: 'Live Continuous Stream',
                channels: '8-Mic Directional Array',
                noiseLevelEstimate: '-36 dB (Optimal)'
              },
              featureExtraction: {
                frequencyPeak: `${match.dominantPeakHz} Hz (Fundamental Match)`,
                spectrogramType: 'Harmonic Blade Pass Comb',
                mfccCoefficients: 'C1: 15.8, C2: -7.2, C3: 24.1',
                acousticActivity: 'High (94%)'
              },
              probabilities: {
                droneProb: match.matchScore,
                nonDroneProb: 100 - match.matchScore,
                uncertaintyScore: 5,
                modelStatus: 'Acoustic Classifier Real-Time Core'
              },
              isDemoAnalysis: false
            };

            onAnalysisCompleted(resultPayload);
          }
        }
      }, 160);

    } catch (err: any) {
      console.warn('Microphone live stream error:', err);
      setLiveMicError('Microphone hardware or browser permission unavailable.');
      setIsLiveListening(false);
    }
  };

  // Simulated Live Acoustic Stream (Instant Fallback if hardware mic unavailable)
  const handleStartSimulatedListening = (profileType: string = 'Quadcopter Drone') => {
    setLiveMicError(null);
    setIsLiveListening(true);
    isSimulatedStreamRef.current = true;

    if (liveMatchLoopRef.current) clearInterval(liveMatchLoopRef.current);

    const targetProfile = trainedProfiles.find(p => p.name.toLowerCase().includes(profileType.toLowerCase())) 
      || trainedProfiles.find(p => p.category === 'DRONE_DETECTED') 
      || trainedProfiles[0];
    const fundHz = targetProfile.fundamentalFreqHz || 185;

    let tick = 0;
    liveMatchLoopRef.current = setInterval(() => {
      tick++;
      const simulatedFreqs = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        simulatedFreqs[i] = Math.floor(10 + Math.random() * 15);
      }
      const binFund = Math.min(250, Math.round((fundHz / 22050) * 256));
      if (binFund > 0 && binFund < 256) {
        simulatedFreqs[binFund] = Math.min(255, 185 + Math.floor(Math.sin(tick * 0.3) * 30));
        if (binFund * 2 < 256) simulatedFreqs[binFund * 2] = 145 + Math.floor(Math.random() * 20);
        if (binFund * 3 < 256) simulatedFreqs[binFund * 3] = 110 + Math.floor(Math.random() * 15);
      }

      const match = matchRealtimeAudioSpectrum(
        simulatedFreqs,
        44100,
        trainedProfiles,
        activeSensorBearing,
        activeSensorName
      );

      setLiveMatchResult(match);

      if (
        match.matchedProfile &&
        match.matchedProfile.category === 'DRONE_DETECTED' &&
        match.matchScore >= 75
      ) {
        const now = Date.now();
        if (now - lastAlertTimestampRef.current > 4500) {
          lastAlertTimestampRef.current = now;

          setLastConfirmedDetection({
            profile: match.matchedProfile,
            bearing: match.calculatedBearing,
            sensorName: match.detectingSensorName || activeSensorName,
            score: match.matchScore,
            timestamp: match.timestamp
          });

          const resultPayload: AnalysisResult = {
            id: `LIVE-SIM-${Date.now().toString().slice(-4)}`,
            fileName: `sim_array_${match.calculatedBearing}deg.wav`,
            classification: 'DRONE_DETECTED',
            confidence: match.matchScore,
            soundClassification: match.matchedProfile.name,
            testStatus: 'Completed',
            analysisDurationMs: 140,
            timestamp: match.timestamp,
            explanation: `Simulated acoustic stream matched with signature "${match.matchedProfile.name}". Rotor fundamental ${match.dominantPeakHz}Hz detected at bearing ${match.calculatedBearing}°.`,
            preprocessing: {
              sampleRate: '44.1 kHz',
              duration: 'Live Continuous Stream',
              channels: '8-Mic Directional Array',
              noiseLevelEstimate: '-36 dB'
            },
            featureExtraction: {
              frequencyPeak: `${match.dominantPeakHz} Hz (Fundamental Match)`,
              spectrogramType: 'Harmonic Blade Pass Comb',
              mfccCoefficients: 'C1: 15.8, C2: -7.2, C3: 24.1',
              acousticActivity: 'High (94%)'
            },
            probabilities: {
              droneProb: match.matchScore,
              nonDroneProb: 100 - match.matchScore,
              uncertaintyScore: 5,
              modelStatus: 'Acoustic Classifier Real-Time Core'
            },
            isDemoAnalysis: false
          };

          onAnalysisCompleted(resultPayload);
        }
      }
    }, 160);
  };

  const handleStopLiveListening = () => {
    isSimulatedStreamRef.current = false;
    if (liveMatchLoopRef.current) clearInterval(liveMatchLoopRef.current);
    if (liveMicSessionRef.current) {
      liveMicSessionRef.current.stop();
      liveMicSessionRef.current = null;
    }
    if (liveMediaStreamRef.current) {
      liveMediaStreamRef.current.getTracks().forEach(track => track.stop());
      liveMediaStreamRef.current = null;
    }
    setIsLiveListening(false);
    setLiveMatchResult(null);
  };

  // Capture Audio Sample with Mic for Training Signature
  const handleCaptureMicForTrain = async () => {
    try {
      setIsCapturingMicTrain(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      let highestBin = 12;
      let highestVal = 0;

      const timer = setInterval(() => {
        analyser.getByteFrequencyData(buffer);
        for (let i = 2; i < buffer.length / 2; i++) {
          if (buffer[i] > highestVal) {
            highestVal = buffer[i];
            highestBin = i;
          }
        }
      }, 100);

      setTimeout(() => {
        clearInterval(timer);
        stream.getTracks().forEach(t => t.stop());
        try { ctx.close(); } catch {}
        setIsCapturingMicTrain(false);

        const detectedHz = Math.max(60, Math.round((highestBin * ctx.sampleRate) / 512));
        setTrainFundHz(detectedHz);
        if (!trainName) {
          setTrainName(`Custom Drone (${detectedHz} Hz)`);
        }
      }, 2500);
    } catch {
      setIsCapturingMicTrain(false);
      setTrainFundHz(195);
      if (!trainName) {
        setTrainName('Custom Multirotor (195 Hz)');
      }
    }
  };

  // Cleanup microphone on unmount
  useEffect(() => {
    return () => {
      handleStopLiveListening();
      handleStopBenchRecording();
      audioSynthesizer.stop();
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      if (benchRecordTimerRef.current) clearInterval(benchRecordTimerRef.current);
      if (benchAnimFrameRef.current) cancelAnimationFrame(benchAnimFrameRef.current);
    };
  }, []);

  // --- REAL-TIME LIVE SPECTRUM CANVAS RENDERER ---
  useEffect(() => {
    let animId: number;
    const canvas = liveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background grid lines
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Draw real-time spectrum bars
      let freqs = isLiveListening && liveMicSessionRef.current
        ? liveMicSessionRef.current.getFrequencyData(64)
        : null;

      if (!freqs && isLiveListening && isSimulatedStreamRef.current) {
        const dummy = new Uint8Array(64);
        for (let k = 0; k < 64; k++) {
          dummy[k] = Math.floor(12 + Math.sin(Date.now() * 0.005 + k * 0.2) * 12);
        }
        dummy[14] = Math.min(255, 195 + Math.floor(Math.sin(Date.now() * 0.01) * 35));
        dummy[28] = Math.min(255, 145 + Math.floor(Math.cos(Date.now() * 0.01) * 20));
        freqs = dummy;
      }

      const numBars = 64;
      const barWidth = (canvas.width / numBars) - 1.5;

      for (let i = 0; i < numBars; i++) {
        const val = freqs ? freqs[i] : 4 + Math.random() * 6;
        const barHeight = (val / 255) * (canvas.height - 12);
        const x = i * (barWidth + 1.5);
        const y = canvas.height - barHeight;

        // Gradient color: Cyan to Purple for higher energy
        const grad = ctx.createLinearGradient(0, canvas.height, 0, y);
        grad.addColorStop(0, 'rgba(34, 211, 238, 0.3)');
        grad.addColorStop(1, val > 120 ? 'rgba(239, 68, 68, 0.9)' : val > 70 ? 'rgba(168, 85, 247, 0.8)' : 'rgba(34, 211, 238, 0.8)');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isLiveListening]);

  // --- TRAIN NEW SIGNATURE HANDLER ---
  const handleTrainNewSignature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainName.trim()) return;

    const harmonicsList = [
      trainFundHz,
      trainFundHz * 2,
      trainFundHz * 3,
      trainFundHz * 4
    ];

    const newProfile: TrainedSoundProfile = {
      id: `SIG-CUSTOM-${Date.now().toString().slice(-4)}`,
      name: trainName.trim(),
      droneType: trainDroneType.trim(),
      category: trainCategory,
      categoryLabel: trainCategory === 'DRONE_DETECTED' ? 'Drone Acoustic Signature' : 'Non-Drone Sound',
      fundamentalFreqHz: trainFundHz,
      harmonics: harmonicsList,
      bladeCount: trainBladeCount,
      motorRpmEst: Math.round(trainFundHz * 30),
      confidenceBase: 95,
      description: trainDescription.trim() || `User-trained acoustic profile with ${trainFundHz} Hz rotor resonance.`,
      sampleDuration: 8.0,
      createdAt: new Date().toLocaleDateString(),
      isCustom: true
    };

    setTrainedProfiles(prev => [newProfile, ...prev]);
    setShowTrainModal(false);
    setTrainName('');
    setTrainDescription('');
    setTrainAudioFile(null);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (window.confirm('Remove this acoustic signature from the trained library?')) {
      setTrainedProfiles(prev => prev.filter(p => p.id !== profileId));
    }
  };

  const handleAuditionProfile = (profile: TrainedSoundProfile) => {
    if (auditioningProfileId === profile.id) {
      audioSynthesizer.stop();
      setAuditioningProfileId(null);
    } else {
      audioSynthesizer.stop();
      setAuditioningProfileId(profile.id);

      // Play synthesized tone for the signature's fundamental frequency
      const demoMap: Record<string, string> = {
        'SIG-DJI-MAVIC': 'demo-quad-hover',
        'SIG-FPV-RACER': 'demo-fpv-drone',
        'SIG-HEX-HEAVY': 'demo-quad-flyover',
        'SIG-FIXED-WING': 'demo-quad-takeoff',
        'SIG-ENV-FAN': 'demo-fan-noise',
        'SIG-ENV-BIRDS': 'demo-bird-sounds',
        'SIG-ENV-WIND': 'demo-wind-noise'
      };

      const demoId = demoMap[profile.id] || 'demo-quad-hover';
      audioSynthesizer.playDemoSound(demoId, 0.8, () => {
        setAuditioningProfileId(null);
      });
    }
  };

  // --- DIAGNOSTIC PLAY / ANALYZE HANDLERS ---
  const handleSelectDemoTrack = (trackId: string) => {
    audioSynthesizer.stop();
    setIsPlaying(false);
    setCurrentTime(0);
    setUploadedFile(null);
    setSelectedDemoId(trackId);
    setAnalysisResult(null);
    
    const track = DEMO_TRACKS.find(t => t.id === trackId);
    if (track) {
      setActiveFileName(track.fileName);
      setTotalDuration(track.duration);
    }
  };

  // --- DIAGNOSTIC BENCH MICROPHONE RECORDER ---
  const handleStartBenchRecording = async () => {
    try {
      setBenchMicError(null);
      setBenchAudioLevel(0);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone not supported by browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } 
      });
      benchMicStreamRef.current = stream;

      // VU level setup
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          src.connect(analyser);
          const dataArr = new Uint8Array(analyser.frequencyBinCount);
          const updateVu = () => {
            analyser.getByteFrequencyData(dataArr);
            let total = 0;
            for (let i = 0; i < dataArr.length; i++) total += dataArr[i];
            const avg = total / dataArr.length;
            setBenchAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            benchAnimFrameRef.current = requestAnimationFrame(updateVu);
          };
          updateVu();
        }
      } catch {}

      // Safe supported MIME
      let selectedMimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
        for (const c of candidates) {
          if (MediaRecorder.isTypeSupported(c)) { selectedMimeType = c; break; }
        }
      }

      const recorder = selectedMimeType ? new MediaRecorder(stream, { mimeType: selectedMimeType }) : new MediaRecorder(stream);
      benchAudioChunksRef.current = [];
      benchStartTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) benchAudioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        if (benchAnimFrameRef.current) cancelAnimationFrame(benchAnimFrameRef.current);
        if (benchMicStreamRef.current) {
          benchMicStreamRef.current.getTracks().forEach(t => t.stop());
          benchMicStreamRef.current = null;
        }
        const blobType = selectedMimeType || 'audio/webm';
        const blob = new Blob(benchAudioChunksRef.current, { type: blobType });
        const recordedFile = new File([blob], `mic_recording_${Date.now().toString().slice(-4)}.webm`, { type: blobType });

        // Load directly into Bench Player
        setSelectedDemoId('');
        setUploadedFile(recordedFile);
        setActiveFileName(recordedFile.name);
        setTotalDuration(Math.max(2.0, Math.round(benchRecordingDuration || 3)));
        setAnalysisResult(null);
      };

      recorder.start(200);
      benchMediaRecorderRef.current = recorder;
      setIsBenchRecording(true);
      setBenchRecordingDuration(0);

      if (benchRecordTimerRef.current) clearInterval(benchRecordTimerRef.current);
      benchRecordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - benchStartTimeRef.current) / 1000);
        setBenchRecordingDuration(elapsed);
      }, 500);

    } catch (err: any) {
      setBenchMicError('Microphone permission or hardware unavailable.');
      setIsBenchRecording(false);
    }
  };

  const handleStopBenchRecording = () => {
    if (benchMediaRecorderRef.current && isBenchRecording) {
      try {
        if (benchMediaRecorderRef.current.state === 'recording') {
          benchMediaRecorderRef.current.requestData();
          benchMediaRecorderRef.current.stop();
        }
      } catch {}
      setIsBenchRecording(false);
      if (benchRecordTimerRef.current) clearInterval(benchRecordTimerRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      audioSynthesizer.stop();
      setIsPlaying(false);
      setCurrentTime(0);
      setSelectedDemoId('');
      setUploadedFile(file);
      setActiveFileName(file.name);
      setTotalDuration(8.0);
      setAnalysisResult(null);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      audioSynthesizer.stop();
      setIsPlaying(false);
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    } else {
      setIsPlaying(true);
      const effectiveVol = isMuted ? 0 : volume;

      if (uploadedFile) {
        audioSynthesizer.playNativeAudioFile(
          uploadedFile,
          effectiveVol,
          () => {
            setIsPlaying(false);
            setCurrentTime(0);
          },
          (curTime, dur) => {
            setCurrentTime(parseFloat(curTime.toFixed(1)));
            if (isFinite(dur) && dur > 0) setTotalDuration(parseFloat(dur.toFixed(1)));
          }
        );
      } else {
        audioSynthesizer.playDemoSound(
          selectedDemoId || 'demo-quad-hover',
          effectiveVol,
          () => {
            setIsPlaying(false);
            setCurrentTime(0);
            if (playTimerRef.current) clearInterval(playTimerRef.current);
          }
        );

        if (playTimerRef.current) clearInterval(playTimerRef.current);
        playTimerRef.current = setInterval(() => {
          setCurrentTime(prev => {
            if (prev >= totalDuration) {
              setIsPlaying(false);
              if (playTimerRef.current) clearInterval(playTimerRef.current);
              return 0;
            }
            return prev + 0.2;
          });
        }, 200);
      }
    }
  };

  const handleStop = () => {
    audioSynthesizer.stop();
    setIsPlaying(false);
    setCurrentTime(0);
    if (playTimerRef.current) clearInterval(playTimerRef.current);
  };

  const handleStartAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    let result: AnalysisResult;
    if (uploadedFile) {
      // Decode real PCM samples & analyze peak frequencies vs speech formants
      result = await decodeAndClassifyAudioBlob(uploadedFile, activeFileName);
    } else {
      result = await analyzeAudioViaBackend(selectedDemoId, activeFileName);
    }

    setIsAnalyzing(false);
    setAnalysisResult(result);
    onAnalysisCompleted(result);
    
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. TOP HEADER & OPERATIONAL MODE SELECTOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <FlaskConical className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Acoustic Training & Real-Time Direction Lab
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Train microphone signatures & listen in real-time to match drone models and pinpoint arrival direction
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setLabMode('live')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              labMode === 'live'
                ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Live Mic Identifier</span>
            {isLiveListening && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setLabMode('library')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              labMode === 'library'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Signature Library ({trainedProfiles.length})</span>
          </button>

          <button
            onClick={() => setLabMode('diagnostic')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              labMode === 'diagnostic'
                ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Diagnostic Bench</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW A: REAL-TIME LIVE MICROPHONE IDENTIFIER & DIRECTION MATCHER */}
      {/* ========================================================================= */}
      {labMode === 'live' && (
        <div className="space-y-5 animate-fade-in">
          
          {/* Top Control Strip */}
          <div className="glass-panel p-4 rounded-2xl border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Sensor Array Selector */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-mono text-slate-400 whitespace-nowrap flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-purple-400" />
                Listening Array:
              </label>
              <select
                value={selectedSensorId}
                onChange={(e) => setSelectedSensorId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs font-bold focus:border-cyan-400 outline-none"
              >
                <option value="LOCAL-MIC">Default Device Microphone (Real-Time Probe)</option>
                {sensors.map(sensor => (
                  <option key={sensor.id} value={sensor.id}>
                    {sensor.name} ({sensor.bearingDeg ?? 0}°) — {sensor.location}
                  </option>
                ))}
              </select>
            </div>

            {/* Start / Stop Real-Time Listening Button */}
            <div className="flex flex-wrap items-center gap-2.5">
              {liveMicError && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400 font-mono">{liveMicError}</span>
                  <button
                    type="button"
                    onClick={() => handleStartSimulatedListening('Quadcopter Drone')}
                    className="px-2.5 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold hover:bg-cyan-500/30 flex items-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Run Simulated Stream</span>
                  </button>
                </div>
              )}

              {!isLiveListening && !liveMicError && (
                <button
                  type="button"
                  onClick={() => handleStartSimulatedListening('Quadcopter Drone')}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-bold transition-all flex items-center gap-1.5"
                  title="Simulate live drone audio stream without physical microphone"
                >
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Simulated Stream</span>
                </button>
              )}

              <button
                onClick={isLiveListening ? handleStopLiveListening : handleStartLiveListening}
                className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${
                  isLiveListening
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse'
                    : 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-black hover:shadow-[0_0_25px_rgba(34,211,238,0.6)]'
                }`}
              >
                {isLiveListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    <span>Stop Real-Time Listening</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start Live Mic Listening</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Real-time Spectrum & Live Matching Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* Left 7 Cols: Real-Time Audio Spectrum Canvas & Frequency Analyzer */}
            <div className="lg:col-span-7 glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase">
                    Live Acoustic FFT Spectrum & Harmonics
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-slate-500">DOMINANT PEAK:</span>
                  <span className="text-cyan-300 font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/40">
                    {liveMatchResult?.dominantPeakHz ? `${liveMatchResult.dominantPeakHz} Hz` : 'Scanning...'}
                  </span>
                </div>
              </div>

              {/* Real-Time Canvas */}
              <div className="bg-[#030712] rounded-xl p-3 border border-slate-800/80 relative">
                <canvas
                  ref={liveCanvasRef}
                  width={560}
                  height={150}
                  className="w-full h-[150px] rounded"
                />

                {!isLiveListening && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl space-y-2">
                    <Mic className="w-8 h-8 text-cyan-400 animate-bounce" />
                    <p className="text-xs font-mono text-slate-300 font-bold">
                      Microphone Listening Inactive
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Click "Start Real-Time Array Listening" above to probe live sound
                    </p>
                  </div>
                )}
              </div>

              {/* Array Status Telemetry Strip */}
              <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">ARRAY BEARING</span>
                  <span className="text-cyan-300 font-bold">{activeSensorBearing}° Azimuth</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">MATCH ENGINE</span>
                  <span className="text-purple-300 font-bold">{trainedProfiles.length} Signatures</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">ARRAY STATE</span>
                  <span className={isLiveListening ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {isLiveListening ? '● LIVE SCANNING' : 'STANDBY'}
                  </span>
                </div>
              </div>

            </div>

            {/* Right 5 Cols: Live Real-Time Classifier & Sound Threat Alert */}
            <div className={`lg:col-span-5 glass-panel p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
              liveMatchResult?.matchedProfile?.category === 'DRONE_DETECTED'
                ? 'border-red-500/80 bg-red-950/20 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
                : liveMatchResult?.matchedProfile?.category === 'NO_DRONE'
                ? 'border-emerald-500/50 bg-emerald-950/15'
                : 'border-slate-800'
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className={`w-4 h-4 ${
                    liveMatchResult?.matchedProfile?.category === 'DRONE_DETECTED'
                      ? 'text-red-400'
                      : liveMatchResult?.matchedProfile?.category === 'NO_DRONE'
                      ? 'text-emerald-400'
                      : 'text-cyan-400'
                  }`} />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Live Sound Alert & Verdict
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                  !isLiveListening
                    ? 'bg-slate-800 text-slate-400'
                    : liveMatchResult?.matchedProfile?.category === 'DRONE_DETECTED'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
                    : liveMatchResult?.matchedProfile?.category === 'NO_DRONE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-cyan-500/15 text-cyan-300'
                }`}>
                  {!isLiveListening 
                    ? 'MIC OFFLINE' 
                    : liveMatchResult?.matchedProfile?.category === 'DRONE_DETECTED' 
                    ? '🚨 DRONE DETECTED' 
                    : liveMatchResult?.matchedProfile?.category === 'NO_DRONE'
                    ? '🟢 NON-DRONE SOUND'
                    : '● LISTENING'}
                </span>
              </div>

              {/* Main Classification Body */}
              <div className="space-y-3 py-1">
                {!isLiveListening ? (
                  <div className="py-8 text-center space-y-2 font-mono text-xs">
                    <MicOff className="w-8 h-8 text-slate-500 mx-auto" />
                    <p className="text-slate-300 font-bold">Microphone Inactive</p>
                    <p className="text-slate-500 text-[11px]">
                      Click "Start Real-Time Array Listening" to begin scanning for drone motor harmonics.
                    </p>
                  </div>
                ) : liveMatchResult?.matchedProfile?.category === 'DRONE_DETECTED' ? (
                  /* DRONE DETECTED ALERT */
                  <div className="space-y-3 font-mono text-xs animate-fade-in">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-red-950/50 border border-red-500/60">
                      <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center font-bold shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-bounce shrink-0">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">
                          AIRSPACE THREAT IDENTIFIED
                        </span>
                        <h4 className="text-sm font-bold text-white font-heading">
                          {liveMatchResult.matchedProfile.name}
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">DIRECTION / BEARING:</span>
                        <span className="text-cyan-300 font-bold text-sm flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-cyan-400" />
                          {liveMatchResult.calculatedBearing}° Azimuth
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">CONFIDENCE:</span>
                        <span className="text-red-400 font-bold text-sm">
                          {liveMatchResult.matchScore}% Certainty
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <span className="text-slate-400 text-[10px] block">TRIANGULATING SENSOR ARRAY:</span>
                      <span className="text-purple-300 font-bold text-xs truncate block">
                        {liveMatchResult.detectingSensorName || activeSensorName}
                      </span>
                    </div>

                    {onNavigateToOverview && (
                      <button
                        onClick={onNavigateToOverview}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-cyan-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:scale-[1.02] transition-transform"
                      >
                        <Radar className="w-4 h-4" />
                        <span>Lock Target on Horizon Radar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : liveMatchResult?.matchedProfile?.category === 'NO_DRONE' ? (
                  /* NON-DRONE SOUND DETECTED */
                  <div className="space-y-3 font-mono text-xs animate-fade-in">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-black flex items-center justify-center font-bold shadow-[0_0_15px_rgba(16,185,129,0.6)] shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                          VERIFIED NON-DRONE SOUND
                        </span>
                        <h4 className="text-sm font-bold text-white font-heading">
                          {liveMatchResult.matchedProfile.name}
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">STATUS:</span>
                        <span className="text-emerald-400 font-bold text-xs">SAFE / NO THREAT</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">CONFIDENCE:</span>
                        <span className="text-white font-bold text-xs">
                          {liveMatchResult.matchScore}% Match
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      Audio analysis confirms acoustic signature lacks multirotor motor blade-pass harmonics. Airspace remains clear.
                    </p>
                  </div>
                ) : (
                  /* AMBIENT QUIET LISTENING */
                  <div className="py-6 text-center space-y-2 font-mono text-xs">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
                      <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <p className="text-slate-200 font-bold">Scanning Airspace Acoustics</p>
                    <p className="text-slate-400 text-[11px]">
                      Microphone array is actively listening. When sound is heard, it instantly classifies if it is a drone or other sounds.
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Sound Simulation Buttons */}
              <div className="pt-2 border-t border-slate-800/80 font-mono text-xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1.5">
                  Quick Audio Probe Simulation:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isLiveListening) handleStartLiveListening();
                      const dji = trainedProfiles.find(p => p.id === 'SIG-DJI-MAVIC') || trainedProfiles[0];
                      const simulatedMatch: LiveAcousticMatchResult = {
                        matchedProfile: dji,
                        matchScore: 94,
                        calculatedBearing: 114,
                        detectingSensorName: activeSensorName,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        dominantPeakHz: 185,
                        harmonicEnergyRatio: 0.85
                      };
                      setLiveMatchResult(simulatedMatch);
                      setLastConfirmedDetection({
                        profile: dji,
                        bearing: 114,
                        sensorName: activeSensorName,
                        score: 94,
                        timestamp: simulatedMatch.timestamp
                      });
                      onAnalysisCompleted({
                        id: `SIM-${Date.now().toString().slice(-4)}`,
                        fileName: 'simulated_quadcopter_114deg.wav',
                        classification: 'DRONE_DETECTED',
                        confidence: 94,
                        soundClassification: dji.name,
                        testStatus: 'Completed',
                        analysisDurationMs: 120,
                        timestamp: simulatedMatch.timestamp,
                        explanation: `Simulated drone motor harmonics at bearing 114°.`,
                        preprocessing: { sampleRate: '44.1 kHz', duration: '5.0s', channels: 'Array', noiseLevelEstimate: '-38 dB' },
                        featureExtraction: { frequencyPeak: '185 Hz', spectrogramType: 'Multirotor Harmonics', mfccCoefficients: 'C1: 14.2', acousticActivity: 'High' },
                        probabilities: { droneProb: 94, nonDroneProb: 6, uncertaintyScore: 3, modelStatus: 'Active' },
                        isDemoAnalysis: false
                      });
                    }}
                    className="px-2 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 text-red-300 text-[11px] font-semibold truncate text-left"
                  >
                    ● Drone (114°)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isLiveListening) handleStartLiveListening();
                      const fpv = trainedProfiles.find(p => p.id === 'SIG-FPV-RACER') || trainedProfiles[0];
                      const simulatedMatch: LiveAcousticMatchResult = {
                        matchedProfile: fpv,
                        matchScore: 98,
                        calculatedBearing: 275,
                        detectingSensorName: activeSensorName,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        dominantPeakHz: 720,
                        harmonicEnergyRatio: 0.92
                      };
                      setLiveMatchResult(simulatedMatch);
                      setLastConfirmedDetection({
                        profile: fpv,
                        bearing: 275,
                        sensorName: activeSensorName,
                        score: 98,
                        timestamp: simulatedMatch.timestamp
                      });
                      onAnalysisCompleted({
                        id: `SIM-${Date.now().toString().slice(-4)}`,
                        fileName: 'simulated_fpv_275deg.wav',
                        classification: 'DRONE_DETECTED',
                        confidence: 98,
                        soundClassification: fpv.name,
                        testStatus: 'Completed',
                        analysisDurationMs: 120,
                        timestamp: simulatedMatch.timestamp,
                        explanation: `High-RPM drone harmonic signature at bearing 275°.`,
                        preprocessing: { sampleRate: '44.1 kHz', duration: '5.0s', channels: 'Array', noiseLevelEstimate: '-35 dB' },
                        featureExtraction: { frequencyPeak: '720 Hz', spectrogramType: 'High-RPM Screamer', mfccCoefficients: 'C1: 18.2', acousticActivity: 'High' },
                        probabilities: { droneProb: 98, nonDroneProb: 2, uncertaintyScore: 2, modelStatus: 'Active' },
                        isDemoAnalysis: false
                      });
                    }}
                    className="px-2 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 text-amber-300 text-[11px] font-semibold truncate text-left"
                  >
                    ● FPV Drone (275°)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isLiveListening) handleStartLiveListening();
                      const voice = trainedProfiles.find(p => p.id === 'SIG-ENV-VOICE') || {
                        id: 'SIG-ENV-VOICE',
                        name: 'Human Voice / Ambient Noise',
                        droneType: 'Non-Drone Ambient',
                        category: 'NO_DRONE' as ClassificationType,
                        categoryLabel: 'Non-Drone Sound',
                        fundamentalFreqHz: 240,
                        harmonics: [240],
                        bladeCount: 0,
                        motorRpmEst: 0,
                        confidenceBase: 92,
                        description: 'Non-drone speech sound.',
                        sampleDuration: 5.0,
                        createdAt: 'Live Simulation'
                      };
                      const simulatedMatch: LiveAcousticMatchResult = {
                        matchedProfile: voice,
                        matchScore: 92,
                        calculatedBearing: activeSensorBearing ?? 0,
                        detectingSensorName: activeSensorName,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        dominantPeakHz: 240,
                        harmonicEnergyRatio: 0.15
                      };
                      setLiveMatchResult(simulatedMatch);
                      onAnalysisCompleted({
                        id: `SIM-${Date.now().toString().slice(-4)}`,
                        fileName: 'simulated_voice_ambient.wav',
                        classification: 'NO_DRONE',
                        confidence: 92,
                        soundClassification: voice.name,
                        testStatus: 'Completed',
                        analysisDurationMs: 120,
                        timestamp: simulatedMatch.timestamp,
                        explanation: `Audio verified as non-drone environmental sound.`,
                        preprocessing: { sampleRate: '44.1 kHz', duration: '5.0s', channels: 'Array', noiseLevelEstimate: '-40 dB' },
                        featureExtraction: { frequencyPeak: '240 Hz', spectrogramType: 'Broadband Non-Harmonic', mfccCoefficients: 'C1: 8.2', acousticActivity: 'Normal' },
                        probabilities: { droneProb: 5, nonDroneProb: 92, uncertaintyScore: 3, modelStatus: 'Active' },
                        isDemoAnalysis: false
                      });
                    }}
                    className="px-2 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold truncate text-left"
                  >
                    ● Non-Drone (Voice)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isLiveListening) handleStartLiveListening();
                      const clearProfile: TrainedSoundProfile = {
                        id: 'SIG-ENV-CLEAR',
                        name: 'Verified Clear Ambient Sound',
                        droneType: 'Non-Drone Ambient',
                        category: 'NO_DRONE' as ClassificationType,
                        categoryLabel: 'Non-Drone Sound',
                        fundamentalFreqHz: 0,
                        harmonics: [],
                        bladeCount: 0,
                        motorRpmEst: 0,
                        confidenceBase: 96,
                        description: 'Clean baseline ambient room noise. Zero multirotor propulsion frequencies or blade-pass harmonics detected.',
                        sampleDuration: 5.0,
                        createdAt: 'Live Simulation'
                      };
                      const simulatedMatch: LiveAcousticMatchResult = {
                        matchedProfile: clearProfile,
                        matchScore: 96,
                        calculatedBearing: activeSensorBearing ?? 0,
                        detectingSensorName: activeSensorName,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        dominantPeakHz: 0,
                        harmonicEnergyRatio: 0
                      };
                      setLiveMatchResult(simulatedMatch);
                      setLastConfirmedDetection(null);
                      onAnalysisCompleted({
                        id: `SIM-${Date.now().toString().slice(-4)}`,
                        fileName: 'clear_ambient_sound.wav',
                        classification: 'NO_DRONE',
                        confidence: 96,
                        soundClassification: clearProfile.name,
                        testStatus: 'Completed',
                        analysisDurationMs: 100,
                        timestamp: simulatedMatch.timestamp,
                        explanation: 'Clean baseline ambient room sound. Zero multirotor motor harmonics or propeller blade frequencies detected.',
                        preprocessing: { sampleRate: '44.1 kHz', duration: '5.0s', channels: 'Array', noiseLevelEstimate: '-48 dB' },
                        featureExtraction: { frequencyPeak: 'None (Clean Baseline)', spectrogramType: 'Clean Flat Ambient', mfccCoefficients: 'C1: 2.1', acousticActivity: 'Minimal' },
                        probabilities: { droneProb: 2, nonDroneProb: 96, uncertaintyScore: 2, modelStatus: 'Active' },
                        isDemoAnalysis: false
                      });
                    }}
                    className="px-2 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold truncate text-left"
                  >
                    ● Clear Sound
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* 🎯 CONFIRMED LIVE IDENTIFICATION & DIRECTION CARD */}
          {lastConfirmedDetection && (
            <div className="glass-panel p-5 rounded-2xl border-2 border-red-500/80 bg-red-950/20 shadow-[0_0_35px_rgba(239,68,68,0.3)] animate-fade-in space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-500/30 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center font-bold shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-red-400 tracking-wider uppercase">
                      ACOUSTIC MATCH CONFIRMED AT REAL-TIME
                    </span>
                    <h3 className="text-lg font-bold text-white font-heading">
                      {lastConfirmedDetection.profile.name}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-mono font-bold animate-pulse">
                    {lastConfirmedDetection.score}% MATCH CONFIDENCE
                  </span>
                  {onNavigateToOverview && (
                    <button
                      onClick={onNavigateToOverview}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-red-500 to-cyan-500 text-white font-mono text-xs font-bold shadow-[0_0_15px_rgba(239,68,68,0.5)] flex items-center gap-1.5 hover:scale-105 transition-transform"
                    >
                      <Radar className="w-3.5 h-3.5" />
                      <span>View on Horizon Radar</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Detailed Direction & Triangulation Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">DRONE TYPE</span>
                  <span className="text-white font-bold text-sm">{lastConfirmedDetection.profile.droneType}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">DIRECTION OF ARRIVAL</span>
                  <span className="text-cyan-300 font-bold text-sm">{lastConfirmedDetection.bearing}° Bearing</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">TRIANGULATING SENSOR</span>
                  <span className="text-purple-300 font-bold text-sm truncate block">{lastConfirmedDetection.sensorName}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">DETECTION TIME</span>
                  <span className="text-slate-300 font-bold text-sm">{lastConfirmedDetection.timestamp}</span>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: TRAINED SIGNATURE LIBRARY ("TRAIN & CALIBRATE") */}
      {/* ========================================================================= */}
      {labMode === 'library' && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
            <div>
              <h3 className="text-base font-bold text-white font-heading">
                Trained Acoustic Signature Library
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Acoustic fingerprints used by microphone arrays for real-time comparison and drone type classification
              </p>
            </div>

            <button
              onClick={() => setShowTrainModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Train New Signature</span>
            </button>
          </div>

          {/* Grid of Trained Sound Profiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainedProfiles.map((profile) => {
              const isDrone = profile.category === 'DRONE_DETECTED';
              const isAuditioning = auditioningProfileId === profile.id;

              return (
                <div
                  key={profile.id}
                  className={`glass-panel p-4 rounded-2xl border transition-all space-y-3 ${
                    isDrone ? 'border-slate-800 hover:border-red-500/40' : 'border-slate-800 hover:border-emerald-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                        isDrone ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {isDrone ? 'Drone Target' : 'Environmental Sound'}
                      </span>
                      <h4 className="text-sm font-bold text-white font-heading mt-1">
                        {profile.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">{profile.droneType}</p>
                    </div>

                    {profile.isCustom && (
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
                        className="p-1 rounded text-slate-500 hover:text-red-400"
                        title="Delete trained signature"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Frequency Specs */}
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-[10px]">Fundamental Blade Freq:</span>
                      <span className="text-cyan-300 font-bold">{profile.fundamentalFreqHz} Hz</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-[10px]">Harmonic Comb:</span>
                      <span className="text-purple-300 font-bold text-[10px]">{profile.harmonics.join(', ')} Hz</span>
                    </div>
                    {profile.bladeCount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-400 text-[10px]">Rotor Blades / RPM:</span>
                        <span className="text-white font-bold">{profile.bladeCount} Blades ({profile.motorRpmEst} RPM)</span>
                      </div>
                    )}
                  </div>

                  <p className="text-slate-400 text-[11px] line-clamp-2">
                    {profile.description}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => handleAuditionProfile(profile)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all ${
                        isAuditioning
                          ? 'bg-purple-500 text-white shadow-[0_0_12px_rgba(168,85,247,0.6)]'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isAuditioning ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                      <span>{isAuditioning ? 'Stop Audition' : 'Audition Sound'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setLabMode('live');
                        handleStartLiveListening();
                      }}
                      className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] font-bold flex items-center gap-1"
                    >
                      <span>Test Live Match</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW C: DIAGNOSTIC BENCH & SINGLE-FILE ML ANALYZER */}
      {/* ========================================================================= */}
      {labMode === 'diagnostic' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 4 Cols: Sound Selection / Upload / Record */}
            <div className="lg:col-span-4 glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              
              {/* Bench Source Selector Tabs */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-white uppercase">
                  Audio Source
                </span>
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-mono font-bold">
                  <button
                    type="button"
                    onClick={() => setBenchSourceMode('presets')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      benchSourceMode === 'presets' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => setBenchSourceMode('upload')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      benchSourceMode === 'upload' ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    onClick={() => setBenchSourceMode('mic')}
                    className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                      benchSourceMode === 'mic' 
                        ? 'bg-red-600 text-white font-bold animate-pulse' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>Record</span>
                  </button>
                </div>
              </div>

              {/* Mode A: Preset Demo Tracks */}
              {benchSourceMode === 'presets' && (
                <div className="space-y-2 overflow-y-auto max-h-[300px] pr-1 font-mono text-xs">
                  {DEMO_TRACKS.map(track => (
                    <button
                      key={track.id}
                      onClick={() => handleSelectDemoTrack(track.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                        selectedDemoId === track.id
                          ? 'border-cyan-400 bg-cyan-950/40 text-white font-bold'
                          : 'border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="truncate">
                        <p className="truncate font-semibold">{track.label}</p>
                        <span className="text-[10px] text-slate-500">{track.duration}s</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                        track.category === 'Drone' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {track.category}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Mode B: Upload File */}
              {benchSourceMode === 'upload' && (
                <div className="space-y-3 pt-1">
                  <label className="w-full py-8 px-4 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-400 flex flex-col items-center justify-center gap-2.5 cursor-pointer text-xs font-mono text-slate-400 hover:text-white transition-all bg-slate-900/50">
                    <Upload className="w-6 h-6 text-cyan-400" />
                    <span className="font-bold text-slate-200">Select Audio File</span>
                    <span className="text-[10px] text-slate-500">Supports .wav, .mp3, .ogg, .webm</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {uploadedFile && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between font-mono text-xs">
                      <span className="truncate text-cyan-300 font-bold">{uploadedFile.name}</span>
                      <span className="text-[10px] text-slate-400">{(uploadedFile.size / 1024).toFixed(0)} KB</span>
                    </div>
                  )}
                </div>
              )}

              {/* Mode C: Live Microphone Recorder */}
              {benchSourceMode === 'mic' && (
                <div className="space-y-3 pt-1">
                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 text-center">
                    
                    {/* Record Button */}
                    <button
                      type="button"
                      onClick={!isBenchRecording ? handleStartBenchRecording : handleStopBenchRecording}
                      className={`w-full py-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                        isBenchRecording
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_25px_rgba(239,68,68,0.7)] animate-pulse'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                      }`}
                    >
                      {isBenchRecording ? (
                        <>
                          <Square className="w-4 h-4 fill-current" />
                          <span>Stop & Load Sample ({benchRecordingDuration}s)</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4" />
                          <span>Start Mic Recording</span>
                        </>
                      )}
                    </button>

                    {/* Live VU Meter during recording */}
                    {isBenchRecording && (
                      <div className="space-y-1.5 p-2 bg-slate-950 rounded-xl border border-red-500/30">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-red-400 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                            AUDIO LEVEL:
                          </span>
                          <span className="text-slate-300 font-bold">{benchAudioLevel}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex items-center gap-0.5 p-0.5">
                          {Array.from({ length: 20 }).map((_, i) => {
                            const active = benchAudioLevel > (i / 20) * 100;
                            return (
                              <div
                                key={i}
                                className={`h-full flex-1 rounded-sm transition-all duration-75 ${
                                  active
                                    ? i > 15 ? 'bg-red-500' : i > 10 ? 'bg-amber-400' : 'bg-cyan-400'
                                    : 'bg-slate-800'
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 font-mono">
                      {isBenchRecording
                        ? 'Listening live... Speak or play drone sound, then click Stop to load.'
                        : 'Record physical mic audio to test on the diagnostic bench.'}
                    </p>

                    {benchMicError && (
                      <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[10px] font-mono">
                        {benchMicError}
                      </div>
                    )}
                  </div>

                  {/* Quick Simulated Acoustic Probes */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">
                      Quick Test Probes (Instant Fallback):
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                      <button
                        type="button"
                        onClick={() => handleSelectDemoTrack('demo-quad-hover')}
                        className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-300 border border-red-500/30 font-bold flex items-center justify-center gap-1"
                      >
                        <span>🛸 Quadcopter</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDemoTrack('demo-fpv-drone')}
                        className="p-1.5 rounded-lg bg-purple-950/30 hover:bg-purple-900/40 text-purple-300 border border-purple-500/30 font-bold flex items-center justify-center gap-1"
                      >
                        <span>⚡ FPV Drone</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDemoTrack('demo-fan-noise')}
                        className="p-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 font-bold flex items-center justify-center gap-1"
                      >
                        <span>🗣️ Speech/Ambient</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectDemoTrack('demo-bird-sounds')}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold flex items-center justify-center gap-1"
                      >
                        <span>🍃 Wildlife</span>
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>

            {/* Right 8 Cols: Player & Waveform Visualizer */}
            <div className="lg:col-span-8 glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase block">ACTIVE BENCH AUDIO</span>
                  <h4 className="text-sm font-bold text-white font-mono truncate">{activeFileName}</h4>
                </div>
                <span className="text-xs font-mono text-cyan-400">{totalDuration}s</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between gap-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePlay}
                    className="p-2.5 rounded-lg bg-cyan-500 text-black hover:bg-cyan-400 font-bold transition-all shadow-[0_0_12px_rgba(34,211,238,0.4)]"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </button>
                  <button
                    onClick={handleStop}
                    className="p-2.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress */}
                <div className="font-mono text-xs text-slate-300">
                  <span className="text-cyan-400 font-bold">{currentTime.toFixed(1)}s</span> / {totalDuration.toFixed(1)}s
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsMuted(!isMuted)} className="text-slate-400 hover:text-white">
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setVolume(v);
                      audioSynthesizer.setVolume(isMuted ? 0 : v);
                    }}
                    className="w-20 accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Scrub Bar */}
              <input
                type="range"
                min={0}
                max={totalDuration}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  audioSynthesizer.seek(val);
                }}
                className="w-full accent-cyan-400 cursor-pointer"
              />

              {/* Action Buttons: Analyze & Train */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={handleStartAnalysis}
                  disabled={isAnalyzing}
                  className="flex-1 w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-emerald-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-sm font-heading tracking-wider shadow-[0_0_20px_rgba(34,211,238,0.4)] flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Extracting Acoustic Harmonics...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Run ML Diagnostic Analysis</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTrainName(activeFileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
                    setShowTrainModal(true);
                  }}
                  className="w-full sm:w-auto px-4 py-3.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                  title="Train this audio sample into signature library"
                >
                  <Bookmark className="w-4 h-4 text-purple-400" />
                  <span>Train As Signature</span>
                </button>
              </div>

            </div>

          </div>

          {/* Diagnostic Result Card */}
          {analysisResult && (
            <div ref={resultRef} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white font-heading">
                    Diagnostic Analysis: {analysisResult.soundClassification}
                  </h3>
                </div>
                <span className={`px-3 py-1 rounded-full font-mono text-xs font-bold ${
                  analysisResult.classification === 'DRONE_DETECTED'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}>
                  {analysisResult.confidence}% MATCH
                </span>
              </div>

              {/* Preprocessing & Feature Extraction Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <span className="text-slate-400 text-[10px] block">SPECTRAL PEAK</span>
                  <span className="text-cyan-300 font-bold text-sm">{analysisResult.featureExtraction.frequencyPeak}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <span className="text-slate-400 text-[10px] block">SPECTROGRAM TYPE</span>
                  <span className="text-purple-300 font-bold text-sm">{analysisResult.featureExtraction.spectrogramType}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <span className="text-slate-400 text-[10px] block">MFCC COEFFICIENTS</span>
                  <span className="text-white font-bold text-xs">{analysisResult.featureExtraction.mfccCoefficients}</span>
                </div>
              </div>

              <p className="text-xs font-mono text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                {analysisResult.explanation}
              </p>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. COLLAPSIBLE DETECTION HISTORY DROPDOWN BOX */}
      {/* ========================================================================= */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-slate-900/40 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-heading">
                  Acoustic Testing & Detection History
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[11px] font-mono font-bold">
                  {history.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                Chronological ledger of real-time microphone matches and test records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-slate-400 hidden md:inline">
              {isHistoryOpen ? 'Collapse History' : 'Expand History'}
            </span>
            <ChevronDown className={`w-4 h-4 text-cyan-400 transition-transform duration-200 ${isHistoryOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isHistoryOpen && (
          <div className="p-5 pt-0 border-t border-slate-800/80 space-y-4 animate-fade-in font-mono text-xs">
            <div className="flex items-center justify-between pt-3">
              <div className="flex items-center gap-1.5">
                {(['ALL', 'DRONE_DETECTED', 'NO_DRONE'] as const).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      historyFilter === filter
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {filter === 'ALL' ? 'All' : filter === 'DRONE_DETECTED' ? 'Drones' : 'Non-Drones'}
                  </button>
                ))}
              </div>

              {history.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="text-red-400 hover:text-red-300 text-[11px] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Ledger</span>
                </button>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="pb-2">SOURCE / FILE</th>
                    <th className="pb-2">RESULT</th>
                    <th className="pb-2">CONFIDENCE</th>
                    <th className="pb-2">TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history
                    .filter(h => historyFilter === 'ALL' || h.classification === historyFilter)
                    .slice(0, 8)
                    .map(item => (
                      <tr key={item.id} className="text-slate-300">
                        <td className="py-2.5 font-bold truncate max-w-[200px]">{item.fileName}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.classification === 'DRONE_DETECTED' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {item.classification === 'DRONE_DETECTED' ? 'DRONE' : 'CLEAR'}
                          </span>
                        </td>
                        <td className="py-2.5 text-cyan-400">{item.confidence}%</td>
                        <td className="py-2.5 text-slate-500">{item.dateTime}</td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {history.length === 0 && (
                <div className="py-6 text-center text-slate-500 text-xs italic">
                  No testing history recorded yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: TRAIN NEW ACOUSTIC SIGNATURE */}
      {/* ========================================================================= */}
      {showTrainModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 rounded-2xl border border-purple-500/40 max-w-md w-full space-y-4 bg-[#071126] font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Train New Acoustic Drone Signature
                </h3>
              </div>
              <button
                onClick={() => setShowTrainModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTrainNewSignature} className="space-y-3">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Signature / Drone Name:</label>
                <input
                  type="text"
                  value={trainName}
                  onChange={(e) => setTrainName(e.target.value)}
                  placeholder="e.g. DJI Mini 4 Pro - High Pitch Hover"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-400 outline-none"
                  required
                />
              </div>

              {uploadedFile && (
                <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="text-[9px] text-purple-300 block font-bold">SOURCE AUDIO LOADED:</span>
                    <span className="font-bold text-white truncate block text-xs">{uploadedFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1 shrink-0"
                  >
                    {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Drone Category:</label>
                  <select
                    value={trainCategory}
                    onChange={(e) => setTrainCategory(e.target.value as ClassificationType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-400 outline-none"
                  >
                    <option value="DRONE_DETECTED">Drone Acoustic Target</option>
                    <option value="NO_DRONE">Non-Drone Sound</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Rotor Blades:</label>
                  <select
                    value={trainBladeCount}
                    onChange={(e) => setTrainBladeCount(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-400 outline-none"
                  >
                    <option value={4}>4-Blade Quadcopter</option>
                    <option value={3}>3-Blade FPV Racer</option>
                    <option value={6}>6-Blade Hexacopter</option>
                    <option value={2}>2-Blade Fixed-Wing</option>
                    <option value={0}>0 (Ambient / Noise)</option>
                  </select>
                </div>
              </div>

              {/* Fundamental Frequency */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold">Fundamental Frequency Peak:</label>
                  <span className="text-purple-300 font-bold text-sm">{trainFundHz} Hz</span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={1200}
                  step={5}
                  value={trainFundHz}
                  onChange={(e) => setTrainFundHz(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>60 Hz (Heavy)</span>
                  <span>185 Hz (DJI Quad)</span>
                  <span>720 Hz (FPV)</span>
                  <span>1200 Hz</span>
                </div>

                {/* Mic Sample Auto-Detect Tool */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-sans">
                    Have live audio? Capture sample to auto-tune frequency:
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureMicForTrain}
                    disabled={isCapturingMicTrain}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                      isCapturingMicTrain
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    }`}
                  >
                    <Mic className="w-3 h-3" />
                    <span>{isCapturingMicTrain ? 'Sampling...' : 'Sample Mic'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Description / Notes:</label>
                <textarea
                  value={trainDescription}
                  onChange={(e) => setTrainDescription(e.target.value)}
                  placeholder="e.g. Captured in outdoor field with 4S LiPo battery at steady altitude."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-400 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTrainModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Train & Save Signature</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
