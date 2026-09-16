import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ExecutiveOverview } from './components/ExecutiveOverview';
import { ManualTestingLab } from './components/ManualTestingLab';
import { SecurityAlertsPage } from './components/SecurityAlertsPage';
import { AcousticSensorsPage } from './components/AcousticSensorsPage';
import { PrivacyFooter } from './components/PrivacyFooter';
import { 
  ExecutiveMetrics, TestHistoryEntry, SecurityAlert, DetectionEvent, AnalysisResult, AlertStatus, AcousticSensor 
} from './types';

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
    gainSensitivity: 90,
    windFilter: true,
    azimuthCoverage: '360° Omnidirectional'
  },
  {
    id: 'SENSOR-ARRAY-EAST-02',
    name: 'East Perimeter Array Beta',
    location: 'Sector B4 - Hangar Roof',
    status: 'Active',
    signalQuality: 95,
    snrDb: 31.8,
    lastUpdate: '2s ago',
    micArrayCount: 8,
    bearingDeg: 90,
    gainSensitivity: 85,
    windFilter: true,
    azimuthCoverage: '360° Omnidirectional'
  },
  {
    id: 'SENSOR-ARRAY-SOUTH-03',
    name: 'South Boundary Array Gamma',
    location: 'Sector C2 - Water Tower',
    status: 'Active',
    signalQuality: 96,
    snrDb: 33.1,
    lastUpdate: '5s ago',
    micArrayCount: 8,
    bearingDeg: 180,
    gainSensitivity: 75,
    windFilter: false,
    azimuthCoverage: '180° Directional'
  },
  {
    id: 'SENSOR-ARRAY-WEST-04',
    name: 'West Perimeter Array Delta',
    location: 'Sector D1 - West Fence',
    status: 'Active',
    signalQuality: 96,
    snrDb: 33.1,
    lastUpdate: '1s ago',
    micArrayCount: 8,
    bearingDeg: 270,
    gainSensitivity: 88,
    windFilter: true,
    azimuthCoverage: '360° Omnidirectional'
  }
];

