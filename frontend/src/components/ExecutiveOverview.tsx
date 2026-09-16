import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, ShieldAlert, CheckCircle2, Play, Square, FlaskConical, 
  Crosshair, Radio, Video, Navigation, Zap, Volume2, ChevronRight, 
  Mic, RefreshCw, X, AlertTriangle, Eye, ArrowRight, Map, Layers,
  Compass, Shield, Building, Target, Wifi
} from 'lucide-react';
import { ExecutiveMetrics, DetectionEvent, TestHistoryEntry, AnalysisResult, AcousticSensor } from '../types';
import { analyzeAudioViaBackend } from '../utils/apiClient';
import { decodeAndClassifyAudioBlob } from '../utils/audioClassifier';
import { audioSynthesizer } from '../utils/audioSynthesizer';

export interface ExecutiveOverviewProps {
  metrics: ExecutiveMetrics;
  recentEvents: DetectionEvent[];
  history: TestHistoryEntry[];
  sensors?: AcousticSensor[];
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onNavigateToTesting: (trackId?: string) => void;
  onTriggerScenario?: (type: 'quadcopter' | 'fpv' | 'birds' | 'clear') => void;
  onAnalysisCompleted?: (result: AnalysisResult) => void;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({
  metrics,
  recentEvents,
  history,
  sensors = [],
  isSimulating,
  onToggleSimulation,
  onNavigateToTesting,
  onTriggerScenario,
  onAnalysisCompleted
}) => {
  // Map View Mode: 'tactical' (Facility & Airspace Defense Map) | 'radar' (360° Polar Radar)
  const [mapViewMode, setMapViewMode] = useState<'tactical' | 'radar'>('tactical');
  const [showBeams, setShowBeams] = useState<boolean>(true);
  const [showFacilityLabels, setShowFacilityLabels] = useState<boolean>(true);

  // Radar sweep animation angle
  const [sweepAngle, setSweepAngle] = useState(0);
  const [radarRange, setRadarRange] = useState<150 | 300 | 500>(300);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);
  const [hoveredSensorId, setHoveredSensorId] = useState<string | null>(null);

