import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

import { readDb, writeDb, initDb, resetDb } from './services/dbService.js';
import { fetchWeatherData, getSimulatedWeather, fetchHistoricalRain, fetchHistoricalRainCustom } from './services/weatherService.js';
import { geocodeLocation, fetchGeoFeaturesAndDrains } from './services/osmService.js';
import { runDrainageSimulation } from './services/simulationEngine.js';
import { verifyMaintenanceImages } from './services/aiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json());

// Serve static assets from data folder (for before/after demo photos)
app.use('/api/static', express.static(path.join(__dirname, 'data')));

// Multer memory storage configuration for before/after image uploads
const upload = multer({ storage: multer.memoryStorage() });

// Helper to add timeline events
function addTimelineEvent(dbState, message, type = "info") {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  dbState.timeline.unshift({
    id: uuidv4(),
    time: timeStr,
    timestamp: now.toISOString(),
    message,
    type
  });
}

// 1. Get complete state
app.get('/api/state', (req, res) => {
  const db = readDb();
  res.json(db);
});

// 2. Search location (Nominatim + Overpass + OpenMeteo)
app.post('/api/location/search', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const db = readDb();
    
    // Geocode query
    const loc = await geocodeLocation(query);
    db.location = {
      lat: loc.lat,
      lng: loc.lng,
      name: loc.name,
      lastUpdated: new Date().toISOString()
    };

    // Fetch live weather (or simulated fallback)
    const weather = await fetchWeatherData(loc.lat, loc.lng);
    db.weather = weather;

    // Fetch real historical weather records
    const historicalRain = await fetchHistoricalRain(loc.lat, loc.lng);
    db.historicalRain = historicalRain;

    // Fetch OSM roads/waterways and generate/load drains
    const geoData = await fetchGeoFeaturesAndDrains(loc.lat, loc.lng);
    db.overpassStatus = geoData.overpassStatus;
    db.roads = geoData.roads;
    db.waterways = geoData.waterways;
    db.waterBodies = geoData.waterBodies;
    
    // Clear tasks and history upon changing location
    db.tasks = [];
    db.timeline = [];

    // Run drainage simulation with current weather rainfall intensity
    db.drains = runDrainageSimulation(geoData.drains, weather.currentRain);

    // Add initial geocoded events
    addTimelineEvent(db, `Location changed to: ${loc.name}`, "info");
    addTimelineEvent(db, `Live weather loaded from ${weather.source}. Rain intensity: ${weather.currentRain} mm/hr`, "info");
    
    // If any drain is overflow/stressed initially, auto-generate tasks
    db.drains.forEach(drain => {
      if (drain.status === "Overflow" || drain.status === "Stressed") {
        const existingTask = db.tasks.find(t => t.drainId === drain.id);
        if (!existingTask) {
          db.tasks.push({
            id: `task-${uuidv4().substring(0, 8)}`,
            drainId: drain.id,
            issue: drain.diagnosisType === "BLOCKAGE" ? "Suspected blockage" : "Infrastructure capacity deficit",
            priority: drain.status === "Overflow" ? "High" : "Medium",
            status: "PENDING",
            assignedTeam: null,
            deadline: null,
            instructions: null,
            createdAt: new Date().toISOString()
          });
          addTimelineEvent(db, `Risk detected on ${drain.id}: ${drain.diagnosis}`, "warning");
        }
      }
    });

    writeDb(db);
    res.json(db);
  } catch (error) {
    console.error("Location search failed:", error);
    res.status(500).json({ error: error.message || "Failed to process location search" });
  }
});
app.get('/api/weather/historical', async (req, res) => {
  const { lat, lon, startDate, endDate } = req.query;
  if (!lat || !lon || !startDate || !endDate) {
    return res.status(400).json({ error: "lat, lon, startDate, and endDate are required" });
  }

  try {
    const historicalRain = await fetchHistoricalRainCustom(lat, lon, startDate, endDate);
    
    const db = readDb();
    db.historicalRain = historicalRain;
    writeDb(db);
    
    res.json(historicalRain);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to fetch custom weather archive" });
  }
});