export function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedTestingTrackId, setSelectedTestingTrackId] = useState<string>('demo-quad-hover');

  const handleNavigateToTesting = (trackId?: string) => {
    if (trackId) {
      setSelectedTestingTrackId(trackId);
    }
    setActiveTab('testing');
  };

  // Acoustic Sensor Arrays State (shared across Radar & Sensor management)
  const [sensors, setSensors] = useState<AcousticSensor[]>(() => {
    try {
      const saved = localStorage.getItem('skyguard_acoustic_sensors');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_SENSORS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('skyguard_acoustic_sensors', JSON.stringify(sensors));
    } catch {
      // ignore
    }
  }, [sensors]);

  // Executive KPI Metrics State
  const [metrics, setMetrics] = useState<ExecutiveMetrics>({
    totalTests: 0,
    droneDetections: 0,
    nonDroneSounds: 0,
    uncertainResults: 0,
    detectionsToday: 0,
    detectionsMonth: 4,
    responseTimeMs: 120,
    falsePositiveRate: 1.4,
    uptimePct: 99.94
  });

  // Detection History State
  const [history, setHistory] = useState<TestHistoryEntry[]>([]);

  // Security Alerts State
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);

  // Live Radar Events (Initial State: Clean airspace, no false alerts)
  const [recentEvents, setRecentEvents] = useState<DetectionEvent[]>([]);

  // Simulation Mode State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Simulation loop effect
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      const isDroneEvent = Math.random() > 0.4;
      const confidence = isDroneEvent ? 86 + Math.floor(Math.random() * 12) : 90 + Math.floor(Math.random() * 8);
      const bearing = Math.floor(Math.random() * 360);
      const distance = 120 + Math.floor(Math.random() * 300);
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (isDroneEvent) {
        // Update KPIs
        setMetrics(prev => ({
          ...prev,
          totalTests: prev.totalTests + 1,
          droneDetections: prev.droneDetections + 1,
          detectionsToday: prev.detectionsToday + 1,
          detectionsMonth: prev.detectionsMonth + 1
        }));

        // Add History
        const newHist: TestHistoryEntry = {
          id: `SIM-${Math.floor(1000 + Math.random() * 9000)}`,
          fileName: `live_array_stream_${bearing}deg.wav`,
          dateTime: timestamp,
          audioType: 'Live Microphone Array',
          classification: 'DRONE_DETECTED',
          confidence,
          status: 'Completed'
        };
        setHistory(prev => [newHist, ...prev]);

        // Add Security Alert
        const newAlert: SecurityAlert = {
          id: `ALT-${Math.floor(100 + Math.random() * 900)}`,
          source: 'Live Detection Simulation',
          fileName: `live_array_stream_${bearing}deg.wav`,
          confidence,
          timestamp,
          status: 'New',
          priority: 'High',
          action: `Camera slewed to bearing ${bearing}°. Verify airspace target.`,
          details: `Live array stream detected quadcopter motor harmonics at bearing ${bearing}°.`
        };
        setAlerts(prev => [newAlert, ...prev]);

        // Update Radar target
        setRecentEvents([
          {
            id: `RAD-${Date.now()}`,
            timestamp,
            bearingDeg: bearing,
            distanceMeters: distance,
            confidencePct: confidence,
            targetType: 'Quadcopter Drone (Simulated)',
            status: 'LOCKED'
          }
        ]);
      } else {
        // Non-drone simulation event
        setMetrics(prev => ({
          ...prev,
          totalTests: prev.totalTests + 1,
          nonDroneSounds: prev.nonDroneSounds + 1
        }));

        const newHist: TestHistoryEntry = {
          id: `SIM-${Math.floor(1000 + Math.random() * 9000)}`,
          fileName: `live_ambient_stream.wav`,
          dateTime: timestamp,
          audioType: 'Live Microphone Array',
          classification: 'NO_DRONE',
          confidence,
          status: 'Completed'
        };
        setHistory(prev => [newHist, ...prev]);
        setRecentEvents([]);
      }

    }, 7000); // Trigger every 7s in simulation mode

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Handler for completed manual sound tests
  const handleAnalysisCompleted = (result: AnalysisResult) => {
    // 1. Update Metrics
    setMetrics(prev => {
      const next = { ...prev, totalTests: prev.totalTests + 1 };
      if (result.classification === 'DRONE_DETECTED') {
        next.droneDetections += 1;
        next.detectionsToday += 1;
        next.detectionsMonth += 1;
      } else if (result.classification === 'NO_DRONE') {
        next.nonDroneSounds += 1;
      } else if (result.classification === 'UNCERTAIN') {
        next.uncertainResults += 1;
      }
      return next;
    });

    // 2. Add History Entry
    const newHist: TestHistoryEntry = {
      id: result.id,
      fileName: result.fileName,
      dateTime: result.timestamp,
      audioType: result.isDemoAnalysis ? 'Demo Sample' : 'Custom Upload / Mic',
      classification: result.classification,
      confidence: result.confidence,
      status: 'Completed'
    };
    setHistory(prev => [newHist, ...prev]);

    // 3. Create Alert and Radar Blip if Drone Detected or Clear on NO_DRONE
    if (result.classification === 'DRONE_DETECTED') {
      const newAlert: SecurityAlert = {
        id: `ALT-${Math.floor(100 + Math.random() * 900)}`,
        source: 'Acoustic Sound Test',
        fileName: result.fileName,
        confidence: result.confidence,
        timestamp: result.timestamp,
        status: 'New',
        priority: 'High',
        action: 'Camera slewed to acoustic bearing. Target locked.',
        details: result.explanation
      };
      setAlerts(prev => [newAlert, ...prev]);

      let bearing = Math.floor(60 + Math.random() * 200);
      const bearingMatch = result.explanation.match(/bearing\s+(\d+)°/i) || result.fileName.match(/_(\d+)deg/i);
      if (bearingMatch && bearingMatch[1]) {
        bearing = parseInt(bearingMatch[1], 10);
      }
      const distance = 160 + Math.floor(Math.random() * 120);
      setRecentEvents([
        {
          id: `RAD-${Date.now()}`,
          timestamp: result.timestamp,
          bearingDeg: bearing,
          distanceMeters: distance,
          confidencePct: result.confidence,
          targetType: result.soundClassification || 'Quadcopter Drone (Acoustic)',
          status: 'LOCKED'
        }
      ]);
    } else if (result.classification === 'NO_DRONE') {
      // Clear active radar drone alerts when verified non-drone sound is tested
      setRecentEvents([]);
    } else if (result.classification === 'UNCERTAIN') {
      const newAlert: SecurityAlert = {
        id: `REV-${Math.floor(100 + Math.random() * 900)}`,
        source: 'Manual Sound Testing',
        fileName: result.fileName,
        confidence: result.confidence,
        timestamp: result.timestamp,
        status: 'New',
        priority: 'Low',
        action: 'Test a clearer recording or verify audio source manually.',
        details: result.explanation
      };
      setAlerts(prev => [newAlert, ...prev]);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleUpdateAlertStatus = (alertId: string, newStatus: AlertStatus) => {
    setAlerts(prev =>
      prev.map(a => (a.id === alertId ? { ...a, status: newStatus } : a))
    );
  };

  const handleTriggerScenario = (type: 'quadcopter' | 'fpv' | 'birds' | 'clear') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (type === 'clear') {
      setRecentEvents([]);
      return;
    }

    if (type === 'quadcopter') {
      setMetrics(prev => ({
        ...prev,
        totalTests: prev.totalTests + 1,
        droneDetections: prev.droneDetections + 1,
        detectionsToday: prev.detectionsToday + 1
      }));
      const newHist: TestHistoryEntry = {
        id: `EVT-${Date.now().toString().slice(-4)}`,
        fileName: 'quadcopter_hover_array1.wav',
        dateTime: timestamp,
        audioType: '8-Mic Array North',
        classification: 'DRONE_DETECTED',
        confidence: 94,
        status: 'Completed'
      };
      setHistory(prev => [newHist, ...prev]);
      const newAlert: SecurityAlert = {
        id: `ALT-${Date.now().toString().slice(-3)}`,
        source: 'Perimeter Array Alpha',
        fileName: 'quadcopter_hover_array1.wav',
        confidence: 94,
        timestamp,
        status: 'New',
        priority: 'High',
        action: 'Camera slewed to bearing 114°. Target locked.',
        details: 'Motor blade harmonics matching quadcopter drone acoustic fingerprint.'
      };
      setAlerts(prev => [newAlert, ...prev]);
      setRecentEvents([
        {
          id: `RAD-${Date.now()}`,
          timestamp,
          bearingDeg: 114,
          distanceMeters: 210,
          confidencePct: 94,
          targetType: 'Quadcopter Drone (Acoustic)',
          status: 'LOCKED'
        }
      ]);
    } else if (type === 'fpv') {
      setMetrics(prev => ({
        ...prev,
        totalTests: prev.totalTests + 1,
        droneDetections: prev.droneDetections + 1,
        detectionsToday: prev.detectionsToday + 1
      }));
      const newHist: TestHistoryEntry = {
        id: `EVT-${Date.now().toString().slice(-4)}`,
        fileName: 'fpv_racing_high_rpm.wav',
        dateTime: timestamp,
        audioType: '8-Mic Array West',
        classification: 'DRONE_DETECTED',
        confidence: 98,
        status: 'Completed'
      };
      setHistory(prev => [newHist, ...prev]);
      const newAlert: SecurityAlert = {
        id: `ALT-${Date.now().toString().slice(-3)}`,
        source: 'Perimeter Array Beta',
        fileName: 'fpv_racing_high_rpm.wav',
        confidence: 98,
        timestamp,
        status: 'New',
        priority: 'High',
        action: 'Camera slewed to bearing 275°. Target locked.',
        details: 'High-RPM harmonic signature detected. Rapid airspace traversal.'
      };
      setAlerts(prev => [newAlert, ...prev]);
      setRecentEvents([
        {
          id: `RAD-${Date.now()}`,
          timestamp,
          bearingDeg: 275,
          distanceMeters: 140,
          confidencePct: 98,
          targetType: 'FPV Racing Drone (High RPM)',
          status: 'LOCKED'
        }
      ]);
    } else if (type === 'birds') {
      setMetrics(prev => ({
        ...prev,
        totalTests: prev.totalTests + 1,
        nonDroneSounds: prev.nonDroneSounds + 1
      }));
      const newHist: TestHistoryEntry = {
        id: `EVT-${Date.now().toString().slice(-4)}`,
        fileName: 'avian_flock_ambient.wav',
        dateTime: timestamp,
        audioType: '8-Mic Array North',
        classification: 'NO_DRONE',
        confidence: 91,
        status: 'Completed'
      };
      setHistory(prev => [newHist, ...prev]);
      setRecentEvents([
        {
          id: `RAD-${Date.now()}`,
          timestamp,
          bearingDeg: 35,
          distanceMeters: 290,
          confidencePct: 91,
          targetType: 'Avian Bioacoustic (Flock)',
          status: 'TRACKING'
        }
      ]);
    }
  };

  const unreadAlertsCount = alerts.filter(a => a.status === 'New').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#050b18] text-slate-100">
      
      {/* Persistent Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        newAlertsCount={unreadAlertsCount}
      />

      {/* Main Content Views */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* View 1: Executive Overview */}
        {activeTab === 'overview' && (
          <ExecutiveOverview
            metrics={metrics}
            recentEvents={recentEvents}
            history={history}
            sensors={sensors}
            isSimulating={isSimulating}
            onToggleSimulation={() => setIsSimulating(!isSimulating)}
            onNavigateToTesting={handleNavigateToTesting}
            onTriggerScenario={handleTriggerScenario}
            onAnalysisCompleted={handleAnalysisCompleted}
          />
        )}

        {/* View 2: Acoustic Training & Direction Lab */}
        {activeTab === 'testing' && (
          <ManualTestingLab
            onAnalysisCompleted={handleAnalysisCompleted}
            history={history}
            sensors={sensors}
            onClearHistory={handleClearHistory}
            onNavigateToOverview={() => setActiveTab('overview')}
            initialDemoTrackId={selectedTestingTrackId}
          />
        )}

        {/* View 3: Security Alerts Page */}
        {activeTab === 'alerts' && (
          <SecurityAlertsPage
            alerts={alerts}
            onUpdateAlertStatus={handleUpdateAlertStatus}
          />
        )}

        {/* View 4: Acoustic Array Sensors Status */}
        {activeTab === 'sensors' && (
          <AcousticSensorsPage 
            sensors={sensors}
            onUpdateSensors={setSensors}
          />
        )}

      </main>

      {/* Persistent Operational Disclaimer Footer */}
      <PrivacyFooter />

    </div>
  );
}
