import React, { useState } from 'react';
import { 
  Bell, CheckCircle2, ShieldAlert, AlertTriangle, Eye, X, Filter
} from 'lucide-react';
import { SecurityAlert, AlertStatus } from '../types';

interface SecurityAlertsPageProps {
  alerts: SecurityAlert[];
  onUpdateAlertStatus: (alertId: string, newStatus: AlertStatus) => void;
}

export const SecurityAlertsPage: React.FC<SecurityAlertsPageProps> = ({
  alerts,
  onUpdateAlertStatus
}) => {
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | AlertStatus>('ALL');

  const filteredAlerts = alerts.filter(a => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Page Header */}
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
          Security Alerts
        </h2>
        <span className="font-mono text-xs text-slate-400">
          {alerts.length} Records
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 text-xs font-mono">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'ALL' ? 'bg-cyan-500/20 text-cyan-400 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            All Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setStatusFilter('New')}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'New' ? 'bg-red-500/20 text-red-400 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            New ({alerts.filter(a => a.status === 'New').length})
          </button>
          <button
            onClick={() => setStatusFilter('Acknowledged')}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'Acknowledged' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Acknowledged ({alerts.filter(a => a.status === 'Acknowledged').length})
          </button>
          <button
            onClick={() => setStatusFilter('Resolved')}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Resolved ({alerts.filter(a => a.status === 'Resolved').length})
          </button>
        </div>
      </div>

      {/* Alert Feed Cards */}
      <div className="space-y-3">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`glass-panel p-4 sm:p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                alert.status === 'New'
                  ? 'border-red-500/40 bg-red-950/10 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                  : alert.status === 'Acknowledged'
                  ? 'border-amber-500/30 bg-amber-950/10'
                  : 'border-slate-800 bg-slate-900/40'
              }`}
            >
              
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                  alert.priority === 'High' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  {alert.priority === 'High' ? <ShieldAlert className="w-6 h-6 animate-pulse" /> : <AlertTriangle className="w-6 h-6" />}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">{alert.id}</span>
                    <span className="text-xs text-slate-500">|</span>
                    <span className="font-mono text-xs text-cyan-400">{alert.timestamp}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      alert.status === 'New'
                        ? 'bg-red-500 text-white animate-pulse'
                        : alert.status === 'Acknowledged'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}>
                      STATUS: {alert.status.toUpperCase()}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white font-heading">
                    {alert.priority === 'High' ? 'Potential Drone Acoustic Signature Detected' : 'Uncertain Audio Low-Priority Review'}
                  </h3>

                  <div className="text-xs font-mono text-slate-300 flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    <span>Source: <strong className="text-cyan-300">{alert.source}</strong></span>
                    <span>File: <strong className="text-white">{alert.fileName}</strong></span>
                    <span>Confidence: <strong className="text-red-400">{alert.confidence}%</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                {alert.status === 'New' && (
                  <button
                    onClick={() => onUpdateAlertStatus(alert.id, 'Acknowledged')}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 text-xs font-mono font-bold transition-all"
                  >
                    Acknowledge
                  </button>
                )}

                {alert.status !== 'Resolved' && (
                  <button
                    onClick={() => onUpdateAlertStatus(alert.id, 'Resolved')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-mono font-bold transition-all flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Mark Resolved</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedAlert(alert)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-cyan-400 hover:bg-slate-700 border border-cyan-500/30 text-xs font-mono font-bold transition-all flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>
              </div>

            </div>
          ))
        ) : (
          <div className="glass-panel p-8 rounded-xl border border-slate-800 text-center text-slate-400 italic">
            No security alerts in this view. Alerts are generated automatically when a drone acoustic signature is detected.
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-cyan-500/40 max-w-lg w-full space-y-4 relative bg-[#09132b]">
            <button
              onClick={() => setSelectedAlert(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <Bell className="w-6 h-6 text-amber-400" />
              <div>
                <h3 className="text-lg font-bold text-white font-heading">
                  Security Alert Telemetry #{selectedAlert.id}
                </h3>
                <p className="text-xs text-slate-400 font-mono">Timestamp: {selectedAlert.timestamp}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Detection Source:</span>
                <span className="text-cyan-400 font-bold">{selectedAlert.source}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Audio Recording File:</span>
                <span className="text-white font-bold">{selectedAlert.fileName}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Acoustic Confidence:</span>
                <span className="text-red-400 font-bold">{selectedAlert.confidence}%</span>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Current Status:</span>
                <span className="text-emerald-400 font-bold">{selectedAlert.status}</span>
              </div>
              <div className="p-3 rounded bg-cyan-950/40 border border-cyan-500/30 text-cyan-200">
                <span className="font-bold text-cyan-400 block mb-1">Recommended Security Action:</span>
                {selectedAlert.action}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-black font-bold text-xs font-mono"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
