import React, { useState, useEffect } from 'react';
import { Crosshair, Navigation, Volume2, Video } from 'lucide-react';
import { DetectionEvent } from '../types';

interface RadarCompassProps {
  events: DetectionEvent[];
  isSimulating: boolean;
}

export const RadarCompass: React.FC<RadarCompassProps> = ({ events, isSimulating }) => {
  const [sweepAngle, setSweepAngle] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSweepAngle(prev => (prev + 3) % 360);
    }, 40);
    return () => clearInterval(interval);
  }, []);

  const activeTarget = events.find(e => e.status === 'LOCKED' || e.status === 'TRACKING');

  return (
    <div className="glass-panel p-5 rounded-2xl relative overflow-hidden border border-cyan-500/30">
      
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
            <div className="absolute w-[80%] h-[80%] rounded-full border border-cyan-500/20 flex items-center justify-center">
              <span className="absolute top-1 text-[9px] font-mono text-cyan-500/60">300m</span>
            </div>
            <div className="absolute w-[55%] h-[55%] rounded-full border border-cyan-500/20 flex items-center justify-center">
              <span className="absolute top-1 text-[9px] font-mono text-cyan-500/60">150m</span>
            </div>
            <div className="absolute w-[30%] h-[30%] rounded-full border border-cyan-500/30 flex items-center justify-center">
              <span className="absolute top-1 text-[9px] font-mono text-cyan-500/70">75m</span>
            </div>

            {/* Crosshairs */}
            <div className="absolute w-full h-[1px] bg-cyan-500/25"></div>
            <div className="absolute h-full w-[1px] bg-cyan-500/25"></div>

            {/* Compass Cardinal Directions */}
            <span className="absolute top-2 text-xs font-mono font-bold text-cyan-400">N (0°)</span>
            <span className="absolute bottom-2 text-xs font-mono font-bold text-slate-400">S (180°)</span>
            <span className="absolute right-2 text-xs font-mono font-bold text-slate-400">E (90°)</span>
            <span className="absolute left-2 text-xs font-mono font-bold text-slate-400">W (270°)</span>

            {/* Rotating Radar Sweep Beam */}
            <div
              className="absolute w-1/2 h-1/2 top-0 left-1/2 origin-bottom-left transition-transform ease-linear"
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

              const isDroneTarget = evt.targetType.includes('Drone') || evt.targetType.includes('Quadcopter');

              return (
                <div
                  key={evt.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer group"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  {/* Pulsing ring animation for drone detections */}
                  {isDroneTarget && (
                    <div className="absolute -inset-3 rounded-full bg-red-500/40 animate-ping"></div>
                  )}

                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center border-2 transition-transform group-hover:scale-125 ${
                      isDroneTarget
                        ? 'bg-red-500 border-white text-white shadow-[0_0_12px_rgba(239,68,68,0.9)]'
                        : 'bg-emerald-500 border-white text-black'
                    }`}
                  >
                    <span className="text-[8px] font-mono font-bold">●</span>
                  </div>

                  {/* Target Tooltip */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-0.5 glass-panel p-2 rounded text-[10px] font-mono text-white whitespace-nowrap z-30 border border-cyan-400">
                    <span className="font-bold text-cyan-300">{evt.targetType}</span>
                    <span>Bearing: {evt.bearingDeg}°</span>
                    <span>Est. Distance: {evt.distanceMeters}m</span>
                    <span>Confidence: {evt.confidencePct}%</span>
                  </div>
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