// 3. Set rainfall (Simulation or Live Override)
app.post('/api/rainfall', (req, res) => {
  const { currentRain, isSimulated, simulatedDuration } = req.body;
  if (currentRain === undefined) {
    return res.status(400).json({ error: "currentRain is required" });
  }

  const db = readDb();
  if (!db.location.lat) {
    return res.status(400).json({ error: "Please select a location first" });
  }

  // Update weather state
  if (isSimulated) {
    db.weather = {
      ...db.weather,
      source: "Manual Rain Simulation",
      status: "SIMULATED",
      timestamp: new Date().toISOString(),
      currentRain: parseFloat(parseFloat(currentRain).toFixed(2)),
      next3hRain: parseFloat((currentRain * (simulatedDuration || 3)).toFixed(2)),
      next6hRain: parseFloat((currentRain * (simulatedDuration || 6)).toFixed(2)),
      peakIntensity: parseFloat(parseFloat(currentRain).toFixed(2))
    };
    addTimelineEvent(db, `Rainfall simulated manually at ${currentRain} mm/hr`, "info");
  } else {
    // Re-fetch live weather
    return fetchWeatherData(db.location.lat, db.location.lng)
      .then(weather => {
        db.weather = weather;
        db.drains = runDrainageSimulation(db.drains, weather.currentRain);
        
        // Auto-generate tasks for newly stressed/overflowing drains
        db.drains.forEach(drain => {
          if (drain.status === "Overflow" || drain.status === "Stressed") {
            const existingTask = db.tasks.find(t => t.drainId === drain.id);
            if (!existingTask) {
              db.tasks.push({
                id: `task-${uuidv4().substring(0, 8)}`,
                drainId: drain.id,
                issue: drain.diagnosisType === "BLOCKAGE" ? "Suspected blockage" : "Infrastructure capacity deficit",
                priority: drain.status === "Overflow" ? "High" : "Medium",
                status: "PENDING",
                assignedTeam: null,
                deadline: null,
                instructions: null,
                createdAt: new Date().toISOString()
              });
              addTimelineEvent(db, `Risk detected on ${drain.id}: ${drain.diagnosis}`, "warning");
            }
          }
        });
        
        writeDb(db);
        res.json(db);
      })
      .catch(err => {
        res.status(500).json({ error: "Failed to reload live weather: " + err.message });
      });
  }

  // Run simulation and check for task updates
  db.drains = runDrainageSimulation(db.drains, db.weather ? db.weather.currentRain : 0);
  
  db.drains.forEach(drain => {
    if (drain.status === "Overflow" || drain.status === "Stressed") {
      const existingTask = db.tasks.find(t => t.drainId === drain.id);
      if (!existingTask) {
        db.tasks.push({
          id: `task-${uuidv4().substring(0, 8)}`,
          drainId: drain.id,
          issue: drain.diagnosisType === "BLOCKAGE" ? "Suspected blockage" : "Infrastructure capacity deficit",
          priority: drain.status === "Overflow" ? "High" : "Medium",
          status: "PENDING",
          assignedTeam: null,
          deadline: null,
          instructions: null,
          createdAt: new Date().toISOString()
        });
        addTimelineEvent(db, `Risk detected on ${drain.id}: ${drain.diagnosis}`, "warning");
      }
    }
  });

  writeDb(db);
  res.json(db);
});

