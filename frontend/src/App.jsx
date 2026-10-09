import React, { useState, useEffect } from 'react';
import { 
  Search, CloudRain, Activity, Wrench, ShieldCheck, 
  TrendingUp, History, MapPin, User, Clock, 
  AlertTriangle, CheckCircle, RefreshCw, Play, 
  ArrowRight, Sparkles, Upload, HelpCircle, Eye
} from 'lucide-react';
import MapComponent from './components/MapComponent';
import * as api from './services/api';

export default function App() {
  // Main State
  const [location, setLocation] = useState({ lat: null, lng: null, name: "No location selected", lastUpdated: null });
  const [weather, setWeather] = useState(null);
  const [drains, setDrains] = useState([]);
  const [roads, setRoads] = useState([]);
  const [waterways, setWaterways] = useState([]);
  const [waterBodies, setWaterBodies] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [overpassStatus, setOverpassStatus] = useState("LIVE");
  const [historicalRain, setHistoricalRain] = useState([]);
  
  // UI Control State
  const [selectedDrain, setSelectedDrain] = useState(null);
  const [activeTab, setActiveTab] = useState("details"); // details, kanban, verification, recommendations, history
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rainSlider, setRainSlider] = useState(0);
  const [isSimulatedRain, setIsSimulatedRain] = useState(false);
  const [rainDuration, setRainDuration] = useState(3);

  // Default date calculations for 1 year ago (weekly window)
  const today = new Date();
  const lastYear = today.getFullYear() - 1;
  const monthStr = String(today.getMonth() + 1).padStart(2, '0');
  const dateStrVal = String(today.getDate()).padStart(2, '0');
  const defaultEndStr = `${lastYear}-${monthStr}-${dateStrVal}`;
  
  const startDateObj = new Date(today);
  startDateObj.setFullYear(lastYear);
  startDateObj.setDate(startDateObj.getDate() - 7);
  const startYear = startDateObj.getFullYear();
  const startMonth = String(startDateObj.getMonth() + 1).padStart(2, '0');
  const startDateDay = String(startDateObj.getDate()).padStart(2, '0');
  const defaultStartStr = `${startYear}-${startMonth}-${startDateDay}`;

  const [histStartDate, setHistStartDate] = useState(defaultStartStr);
  const [histEndDate, setHistEndDate] = useState(defaultEndStr);

  // Worker Assignment Modal/State
  const [assigningTask, setAssigningTask] = useState(null);
  const [workerTeam, setWorkerTeam] = useState("Drainage Maintenance Team A");
  const [priority, setPriority] = useState("Medium");
  const [instructions, setInstructions] = useState("Clear inlet grate and remove accumulated silt from the catchment.");

  // Upload/Verification Form State
  const [verifyingTask, setVerifyingTask] = useState(null);
  const [beforeFile, setBeforeFile] = useState(null);
  const [afterFile, setAfterFile] = useState(null);
  const [gpsMatch, setGpsMatch] = useState(true);
  const [verificationLoading, setVerificationLoading] = useState(false);

  // Guided Demo Mode State
  const [demoStep, setDemoStep] = useState(null); // null, 1, 2, 3, 4, 5, 6
  const [demoText, setDemoText] = useState("");

  // 1. Initial Load: Search default location on mount
  useEffect(() => {
    handleSearch("New Delhi"); // Default Indian map placeholder
  }, []);

  // Sync rain slider with live weather if NOT simulated
  useEffect(() => {
    if (weather && !isSimulatedRain) {
      setRainSlider(weather.currentRain);
    }
  }, [weather, isSimulatedRain]);

  // Sync selected drain details with updated simulation drains array
  useEffect(() => {
    if (selectedDrain && drains.length > 0) {
      const updated = drains.find(d => d.id === selectedDrain.id);
      if (updated && (
        updated.expectedRunoff !== selectedDrain.expectedRunoff || 
        updated.status !== selectedDrain.status || 
        updated.effectiveCapacityPct !== selectedDrain.effectiveCapacityPct
      )) {
        setSelectedDrain(updated);
      }
    }
  }, [drains]);

  // Load state from backend helper
  const refreshState = async () => {
    try {
      const state = await api.fetchState();
      setDrains(state.drains);
      setTasks(state.tasks);
      setTimeline(state.timeline);
      setWeather(state.weather);
      setLocation(state.location);
      setRoads(state.roads || []);
      setWaterways(state.waterways || []);
      setWaterBodies(state.waterBodies || []);
      setOverpassStatus(state.overpassStatus || "LIVE");
      setHistoricalRain(state.historicalRain || []);
      
      // Update selected drain details if it exists
      if (selectedDrain) {
        const updated = state.drains.find(d => d.id === selectedDrain.id);
        if (updated) setSelectedDrain(updated);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle geocoding location search
  const handleSearch = async (queryStr = searchQuery) => {
    if (!queryStr) return;
    setIsLoading(true);
    setError(null);
    try {
      const state = await api.searchLocation(queryStr);
      setLocation(state.location);
      setWeather(state.weather);
      setDrains(state.drains);
      setRoads(state.roads || []);
      setWaterways(state.waterways || []);
      setWaterBodies(state.waterBodies || []);
      setTasks(state.tasks);
      setTimeline(state.timeline);
      setOverpassStatus(state.overpassStatus || "LIVE");
      setHistoricalRain(state.historicalRain || []);
      setIsSimulatedRain(false);
      setSelectedDrain(state.drains.find(d => d.id === "D-27") || state.drains[0] || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch custom weather history range from backend
  const handleFetchCustomHistory = async () => {
    if (!location.lat) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.fetchCustomHistory(location.lat, location.lng, histStartDate, histEndDate);
      setHistoricalRain(data);
      refreshState();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle manual rain slider change
  const handleRainfallChange = async (val) => {
    setRainSlider(val);
    try {
      const state = await api.updateRainfall(val, true, rainDuration);
      setDrains(state.drains);
      setWeather(state.weather);
      setTasks(state.tasks);
      setTimeline(state.timeline);
    } catch (err) {
      setError(err.message);
    }
  };

  // Toggle simulation mode
  const handleRainModeToggle = async (simulate) => {
    setIsSimulatedRain(simulate);
    try {
      const targetRain = simulate ? rainSlider : 0; // default back to live or start at current slider
      const state = await api.updateRainfall(targetRain, simulate, rainDuration);
      setDrains(state.drains);
      setWeather(state.weather);
      setTasks(state.tasks);
      setTimeline(state.timeline);
    } catch (err) {
      setError(err.message);
    }
  };

  // Trigger task manual creation
  const handleCreateTask = async (drainId) => {
    // Actually backend generates tasks automatically on overflow status, 
    // but this gives direct control.
    try {
      setIsLoading(true);
      // Re-trigger rain scenario which updates tasks
      const state = await api.updateRainfall(weather.currentRain, isSimulatedRain, rainDuration);
      setTasks(state.tasks);
      setActiveTab("kanban");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Worker assignment action
  const handleAssignWorker = async (e) => {
    e.preventDefault();
    if (!assigningTask) return;
    try {
      const state = await api.assignTask(assigningTask.id, {
        assignedTeam: workerTeam,
        priority,
        deadline: new Date(Date.now() + 3 * 3600000).toISOString(), // 3 hours from now
        instructions
      });
      setTasks(state.tasks);
      setTimeline(state.timeline);
      setAssigningTask(null);
      refreshState();
    } catch (err) {
      setError(err.message);
    }
  };

  // Submit photos for AI verification
  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    if (!verifyingTask) return;
    setVerificationLoading(true);
    setError(null);
    try {
      const state = await api.verifyTask(
        verifyingTask.id, 
        beforeFile, 
        afterFile, 
        `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
        demoStep !== null
      );
      if (state.drains) setDrains(state.drains);
      if (state.tasks) setTasks(state.tasks);
      if (state.timeline) setTimeline(state.timeline);
      setVerifyingTask(null);
      setBeforeFile(null);
      setAfterFile(null);
      setActiveTab("details");
    } catch (err) {
      setError(err.message);
    } finally {
      setVerificationLoading(false);
    }
  };

  // Run Guided Demo Mode
  const runNextDemoStep = async () => {
    if (demoStep === null) {
      // Start Demo
      setDemoStep(1);
      setDemoText("STEP 1: PREDICT — Heavy rainfall arrives. Simulating torrential precipitation at 110 mm/hr...");
      // Simulate heavy rainfall
      setIsSimulatedRain(true);
      setRainSlider(110);
      const state = await api.updateRainfall(110, true, 3);
      setDrains(state.drains);
      setWeather(state.weather);
      setTasks(state.tasks);
      setTimeline(state.timeline);
      
      // Auto select D-27 for visual tracking
      const d27 = state.drains.find(d => d.id === "D-27");
      setSelectedDrain(d27);
      setActiveTab("details");
    } else if (demoStep === 1) {
      setDemoStep(2);
      setDemoText("STEP 2: DETECT — System identifies degraded drain status. D-27 effective capacity is heavily degraded (52%). expected runoff exceeds this capacity. Diagnosis: Suspected Blockage!");
    } else if (demoStep === 2) {
      setDemoStep(3);
      setDemoText("STEP 3: ASSIGN — Maintenance task is automatically generated. Assigning 'Drainage Maintenance Team A' to inspect and desilt the inlet.");
      // Auto-assign
      const targetTask = tasks.find(t => t.drainId === "D-27");
      if (targetTask) {
        const state = await api.assignTask(targetTask.id, {
          assignedTeam: "Drainage Maintenance Team A",
          priority: "High",
          deadline: new Date(Date.now() + 2 * 3600000).toISOString(),
          instructions: "DESILT INLET: Clear leaves, plastic waste and silt blocking catch basin grate."
        });
        setTasks(state.tasks);
        setTimeline(state.timeline);
        setActiveTab("kanban");
      }
    } else if (demoStep === 3) {
      setDemoStep(4);
      setDemoText("STEP 4: VERIFY — Worker submits before/after photos. Running Gemini Vision AI multimodal verification...");
      setActiveTab("verification");
      // Find D-27 task to verify
      const targetTask = tasks.find(t => t.drainId === "D-27");
      if (targetTask) {
        setVerifyingTask(targetTask);
      }
    } else if (demoStep === 4) {
      setDemoStep(5);
      setDemoText("STEP 5: UPDATE — AI verification passed! Grate cleared. Recalculating twin capacity to 95%...");
      setVerificationLoading(true);
      try {
        const targetTask = tasks.find(t => t.drainId === "D-27");
        if (targetTask) {
          const state = await api.verifyTask(
            targetTask.id,
            null,
            null,
            `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
            true // isDemo flag uses the local files
          );
          setDrains(state.drains);
          setTasks(state.tasks);
          setTimeline(state.timeline);
          
          // Select D-27 to show updated state
          const d27 = state.drains.find(d => d.id === "D-27");
          setSelectedDrain(d27);
          setActiveTab("details");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setVerificationLoading(false);
      }
    } else if (demoStep === 5) {
      setDemoStep(6);
      setDemoText("STEP 6: IMPROVE — Risk recalculated: D-27 status is now SAFE. Preventive maintenance avoided predicted urban overflow! Demo complete.");
    } else {
      // Reset Demo
      setDemoStep(null);
      setDemoText("");
      setIsSimulatedRain(false);
      handleSearch("New Delhi");
    }
  };

  const handleReset = async () => {
    setIsLoading(true);
    try {
      await api.resetDatabase();
      setDemoStep(null);
      setDemoText("");
      setIsSimulatedRain(false);
      await handleSearch("New Delhi");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-darkBg text-slate-100">
      
      {/* 1. Header Area */}
      <header className="glass-panel border-b border-darkBorder px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <CloudRain className="w-7 h-7 text-accentBlue animate-pulse" />
            <h1 className="text-2xl font-black tracking-tight text-white">DRAINAGE <span className="text-accentBlue">DIGITAL TWIN</span></h1>
            <span className="text-[10px] uppercase font-bold tracking-widest bg-blue-500/10 text-accentBlue px-2 py-0.5 rounded border border-blue-500/20">Hackathon Prototype</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Predict. Detect. Assign. Verify. Update. Improve.</p>
        </div>

        {/* Location Status Meta */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-300 font-medium truncate max-w-[180px]" title={location.name}>{location.name}</span>
            {location.lat && (
              <span className="text-[10px] text-slate-500 font-mono ml-1">
                [{location.lat.toFixed(4)}, {location.lng.toFixed(4)}]
              </span>
            )}
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/10 text-accentEmerald px-2.5 py-1 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            LIVE API CONNECTED
          </span>

          <button 
            onClick={handleReset}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Reset Database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Guided Demo Toast */}
      {demoStep !== null && (
        <div className="bg-gradient-to-r from-blue-900/90 to-cyan-900/90 border-b border-cyan-500/30 px-6 py-3 flex items-center justify-between z-20 shadow-glow shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400 animate-bounce" />
            <span className="text-xs md:text-sm font-semibold text-white tracking-wide">{demoText}</span>
          </div>
          <button 
            onClick={runNextDemoStep}
            className="flex items-center gap-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-xs font-bold px-4 py-1.5 rounded-lg shadow transition-colors shrink-0"
          >
            {demoStep === 6 ? "Finish & Reset" : "Next Step"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Main Dashboard Layout Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden p-6 gap-6">
        
        {/* Left Side: Map + Search + Weather Controls (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-6 overflow-hidden h-full">
          
          {/* Geocoding Search Panel */}
          <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center shrink-0">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search city, neighborhood, or coords (lat, lng)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full bg-slate-950/60 border border-darkBorder rounded-lg py-2 pl-10 pr-4 text-slate-200 text-sm focus:outline-none focus:border-accentBlue focus:ring-1 focus:ring-blue-500/20"
              />
            </div>
            
            <div className="flex w-full md:w-auto gap-2 shrink-0">
              <button 
                onClick={() => handleSearch()}
                disabled={isLoading}
                className="flex-1 md:flex-none bg-accentBlue hover:bg-blue-600 font-semibold text-white text-sm px-5 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Search
              </button>
              
              {demoStep === null && (
                <button 
                  onClick={() => runNextDemoStep()}
                  className="flex-1 md:flex-none bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-sm px-4 py-2 rounded-lg shadow-glow flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Run Demo
                </button>
              )}
            </div>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div className="flex-1 min-h-[300px] relative">
            {location.lat ? (
              <MapComponent 
                location={location}
                drains={drains}
                roads={roads}
                waterways={waterways}
                waterBodies={waterBodies}
                selectedDrain={selectedDrain}
                onSelectDrain={(d) => {
                  setSelectedDrain(d);
                  setActiveTab("details");
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center border border-darkBorder rounded-xl bg-slate-900/30 text-slate-500">
                <MapPin className="w-12 h-12 mb-2 animate-bounce" />
                <p>Loading interactive digital twin map...</p>
              </div>
            )}
          </div>

          {/* Small Disclaimer / Demo Note */}
          <div className="glass-panel p-3 rounded-lg border-white/5 text-[11px] text-slate-400 leading-relaxed shrink-0">
            <span className="font-bold text-slate-300 block mb-0.5">About this demo</span>
            Weather and geographic data are retrieved from live public sources where available. Drainage condition, effective capacity, maintenance status, and historical incidents are simulated unless connected to an authoritative municipal data source.
          </div>
        </section>

        {/* Right Side: Tabbed Details & Controls Column (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-6 overflow-hidden h-full">
          
          {/* Weather Panel: Rainfall Slider Controls */}
          <div className="glass-panel p-4 rounded-xl shrink-0">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm tracking-wide text-white uppercase flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-accentCyan" />
                Rainfall & Runoff Dashboard
              </h3>
              
              <div className="flex bg-slate-900 border border-darkBorder p-0.5 rounded-lg text-[10px]">
                <button 
                  onClick={() => handleRainModeToggle(false)}
                  className={`px-2 py-1 rounded font-semibold transition-colors ${!isSimulatedRain ? 'bg-accentBlue text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Live Forecast
                </button>
                <button 
                  onClick={() => handleRainModeToggle(true)}
                  className={`px-2 py-1 rounded font-semibold transition-colors ${isSimulatedRain ? 'bg-accentBlue text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Simulate
                </button>
              </div>
            </div>

            {weather ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/40 p-3 rounded-lg border border-darkBorder mb-3">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Intensity</span>
                  <span className="text-sm font-bold text-slate-200">{weather.currentRain} mm/hr</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Next 3 hrs</span>
                  <span className="text-sm font-bold text-slate-200">{weather.next3hRain} mm</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Peak Intensity</span>
                  <span className="text-sm font-bold text-slate-200">{weather.peakIntensity} mm/hr</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-semibold">Source</span>
                  <span className="text-sm font-bold text-accentCyan truncate block max-w-full" title={weather.source}>
                    {weather.status === "LIVE" ? "🟢 Live" : "🟡 Simulated"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-10 animate-pulse bg-slate-900 rounded mb-3"></div>
            )}

            {isSimulatedRain && (
              <div className="space-y-2 bg-slate-950/20 p-3 rounded-lg border border-white/5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Simulated Rain Rate:</span>
                  <span className="font-bold text-accentCyan font-mono">{rainSlider} mm/hr</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="150" 
                  step="5"
                  value={rainSlider}
                  onChange={(e) => handleRainfallChange(parseInt(e.target.value))}
                  className="w-full accent-cyan-500 cursor-ew-resize bg-slate-800 rounded-lg appearance-none h-1.5"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Dry</span>
                  <span>Moderate (25)</span>
                  <span>Heavy (75)</span>
                  <span>Torrential (150)</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="glass-panel p-1 rounded-xl flex text-xs shrink-0 select-none">
            {[
              { id: "details", label: "Details", icon: Eye },
              { id: "kanban", label: "Tasks", icon: Wrench },
              { id: "verification", label: "Verification", icon: ShieldCheck },
              { id: "recommendations", label: "Recommendations", icon: TrendingUp },
              { id: "history", label: "Timeline", icon: History }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg font-bold transition-all ${activeTab === tab.id ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Panel Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto glass-panel p-5 rounded-xl flex flex-col min-h-0 relative">
            
            {/* TAB 1: Selected Drain Details */}
            {activeTab === "details" && (
              <div className="space-y-4 flex-1">
                {selectedDrain ? (
                  <>
                    <div className="flex justify-between items-start border-b border-darkBorder pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold text-white">{selectedDrain.id}</h2>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                            {selectedDrain.drainType}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Coordinates: {selectedDrain.latitude}, {selectedDrain.longitude}</p>
                      </div>

                      <div className="text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          selectedDrain.status === 'Overflow' 
                            ? 'bg-rose-500/10 text-accentRose border border-rose-500/20' 
                            : selectedDrain.status === 'Stressed' 
                              ? 'bg-amber-500/10 text-accentAmber border border-amber-500/20' 
                              : 'bg-emerald-500/10 text-accentEmerald border border-emerald-500/20'
                        }`}>
                          {selectedDrain.status === 'Overflow' ? '🔴 Predicted Overflow' : selectedDrain.status === 'Stressed' ? '🟡 Stressed' : '🟢 Safe'}
                        </span>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-950/30 p-2.5 rounded border border-darkBorder">
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">Theoretical Cap</span>
                        <span className="text-sm font-bold text-slate-200">{selectedDrain.theoreticalCapacity} m³/hr</span>
                      </div>
                      <div className="bg-slate-950/30 p-2.5 rounded border border-darkBorder">
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">Effective Cap</span>
                        <span className="text-sm font-bold text-slate-200">
                          {selectedDrain.effectiveCapacity} m³/hr ({selectedDrain.effectiveCapacityPct}%)
                        </span>
                      </div>
                      <div className="bg-slate-950/30 p-2.5 rounded border border-darkBorder">
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">Expected Runoff</span>
                        <span className="text-sm font-bold text-slate-200">{selectedDrain.expectedRunoff} m³/hr</span>
                      </div>
                      <div className="bg-slate-950/30 p-2.5 rounded border border-darkBorder">
                        <span className="text-[10px] text-slate-500 block uppercase font-medium">Risk Score</span>
                        <span className="text-sm font-bold text-slate-200">{selectedDrain.riskScore} / 100</span>
                      </div>
                    </div>

                    {/* Progress Bar (Capacity Utilization) */}
                    <div className="space-y-1 bg-slate-950/20 p-3 rounded-lg border border-darkBorder">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">Capacity Utilization:</span>
                        <span className={`${selectedDrain.capacityUtilization > 100 ? 'text-accentRose' : selectedDrain.capacityUtilization > 70 ? 'text-accentAmber' : 'text-accentEmerald'}`}>
                          {selectedDrain.capacityUtilization}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            selectedDrain.capacityUtilization > 100 
                              ? 'bg-rose-500 shadow-glowRose' 
                              : selectedDrain.capacityUtilization > 70 
                                ? 'bg-amber-500' 
                                : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(selectedDrain.capacityUtilization, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Diagnosis Banner */}
                    <div className={`p-4 rounded-lg flex gap-3 ${
                      selectedDrain.status === 'Overflow'
                        ? 'bg-rose-500/10 border border-rose-500/20 text-slate-200'
                        : selectedDrain.status === 'Stressed'
                          ? 'bg-amber-500/10 border border-amber-500/20 text-slate-200'
                          : 'bg-emerald-500/5 border border-emerald-500/10 text-slate-300'
                    }`}>
                      {selectedDrain.status !== 'Safe' ? (
                        <AlertTriangle className={`w-5 h-5 shrink-0 ${selectedDrain.status === 'Overflow' ? 'text-accentRose' : 'text-accentAmber'}`} />
                      ) : (
                        <CheckCircle className="w-5 h-5 shrink-0 text-accentEmerald" />
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">Diagnosis: {selectedDrain.diagnosis}</div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{selectedDrain.recommendedAction}</p>
                      </div>
                    </div>

                    {/* Meta Detail Tags */}
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 font-medium">
                      <div className="bg-slate-900/60 p-2 rounded text-center">
                        <span className="text-slate-500 block">Elevation</span>
                        <span className="text-slate-200">{selectedDrain.elevation}</span>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded text-center">
                        <span className="text-slate-500 block">Last Maintenance</span>
                        <span className="text-slate-200">{selectedDrain.lastMaintenanceDaysAgo} days ago</span>
                      </div>
                      <div className="bg-slate-900/60 p-2 rounded text-center">
                        <span className="text-slate-500 block">Floods Logged</span>
                        <span className="text-slate-200">{selectedDrain.historicalIncidents} times</span>
                      </div>
                    </div>

                    {/* Task Actions */}
                    {selectedDrain.status !== 'Safe' && (
                      <div className="pt-2">
                        {tasks.some(t => t.drainId === selectedDrain.id) ? (
                          <button 
                            onClick={() => setActiveTab("kanban")}
                            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Wrench className="w-4 h-4" />
                            View Maintenance Task
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleCreateTask(selectedDrain.id)}
                            className="w-full py-2 bg-accentBlue hover:bg-blue-600 text-white font-semibold rounded-lg text-xs shadow transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Wrench className="w-4 h-4" />
                            Generate Maintenance Task
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center py-12">
                    <Activity className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm">Click a drain marker on the map to display structural twin properties, runoff levels, and risk calculations.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Maintenance Kanban Board */}
            {activeTab === "kanban" && (
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center border-b border-darkBorder pb-2">
                  <h3 className="font-bold text-white text-sm uppercase">Active Maintenance Tasks</h3>
                  <span className="bg-slate-800 border border-slate-700 text-[10px] text-slate-300 px-2 py-0.5 rounded-full font-mono">
                    {tasks.length} Total
                  </span>
                </div>

                {tasks.length > 0 ? (
                  <div className="space-y-3">
                    {tasks.map(task => (
                      <div key={task.id} className="bg-slate-950/40 p-4 rounded-xl border border-darkBorder hover:border-slate-700 transition-all flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                              {task.id}
                            </span>
                            <h4 className="font-bold text-white text-sm mt-1">{task.drainId} — {task.issue}</h4>
                          </div>
                          
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            task.status === 'VERIFIED' 
                              ? 'bg-emerald-500/10 text-accentEmerald border border-emerald-500/20'
                              : task.status === 'SUBMITTED'
                                ? 'bg-cyan-500/10 text-accentCyan border border-cyan-500/20 animate-pulse'
                                : task.status === 'ASSIGNED'
                                  ? 'bg-blue-500/10 text-accentBlue border border-blue-500/20'
                                  : task.status === 'FAILED'
                                    ? 'bg-rose-500/10 text-accentRose border border-rose-500/20'
                                    : 'bg-amber-500/10 text-accentAmber border border-amber-500/20'
                          }`}>
                            {task.status}
                          </span>
                        </div>

                        {task.status === 'PENDING' && (
                          <button
                            onClick={() => setAssigningTask(task)}
                            className="py-1.5 bg-accentBlue hover:bg-blue-600 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1"
                          >
                            <User className="w-3.5 h-3.5" />
                            Assign Worker Team
                          </button>
                        )}

                        {task.status === 'ASSIGNED' && (
                          <div className="flex flex-col gap-2">
                            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded">
                              <span className="font-semibold text-slate-300 block">Assigned To:</span>
                              {task.assignedTeam} (Priority: {task.priority})
                            </div>
                            
                            <button
                              onClick={() => {
                                setVerifyingTask(task);
                                setActiveTab("verification");
                              }}
                              className="py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-xs rounded transition-colors flex items-center justify-center gap-1"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Verify Work Submission
                            </button>
                          </div>
                        )}

                        {(task.status === 'SUBMITTED' || task.status === 'VERIFIED' || task.status === 'FAILED') && (
                          <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded flex flex-col gap-1 border border-white/5">
                            <span className="font-semibold text-slate-300">AI Verification Log:</span>
                            <span className="text-[10px] text-slate-500">Verdict: {task.aiResponse?.verdict} (Confidence: {task.aiResponse?.confidence * 100}%)</span>
                            <p className="mt-1 italic line-clamp-2 text-slate-400">"{task.aiResponse?.reason}"</p>
                            
                            {task.status === 'VERIFIED' && (
                              <div className="flex items-center gap-1 text-[10px] text-accentEmerald font-bold mt-1.5">
                                <CheckCircle className="w-3 h-3" />
                                Twin Capacity Restored
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center py-12">
                    <CheckCircle className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm">No active tasks. Digital twin simulation is functioning within capacity limits under current rainfall.</p>
                  </div>
                )}
              </div>
            )}

            {/* Worker Assignment Drawer/Modal Layer */}
            {assigningTask && (
              <div className="absolute inset-0 bg-slate-950/95 z-20 p-5 flex flex-col gap-4 rounded-xl">
                <div className="flex justify-between items-center border-b border-darkBorder pb-2">
                  <h3 className="font-bold text-white text-sm">Assign Maintenance Team</h3>
                  <button onClick={() => setAssigningTask(null)} className="text-slate-400 hover:text-white font-bold text-sm">✕</button>
                </div>

                <form onSubmit={handleAssignWorker} className="flex-1 flex flex-col justify-between text-xs space-y-3">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-slate-400 font-semibold block">Task Target:</label>
                      <span className="font-bold text-slate-200">{assigningTask.drainId} ({assigningTask.issue})</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-semibold block">Select Maintenance Team:</label>
                      <select 
                        value={workerTeam}
                        onChange={(e) => setWorkerTeam(e.target.value)}
                        className="w-full bg-slate-900 border border-darkBorder p-2 rounded text-slate-200 focus:outline-none"
                      >
                        <option value="Drainage Maintenance Team A">Drainage Maintenance Team A (Inlets/Grates)</option>
                        <option value="Municipal Sewerage Team B">Municipal Sewerage Team B (Underground conduits)</option>
                        <option value="Emergency Flood Response Crew">Emergency Flood Response Crew (Mobile pumps/retention)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-semibold block">Priority Rank:</label>
                      <div className="flex gap-2">
                        {['Medium', 'High', 'Critical'].map(p => (
                          <button
                            type="button"
                            key={p}
                            onClick={() => setPriority(p)}
                            className={`flex-1 py-1 rounded font-bold border transition-colors ${priority === p ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-darkBorder text-slate-400'}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-semibold block">Dispatched Work Orders:</label>
                      <textarea 
                        rows="3"
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="w-full bg-slate-900 border border-darkBorder p-2 rounded text-slate-200 focus:outline-none text-[11px]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-accentBlue hover:bg-blue-600 text-white font-bold rounded transition-colors"
                  >
                    Confirm Dispatch Worker
                  </button>
                </form>
              </div>
            )}

            {/* TAB 3: Photo Verification */}
            {activeTab === "verification" && (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex justify-between items-center border-b border-darkBorder pb-2 shrink-0">
                  <h3 className="font-bold text-white text-sm uppercase">AI Photo Verification</h3>
                  <HelpCircle className="w-4 h-4 text-slate-500 hover:text-slate-300 cursor-pointer" title="Upload before/after work evidence. Gemini Vision AI inspects and verifies clearance." />
                </div>

                {verifyingTask ? (
                  <form onSubmit={handleVerificationSubmit} className="flex-1 flex flex-col gap-4 text-xs">
                    <div className="bg-slate-900/60 p-3 rounded-lg border border-darkBorder">
                      <div className="font-semibold text-slate-300">Task Reference: {verifyingTask.id}</div>
                      <div className="text-slate-500 mt-0.5">Asset ID: <span className="text-accentBlue font-bold">{verifyingTask.drainId}</span></div>
                    </div>

                    {/* Before Photo Upload */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        Before Photo (Blocked Grate):
                      </label>
                      
                      {demoStep === 4 ? (
                        <div className="bg-slate-950/60 border border-cyan-500/20 p-2.5 rounded-lg flex items-center justify-between text-cyan-400 font-mono text-[10px]">
                          <span className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" />
                            [Demo Asset] blocked_drain.jpg
                          </span>
                          <span className="text-slate-500 italic">Preloaded</span>
                        </div>
                      ) : (
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => setBeforeFile(e.target.files[0])}
                          className="w-full bg-slate-900 border border-darkBorder p-2 rounded text-slate-300 focus:outline-none file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-300 file:hover:bg-slate-700 cursor-pointer"
                        />
                      )}
                    </div>

                    {/* After Photo Upload */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-semibold flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        After Photo (Cleared Grate):
                      </label>
                      
                      {demoStep === 4 ? (
                        <div className="bg-slate-950/60 border border-cyan-500/20 p-2.5 rounded-lg flex items-center justify-between text-cyan-400 font-mono text-[10px]">
                          <span className="flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5" />
                            [Demo Asset] cleared_drain.jpg
                          </span>
                          <span className="text-slate-500 italic">Preloaded</span>
                        </div>
                      ) : (
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => setAfterFile(e.target.files[0])}
                          className="w-full bg-slate-900 border border-darkBorder p-2 rounded text-slate-300 focus:outline-none file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-slate-800 file:text-slate-300 file:hover:bg-slate-700 cursor-pointer"
                        />
                      )}
                    </div>

                    {/* Location Match Verification Flag */}
                    <div className="bg-slate-950/30 p-2.5 rounded border border-darkBorder flex items-start gap-2">
                      <input 
                        type="checkbox" 
                        id="gps-match"
                        checked={gpsMatch}
                        onChange={(e) => setGpsMatch(e.target.checked)}
                        className="mt-0.5 accent-blue-600 rounded"
                      />
                      <label htmlFor="gps-match" className="text-[10px] text-slate-400 select-none cursor-pointer leading-normal">
                        <strong>GPS Location match:</strong> Verification matches target digital twin coordinate boundaries.
                        <span className="block text-[9px] text-slate-500 mt-0.5">Prototype limitation: Full EXIF data reverse forensics checks are scheduled for production release.</span>
                      </label>
                    </div>

                    {/* Trigger Verification */}
                    <button
                      type="submit"
                      disabled={verificationLoading || (demoStep === null && (!beforeFile || !afterFile))}
                      className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-extrabold rounded-lg shadow-glow transition-all flex items-center justify-center gap-1.5"
                    >
                      {verificationLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Running AI Multimodal Analysis...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          Verify Work Evidence
                        </>
                      )}
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => setVerifyingTask(null)}
                      className="w-full py-1 text-slate-500 hover:text-slate-300 font-semibold"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center py-12 shrink-0">
                    <ShieldCheck className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm">No task is currently staged for verification.</p>
                    <p className="text-[11px] text-slate-600 mt-2 px-6">Dispatch a worker to a degraded asset from the "Tasks" board to unlock the photo submission verification workflow.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Infrastructure Recommendations */}
            {activeTab === "recommendations" && (
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center border-b border-darkBorder pb-2">
                  <h3 className="font-bold text-white text-sm uppercase">Structural Upgrade Proposals</h3>
                  <span className="bg-slate-800 text-[10px] text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                    Insufficiency Log
                  </span>
                </div>

                {drains.filter(d => d.expectedRunoff > d.theoreticalCapacity).length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-[11px] rounded-lg text-slate-300 leading-relaxed">
                      💡 <strong>Note:</strong> Drains listed below are failing even at 100% capacity. These assets represent structural bottlenecks that require physical capital upgrades rather than maintenance.
                    </div>

                    {drains
                      .filter(d => d.expectedRunoff > d.theoreticalCapacity)
                      .sort((a, b) => (b.expectedRunoff - b.theoreticalCapacity) - (a.expectedRunoff - a.theoreticalCapacity))
                      .map(drain => {
                        const gap = parseFloat((drain.expectedRunoff - drain.theoreticalCapacity).toFixed(2));
                        return (
                          <div key={drain.id} className="bg-slate-950/40 p-4 rounded-xl border border-darkBorder hover:border-slate-700 transition-all flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-white text-sm">{drain.id}</h4>
                                <span className="text-[10px] text-slate-500">{drain.drainType} · Elev: {drain.elevation}</span>
                              </div>
                              <span className="text-[10px] font-bold text-accentRose bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
                                Gap: +{gap} m³/hr
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                              <div>Theo Cap: {drain.theoreticalCapacity} m³/h</div>
                              <div>Peak Runoff: {drain.expectedRunoff} m³/h</div>
                            </div>

                            <div className="bg-slate-900/60 p-2.5 rounded text-[11px] border border-white/5">
                              <span className="font-bold text-slate-300 block mb-0.5">Proposed Intervention:</span>
                              Increase physical pipe diameter or construct parallel retention conduits. Expand inlet throat width by {Math.max(10, Math.ceil((gap / drain.theoreticalCapacity) * 100))}%.
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center py-12">
                    <TrendingUp className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm">No structural capacity deficits detected.</p>
                    <p className="text-[11px] text-slate-600 mt-2 px-6">Under current rain parameters, all runoff flows are within the physical design capacity of the drainage grid assets.</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: Timeline & Historical Analysis */}
            {activeTab === "history" && (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                
                {/* Part A: Historical Rainfall Analysis */}
                <div className="space-y-3 shrink-0">
                  <div className="flex justify-between items-center border-b border-darkBorder pb-1">
                    <h3 className="font-bold text-white text-sm uppercase">Historical Storm Analysis</h3>
                    <span className="text-[10px] text-accentCyan bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded font-bold">
                      Feature 12
                    </span>
                  </div>

                  {/* Predefined Scenarios */}
                  <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Simulated Storms</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "monsoon", name: "Monsoon '24", rain: 85, dur: 2 },
                      { id: "flash", name: "Cloudburst", rain: 55, dur: 3 },
                      { id: "cyclone", name: "Cyclone '25", rain: 120, dur: 6 }
                    ].map(evt => (
                      <button
                        key={evt.id}
                        onClick={() => {
                          setIsSimulatedRain(true);
                          setRainSlider(evt.rain);
                          setRainDuration(evt.dur);
                          handleRainfallChange(evt.rain);
                        }}
                        className={`p-1.5 rounded-lg border text-left transition-all ${
                          rainSlider === evt.rain && isSimulatedRain && rainDuration === evt.dur
                            ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-glow'
                            : 'bg-slate-950/40 border-darkBorder hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="font-bold text-[10px] truncate">{evt.name}</div>
                        <div className="font-mono text-[9px] text-slate-500 mt-0.5">{evt.rain} mm/h · {evt.dur}h</div>
                      </button>
                    ))}
                  </div>

                  {/* Real Historical Data from Open-Meteo Archive */}
                  <div className="flex justify-between items-center pt-1 border-t border-white/5">
                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Real Archive Data Range</span>
                    <span className="text-[9px] text-accentEmerald font-semibold">🟢 Live Archive</span>
                  </div>

                  <div className="flex gap-1.5 items-end bg-slate-950/40 p-2 rounded-lg border border-darkBorder text-[10px]">
                    <div className="flex-1 flex flex-col gap-0.5">
                      <span className="text-slate-500 font-semibold uppercase text-[8px]">Start Date</span>
                      <input 
                        type="date" 
                        value={histStartDate} 
                        onChange={(e) => setHistStartDate(e.target.value)} 
                        className="w-full bg-slate-900 border border-darkBorder rounded px-1.5 py-0.5 text-slate-300 focus:outline-none" 
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <span className="text-slate-500 font-semibold uppercase text-[8px]">End Date</span>
                      <input 
                        type="date" 
                        value={histEndDate} 
                        onChange={(e) => setHistEndDate(e.target.value)} 
                        className="w-full bg-slate-900 border border-darkBorder rounded px-1.5 py-0.5 text-slate-300 focus:outline-none" 
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={handleFetchCustomHistory}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1 rounded transition-colors shrink-0"
                    >
                      Fetch
                    </button>
                  </div>
                  
                  {historicalRain.length > 0 ? (
                    <div className="max-h-[120px] overflow-y-auto space-y-1.5 bg-slate-950/20 p-2 rounded-lg border border-white/5 pr-1">
                      {historicalRain.map((day, idx) => {
                        const calculatedRate = parseFloat((day.rainSum > 0 ? Math.max(1, day.rainSum / 4) : 0).toFixed(2));
                        const isCurrent = rainSlider === calculatedRate && isSimulatedRain && rainDuration === 24;
                        
                        return (
                          <div 
                            key={idx}
                            className={`flex justify-between items-center p-1.5 rounded-lg border text-[11px] transition-all ${
                              isCurrent 
                                ? 'bg-emerald-500/10 border-emerald-400 text-white' 
                                : 'bg-slate-900/60 border-darkBorder text-slate-300'
                            }`}
                          >
                            <div>
                              <div className="font-mono font-semibold">{day.date}</div>
                              <div className="text-[9px] text-slate-500 mt-0.5">Sum: {day.rainSum} mm · Peak: {calculatedRate} mm/h</div>
                            </div>
                            
                            <button
                              onClick={() => {
                                setIsSimulatedRain(true);
                                setRainSlider(calculatedRate);
                                setRainDuration(24);
                                handleRainfallChange(calculatedRate);
                              }}
                              className={`px-2 py-0.5 rounded font-bold text-[9px] transition-colors ${
                                isCurrent 
                                  ? 'bg-accentEmerald text-slate-955' 
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                              }`}
                            >
                              Test Day
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-600 italic text-center p-2 border border-dashed border-darkBorder rounded">
                      Loading real historical weather records...
                    </div>
                  )}

                  {selectedDrain ? (
                    <div className="bg-slate-950/60 p-3 rounded-lg border border-darkBorder text-xs space-y-2">
                      <div className="flex justify-between font-semibold border-b border-white/5 pb-1">
                        <span className="text-slate-300">Runoff Impact on {selectedDrain.id}:</span>
                        <span className={`${
                          (selectedDrain.expectedRunoff) > selectedDrain.effectiveCapacity 
                            ? 'text-accentRose font-bold' 
                            : 'text-accentEmerald font-bold'
                        }`}>
                          {(selectedDrain.expectedRunoff) > selectedDrain.effectiveCapacity ? "🔴 Predicted Overflow" : "🟢 Safely Drained"}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-[11px] text-slate-400">
                        <div className="flex justify-between">
                          <span>Simulated Rain:</span>
                          <span className="font-bold text-slate-300 font-mono">{weather?.currentRain} mm/h</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Maintenance State:</span>
                          <span className="font-bold text-slate-300 capitalize">{selectedDrain.blockageCondition}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Expected Runoff:</span>
                          <span className="font-bold text-slate-300 font-mono">{selectedDrain.expectedRunoff} m³/h</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Drain Capacity:</span>
                          <span className="font-bold text-slate-300 font-mono">{selectedDrain.effectiveCapacity} m³/h</span>
                        </div>
                      </div>

                      {(selectedDrain.expectedRunoff) > selectedDrain.effectiveCapacity && (
                        <div className="mt-2 text-[10px] p-2 bg-slate-900 rounded border border-white/5 text-slate-400">
                          {selectedDrain.expectedRunoff > selectedDrain.theoreticalCapacity ? (
                            <span className="text-accentRose">
                              <strong>Upgrade Suggestion:</strong> Deficit exceeds physical pipe capacity. Increase physical capacity (gap: {parseFloat((selectedDrain.expectedRunoff - selectedDrain.theoreticalCapacity).toFixed(1))} m³/h).
                            </span>
                          ) : (
                            <span className="text-accentAmber">
                              <strong>Upgrade Suggestion:</strong> Drain is blocked. Cleaning grate will resolve this overflow (effective capacity is {selectedDrain.effectiveCapacityPct}% degraded).
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 italic text-center p-2">Select a drain to run localized historical flood analysis.</div>
                  )}
                </div>

                {/* Part B: Timeline Logs */}
                <div className="space-y-3 flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex justify-between items-center border-b border-darkBorder pb-2 shrink-0">
                    <h3 className="font-bold text-white text-sm uppercase">Digital Twin Event Timeline</h3>
                    <History className="w-4 h-4 text-slate-500" />
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1">
                    {timeline.length > 0 ? (
                      <div className="space-y-4 relative pl-3 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
                        {timeline.slice(0, 15).map(event => (
                          <div key={event.id} className="relative text-xs flex gap-2">
                            <span className={`absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full border border-darkBg ${
                              event.type === 'success' 
                                ? 'bg-emerald-500' 
                                : event.type === 'warning' 
                                  ? 'bg-amber-500 animate-pulse' 
                                  : event.type === 'error' 
                                    ? 'bg-rose-500' 
                                    : 'bg-blue-500'
                            }`} />
                            
                            <div className="flex-1">
                              <span className="font-mono text-[10px] text-slate-500">{event.time}</span>
                              <p className="text-slate-300 mt-0.5">{event.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500 text-center py-12">
                        <History className="w-10 h-10 mb-2 text-slate-600" />
                        <p className="text-sm">No timeline logs recorded yet.</p>
                        <p className="text-[11px] text-slate-600 mt-2">Logs of updates will display here.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>

      </main>

      {/* Global Error Banner */}
      {error && (
        <div className="fixed bottom-6 right-6 max-w-sm glass-panel border-rose-500/20 bg-rose-950/90 text-slate-200 p-4 rounded-xl shadow-glow z-[2000] flex gap-3 items-start animate-bounce">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm text-white">System Error</div>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
            <button onClick={() => setError(null)} className="mt-2 text-[10px] font-bold text-rose-400 hover:text-white uppercase">Dismiss</button>
          </div>
        </div>
      )}

    </div>
  );
}
