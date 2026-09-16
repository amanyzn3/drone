import React, { useState, useEffect } from 'react';
import { Crosshair, Navigation, Volume2, Video } from 'lucide-react';
import { DetectionEvent } from '../types';

interface RadarCompassProps {
  events: DetectionEvent[];
  isSimulating: boolean;
}

export const RadarCompass: React.FC<RadarCompassProps> = ({ events, isSimulating }) => {
  const [sweepAngle, setSweepAngle] = useState(0);
  const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSweepAngle(prev => (prev + 3) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  const activeTarget = events.find(e => e.status === 'LOCKED' || e.status === 'TRACKING');

  const getCompassDir = (deg: number): string => {
    const norm = (deg % 360 + 360) % 360;
    if (norm >= 337.5 || norm < 22.5) return 'N';
    if (norm >= 22.5 && norm < 67.5) return 'NE';
    if (norm >= 67.5 && norm < 112.5) return 'E';
    if (norm >= 112.5 && norm < 157.5) return 'SE';
    if (norm >= 157.5 && norm < 202.5) return 'S';
    if (norm >= 202.5 && norm < 247.5) return 'SW';
    if (norm >= 247.5 && norm < 292.5) return 'W';
    return 'NW';
  };

  return (
    <div className="glass-panel p-5 rounded-2xl relative border border-cyan-500/30">
      
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white font-heading tracking-wide flex items-center gap-2">
              <Crosshair className="w-5 h-5 text-cyan-400" />
              Acoustic Array Compass & Bearing Tracking
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            360° passive acoustic microphone array triangulating propeller motor signatures
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">ARRAY:</span>
          <span className="text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
            NORTH-QUAD-01
          </span>
        </div>
      </div>

      {/* Main Radar Compass View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Radial Canvas Radar Area */}
        <div className="lg:col-span-7 flex justify-center py-4 relative">
          <div className="relative w-[300px] h-[300px] sm:w-[340px] sm:h-[340px] rounded-full radar-grid border-2 border-cyan-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.15)] bg-[#040916]">
            
            {/* Concentric distance rings */}
            <div className="absolute w-[80%] h-[80%] rounded-full border border-cyan-500/20 flex items-center justify-center pointer-events-none">
              <span className="absolute top-1 text-[9px] font-mono text-cyan-500/60">300m</span>
            </div>
            <div className="absolute w-[55%] h-[55%] rounded-full border border-cyan-500/20 flex items-center justify-center pointer-events-none">
              <span className="absolute top-1 text-[9px] font-mono text-cyan-500/60">150m</span>
            </div>
            <div className="absolute w-[30%] h-[30%] rounded-full border border-cyan-500/30 flex items-center justify-center pointer-events-none">
              <span className="absolute top-1 text-[9px] font-mono text-cyan-500/70">75m</span>
            </div>

            {/* Crosshairs */}
            <div className="absolute w-full h-[1px] bg-cyan-500/25 pointer-events-none"></div>
            <div className="absolute h-full w-[1px] bg-cyan-500/25 pointer-events-none"></div>

            {/* Compass Cardinal Directions */}
            <span className="absolute top-2 text-xs font-mono font-bold text-cyan-400 pointer-events-none">N (0°)</span>
            <span className="absolute bottom-2 text-xs font-mono font-bold text-slate-400 pointer-events-none">S (180°)</span>
            <span className="absolute right-2 text-xs font-mono font-bold text-slate-400 pointer-events-none">E (90°)</span>
            <span className="absolute left-2 text-xs font-mono font-bold text-slate-400 pointer-events-none">W (270°)</span>

            {/* Rotating Radar Sweep Beam */}
            <div
              className="absolute w-1/2 h-1/2 top-0 left-1/2 origin-bottom-left transition-transform ease-linear pointer-events-none"
              style={{
                transform: `rotate(${sweepAngle}deg)`,
                background: 'conic-gradient(from 270deg at 0% 100%, rgba(34, 211, 238, 0.4) 0deg, rgba(34, 211, 238, 0) 60deg)',
              }}
            />

            {/* Center Acoustic Mic Array Icon */}
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-black flex items-center justify-center font-bold text-xs shadow-[0_0_15px_rgba(34,211,238,0.8)] z-10">
              <Volume2 className="w-3.5 h-3.5" />
            </div>

            {/* Target Markers for Detections */}
            {events.map((evt) => {
              // Convert bearing & distance to x, y relative percentage
              const rad = ((evt.bearingDeg - 90) * Math.PI) / 180;
              const maxDist = 450;
              const radiusPct = Math.min(42, (evt.distanceMeters / maxDist) * 42);
              const x = 50 + radiusPct * Math.cos(rad);
              const y = 50 + radiusPct * Math.sin(rad);

              const isDroneTarget = evt.targetType.includes('Drone') || evt.targetType.includes('Quadcopter') || evt.targetType.includes('FPV');
              const isHovered = hoveredTargetId === evt.id;

              return (
                <div
                  key={evt.id}
                  onMouseEnter={() => setHoveredTargetId(evt.id)}
                  onMouseLeave={() => setHoveredTargetId(null)}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer p-2 group"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  {/* Pulsing ring animation for drone detections */}
                  {isDroneTarget && (
                    <div className="absolute inset-0 rounded-full bg-red-500/40 animate-ping pointer-events-none"></div>
                  )}

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isHovered ? 'ring-4 ring-white shadow-[0_0_20px_rgba(239,68,68,1)] z-40' : ''
                    } ${
                      isDroneTarget
                        ? 'bg-red-500 border-white text-white shadow-[0_0_15px_rgba(239,68,68,1)]'
                        : 'bg-emerald-500 border-white text-black shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                    }`}
                  >
                    <span className="text-[9px] font-mono font-bold">●</span>
                  </div>

                  {/* Rich Target Hover Card */}
                  {isHovered && (
                    <div
                      className={`absolute z-50 glass-panel p-3 rounded-xl border text-xs font-mono shadow-2xl whitespace-nowrap pointer-events-none transition-all ${
                        isDroneTarget 
                          ? 'border-red-500/80 bg-slate-950/95 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)]' 
                          : 'border-emerald-500/80 bg-slate-950/95 text-white shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                      } ${
                        y > 55 ? 'bottom-8' : 'top-8'
                      } ${
                        x > 55 ? 'right-0' : 'left-0'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5 mb-1.5">
                        <span className={`font-bold text-sm ${isDroneTarget ? 'text-red-400' : 'text-emerald-400'}`}>
                          {evt.targetType}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isDroneTarget ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {evt.status}
                        </span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Target ID:</span>
                          <span className="font-bold text-white">{evt.id}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Bearing:</span>
                          <span className="font-bold text-cyan-300">{evt.bearingDeg}° ({getCompassDir(evt.bearingDeg)})</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Distance:</span>
                          <span className="font-bold text-white">{evt.distanceMeters} meters</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Confidence:</span>
                          <span className="font-bold text-emerald-400">{evt.confidencePct}% Match</span>
                        </div>
                        <div className="flex justify-between gap-4 pt-0.5 border-t border-slate-800/80">
                          <span className="text-slate-400">Acoustic Signature:</span>
                          <span className="text-amber-300 font-bold">185 Hz Blade Pass</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Target Telemetry Panel */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-slate-400">TARGET ACQUISITION:</span>
              <span className={`px-2 py-0.5 rounded font-bold ${activeTarget ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                {activeTarget ? 'TARGET LOCKED' : 'SEARCHING AIRSPACE'}
              </span>
            </div>

            {activeTarget ? (
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Target Type:</span>
                  <span className="text-red-400 font-bold">{activeTarget.targetType}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Bearing Angle:</span>
                  <span className="text-cyan-300 font-bold">{activeTarget.bearingDeg}° (East-Northeast)</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Distance Estimate:</span>
                  <span className="text-white font-bold">{activeTarget.distanceMeters} meters</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Confidence Score:</span>
                  <span className="text-emerald-400 font-bold">{activeTarget.confidencePct}%</span>
                </div>
                <div className="flex justify-between pt-1 text-emerald-400 font-semibold items-center">
                  <span className="flex items-center gap-1">
                    <Video className="w-3.5 h-3.5 text-cyan-400 animate-spin" /> Auto-PTZ Camera:
                  </span>
                  <span>Slewed to {activeTarget.bearingDeg}°</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center italic">
                No active drone targets currently locked. Acoustic sensors scanning 360° horizon...
              </p>
            )}
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-[11px] text-cyan-300/90 font-mono flex items-center gap-2">
            <Navigation className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Passively measuring acoustic phase offsets across 8 MEMS microphones to calculate exact azimuth angle.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