// 4. Assign Worker to Task
app.post('/api/tasks/:id/assign', (req, res) => {
  const { id } = req.params;
  const { assignedTeam, priority, deadline, instructions } = req.body;

  const db = readDb();
  const taskIndex = db.tasks.findIndex(t => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  db.tasks[taskIndex] = {
    ...db.tasks[taskIndex],
    status: "ASSIGNED",
    assignedTeam,
    priority,
    deadline,
    instructions,
    assignedAt: new Date().toISOString()
  };

  addTimelineEvent(
    db, 
    `Task ${id} (${db.tasks[taskIndex].drainId}) assigned to ${assignedTeam}`, 
    "info"
  );

  writeDb(db);
  res.json(db);
});

// 5. Submit Images for AI Verification
app.post('/api/tasks/:id/verify', upload.fields([
  { name: 'beforePhoto', maxCount: 1 },
  { name: 'afterPhoto', maxCount: 1 }
]), async (req, res) => {
  const { id } = req.params;
  const { isDemo, reportedLocation } = req.body;

  const db = readDb();
  const taskIndex = db.tasks.findIndex(t => t.id === id);

  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  const task = db.tasks[taskIndex];
  db.tasks[taskIndex].status = "SUBMITTED";
  addTimelineEvent(db, `Maintenance evidence submitted for task ${id} (${task.drainId})`, "info");

  let beforeBuffer, beforeMime, afterBuffer, afterMime;

  try {
    if (isDemo === 'true' || isDemo === true) {
      // Use local demo files
      const blockedPath = path.join(__dirname, 'data', 'blocked_drain.jpg');
      const clearedPath = path.join(__dirname, 'data', 'cleared_drain.jpg');
      
      beforeBuffer = fs.readFileSync(blockedPath);
      beforeMime = 'image/jpeg';
      afterBuffer = fs.readFileSync(clearedPath);
      afterMime = 'image/jpeg';
    } else {
      // Use uploaded files
      if (!req.files || !req.files.beforePhoto || !req.files.afterPhoto) {
        return res.status(400).json({ error: "Before and After photos are required" });
      }
      
      beforeBuffer = req.files.beforePhoto[0].buffer;
      beforeMime = req.files.beforePhoto[0].mimetype;
      afterBuffer = req.files.afterPhoto[0].buffer;
      afterMime = req.files.afterPhoto[0].mimetype;
    }

    // Call Vision AI
    const result = await verifyMaintenanceImages(beforeBuffer, beforeMime, afterBuffer, afterMime);

    if (result.verdict === 'verified') {
      db.tasks[taskIndex].status = "VERIFIED";
      db.tasks[taskIndex].aiResponse = result;
      db.tasks[taskIndex].verificationTime = new Date().toISOString();
      
      addTimelineEvent(db, `AI Verification PASSED: ${result.before_condition} → ${result.after_condition}`, "success");

      // UPDATE DIGITAL TWIN CAPACITY
      const drainIndex = db.drains.findIndex(d => d.id === task.drainId);
      if (drainIndex !== -1) {
        const oldCapacityPct = db.drains[drainIndex].effectiveCapacityPct;
        const newCapacityPct = 95; // Clear blockage yields 95% capacity
        
        db.drains[drainIndex].effectiveCapacityPct = newCapacityPct;
        db.drains[drainIndex].effectiveCapacity = parseFloat(
          ((db.drains[drainIndex].theoreticalCapacity * newCapacityPct) / 100).toFixed(2)
        );
        db.drains[drainIndex].blockageCondition = "Clear";
        db.drains[drainIndex].maintenanceStatus = "VERIFIED";
        db.drains[drainIndex].lastMaintenanceDaysAgo = 0;

        addTimelineEvent(db, `Drain ${task.drainId} twin capacity updated: ${oldCapacityPct}% → ${newCapacityPct}%`, "success");

        // Recalculate simulation state
        db.drains = runDrainageSimulation(db.drains, db.weather ? db.weather.currentRain : 0);
        
        const newStatus = db.drains[drainIndex].status;
        addTimelineEvent(db, `Recalculated flood risk: ${task.drainId} risk status is now ${newStatus.toUpperCase()}`, "success");
      }
    } else {
      db.tasks[taskIndex].status = "FAILED";
      db.tasks[taskIndex].aiResponse = result;
      addTimelineEvent(db, `AI Verification FAILED: ${result.reason}`, "error");
    }

    writeDb(db);
    res.json({ task: db.tasks[taskIndex], tasks: db.tasks, drains: db.drains, timeline: db.timeline });
  } catch (error) {
    console.error("Verification failed:", error);
    res.status(500).json({ error: error.message || "Failed to process photo verification" });
  }
});

// 6. Reset database
app.post('/api/reset', (req, res) => {
  const db = resetDb();
  res.json(db);
});

// Run server
app.listen(PORT, () => {
  console.log(`Drainage Digital Twin Server running at http://localhost:${PORT}`);
});
