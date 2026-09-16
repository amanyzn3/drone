import React from 'react';
import { Shield, Radar, FlaskConical, Bell, Radio, Zap } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  newAlertsCount: number;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, newAlertsCount }) => {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-cyan-500/20 bg-[#060c1d]/90 backdrop-blur-md">
      {/* Top Banner / System Status bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950/60 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-heading">
                SkyGuard <span className="text-cyan-400 font-mono text-sm font-semibold">Acoustic</span>
              </h1>
            </div>
          </div>

          {/* System Status Indicator & CTA */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium tracking-wide">System Active</span>
            </div>

            {/* Test Sound Button */}
            <button
              onClick={() => setActiveTab('testing')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs sm:text-sm transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)]"
            >
              <FlaskConical className="w-3.5 h-3.5 fill-black/20" />
              <span>Test Sound</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto pt-1 pb-2 border-t border-slate-800/80">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.15)] font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Radar className="w-4 h-4 text-cyan-400" />
            <span>Executive Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('testing')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap relative ${
              activeTab === 'testing'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.15)] font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            <span>Acoustic Training Lab</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap relative ${
              activeTab === 'alerts'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.15)] font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Security Alerts</span>
            {newAlertsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold font-mono bg-red-500 text-white animate-pulse">
                {newAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sensors')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === 'sensors'
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shadow-[0_0_12px_rgba(34,211,238,0.15)] font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Radio className="w-4 h-4 text-purple-400" />
            <span>Acoustic Sensors</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
