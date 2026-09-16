import React, { useState, useEffect } from 'react';
import { 
  Radio, CheckCircle2, Sliders, ShieldCheck, Activity, Wifi, 
  Plus, Trash2, Settings, RefreshCw, Volume2, Power, X, Save, 
  Edit3, Wind, SlidersHorizontal, AlertTriangle, RotateCcw, Compass,
  ChevronRight, Eye, Map, Crosshair, Layers
} from 'lucide-react';
import { AcousticSensor } from '../types';

interface AcousticSensorsPageProps {
  sensors?: AcousticSensor[];
  onUpdateSensors?: React.Dispatch<React.SetStateAction<AcousticSensor[]>>;
}

const DEFAULT_SENSORS: AcousticSensor[] = [
  {
    id: 'SENSOR-ARRAY-NORTH-01',
    name: 'North Perimeter Array Alpha',
    location: 'Sector A1 - North Gate Tower',
    status: 'Active',
    signalQuality: 98,
    snrDb: 34.2,
    lastUpdate: 'Just now',
    micArrayCount: 8,
    bearingDeg: 0,
    gainSensitivity: 88,
    windFilter: true,
    azimuthCoverage: '360° Omnidirectional'
  },
  {
    id: 'SENSOR-ARRAY-EAST-02',
    name: 'East Compound Array Bravo',
    location: 'Sector B4 - Hangar Roof',
    status: 'Active',
    signalQuality: 95,
    snrDb: 31.8,
    lastUpdate: '2m ago',
    micArrayCount: 8,
    bearingDeg: 90,
    gainSensitivity: 84,
    windFilter: true,
    azimuthCoverage: '360° Omnidirectional'
  },
  {
    id: 'SENSOR-ARRAY-SOUTH-03',
    name: 'South Sector Array Charlie',
    location: 'Sector C2 - Water Tower',
    status: 'Active',
    signalQuality: 96,
    snrDb: 33.1,
    lastUpdate: 'Just now',
    micArrayCount: 8,
    bearingDeg: 180,
    gainSensitivity: 86,
    windFilter: true,
    azimuthCoverage: '360° Omnidirectional'
  },
  {
    id: 'SENSOR-ARRAY-WEST-04',
    name: 'West Perimeter Array Delta',
    location: 'Sector D1 - West Fence',
    status: 'Active',
    signalQuality: 92,
    snrDb: 29.5,
    lastUpdate: '5m ago',
    micArrayCount: 8,
    bearingDeg: 270,
    gainSensitivity: 80,
    windFilter: true,
    azimuthCoverage: '360° Omnidirectional'
  }
];