  // Dedicated Acoustic Probe Deck State
  const [showAcousticDeck, setShowAcousticDeck] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [isAnalyzingMic, setIsAnalyzingMic] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [lastMicResult, setLastMicResult] = useState<AnalysisResult | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Audio Playback of Recorded Clip
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const handleToggleAudioPlayback = () => {
    if (!recordedAudioUrl) return;
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(recordedAudioUrl);
      audioPlayerRef.current.onended = () => setIsAudioPlaying(false);
    }
    if (isAudioPlaying) {
      audioPlayerRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.play();
      setIsAudioPlaying(true);
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSweepAngle(prev => (prev + 3) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  // Cleanup microphone on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (micAudioCtxRef.current) {
        try { micAudioCtxRef.current.close(); } catch {}
      }
    };
  }, []);

  // Start microphone recording inside the probe modal
  const handleStartRecording = async () => {
    try {
      setMicError(null);
      setLastMicResult(null);
      setAudioLevel(0);

      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported by your browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        } 
      });
      micStreamRef.current = stream;

      // Setup Web Audio Analyser for live VU meter
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          micAudioCtxRef.current = ctx;
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
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            animFrameRef.current = requestAnimationFrame(updateVu);
          };
          updateVu();
        }
      } catch (vuErr) {
        console.warn('Live VU meter inactive:', vuErr);
      }

      // Determine supported MIME type safely
      let selectedMimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus'
        ];
        for (const c of candidates) {
          if (MediaRecorder.isTypeSupported(c)) {
            selectedMimeType = c;
            break;
          }
        }
      }

      const recorder = selectedMimeType 
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recordStartTimeRef.current = Date.now();

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          audioChunksRef.current.push(evt.data);
        }
      };

      recorder.onstop = async () => {
        try {
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          if (micAudioCtxRef.current) {
            try { micAudioCtxRef.current.close(); } catch {}
            micAudioCtxRef.current = null;
          }
          if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
          }

          const blobType = selectedMimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
          const fileName = `mic_recording_${Date.now().toString().slice(-4)}.webm`;

          if (audioBlob.size > 0) {
            const url = URL.createObjectURL(audioBlob);
            setRecordedAudioUrl(url);
            if (audioPlayerRef.current) {
              audioPlayerRef.current.src = url;
            }
          }

          setIsAnalyzingMic(true);
          // Decodes real PCM samples & detects pitch, periodicity, and vocal formants
          const result = await decodeAndClassifyAudioBlob(audioBlob, fileName);
          setIsAnalyzingMic(false);
          setLastMicResult(result);
          onAnalysisCompleted?.(result);
        } catch (procErr) {
          setIsAnalyzingMic(false);
          setMicError('Audio processing failed: ' + (procErr as Error).message);
        }
      };

      // Timesliced recording ensures chunks are continuously saved every 200ms
      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordStartTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
      }, 500);

    } catch (err: any) {
      console.error('Microphone error:', err);
      const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const isNotFound = err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';
      const msg = isDenied
        ? 'Microphone permission denied by browser. You can still test acoustic classification below using Simulated Audio Probes.'
        : isNotFound
        ? 'No hardware microphone found on this device. You can test acoustic classification below using Simulated Audio Probes.'
        : `Microphone access error: ${err.message || err.name}. You can use Simulated Audio Probes below.`;
      setMicError(msg);
      setIsRecording(false);
    }
  };

  // Stop microphone recording cleanly
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }
      } catch (err) {
        console.warn('Error stopping MediaRecorder:', err);
      }
      setIsRecording(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  // Run Simulated Acoustic Probe fallback (available anytime, even if mic denied)
  const handleRunSimulatedProbe = async (toneType: 'drone' | 'ambient' | 'fpv' | 'speech' | 'clear' = 'drone') => {
    try {
      setMicError(null);
      setIsAnalyzingMic(true);
      setLastMicResult(null);

      // Play synthesized acoustic tone so operator can hear what is being tested
      if (toneType === 'drone') {
        audioSynthesizer.playDemoSound('demo-quad-hover', 0.8);
      } else if (toneType === 'fpv') {
        audioSynthesizer.playDemoSound('demo-fpv-drone', 0.8);
      } else if (toneType === 'ambient') {
        audioSynthesizer.playDemoSound('demo-fan-noise', 0.6);
      }

      const dummyBlob = new Blob([new Uint8Array(2048)], { type: 'audio/webm' });
      const result = await decodeAndClassifyAudioBlob(dummyBlob, `${toneType}_probe.webm`, toneType);
      setIsAnalyzingMic(false);
      setLastMicResult(result);
      onAnalysisCompleted?.(result);
    } catch (err) {
      setIsAnalyzingMic(false);
      setMicError('Failed to run simulated probe: ' + (err as Error).message);
    }
  };

  // Determine active target (selected or first locked/tracking)
  const activeTarget = selectedEventId
    ? recentEvents.find(e => e.id === selectedEventId) || recentEvents[0]
    : recentEvents.find(e => e.status === 'LOCKED' || e.status === 'TRACKING') || recentEvents[0] || null;

  return (
    <div className="space-y-4 pb-12">
      
      {/* 1. TOP COMMAND & METRICS BAR (Stable, Clean, Everything in One Reach) */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Airspace Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                activeTarget && activeTarget.status === 'LOCKED' ? 'bg-red-400' : isSimulating ? 'bg-amber-400' : 'bg-emerald-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                activeTarget && activeTarget.status === 'LOCKED' ? 'bg-red-500' : isSimulating ? 'bg-amber-500' : 'bg-emerald-500'
              }`}></span>
            </span>
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
              {activeTarget && activeTarget.status === 'LOCKED' 
                ? 'ALERT: AIRSPACE ENGAGED' 
                : isSimulating 
                ? 'SIMULATION RUNNING' 
                : 'SURVEILLANCE ARMED'}
            </span>
          </div>

          <h2 className="hidden lg:block text-sm font-bold text-slate-400 font-heading tracking-tight border-l border-slate-800 pl-3">
            Acoustic Airspace Command
          </h2>
        </div>

        {/* Inline KPI Metric Chips */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono py-0.5">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2 whitespace-nowrap">
            <span className="text-slate-500 text-[11px]">TESTS:</span>
            <span className="font-bold text-white">{metrics.totalTests}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-red-950/20 border border-red-500/30 flex items-center gap-2 whitespace-nowrap text-red-400">
            <span className="text-red-400/70 text-[11px]">DRONES:</span>
            <span className="font-bold text-red-400">{metrics.droneDetections}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-2 whitespace-nowrap text-emerald-400">
            <span className="text-emerald-400/70 text-[11px]">NON-DRONE:</span>
            <span className="font-bold text-emerald-400">{metrics.nonDroneSounds}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-center gap-2 whitespace-nowrap text-cyan-400">
            <span className="text-cyan-400/70 text-[11px]">RESPONSE:</span>
            <span className="font-bold text-cyan-300">{metrics.responseTimeMs}ms</span>
          </div>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Record Sound Direct Button */}
          <button
            onClick={!isRecording ? handleStartRecording : handleStopRecording}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
              isRecording
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.7)] animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.15)]'
            }`}
            title="Start or stop recording live audio"
          >
            {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{isRecording ? `Recording (${recordingDuration}s)` : 'Record Sound'}</span>
          </button>

          {/* Simulation Toggle */}
          <button
            onClick={onToggleSimulation}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
              isSimulating
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.3)] animate-pulse'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {isSimulating ? <Square className="w-3.5 h-3.5 fill-current text-amber-400" /> : <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />}
            <span>{isSimulating ? 'Stop Sim' : 'Live Sim'}</span>
          </button>

          {/* Test Sound Button */}
          <button
            onClick={() => onNavigateToTesting()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-black font-bold text-xs font-heading shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] transition-all"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Test Sound</span>
          </button>
        </div>
      </div>

      {/* CRITICAL AIRSPACE DRONE ALERT BANNER (Triggers immediately on verified Drone Detection) */}
      {(() => {
        const isDroneTarget = activeTarget && (
          activeTarget.targetType.includes('Drone') || 
          activeTarget.targetType.includes('Quadcopter') || 
          activeTarget.targetType.includes('FPV') || 
          activeTarget.targetType.includes('UAV')
        );
        const hasActiveDroneThreat = isDroneTarget && (activeTarget.status === 'LOCKED' || activeTarget.status === 'TRACKING');
        if (!hasActiveDroneThreat || !activeTarget) return null;

        const isFpv = activeTarget.targetType.includes('FPV') || activeTarget.targetType.includes('Racing');
        const targetTrackId = isFpv ? 'demo-fpv-drone' : 'demo-quad-hover';

        return (
          <div className="p-4 rounded-2xl bg-red-950/80 border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)] flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-red-500 text-white font-bold animate-bounce shrink-0 shadow-[0_0_20px_rgba(239,68,68,0.9)]">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-red-500 text-white uppercase tracking-wider">
                    CRITICAL AIRSPACE THREAT
                  </span>
                  <span className="text-red-300 font-mono text-xs">• ACOUSTIC TARGET LOCKED</span>
                </div>
                <h3 className="text-lg font-bold text-white font-heading mt-0.5">
                  {activeTarget.targetType.toUpperCase()} DETECTED IN PERIMETER
                </h3>
                <p className="text-xs text-red-200 font-mono mt-0.5">
                  Azimuth Bearing: <strong className="text-white">{activeTarget.bearingDeg}°</strong> | Distance: <strong className="text-white">{activeTarget.distanceMeters}m</strong> | Match Confidence: <strong className="text-emerald-300">{activeTarget.confidencePct}%</strong> | Auto-PTZ Camera Slewed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onNavigateToTesting(targetTrackId)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FlaskConical className="w-4 h-4" />
                <span>Inspect Spectrum</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* 2. INLINE ACOUSTIC RECORDING & SOUND PROBE STATION */}
      <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-3 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90">
        
        {/* Top Header of the Deck */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <Mic className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                Acoustic Airspace Probe & Microphone Station
                {isRecording && (
                  <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold bg-red-950/60 border border-red-500/40 px-2 py-0.5 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                    RECORDING LIVE ({recordingDuration}s)
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Record live microphone sound or trigger simulated audio probes to test instant drone identification
              </p>
            </div>
          </div>

          {/* Controls / Error */}
          {micError && (
            <div className="text-[11px] font-mono text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-xs">{micError}</span>
            </div>
          )}
        </div>

        {/* Action Controls & Live Visualizer Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-0.5">
          
          {/* Record Button, VU Meter & Audio Playback */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={!isRecording ? handleStartRecording : handleStopRecording}
              disabled={isAnalyzingMic}
              className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 shadow-md ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop & Classify Sound</span>
                </>
              ) : isAnalyzingMic ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing Spectrum...</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Record from Mic</span>
                </>
              )}
            </button>

            {/* Live VU Meter during recording */}
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/80 rounded-xl border border-red-500/30">
                <span className="text-[10px] font-mono text-red-400 font-bold">LEVEL:</span>
                <div className="h-2.5 w-28 bg-slate-900 rounded-full overflow-hidden flex items-center gap-0.5 p-0.5">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const threshold = (i / 16) * 100;
                    const active = audioLevel > threshold;
                    return (
                      <div
                        key={i}
                        className={`h-full flex-1 rounded-sm transition-all duration-75 ${
                          active
                            ? i > 12 ? 'bg-red-500' : i > 8 ? 'bg-amber-400' : 'bg-cyan-400'
                            : 'bg-slate-800'
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[10px] font-mono text-slate-300 font-bold">{audioLevel}%</span>
              </div>
            )}

            {/* Audio Playback of Recorded Clip */}
            {recordedAudioUrl && !isRecording && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700">
                <button
                  type="button"
                  onClick={handleToggleAudioPlayback}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-mono text-xs font-bold"
                  title="Listen to recorded audio sample"
                >
                  {isAudioPlaying ? <Square className="w-3.5 h-3.5 fill-current text-red-400" /> : <Play className="w-3.5 h-3.5 fill-current text-cyan-400 ml-0.5" />}
                  <span>{isAudioPlaying ? 'Stop Audio' : 'Play Audio'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick Simulated Test Probes */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-slate-500 text-[11px]">QUICK PROBE:</span>
            <button
              type="button"
              onClick={() => handleRunSimulatedProbe('drone')}
              className="px-2.5 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-500/30 font-bold flex items-center gap-1 transition-all"
            >
              <span>🛸 Quadcopter</span>
            </button>
            <button
              type="button"
              onClick={() => handleRunSimulatedProbe('fpv')}
              className="px-2.5 py-1.5 rounded-lg bg-purple-950/30 hover:bg-purple-900/40 text-purple-400 border border-purple-500/30 font-bold flex items-center gap-1 transition-all"
            >
              <span>⚡ FPV Drone</span>
            </button>
            <button
              type="button"
              onClick={() => handleRunSimulatedProbe('clear')}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 transition-all"
            >
              <span>🟢 Clear Sound</span>
            </button>
            <button
              type="button"
              onClick={() => handleRunSimulatedProbe('speech')}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1 transition-all"
            >
              <span>🗣️ Speech (Safe)</span>
            </button>
            <button
              type="button"
              onClick={() => handleRunSimulatedProbe('ambient')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold flex items-center gap-1 transition-all"
            >
              <span>🍃 Ambient</span>
            </button>
          </div>

        </div>

        {/* Live Classification Verdict Banner (if test result exists) */}
        {lastMicResult && !isRecording && (
          <div className={`p-3 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in ${
            lastMicResult.classification === 'DRONE_DETECTED'
              ? 'bg-red-950/40 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
              : lastMicResult.classification === 'NO_DRONE'
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
              : 'bg-amber-950/40 border-amber-500/50'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${
                lastMicResult.classification === 'DRONE_DETECTED'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {lastMicResult.classification === 'DRONE_DETECTED' ? (
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
                    lastMicResult.classification === 'DRONE_DETECTED' ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {lastMicResult.classification === 'DRONE_DETECTED' ? '🚨 DRONE DETECTED' : '🟢 NON-DRONE SOUND (SAFE)'}
                  </span>
                  <span className="text-slate-400 text-xs font-mono">•</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {lastMicResult.soundClassification}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    lastMicResult.classification === 'DRONE_DETECTED'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {lastMicResult.confidence}% Match
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-sans mt-0.5">
                  {lastMicResult.explanation}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (lastMicResult?.classification === 'DRONE_DETECTED') {
                    const isFpv = lastMicResult.soundClassification?.includes('FPV');
                    onNavigateToTesting(isFpv ? 'demo-fpv-drone' : 'demo-quad-hover');
                  } else {
                    const isWind = lastMicResult?.soundClassification?.includes('Wind');
                    onNavigateToTesting(isWind ? 'demo-wind-noise' : 'demo-fan-noise');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-mono text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Open in Testing Lab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLastMicResult(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700"
                title="Dismiss result"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 2. MAIN COCKPIT VIEW (Balanced 2-Column Layout - Perfectly Stable) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        
        {/* LEFT COLUMN (7 Cols): 360° Airspace Radar & Tactical Scenario Controller */}
        <div className="lg:col-span-7 glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
                   {/* Map / Radar Header & View Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMapViewMode('tactical')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    mapViewMode === 'tactical'
                      ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Tactical Facility Map</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMapViewMode('radar')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    mapViewMode === 'radar'
                      ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>360° Polar Radar</span>
                </button>
              </div>

              <span className="hidden xl:inline-flex text-[10px] font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full items-center gap-1">
                <Radio className="w-3 h-3 text-purple-400" />
                <span>{sensors.length} Arrays</span>
              </span>
            </div>

            {/* Range Toggle & Layer Options */}
            <div className="flex items-center gap-2">
              {mapViewMode === 'tactical' && (
                <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={() => setShowBeams(!showBeams)}
                    className={`px-2 py-0.5 rounded transition-colors ${showBeams ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Toggle acoustic directional coverage cones"
                  >
                    Beams
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFacilityLabels(!showFacilityLabels)}
                    className={`px-2 py-0.5 rounded transition-colors ${showFacilityLabels ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Toggle facility landmark labels"
                  >
                    Facility
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-500 px-1">Rng:</span>
                <button
                  onClick={() => setRadarRange(150)}
                  className={`px-1.5 py-0.5 rounded transition-all ${radarRange === 150 ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
                >
                  150m
                </button>
                <button
                  onClick={() => setRadarRange(300)}
                  className={`px-1.5 py-0.5 rounded transition-all ${radarRange === 300 ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
                >
                  300m
                </button>
                <button
                  onClick={() => setRadarRange(500)}
                  className={`px-1.5 py-0.5 rounded transition-all ${radarRange === 500 ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
                >
                  500m
                </button>
              </div>
            </div>
          </div>

          {/* VISUALIZER CONTAINER: Tactical Facility Defense Map OR 360° Polar Radar */}
          <div className="flex justify-center py-2 relative select-none">
            {mapViewMode === 'tactical' ? (
              /* --- MODE 1: TACTICAL AIRSPACE & FACILITY DEFENSE MAP --- */
              <div className="relative w-full h-[320px] rounded-2xl border border-cyan-500/30 bg-[#040916] overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] flex items-center justify-center">
                <svg viewBox="0 0 520 320" className="w-full h-full">
                  <defs>
                    {/* Background Grid Pattern */}
                    <pattern id="tacGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(34, 211, 238, 0.05)" strokeWidth="0.8" />
                      <circle cx="0" cy="0" r="1" fill="rgba(34, 211, 238, 0.15)" />
                    </pattern>

                    {/* Facility Compound Fill */}
                    <radialGradient id="facilityFill" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#081836" stopOpacity="0.85" />
                      <stop offset="100%" stopColor="#040b1a" stopOpacity="0.95" />
                    </radialGradient>

                    {/* Directional Acoustic Listening Cone Gradients */}
                    <radialGradient id="beamGradNormal" cx="0%" cy="50%" r="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                      <stop offset="60%" stopColor="#0284c7" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
                    </radialGradient>

                    <radialGradient id="beamGradActive" cx="0%" cy="50%" r="100%">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.75" />
                      <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#0891b2" stopOpacity="0.0" />
                    </radialGradient>

                    <radialGradient id="threatPulse" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* 1. Tactical Grid Background */}
                  <rect width="520" height="320" fill="#040916" />
                  <rect width="520" height="320" fill="url(#tacGrid)" />

                  {/* 2. Concentric Range Rings from Center TOC */}
                  <circle cx="260" cy="160" r="230" fill="none" stroke="rgba(34, 211, 238, 0.12)" strokeWidth="1" strokeDasharray="4 4" />
                  <text x="480" y="155" fill="rgba(34, 211, 238, 0.45)" fontSize="9" fontFamily="monospace">{radarRange}m</text>

                  <circle cx="260" cy="160" r="160" fill="none" stroke="rgba(34, 211, 238, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="410" y="155" fill="rgba(34, 211, 238, 0.45)" fontSize="9" fontFamily="monospace">{Math.round(radarRange * 0.65)}m</text>

                  <circle cx="260" cy="160" r="95" fill="rgba(239, 68, 68, 0.02)" stroke="rgba(239, 68, 68, 0.25)" strokeWidth="1" strokeDasharray="2 2" />
                  <text x="345" y="155" fill="rgba(239, 68, 68, 0.5)" fontSize="9" fontFamily="monospace">CORE</text>

                  {/* Crosshair coordinate axes */}
                  <line x1="260" y1="10" x2="260" y2="310" stroke="rgba(34, 211, 238, 0.1)" strokeWidth="0.8" />
                  <line x1="10" y1="160" x2="510" y2="160" stroke="rgba(34, 211, 238, 0.1)" strokeWidth="0.8" />

                  {/* 3. Compound Security Perimeter Boundary Polygon */}
                  <polygon
                    points="140,65 380,65 455,160 380,255 140,255 65,160"
                    fill="url(#facilityFill)"
                    stroke="#06b6d4"
                    strokeWidth="1.6"
                    strokeDasharray="6 3"
                    className="drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                  />

                  {/* Perimeter Corner Security Watchposts */}
                  {[
                    [140, 65], [380, 65], [455, 160], [380, 255], [140, 255], [65, 160]
                  ].map(([px, py], i) => (
                    <g key={i}>
                      <circle cx={px} cy={py} r="4" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.2" />
                      <circle cx={px} cy={py} r="1.5" fill="#38bdf8" />
                    </g>
                  ))}

                  {/* 4. Cardinal Defense Sectors Labeled (Positioned safely outside sensor nodes) */}
                  <text x="260" y="32" fill="#38bdf8" fontSize="8.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle" letterSpacing="1">
                    SECTOR ALPHA (NORTH GATE 0°)
                  </text>
                  <text x="475" y="164" fill="#94a3b8" fontSize="7.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    SECTOR BRAVO (90°)
                  </text>
                  <text x="260" y="295" fill="#94a3b8" fontSize="7.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    SECTOR CHARLIE (180°)
                  </text>
                  <text x="45" y="164" fill="#94a3b8" fontSize="7.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                    SECTOR DELTA (270°)
                  </text>

                  {/* 5. Facility Infrastructure & Buildings */}
                  {showFacilityLabels && (
                    <g id="facilityInfrastructure">
                      {/* Aircraft / Interceptor Hangar Alpha */}
                      <rect x="330" y="105" width="46" height="34" rx="3" fill="#0f2142" stroke="#38bdf8" strokeWidth="1" />
                      <line x1="330" y1="122" x2="376" y2="122" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" strokeDasharray="2 2" />
                      <text x="353" y="127" fill="#bae6fd" fontSize="7.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">HANGAR</text>

                      {/* Helipad with 'H' in matching cyan compound palette */}
                      <circle cx="353" cy="180" r="14" fill="#0a1830" stroke="#38bdf8" strokeWidth="1" />
                      <text x="353" y="184" fill="#7dd3fc" fontSize="10" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">H</text>

                      {/* North Gatehouse Security Checkpoint */}
                      <rect x="246" y="60" width="28" height="14" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="1" />
                      <text x="260" y="70" fill="#94a3b8" fontSize="6.5" fontFamily="monospace" textAnchor="middle">GATE</text>

                      {/* Radar & EW Mast Tower */}
                      <polygon points="175,108 184,128 166,128" fill="#1e1b4b" stroke="#a855f7" strokeWidth="1" />
                      <circle cx="175" cy="108" r="2.5" fill="#c084fc" />
                      <path d="M 169 104 A 8 8 0 0 1 181 104" fill="none" stroke="#a855f7" strokeWidth="0.9" opacity="0.7" />
                      <path d="M 165 100 A 13 13 0 0 1 185 100" fill="none" stroke="#a855f7" strokeWidth="0.8" opacity="0.4" />
                      <text x="175" y="137" fill="#d8b4fe" fontSize="7" fontFamily="monospace" textAnchor="middle">RADAR</text>

                      {/* Water Tower / Substation */}
                      <circle cx="175" cy="195" r="11" fill="#0f263d" stroke="#38bdf8" strokeWidth="1" />
                      <text x="175" y="198" fill="#7dd3fc" fontSize="6.5" fontFamily="monospace" textAnchor="middle">TOWER</text>

                      {/* Central Command Headquarters (TOC) */}
                      <rect x="238" y="145" width="44" height="30" rx="4" fill="#0b1d3a" stroke="#22d3ee" strokeWidth="1.5" />
                      <circle cx="260" cy="160" r="5" fill="#10b981" className="animate-pulse" />
                      <text x="260" y="185" fill="#67e8f9" fontSize="7.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                        COMMAND TOC
                      </text>
                    </g>
                  )}

                  {/* 6. Perimeter Acoustic Sensor Array Stations & Listening Beams */}
                  {sensors.map((sensor, idx) => {
                    let bearing = sensor.bearingDeg;
                    if (bearing === undefined) {
                      if (sensor.location.includes('North') || sensor.id.includes('NORTH')) bearing = 0;
                      else if (sensor.location.includes('East') || sensor.id.includes('EAST')) bearing = 90;
                      else if (sensor.location.includes('South') || sensor.id.includes('SOUTH')) bearing = 180;
                      else if (sensor.location.includes('West') || sensor.id.includes('WEST')) bearing = 270;
                      else bearing = Math.round((idx * 360) / Math.max(1, sensors.length));
                    }

                    // Compute sensor position along compound perimeter
                    const rad = ((bearing - 90) * Math.PI) / 180;
                    const sx = 260 + 175 * Math.cos(rad);
                    const sy = 160 + 95 * Math.sin(rad);

                    const isActive = sensor.status === 'Active';
                    const isCalibrating = sensor.status === 'Calibrating';

                    // Check if this sensor's listening beam points towards the threat
                    const angleDiff = activeTarget ? Math.min(
                      Math.abs(bearing - activeTarget.bearingDeg),
                      360 - Math.abs(bearing - activeTarget.bearingDeg)
                    ) : 999;
                    const isDetectingTarget = activeTarget && angleDiff <= 65;

                    // Directional Acoustic Listening Wedge (72° coverage cone pointing outward)
                    const beamR = isDetectingTarget ? 88 : 70;
                    const a1 = ((bearing - 90 - 36) * Math.PI) / 180;
                    const a2 = ((bearing - 90 + 36) * Math.PI) / 180;
                    const p1x = sx + beamR * Math.cos(a1);
                    const p1y = sy + beamR * Math.sin(a1);
                    const p2x = sx + beamR * Math.cos(a2);
                    const p2y = sy + beamR * Math.sin(a2);
                    const beamPath = `M ${sx} ${sy} L ${p1x} ${p1y} A ${beamR} ${beamR} 0 0 1 ${p2x} ${p2y} Z`;

                    return (
                      <g
                        key={sensor.id}
                        onMouseEnter={() => setHoveredSensorId(sensor.id)}
                        onMouseLeave={() => setHoveredSensorId(null)}
                        className="cursor-pointer group"
                      >
                        {/* Acoustic Directional Listening Beam Cone */}
                        {showBeams && (
                          <g>
                            <path
                              d={beamPath}
                              fill={isDetectingTarget ? "url(#beamGradActive)" : "url(#beamGradNormal)"}
                              stroke={isDetectingTarget ? "#22d3ee" : "rgba(56, 189, 248, 0.4)"}
                              strokeWidth={isDetectingTarget ? "1.5" : "0.7"}
                              opacity={isDetectingTarget ? 0.85 : 0.45}
                            />
                            {/* Animated sound ripple arcs for detecting sensor */}
                            {isDetectingTarget && (
                              <>
                                <path
                                  d={`M ${sx + 40 * Math.cos(a1)} ${sy + 40 * Math.sin(a1)} A 40 40 0 0 1 ${sx + 40 * Math.cos(a2)} ${sy + 40 * Math.sin(a2)}`}
                                  fill="none"
                                  stroke="#22d3ee"
                                  strokeWidth="1.5"
                                  strokeDasharray="3 3"
                                  className="animate-pulse"
                                />
                                <path
                                  d={`M ${sx + 65 * Math.cos(a1)} ${sy + 65 * Math.sin(a1)} A 65 65 0 0 1 ${sx + 65 * Math.cos(a2)} ${sy + 65 * Math.sin(a2)}`}
                                  fill="none"
                                  stroke="#22d3ee"
                                  strokeWidth="1"
                                  strokeDasharray="2 2"
                                />
                              </>
                            )}
                          </g>
                        )}

                        {/* Sensor Station Post Icon */}
                        <circle
                          cx={sx}
                          cy={sy}
                          r={hoveredSensorId === sensor.id ? 14 : isDetectingTarget ? 13 : 11}
                          fill={isDetectingTarget ? "#0891b2" : isActive ? "#0f172a" : "#1e293b"}
                          stroke={hoveredSensorId === sensor.id ? "#ffffff" : isDetectingTarget ? "#ffffff" : isActive ? "#a855f7" : "#64748b"}
                          strokeWidth={hoveredSensorId === sensor.id ? "2.8" : isDetectingTarget ? "2.5" : "1.8"}
                          className="transition-all duration-200"
                        />

                        <text
                          x={sx}
                          y={sy + 3.5}
                          fill="#ffffff"
                          fontSize="8.5"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {isDetectingTarget ? '★' : `S${idx + 1}`}
                        </text>

                        {/* Perimeter Bearing Badge */}
                        <rect
                          x={sx - 14}
                          y={sy > 160 ? sy + 13 : sy - 22}
                          width="28"
                          height="11"
                          rx="3"
                          fill={isDetectingTarget ? "#06b6d4" : "#020617"}
                          stroke={isDetectingTarget ? "#ffffff" : "#334155"}
                          strokeWidth="0.8"
                        />
                        <text
                          x={sx}
                          y={sy > 160 ? sy + 21 : sy - 14}
                          fill={isDetectingTarget ? "#000000" : "#94a3b8"}
                          fontSize="7"
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {bearing}°
                        </text>

                        {/* Interactive Sensor SVG Hover Card */}
                        {hoveredSensorId === sensor.id && (
                          <g transform={`translate(${sx > 340 ? sx - 155 : sx < 140 ? sx + 15 : sx - 75}, ${sy > 180 ? sy - 60 : sy + 15})`} className="pointer-events-none z-50">
                            <rect
                              width="150"
                              height="52"
                              rx="6"
                              fill="rgba(2, 6, 23, 0.95)"
                              stroke={isDetectingTarget ? "#22d3ee" : isActive ? "#a855f7" : "#64748b"}
                              strokeWidth="1.5"
                              className="shadow-2xl"
                            />
                            <text x="8" y="14" fill="#ffffff" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                              {sensor.name || `Sensor Array S${idx + 1}`}
                            </text>
                            <text x="8" y="26" fill="#a855f7" fontSize="7.5" fontFamily="monospace">
                              ID: {sensor.id} | Bearing: {bearing}°
                            </text>
                            <text x="8" y="37" fill="#94a3b8" fontSize="7" fontFamily="monospace">
                              Hardware: 8-Mic MEMS Array
                            </text>
                            <text x="8" y="47" fill={isDetectingTarget ? "#22d3ee" : "#34d399"} fontSize="7" fontWeight="bold" fontFamily="monospace">
                              Status: {isDetectingTarget ? "TARGET IN RANGE" : sensor.status} (-54dB)
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* 7. Threat Drone Target & Approach Flight Trajectory */}
                  {recentEvents.map((evt) => {
                    const isDrone = evt.targetType.includes('Drone') || evt.targetType.includes('Quadcopter') || evt.targetType.includes('FPV');
                    const isSelected = activeTarget?.id === evt.id;
                    const isHovered = hoveredTargetId === evt.id;

                    const targetRad = ((evt.bearingDeg - 90) * Math.PI) / 180;
                    const distFactor = Math.min(1.05, evt.distanceMeters / radarRange);
                    const tx = 260 + (215 * distFactor) * Math.cos(targetRad);
                    const ty = 160 + (130 * distFactor) * Math.sin(targetRad);

                    // Trajectory breadcrumbs (past 3 positions outside perimeter)
                    const p0x = 260 + (215 * Math.min(1.25, distFactor + 0.35)) * Math.cos(targetRad - 0.15);
                    const p0y = 160 + (130 * Math.min(1.25, distFactor + 0.35)) * Math.sin(targetRad - 0.15);
                    const p1x = 260 + (215 * Math.min(1.15, distFactor + 0.20)) * Math.cos(targetRad - 0.08);
                    const p1y = 160 + (130 * Math.min(1.15, distFactor + 0.20)) * Math.sin(targetRad - 0.08);
                    const p2x = 260 + (215 * Math.min(1.08, distFactor + 0.10)) * Math.cos(targetRad - 0.03);
                    const p2y = 160 + (130 * Math.min(1.08, distFactor + 0.10)) * Math.sin(targetRad - 0.03);

                    return (
                      <g 
                        key={evt.id} 
                        onClick={() => setSelectedEventId(evt.id)} 
                        onMouseEnter={() => setHoveredTargetId(evt.id)}
                        onMouseLeave={() => setHoveredTargetId(null)}
                        className="cursor-pointer"
                      >
                        {/* Approach Flight Path Polyline */}
                        <polyline
                          points={`${p0x},${p0y} ${p1x},${p1y} ${p2x},${p2y} ${tx},${ty}`}
                          fill="none"
                          stroke={isDrone ? "#ef4444" : "#10b981"}
                          strokeWidth="1.6"
                          strokeDasharray="4 3"
                          opacity="0.8"
                        />
                        {/* Past waypoint dots */}
                        <circle cx={p0x} cy={p0y} r="2" fill={isDrone ? "#ef4444" : "#10b981"} opacity="0.35" />
                        <circle cx={p1x} cy={p1y} r="2.5" fill={isDrone ? "#ef4444" : "#10b981"} opacity="0.55" />
                        <circle cx={p2x} cy={p2y} r="3" fill={isDrone ? "#ef4444" : "#10b981"} opacity="0.75" />

                        {/* Pulsing Acoustic Sonar Rings */}
                        {isDrone && (
                          <>
                            <circle cx={tx} cy={ty} r="16" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 2" className="animate-ping" />
                            <circle cx={tx} cy={ty} r="26" fill="rgba(239, 68, 68, 0.05)" stroke="rgba(239, 68, 68, 0.3)" strokeWidth="0.8" />
                          </>
                        )}

                        {/* Drone Silhouette / Marker */}
                        <circle
                          cx={tx}
                          cy={ty}
                          r={isSelected || isHovered ? 11 : 8}
                          fill={isDrone ? "#dc2626" : "#059669"}
                          stroke="#ffffff"
                          strokeWidth={isSelected || isHovered ? "2.5" : "1.8"}
                          className="drop-shadow-[0_0_12px_rgba(239,68,68,0.9)] transition-all"
                        />
                        {/* Crosshair reticle inside target */}
                        <line x1={tx - 4} y1={ty} x2={tx + 4} y2={ty} stroke="#ffffff" strokeWidth="1.2" />
                        <line x1={tx} y1={ty - 4} x2={tx} y2={ty + 4} stroke="#ffffff" strokeWidth="1.2" />

                        {/* Tactical Target Callout Badge (Suppressed when a sensor is being hovered to prevent box collision) */}
                        {!hoveredSensorId && (
                          <g transform={`translate(${tx > 260 ? tx - 118 : tx + 18}, ${ty > 160 ? ty - 45 : ty + 15})`}>
                            <rect
                              width="108"
                              height="34"
                              rx="4"
                              fill="rgba(2, 6, 23, 0.95)"
                              stroke={isHovered ? "#38bdf8" : isDrone ? "#ef4444" : "#10b981"}
                              strokeWidth={isHovered ? "1.8" : "1"}
                              className="shadow-xl"
                            />
                            <text x="6" y="11" fill={isDrone ? "#fca5a5" : "#6ee7b7"} fontSize="8" fontWeight="bold" fontFamily="monospace">
                              {evt.targetType.toUpperCase()}
                            </text>
                            <text x="6" y="21" fill="#cbd5e1" fontSize="6.5" fontFamily="monospace">
                              {evt.distanceMeters}m | {evt.bearingDeg}° | ALT:45m
                            </text>
                            <text x="6" y="29" fill="#38bdf8" fontSize="6.5" fontFamily="monospace">
                              Match: {evt.confidencePct}% | Peak: 185Hz
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            ) : (
              /* --- MODE 2: 360° POLAR HORIZON RADAR HUD --- */
              <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full border-2 border-cyan-500/40 flex items-center justify-center shadow-[0_0_35px_rgba(34,211,238,0.15)] bg-[#030712] select-none">
                {/* Concentric Distance Rings */}
                <div className="absolute w-[85%] h-[85%] rounded-full border border-cyan-500/20 flex items-center justify-center pointer-events-none">
                  <span className="absolute top-1 text-[9px] font-mono text-cyan-500/60">{radarRange}m</span>
                </div>
                <div className="absolute w-[58%] h-[58%] rounded-full border border-cyan-500/20 flex items-center justify-center pointer-events-none">
                  <span className="absolute top-1 text-[9px] font-mono text-cyan-500/60">{Math.round(radarRange * 0.6)}m</span>
                </div>
                <div className="absolute w-[30%] h-[30%] rounded-full border border-cyan-500/30 flex items-center justify-center pointer-events-none">
                  <span className="absolute top-1 text-[9px] font-mono text-cyan-500/70">{Math.round(radarRange * 0.3)}m</span>
                </div>

                {/* Crosshairs & 45-deg Angle Lines */}
                <div className="absolute w-full h-[1px] bg-cyan-500/20 pointer-events-none"></div>
                <div className="absolute h-full w-[1px] bg-cyan-500/20 pointer-events-none"></div>
                <div className="absolute w-full h-[1px] bg-cyan-500/10 rotate-45 pointer-events-none"></div>
                <div className="absolute w-full h-[1px] bg-cyan-500/10 -rotate-45 pointer-events-none"></div>

                {/* Cardinal Directions */}
                <span className="absolute top-2 text-[11px] font-mono font-bold text-cyan-400 pointer-events-none">N (0°)</span>
                <span className="absolute bottom-2 text-[11px] font-mono font-bold text-slate-500 pointer-events-none">S (180°)</span>
                <span className="absolute right-2 text-[11px] font-mono font-bold text-slate-500 pointer-events-none">E (90°)</span>
                <span className="absolute left-2 text-[11px] font-mono font-bold text-slate-500 pointer-events-none">W (270°)</span>

                {/* Rotating Sweep Beam */}
                <div
                  className="absolute w-1/2 h-1/2 top-0 left-1/2 origin-bottom-left transition-transform ease-linear pointer-events-none"
                  style={{
                    transform: `rotate(${sweepAngle}deg)`,
                    background: 'conic-gradient(from 270deg at 0% 100%, rgba(34, 211, 238, 0.45) 0deg, rgba(34, 211, 238, 0) 55deg)',
                  }}
                />

                {/* Center Acoustic Array Icon */}
                <div className="w-7 h-7 rounded-full bg-cyan-500 text-black flex items-center justify-center font-bold text-xs shadow-[0_0_18px_rgba(34,211,238,0.9)] z-10">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>

                {/* Target Markers in Polar Mode */}
                {recentEvents.map((evt) => {
                  const rad = ((evt.bearingDeg - 90) * Math.PI) / 180;
                  const radiusPct = Math.min(42, (evt.distanceMeters / radarRange) * 42);
                  const x = 50 + radiusPct * Math.cos(rad);
                  const y = 50 + radiusPct * Math.sin(rad);
                  const isDrone = evt.targetType.includes('Drone') || evt.targetType.includes('Quadcopter') || evt.targetType.includes('FPV');
                  const isSelected = activeTarget?.id === evt.id;
                  const isHovered = hoveredTargetId === evt.id;

                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEventId(evt.id)}
                      onMouseEnter={() => setHoveredTargetId(evt.id)}
                      onMouseLeave={() => setHoveredTargetId(null)}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer p-2 group"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      {isDrone && (
                        <div className="absolute inset-0 rounded-full bg-red-500/40 animate-ping pointer-events-none"></div>
                      )}
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${
                          isSelected || isHovered ? 'ring-4 ring-white shadow-[0_0_20px_rgba(239,68,68,1)] z-40' : ''
                        } ${
                          isDrone
                            ? 'bg-red-500 border-white text-white shadow-[0_0_15px_rgba(239,68,68,1)]'
                            : 'bg-emerald-500 border-white text-black shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                        }`}
                      >
                        <span className="text-[9px] font-mono font-bold">●</span>
                      </div>

                      {/* Interactive Target Hover Card (Polar Mode) */}
                      {isHovered && (
                        <div
                          className={`absolute z-50 glass-panel p-2.5 rounded-xl border text-xs font-mono shadow-2xl whitespace-nowrap pointer-events-none transition-all ${
                            isDrone
                              ? 'border-red-500/80 bg-slate-950/95 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)]'
                              : 'border-emerald-500/80 bg-slate-950/95 text-white shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                          } ${
                            y > 55 ? 'bottom-8' : 'top-8'
                          } ${
                            x > 55 ? 'right-0' : 'left-0'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1 mb-1">
                            <span className={`font-bold ${isDrone ? 'text-red-400' : 'text-emerald-400'}`}>
                              {evt.targetType}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                              {evt.status}
                            </span>
                          </div>
                          <div className="space-y-0.5 text-[10px] text-slate-300">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Target ID:</span>
                              <span className="font-bold text-white">{evt.id}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Bearing:</span>
                              <span className="font-bold text-cyan-300">{evt.bearingDeg}°</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Distance:</span>
                              <span className="font-bold text-white">{evt.distanceMeters}m</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Confidence:</span>
                              <span className="font-bold text-emerald-400">{evt.confidencePct}%</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Perimeter Acoustic Sensor Array Nodes in Polar Mode */}
                {sensors.map((sensor, idx) => {
                  let bearing = sensor.bearingDeg;
                  if (bearing === undefined) {
                    if (sensor.location.includes('North') || sensor.id.includes('NORTH')) bearing = 0;
                    else if (sensor.location.includes('East') || sensor.id.includes('EAST')) bearing = 90;
                    else if (sensor.location.includes('South') || sensor.id.includes('SOUTH')) bearing = 180;
                    else if (sensor.location.includes('West') || sensor.id.includes('WEST')) bearing = 270;
                    else bearing = Math.round((idx * 360) / Math.max(1, sensors.length));
                  }

                  const rad = ((bearing - 90) * Math.PI) / 180;
                  const x = 50 + 39.0 * Math.cos(rad);
                  const y = 50 + 39.0 * Math.sin(rad);

                  const isActive = sensor.status === 'Active';
                  const isCalibrating = sensor.status === 'Calibrating';
                  const angleDiff = activeTarget ? Math.min(
                    Math.abs(bearing - activeTarget.bearingDeg),
                    360 - Math.abs(bearing - activeTarget.bearingDeg)
                  ) : 999;
                  const isDetectingTarget = activeTarget && angleDiff <= 65;
                  const isHovered = hoveredSensorId === sensor.id;

                  return (
                    <div
                      key={sensor.id}
                      onMouseEnter={() => setHoveredSensorId(sensor.id)}
                      onMouseLeave={() => setHoveredSensorId(null)}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer p-1 group"
                      style={{ left: `${x}%`, top: `${y}%` }}
                    >
                      {isDetectingTarget && (
                        <div className="absolute -inset-2.5 rounded-full bg-cyan-400/50 animate-ping pointer-events-none"></div>
                      )}
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shadow-md ${
                          isDetectingTarget
                            ? 'bg-cyan-500 border-white text-black font-bold ring-2 ring-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.9)] animate-pulse'
                            : isHovered
                            ? 'bg-[#0e1738] border-white text-cyan-300 ring-2 ring-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.8)]'
                            : isActive
                            ? 'bg-[#0e1738] border-purple-400 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.6)]'
                            : isCalibrating
                            ? 'bg-amber-950/90 border-amber-400 text-amber-300 animate-pulse'
                            : 'bg-slate-900 border-slate-700 text-slate-500'
                        }`}
                      >
                        <span className="text-[9px] font-mono font-bold">
                          {isDetectingTarget ? '★' : `S${idx + 1}`}
                        </span>
                      </div>
                      <span className={`absolute ${y > 70 ? '-top-4' : y < 30 ? '-bottom-4' : x > 70 ? '-left-6' : '-right-6'} left-1/2 -translate-x-1/2 text-[7.5px] font-mono font-bold px-1 rounded whitespace-nowrap border pointer-events-none ${
                        isDetectingTarget ? 'bg-cyan-500 text-black border-white' : 'bg-slate-950/95 text-slate-200 border-slate-800'
                      }`}>
                        {bearing}°
                      </span>

                      {/* Interactive Sensor Hover Card (Polar Mode) */}
                      {isHovered && (
                        <div
                          className={`absolute z-50 glass-panel p-2.5 rounded-xl border border-cyan-500/80 bg-slate-950/95 text-white text-xs font-mono shadow-2xl whitespace-nowrap pointer-events-none transition-all shadow-[0_0_25px_rgba(34,211,238,0.3)] ${
                            y > 55 ? 'bottom-8' : 'top-8'
                          } ${
                            x > 55 ? 'right-0' : 'left-0'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1 mb-1">
                            <span className="font-bold text-cyan-300">
                              {sensor.name || `Sensor Array S${idx + 1}`}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                              {sensor.status}
                            </span>
                          </div>
                          <div className="space-y-0.5 text-[10px] text-slate-300">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Array ID:</span>
                              <span className="font-bold text-white">{sensor.id}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Perimeter Bearing:</span>
                              <span className="font-bold text-cyan-300">{bearing}°</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Hardware Spec:</span>
                              <span className="text-white">8 MEMS Microphone Array</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-400">Noise Floor:</span>
                              <span className="text-emerald-400 font-bold">-54 dB SNR</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Tactical Scenarios Bar */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
                Quick Tactical Scenarios:
              </span>
              <span className="text-[10px] font-mono text-cyan-400">
                1-Click Simulation Probe
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onTriggerScenario?.('quadcopter')}
                className="px-2.5 py-2 rounded-xl bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 hover:border-red-500/60 text-red-300 font-mono text-xs font-semibold transition-all text-left flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="truncate">Quadcopter (114°)</span>
              </button>

              <button
                type="button"
                onClick={() => onTriggerScenario?.('fpv')}
                className="px-2.5 py-2 rounded-xl bg-amber-950/30 hover:bg-amber-900/40 border border-amber-500/30 hover:border-amber-500/60 text-amber-300 font-mono text-xs font-semibold transition-all text-left flex items-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">FPV Drone (275°)</span>
              </button>

              <button
                type="button"
                onClick={() => onTriggerScenario?.('birds')}
                className="px-2.5 py-2 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 font-mono text-xs font-semibold transition-all text-left flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Bird Flock (35°)</span>
              </button>

              <button
                type="button"
                onClick={() => onTriggerScenario?.('clear')}
                className="px-2.5 py-2 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/60 hover:border-slate-600 text-slate-300 font-mono text-xs font-semibold transition-all text-left flex items-center gap-1.5"
              >
                <Crosshair className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">Clear Sky</span>
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (5 Cols): Target Acquisition HUD & Live Event Activity Feed */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Card 1: Active Target Acquisition & Bearing Telemetry */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono font-bold uppercase text-white">Target Telemetry</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                activeTarget && activeTarget.status === 'LOCKED'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {activeTarget && activeTarget.status === 'LOCKED' ? 'TARGET LOCKED' : 'AIRSPACE CLEAR'}
              </span>
            </div>

            {activeTarget ? (
              <div className="space-y-2.5 font-mono text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Target Signature:</span>
                  <span className="text-red-400 font-bold">{activeTarget.targetType}</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Azimuth Bearing:</span>
                    <span className="text-cyan-300 font-bold text-sm">{activeTarget.bearingDeg}°</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Distance Est:</span>
                    <span className="text-white font-bold text-sm">{activeTarget.distanceMeters}m</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Acoustic Confidence:</span>
                    <span className="text-emerald-400 font-bold text-sm">{activeTarget.confidencePct}%</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 text-[10px] block">PTZ Camera:</span>
                      <span className="text-cyan-400 font-bold text-xs flex items-center gap-1">
                        <Video className="w-3 h-3 animate-spin" /> Slewed {activeTarget.bearingDeg}°
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const isFpv = activeTarget?.targetType?.includes('FPV') || activeTarget?.targetType?.includes('Racing');
                    onNavigateToTesting(isFpv ? 'demo-fpv-drone' : 'demo-quad-hover');
                  }}
                  className="w-full py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Analyze Acoustic Profile in Lab</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <p className="text-xs font-mono text-slate-300">Passive Acoustic Scanning Active</p>
                <p className="text-[11px] text-slate-500 font-sans">
                  {sensors.length} acoustic microphone array{sensors.length === 1 ? '' : 's'} listening on 360° perimeter. Click "Record Sound" in the toolbar to probe live audio.
                </p>
              </div>
            )}
          </div>

          {/* Card 2: Real-time Acoustic Activity Feed (Ticker Style) */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex-1 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono font-bold uppercase text-white">
                  Detection Activity Feed
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {history.length} Events
              </span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[220px] pr-1 font-mono text-xs">
              {history.length > 0 ? (
                history.slice(0, 4).map((evt) => {
                  const isDrone = evt.classification === 'DRONE_DETECTED';
                  return (
                    <div
                      key={evt.id}
                      className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isDrone ? 'bg-red-400 animate-ping' : 'bg-emerald-400'}`}></span>
                        <div className="truncate">
                          <p className="text-slate-200 font-semibold truncate text-[11px]">{evt.fileName}</p>
                          <span className="text-[10px] text-slate-500">{evt.dateTime}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isDrone 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {isDrone ? 'Drone' : 'Clear'}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{evt.confidence}% match</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs italic">
                  No detection activity yet. Trigger a tactical scenario or record audio.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Array Hardware: 4 Online</span>
              <span className="text-cyan-400">SNR: 34.2 dB</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
