import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const PrivacyFooter: React.FC = () => {
  return (
    <footer className="mt-12 py-6 border-t border-slate-800/80 text-xs font-mono text-slate-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-500/80" />
          <span>SkyGuard Acoustic Airspace Surveillance</span>
        </div>
        <div className="text-slate-600 text-[11px]">
          Multi-Sensor Acoustic Bearing & Detection System
        </div>
      </div>
    </footer>
  );
};