export const AcousticSensorsPage: React.FC<AcousticSensorsPageProps> = ({
  sensors: propSensors,
  onUpdateSensors
}) => {
  // Local state initialized with props or localStorage
  const [sensors, setSensors] = useState<AcousticSensor[]>(() => {
    if (propSensors && propSensors.length > 0) return propSensors;
    try {
      const saved = localStorage.getItem('skyguard_acoustic_sensors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_SENSORS;
  });

  // Sync with parent state if provided
  useEffect(() => {
    if (onUpdateSensors) {
      onUpdateSensors(sensors);
    }
    try {
      localStorage.setItem('skyguard_acoustic_sensors', JSON.stringify(sensors));
    } catch {
      // ignore
    }
  }, [sensors, onUpdateSensors]);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Calibrating' | 'Standby'>('ALL');
  
  // Calibrating array animation tracking
  const [calibratingIds, setCalibratingIds] = useState<string[]>([]);
  const [isCalibratingAll, setIsCalibratingAll] = useState<boolean>(false);

  // Map Mode: 'tactical' (Facility Perimeter Map) | 'radar' (360° Polar Radar)
  const [sensorMapMode, setSensorMapMode] = useState<'tactical' | 'radar'>('tactical');
  const [showCoverageBeams, setShowCoverageBeams] = useState<boolean>(true);

  // Radar animation & selection state
  const [sweepAngle, setSweepAngle] = useState(0);
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [hoveredSensorId, setHoveredSensorId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSweepAngle(prev => (prev + 2.5) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  // Modal states
  const [editingSensor, setEditingSensor] = useState<AcousticSensor | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Sensor form state
  const [newId, setNewId] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newLocation, setNewLocation] = useState<string>('');
  const [newMicCount, setNewMicCount] = useState<number>(8);
  const [newGain, setNewGain] = useState<number>(85);
  const [newBearing, setNewBearing] = useState<number>(45);
  const [newStatus, setNewStatus] = useState<'Active' | 'Calibrating' | 'Standby'>('Active');
  const [formError, setFormError] = useState<string | null>(null);

  // Status Change Handler
  const handleStatusChange = (sensorId: string, newStatus: 'Active' | 'Calibrating' | 'Standby') => {
    setSensors(prev =>
      prev.map(s => (s.id === sensorId ? { ...s, status: newStatus, lastUpdate: 'Just now' } : s))
    );
  };

  // Gain / Sensitivity Slider Change Handler
  const handleGainChange = (sensorId: string, gain: number) => {
    setSensors(prev =>
      prev.map(s => {
        if (s.id !== sensorId) return s;
        const calculatedSnr = parseFloat((24 + (gain / 100) * 12.5).toFixed(1));
        const calculatedSignalQuality = Math.min(100, Math.round(70 + (gain / 100) * 28));
        return {
          ...s,
          gainSensitivity: gain,
          snrDb: calculatedSnr,
          signalQuality: calculatedSignalQuality,
          lastUpdate: 'Just now'
        };
      })
    );
  };

  // Wind Noise Filter Toggle
  const handleToggleWindFilter = (sensorId: string) => {
    setSensors(prev =>
      prev.map(s => (s.id === sensorId ? { ...s, windFilter: !s.windFilter, lastUpdate: 'Just now' } : s))
    );
  };

  // Recalibrate Single Array
  const handleRecalibrateSensor = (sensorId: string) => {
    if (calibratingIds.includes(sensorId)) return;
    setCalibratingIds(prev => [...prev, sensorId]);
    handleStatusChange(sensorId, 'Calibrating');

    setTimeout(() => {
      setSensors(prev =>
        prev.map(s => {
          if (s.id !== sensorId) return s;
          return {
            ...s,
            status: 'Active',
            signalQuality: 98,
            snrDb: parseFloat((32 + Math.random() * 3).toFixed(1)),
            lastUpdate: 'Calibrated just now'
          };
        })
      );
      setCalibratingIds(prev => prev.filter(id => id !== sensorId));
    }, 2200);
  };

  // Recalibrate All Arrays
  const handleRecalibrateAll = () => {
    setIsCalibratingAll(true);
    setSensors(prev => prev.map(s => ({ ...s, status: 'Calibrating', lastUpdate: 'Recalibrating...' })));

    setTimeout(() => {
      setSensors(prev =>
        prev.map(s => ({
          ...s,
          status: 'Active',
          signalQuality: Math.min(100, 94 + Math.floor(Math.random() * 6)),
          snrDb: parseFloat((31 + Math.random() * 4).toFixed(1)),
          lastUpdate: 'Calibrated just now'
        }))
      );
      setIsCalibratingAll(false);
    }, 2500);
  };

  // Delete Sensor Array
  const handleDeleteSensor = (sensorId: string) => {
    if (sensors.length <= 1) {
      alert('Cannot delete all sensors. At least one perimeter array is required.');
      return;
    }
    if (window.confirm('Are you sure you want to decommission this acoustic sensor array?')) {
      setSensors(prev => prev.filter(s => s.id !== sensorId));
    }
  };

  // Reset to default configuration
  const handleResetDefaults = () => {
    if (window.confirm('Reset all acoustic sensor arrays to factory defaults?')) {
      setSensors(DEFAULT_SENSORS);
    }
  };

  // Save edits in Edit Modal
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSensor) return;
    setSensors(prev =>
      prev.map(s => (s.id === editingSensor.id ? { ...editingSensor, lastUpdate: 'Just now' } : s))
    );
    setEditingSensor(null);
  };

  // Add new sensor with Radar Bearing
  const handleCreateSensor = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newId.trim() || !newName.trim() || !newLocation.trim()) {
      setFormError('Please fill out all required fields.');
      return;
    }

    if (sensors.some(s => s.id.toLowerCase() === newId.trim().toLowerCase())) {
      setFormError('A sensor array with this ID already exists.');
      return;
    }

    const created: AcousticSensor = {
      id: newId.trim().toUpperCase(),
      name: newName.trim(),
      location: newLocation.trim(),
      status: newStatus,
      micArrayCount: newMicCount,
      bearingDeg: newBearing,
      gainSensitivity: newGain,
      signalQuality: Math.min(100, Math.round(75 + (newGain / 100) * 23)),
      snrDb: parseFloat((25 + (newGain / 100) * 9).toFixed(1)),
      lastUpdate: 'Added just now',
      windFilter: true,
      azimuthCoverage: '360° Omnidirectional'
    };

    setSensors(prev => [created, ...prev]);
    setSelectedSensorId(created.id);
    setShowAddModal(false);
    setNewId('');
    setNewName('');
    setNewLocation('');
    setNewGain(85);
    setNewBearing(45);
  };

  const filteredSensors = sensors.filter(s => {
    if (statusFilter === 'ALL') return true;
    return s.status === statusFilter;
  });

  const activeCount = sensors.filter(s => s.status === 'Active').length;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header & Global Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
            Acoustic Sensor Arrays
          </h2>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-semibold">
            {activeCount} / {sensors.length} Active Online
          </span>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Recalibrate All */}
          <button
            type="button"
            onClick={handleRecalibrateAll}
            disabled={isCalibratingAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-semibold transition-all ${
              isCalibratingAll
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 hover:text-white'
            }`}
            title="Recalibrate acoustic phase sync on all arrays"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCalibratingAll ? 'animate-spin text-amber-400' : 'text-cyan-400'}`} />
            <span>{isCalibratingAll ? 'Recalibrating All...' : 'Recalibrate All'}</span>
          </button>

          {/* Add Sensor Array Button */}
          <button
            type="button"
            onClick={() => {
              setNewId(`SENSOR-ARRAY-${String(sensors.length + 1).padStart(2, '0')}`);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Array</span>
          </button>

          {/* Reset Defaults */}
          <button
            type="button"
            onClick={handleResetDefaults}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
            title="Reset to factory defaults"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Acoustic Perimeter Defense Map & Telemetry Dashboard */}
      <div className="glass-panel p-5 rounded-2xl border border-purple-500/30 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Visualizer (5 Cols): Dual-Mode Tactical Defense Map OR Polar Radar */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col items-center justify-center py-2 relative space-y-2">
          
          {/* Visualizer Mode Switcher */}
          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSensorMapMode('tactical')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  sensorMapMode === 'tactical'
                    ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                <span>Tactical Map</span>
              </button>
              <button
                type="button"
                onClick={() => setSensorMapMode('radar')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  sensorMapMode === 'radar'
                    ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Polar Radar</span>
              </button>
            </div>

            {sensorMapMode === 'tactical' && (
              <button
                type="button"
                onClick={() => setShowCoverageBeams(!showCoverageBeams)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
                  showCoverageBeams
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-500'
                }`}
              >
                Beams: {showCoverageBeams ? 'ON' : 'OFF'}
              </button>
            )}
          </div>

          {sensorMapMode === 'tactical' ? (
            /* --- TACTICAL FACILITY DEFENSE MAP SVG --- */
            <div className="relative w-full h-[290px] rounded-2xl border border-purple-500/40 bg-[#040816] overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] select-none flex items-center justify-center">
              <svg viewBox="0 0 480 300" className="w-full h-full">
                <defs>
                  <radialGradient id="sensorBeamGrad" cx="0%" cy="50%" r="100%">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.5" />
                    <stop offset="60%" stopColor="#7c3aed" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#6d28d9" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="selectedBeamGrad" cx="0%" cy="50%" r="100%">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.75" />
                    <stop offset="60%" stopColor="#0891b2" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0e7490" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Tactical grid background */}
                <rect width="480" height="300" fill="#040816" />
                <circle cx="240" cy="150" r="210" fill="none" stroke="rgba(168, 85, 247, 0.1)" strokeWidth="1" strokeDasharray="4 4" />
                <circle cx="240" cy="150" r="140" fill="none" stroke="rgba(168, 85, 247, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx="240" cy="150" r="80" fill="none" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="1" strokeDasharray="2 2" />

                {/* Facility Perimeter Hexagon Fence */}
                <polygon
                  points="130,55 350,55 420,150 350,245 130,245 60,150"
                  fill="#07112b"
                  stroke="#a855f7"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                />

                {/* Cardinal direction labels */}
                <text x="240" y="40" fill="#c084fc" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">SECTOR ALPHA (0° NORTH)</text>
                <text x="430" y="140" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">BRAVO (90°)</text>
                <text x="240" y="268" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">CHARLIE (180°)</text>
                <text x="50" y="140" fill="#94a3b8" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">DELTA (270°)</text>

                {/* Central Base Operations Hub */}
                <rect x="218" y="135" width="44" height="30" rx="4" fill="#0f1f3d" stroke="#a855f7" strokeWidth="1.2" />
                <circle cx="240" cy="150" r="5" fill="#a855f7" />
                <text x="240" y="174" fill="#d8b4fe" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">BASE HUB</text>

                {/* All Perimeter Sensor Arrays with Directional Listening Cones */}
                {sensors.map((sensor, idx) => {
                  const bearing = sensor.bearingDeg ?? Math.round((idx * 360) / Math.max(1, sensors.length));
                  const rad = ((bearing - 90) * Math.PI) / 180;
                  const sx = 240 + 160 * Math.cos(rad);
                  const sy = 150 + 85 * Math.sin(rad);

                  const isSelected = selectedSensorId === sensor.id;
                  const isActive = sensor.status === 'Active';
                  const isCalibrating = sensor.status === 'Calibrating';

                  // Directional listening cone
                  const beamR = isSelected ? 80 : 65;
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
                      onClick={() => {
                        setSelectedSensorId(sensor.id);
                        document.getElementById(`sensor-card-${sensor.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      onMouseEnter={() => setHoveredSensorId(sensor.id)}
                      onMouseLeave={() => setHoveredSensorId(null)}
                      className="cursor-pointer group"
                    >
                      {/* Directional Acoustic Listening Cone */}
                      {showCoverageBeams && (
                        <path
                          d={beamPath}
                          fill={isSelected ? "url(#selectedBeamGrad)" : "url(#sensorBeamGrad)"}
                          stroke={isSelected ? "#22d3ee" : "rgba(168, 85, 247, 0.5)"}
                          strokeWidth={isSelected ? "1.5" : "0.8"}
                          opacity={isSelected ? 0.9 : 0.45}
                        />
                      )}

                      {/* Sensor Station Post Node */}
                      <circle
                        cx={sx}
                        cy={sy}
                        r={isSelected || hoveredSensorId === sensor.id ? 14 : 11}
                        fill={isSelected ? "#0891b2" : isActive ? "#2e1065" : "#1e293b"}
                        stroke={isSelected || hoveredSensorId === sensor.id ? "#ffffff" : isActive ? "#c084fc" : "#64748b"}
                        strokeWidth={isSelected || hoveredSensorId === sensor.id ? "2.5" : "1.8"}
                        className="transition-all duration-200"
                      />
                      {isCalibrating && (
                        <circle cx={sx} cy={sy} r="16" fill="none" stroke="#c084fc" strokeWidth="1.5" strokeDasharray="3 3" className="animate-spin" />
                      )}

                      <text
                        x={sx}
                        y={sy + 3.5}
                        fill="#ffffff"
                        fontSize="8.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        S{idx + 1}
                      </text>

                      {/* Bearing Badge */}
                      <rect
                        x={sx - 13}
                        y={sy > 150 ? sy + 13 : sy - 21}
                        width="26"
                        height="10"
                        rx="2.5"
                        fill={isSelected ? "#06b6d4" : "#020617"}
                        stroke={isSelected ? "#ffffff" : "#334155"}
                        strokeWidth="0.8"
                      />
                      <text
                        x={sx}
                        y={sy > 150 ? sy + 20.5 : sy - 13.5}
                        fill={isSelected ? "#000000" : "#cbd5e1"}
                        fontSize="6.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {bearing}°
                      </text>

                      {/* Interactive Sensor SVG Hover Card */}
                      {(hoveredSensorId === sensor.id || isSelected) && (
                        <g transform={`translate(${sx > 320 ? sx - 155 : sx < 140 ? sx + 15 : sx - 75}, ${sy > 170 ? sy - 58 : sy + 15})`} className="pointer-events-none z-50">
                          <rect
                            width="150"
                            height="52"
                            rx="6"
                            fill="rgba(2, 6, 23, 0.95)"
                            stroke={isSelected ? "#22d3ee" : isActive ? "#c084fc" : "#64748b"}
                            strokeWidth="1.5"
                            className="shadow-2xl"
                          />
                          <text x="8" y="14" fill="#ffffff" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
                            {sensor.name || `Sensor Array S${idx + 1}`}
                          </text>
                          <text x="8" y="26" fill="#c084fc" fontSize="7.5" fontFamily="monospace">
                            ID: {sensor.id} | Bearing: {bearing}°
                          </text>
                          <text x="8" y="37" fill="#94a3b8" fontSize="7" fontFamily="monospace">
                            Freq: {sensor.frequencyRange || '100Hz - 8kHz'}
                          </text>
                          <text x="8" y="47" fill={isActive ? "#34d399" : "#f59e0b"} fontSize="7" fontWeight="bold" fontFamily="monospace">
                            Status: {sensor.status.toUpperCase()} (-54dB SNR)
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            /* --- 360° POLAR RADAR HUD --- */
            <div className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full border-2 border-purple-500/50 flex items-center justify-center shadow-[0_0_35px_rgba(168,85,247,0.25)] bg-[#030713] select-none">
              {/* Concentric distance rings */}
              <div className="absolute w-[84%] h-[84%] rounded-full border border-purple-500/25 pointer-events-none"></div>
              <div className="absolute w-[58%] h-[58%] rounded-full border border-purple-500/20 pointer-events-none"></div>
              <div className="absolute w-[30%] h-[30%] rounded-full border border-purple-500/30 pointer-events-none"></div>

              {/* Crosshairs & 45-deg angle lines */}
              <div className="absolute w-full h-[1px] bg-purple-500/20 pointer-events-none"></div>
              <div className="absolute h-full w-[1px] bg-purple-500/20 pointer-events-none"></div>
              <div className="absolute w-full h-[1px] bg-purple-500/10 rotate-45 pointer-events-none"></div>
              <div className="absolute w-full h-[1px] bg-purple-500/10 -rotate-45 pointer-events-none"></div>

              {/* Cardinal Directions */}
              <span className="absolute top-2 text-[10px] font-mono font-bold text-purple-300 pointer-events-none">N (0°)</span>
              <span className="absolute bottom-2 text-[10px] font-mono font-bold text-slate-500 pointer-events-none">S (180°)</span>
              <span className="absolute right-2 text-[10px] font-mono font-bold text-slate-500 pointer-events-none">E (90°)</span>
              <span className="absolute left-2 text-[10px] font-mono font-bold text-slate-500 pointer-events-none">W (270°)</span>

              {/* Rotating Radar Sweep Beam */}
              <div
                className="absolute w-1/2 h-1/2 top-0 left-1/2 origin-bottom-left transition-transform ease-linear pointer-events-none"
                style={{
                  transform: `rotate(${sweepAngle}deg)`,
                  background: 'conic-gradient(from 270deg at 0% 100%, rgba(168, 85, 247, 0.45) 0deg, rgba(168, 85, 247, 0) 55deg)',
                }}
              />

              {/* Center Base Hub */}
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-[0_0_20px_rgba(168,85,247,0.9)] z-10 border border-white/50">
                <Radio className="w-4 h-4" />
              </div>

              {/* Perimeter Sensor Array Nodes */}
              {sensors.map((sensor, idx) => {
                const bearing = sensor.bearingDeg ?? Math.round((idx * 360) / Math.max(1, sensors.length));
                const rad = ((bearing - 90) * Math.PI) / 180;
                const x = 50 + 39.5 * Math.cos(rad);
                const y = 50 + 39.5 * Math.sin(rad);

                const isActive = sensor.status === 'Active';
                const isCalibrating = sensor.status === 'Calibrating';
                const isSelected = selectedSensorId === sensor.id;
                const isHovered = hoveredSensorId === sensor.id;

                return (
                  <div
                    key={sensor.id}
                    onClick={() => {
                      setSelectedSensorId(sensor.id);
                      document.getElementById(`sensor-card-${sensor.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    onMouseEnter={() => setHoveredSensorId(sensor.id)}
                    onMouseLeave={() => setHoveredSensorId(null)}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer p-1 group"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    {isCalibrating && (
                      <div className="absolute -inset-2 rounded-full bg-amber-400/40 animate-ping pointer-events-none"></div>
                    )}

                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all shadow-lg ${
                        isSelected
                          ? 'ring-4 ring-cyan-300 border-white bg-cyan-600 text-white shadow-[0_0_20px_rgba(34,211,238,0.9)]'
                          : isHovered
                          ? 'bg-purple-900/90 border-white text-purple-200 ring-2 ring-purple-400 shadow-[0_0_18px_rgba(168,85,247,0.8)]'
                          : isActive
                          ? 'bg-purple-900/90 border-purple-400 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.7)]'
                          : isCalibrating
                          ? 'bg-amber-950/90 border-amber-400 text-amber-300 animate-pulse'
                          : 'bg-slate-900 border-slate-700 text-slate-500'
                      }`}
                    >
                      <span className="text-[10px] font-mono font-bold">S{idx + 1}</span>
                    </div>

                    {/* Bearing Tag */}
                    <span className={`absolute ${y > 75 ? '-top-4' : '-bottom-4'} left-1/2 -translate-x-1/2 text-[8px] font-mono font-bold px-1.5 py-0.2 rounded whitespace-nowrap border pointer-events-none ${
                      isSelected ? 'bg-cyan-500 text-black border-white' : 'bg-slate-950/90 text-slate-200 border-slate-800'
                    }`}>
                      {bearing}°
                    </span>

                    {/* Interactive Sensor Hover Card (Polar Mode) */}
                    {isHovered && (
                      <div
                        className={`absolute z-50 glass-panel p-2.5 rounded-xl border border-purple-500/80 bg-slate-950/95 text-white text-xs font-mono shadow-2xl whitespace-nowrap pointer-events-none transition-all shadow-[0_0_25px_rgba(168,85,247,0.3)] ${
                          y > 55 ? 'bottom-8' : 'top-8'
                        } ${
                          x > 55 ? 'right-0' : 'left-0'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1 mb-1">
                          <span className="font-bold text-purple-300">
                            {sensor.name || `Sensor Array S${idx + 1}`}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-bold">
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
                            <span className="text-slate-400">Frequency Band:</span>
                            <span className="text-white">{sensor.frequencyRange || '100Hz - 8kHz'}</span>
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

        {/* Right: Perimeter Telemetry & Active Sensor Details (7 Cols) */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  360° Airspace Acoustic Perimeter Radar
                </h3>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Real-time triangulation mesh mapping all {sensors.length} deployed microphone arrays
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewId(`SENSOR-ARRAY-${String(sensors.length + 1).padStart(2, '0')}`);
                setShowAddModal(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Deploy Array</span>
            </button>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">DEPLOYED</span>
              <span className="text-white font-bold text-sm">{sensors.length} Arrays</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">PERIMETER COVERAGE</span>
              <span className="text-emerald-400 font-bold text-sm">360° Seamless</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">AVG SNR LEVEL</span>
              <span className="text-cyan-300 font-bold text-sm">
                {(sensors.reduce((acc, s) => acc + s.snrDb, 0) / Math.max(1, sensors.length)).toFixed(1)} dB
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-500 text-[10px] block">MEMS TOTAL</span>
              <span className="text-purple-300 font-bold text-sm">
                {sensors.reduce((acc, s) => acc + s.micArrayCount, 0)} Capsules
              </span>
            </div>
          </div>

          {/* Selected or Default Sensor Preview Bar */}
          {(() => {
            const activePreview = sensors.find(s => s.id === selectedSensorId) || sensors[0];
            if (!activePreview) return null;
            return (
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center font-bold">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{activePreview.name}</span>
                      <span className="text-cyan-400 font-bold">({activePreview.bearingDeg ?? 0}°)</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">{activePreview.location}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingSensor(activePreview)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3 text-cyan-400" />
                    <span>Reposition Angle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecalibrateSensor(activePreview.id)}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3 text-purple-400" />
                    <span>Calibrate</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-mono w-fit">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'ALL' ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40' : 'text-slate-400 hover:text-white'}`}
        >
          All Arrays ({sensors.length})
        </button>
        <button
          onClick={() => setStatusFilter('Active')}
          className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'Active' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40' : 'text-slate-400 hover:text-white'}`}
        >
          Active ({sensors.filter(s => s.status === 'Active').length})
        </button>
        <button
          onClick={() => setStatusFilter('Calibrating')}
          className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'Calibrating' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-slate-400 hover:text-white'}`}
        >
          Calibrating ({sensors.filter(s => s.status === 'Calibrating').length})
        </button>
        <button
          onClick={() => setStatusFilter('Standby')}
          className={`px-3 py-1 rounded-lg transition-all ${statusFilter === 'Standby' ? 'bg-slate-700 text-slate-200 font-bold' : 'text-slate-400 hover:text-white'}`}
        >
          Standby ({sensors.filter(s => s.status === 'Standby').length})
        </button>
      </div>

      {/* Grid of Interactive Sensors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredSensors.map((sensor) => {
          const isCalibrating = calibratingIds.includes(sensor.id) || sensor.status === 'Calibrating';
          const gainVal = sensor.gainSensitivity ?? 85;
          const bearing = sensor.bearingDeg ?? 0;
          const isSelected = selectedSensorId === sensor.id;

          return (
            <div 
              key={sensor.id}
              id={`sensor-card-${sensor.id}`}
              className={`glass-panel p-5 rounded-2xl border transition-all space-y-4 ${
                isSelected
                  ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                  : sensor.status === 'Active'
                  ? 'border-slate-800 hover:border-cyan-500/40'
                  : sensor.status === 'Calibrating'
                  ? 'border-amber-500/40 bg-amber-950/10'
                  : 'border-slate-800/80 bg-slate-900/40 opacity-75'
              }`}
            >
              
              {/* Card Header: Array Info, Radar Position & Status Selector */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Radio className={`w-5 h-5 ${sensor.status === 'Active' ? 'text-purple-400' : 'text-slate-500'}`} />
                    <span className="font-mono text-xs font-bold text-cyan-400">{sensor.id}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                      <Compass className="w-3 h-3 text-purple-400" />
                      <span>Radar: {bearing}°</span>
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white font-heading">{sensor.name}</h3>
                  <p className="text-xs text-slate-400">{sensor.location}</p>
                </div>

                {/* Status Dropdown Pill */}
                <div className="flex items-center gap-2">
                  <select
                    value={sensor.status}
                    onChange={(e) => handleStatusChange(sensor.id, e.target.value as 'Active' | 'Calibrating' | 'Standby')}
                    className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold border outline-none cursor-pointer transition-all ${
                      sensor.status === 'Active'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                        : sensor.status === 'Calibrating'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <option value="Active">● Active</option>
                    <option value="Calibrating">● Calibrating</option>
                    <option value="Standby">● Standby</option>
                  </select>
                </div>
              </div>

              {/* Real-time Telemetry Metrics */}
              <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">SIGNAL QUALITY</span>
                  <span className="text-emerald-400 font-bold text-sm">{sensor.signalQuality}%</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">SNR LEVEL</span>
                  <span className="text-cyan-300 font-bold text-sm">{sensor.snrDb} dB</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">MIC CAPSULES</span>
                  <span className="text-white font-bold text-sm">{sensor.micArrayCount} MEMS</span>
                </div>
              </div>

              {/* Interactive Gain / Sensitivity Slider */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                    Acoustic Sensitivity & Gain:
                  </span>
                  <span className="text-cyan-300 font-bold">{gainVal}% (+{((gainVal / 100) * 18).toFixed(1)} dB)</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={1}
                  value={gainVal}
                  onChange={(e) => handleGainChange(sensor.id, parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Settings, Recalibrate & Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                
                {/* Wind Noise Filter Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleWindFilter(sensor.id)}
                  className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                    sensor.windFilter
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 font-semibold'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700'
                  }`}
                  title="Toggle wind noise buffeting filter"
                >
                  <Wind className="w-3.5 h-3.5" />
                  <span>Wind Filter: {sensor.windFilter ? 'ON' : 'OFF'}</span>
                </button>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-1.5 ml-auto">
                  {/* Recalibrate Array */}
                  <button
                    type="button"
                    onClick={() => handleRecalibrateSensor(sensor.id)}
                    disabled={isCalibrating}
                    className={`px-2.5 py-1 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
                      isCalibrating
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                    title="Recalibrate microphone phase offsets"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
                    <span>{isCalibrating ? 'Calibrating...' : 'Recalibrate'}</span>
                  </button>

                  {/* Edit Sensor */}
                  <button
                    type="button"
                    onClick={() => setEditingSensor({ ...sensor })}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-white"
                    title="Configure sensor properties & radar position"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Sensor */}
                  <button
                    type="button"
                    onClick={() => handleDeleteSensor(sensor.id)}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
                    title="Decommission sensor array"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

              {/* Status footer line */}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
                  Phase Sync: {sensor.status === 'Active' ? `Locked on ${bearing}° Azimuth` : 'Calibrating Offset'}
                </span>
                <span>{sensor.lastUpdate}</span>
              </div>

            </div>
          );
        })}
      </div>

      {/* MODAL 1: EDIT SENSOR ARRAY (With Radar Bearing Positioning) */}
      {editingSensor && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/40 max-w-md w-full space-y-4 relative bg-[#071126]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Configure Sensor Array: {editingSensor.id}
                </h3>
              </div>
              <button
                onClick={() => setEditingSensor(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Array Name:</label>
                <input
                  type="text"
                  value={editingSensor.name}
                  onChange={(e) => setEditingSensor({ ...editingSensor, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-cyan-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Perimeter Location / Sector:</label>
                <input
                  type="text"
                  value={editingSensor.location}
                  onChange={(e) => setEditingSensor({ ...editingSensor, location: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-cyan-400 outline-none"
                  required
                />
              </div>

              {/* Radar Perimeter Bearing (0° - 360°) */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    Radar Perimeter Bearing:
                  </label>
                  <span className="text-cyan-300 font-bold text-sm">
                    {editingSensor.bearingDeg ?? 0}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={editingSensor.bearingDeg ?? 0}
                  onChange={(e) => setEditingSensor({ ...editingSensor, bearingDeg: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => setEditingSensor({ ...editingSensor, bearingDeg: deg })}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        (editingSensor.bearingDeg ?? 0) === deg
                          ? 'bg-cyan-500 text-black font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {deg === 0 ? 'N (0°)' : deg === 90 ? 'E (90°)' : deg === 180 ? 'S (180°)' : deg === 270 ? 'W (270°)' : `${deg}°`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">MEMS Capsules:</label>
                  <select
                    value={editingSensor.micArrayCount}
                    onChange={(e) => setEditingSensor({ ...editingSensor, micArrayCount: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-cyan-400 outline-none"
                  >
                    <option value={4}>4 Microphones</option>
                    <option value={8}>8 Microphones (Standard)</option>
                    <option value={16}>16 Microphones (High Precision)</option>
                    <option value={32}>32 Microphones (Long Range)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Operational State:</label>
                  <select
                    value={editingSensor.status}
                    onChange={(e) => setEditingSensor({ ...editingSensor, status: e.target.value as 'Active' | 'Calibrating' | 'Standby' })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-cyan-400 outline-none"
                  >
                    <option value="Active">Active Online</option>
                    <option value="Calibrating">Calibrating</option>
                    <option value="Standby">Standby Passive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Sensitivity Gain: {editingSensor.gainSensitivity ?? 85}%
                </label>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={editingSensor.gainSensitivity ?? 85}
                  onChange={(e) => setEditingSensor({ ...editingSensor, gainSensitivity: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSensor(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-[0_0_15px_rgba(34,211,238,0.3)] flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW SENSOR ARRAY (With Radar Bearing Positioning) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 rounded-2xl border border-purple-500/40 max-w-md w-full space-y-4 relative bg-[#071126]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Deploy New Acoustic Sensor Array
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs font-mono">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSensor} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Array ID (Unique):</label>
                <input
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="e.g. SENSOR-ARRAY-SOUTH-05"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Array Friendly Name:</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Perimeter Array Epsilon"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Physical Sector / Location:</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Sector E3 - Southeast Storage Facility"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-400 outline-none"
                  required
                />
              </div>

              {/* Radar Perimeter Bearing (0° - 360°) */}
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-purple-400" />
                    Radar Perimeter Bearing Angle:
                  </label>
                  <span className="text-purple-300 font-bold text-sm">
                    {newBearing}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={newBearing}
                  onChange={(e) => setNewBearing(parseInt(e.target.value, 10))}
                  className="w-full accent-purple-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => setNewBearing(deg)}
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        newBearing === deg
                          ? 'bg-purple-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {deg === 0 ? 'N (0°)' : deg === 90 ? 'E (90°)' : deg === 180 ? 'S (180°)' : deg === 270 ? 'W (270°)' : `${deg}°`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">MEMS Capsules:</label>
                  <select
                    value={newMicCount}
                    onChange={(e) => setNewMicCount(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-400 outline-none"
                  >
                    <option value={4}>4 Microphones</option>
                    <option value={8}>8 Microphones</option>
                    <option value={16}>16 Microphones</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Initial Status:</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as 'Active' | 'Calibrating' | 'Standby')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white focus:border-purple-400 outline-none"
                  >
                    <option value="Active">Active Online</option>
                    <option value="Calibrating">Calibrating</option>
                    <option value="Standby">Standby</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Deploy Array & Map to Radar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
