import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Bounding box delta (~1km radius)
const BBOX_DELTA = 0.008;

export async function geocodeLocation(query) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=en`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'DrainageDigitalTwinHackathonPrototype/1.0'
      },
      timeout: 5000
    });
    
    if (response.data && response.data.length > 0) {
      const first = response.data[0];
      return {
        lat: parseFloat(first.lat),
        lng: parseFloat(first.lon),
        name: first.display_name
      };
    }
    throw new Error("Location not found");
  } catch (error) {
    console.warn("Geocoding API failed, using local dictionary fallback:", error.message);
    
    // Check if it's direct coordinates: e.g. "28.6139, 77.2090"
    const coordsMatch = query.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coordsMatch) {
      return {
        lat: parseFloat(coordsMatch[1]),
        lng: parseFloat(coordsMatch[2]),
        name: `Coordinates: ${coordsMatch[1]}, ${coordsMatch[2]}`
      };
    }

    // Common city mapping fallback
    const q = query.toLowerCase().trim();
    if (q.includes("delhi")) {
      return { lat: 28.6139, lng: 77.2090, name: "New Delhi, Delhi, India (Archive Fallback)" };
    } else if (q.includes("mumbai")) {
      return { lat: 19.0760, lng: 72.8777, name: "Mumbai, Maharashtra, India (Archive Fallback)" };
    } else if (q.includes("chennai")) {
      return { lat: 13.0827, lng: 80.2707, name: "Chennai, Tamil Nadu, India (Archive Fallback)" };
    } else if (q.includes("coimbatore")) {
      return { lat: 11.0168, lng: 76.9558, name: "Coimbatore, Tamil Nadu, India (Archive Fallback)" };
    } else if (q.includes("hyderabad")) {
      return { lat: 17.3850, lng: 78.4867, name: "Hyderabad, Telangana, India (Archive Fallback)" };
    } else if (q.includes("kolkata")) {
      return { lat: 22.5726, lng: 88.3639, name: "Kolkata, West Bengal, India (Archive Fallback)" };
    } else if (q.includes("bangalore") || q.includes("bengaluru")) {
      return { lat: 12.9716, lng: 77.5946, name: "Bengaluru, Karnataka, India (Archive Fallback)" };
    } else if (q.includes("tokyo")) {
      return { lat: 35.6762, lng: 139.6503, name: "Tokyo, Japan (Archive Fallback)" };
    } else if (q.includes("paris")) {
      return { lat: 48.8566, lng: 2.3522, name: "Paris, France (Archive Fallback)" };
    }
    
    // Ultimate default fallback to avoid crashes
    return { 
      lat: 28.6139, 
      lng: 77.2090, 
      name: `${query} (Defaulting to New Delhi Fallback)` 
    };
  }
}

export async function fetchGeoFeaturesAndDrains(lat, lng) {
  let roads = [];
  let waterways = [];
  let waterBodies = [];
  let overpassStatus = "LIVE";

  try {
    const minLat = lat - BBOX_DELTA;
    const minLng = lng - BBOX_DELTA;
    const maxLat = lat + BBOX_DELTA;
    const maxLng = lng + BBOX_DELTA;
    
    const query = `
      [out:json][timeout:10];
      (
        way["highway"](${minLat},${minLng},${maxLat},${maxLng});
        way["waterway"](${minLat},${minLng},${maxLat},${maxLng});
        way["natural"="water"](${minLat},${minLng},${maxLat},${maxLng});
      );
      out geom;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const response = await axios.get(url, { timeout: 8000 });
    
    if (response.data && response.data.elements) {
      response.data.elements.forEach(el => {
        if (el.type === 'way') {
          const coords = el.geometry ? el.geometry.map(pt => [pt.lat, pt.lon]) : [];
          if (coords.length > 1) {
            if (el.tags.highway) {
              roads.push({ id: el.id, coordinates: coords, name: el.tags.name || "Road" });
            } else if (el.tags.waterway) {
              waterways.push({ id: el.id, coordinates: coords, name: el.tags.name || "Waterway" });
            } else if (el.tags.natural === 'water' || el.tags.landuse === 'basin') {
              waterBodies.push({ id: el.id, coordinates: coords, name: el.tags.name || "Water Body" });
            }
          }
        }
      });
    }
    
    if (roads.length === 0 && waterways.length === 0) {
      overpassStatus = "EMPTY_RESULT";
    }
  } catch (error) {
    console.warn("Overpass API query failed, using procedural generation:", error.message);
    overpassStatus = "API_UNAVAILABLE";
  }

  // If live query yielded nothing or failed, generate procedural fallback geography
  if (overpassStatus === "API_UNAVAILABLE" || overpassStatus === "EMPTY_RESULT") {
    const fallback = generateFallbackGeography(lat, lng);
    roads = fallback.roads;
    waterways = fallback.waterways;
    waterBodies = fallback.waterBodies;
  }

  // Generate 15-20 drainage assets strategically distributed along roads and waterways
  const drains = generateDrainageAssets(lat, lng, roads, waterways);

  return {
    overpassStatus,
    roads,
    waterways,
    waterBodies,
    drains
  };
}

function generateFallbackGeography(centerLat, centerLng) {
  const roads = [];
  const waterways = [];
  const waterBodies = [];

  // Deterministic seed based on coordinates
  const seed = Math.abs(Math.sin(centerLat) * Math.cos(centerLng) * 100000);
  let currentSeed = seed;
  
  function seededRandom() {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  }

  // Generate 8-12 custom road segments
  const numRoads = 10 + Math.floor(seededRandom() * 5);
  const offsetRange = 0.008;

  for (let i = 0; i < numRoads; i++) {
    const startLat = centerLat + (seededRandom() - 0.5) * offsetRange * 1.5;
    const startLng = centerLng + (seededRandom() - 0.5) * offsetRange * 1.5;
    
    const type = seededRandom();
    let endLat, endLng;
    
    if (type < 0.4) {
      // Horizontal-ish
      endLat = startLat + (seededRandom() - 0.5) * 0.001;
      endLng = startLng + (0.003 + seededRandom() * 0.005);
    } else if (type < 0.8) {
      // Vertical-ish
      endLat = startLat + (0.003 + seededRandom() * 0.005);
      endLng = startLng + (seededRandom() - 0.5) * 0.001;
    } else {
      // Diagonal
      endLat = startLat + (seededRandom() - 0.5) * 0.006;
      endLng = startLng + (seededRandom() - 0.5) * 0.006;
    }

    roads.push({
      id: `road-gen-${i}`,
      name: `Street ${100 + i}`,
      coordinates: [
        [startLat, startLng],
        [endLat, endLng]
      ]
    });
  }

  // Generate 1-2 waterways
  const numWaterways = 1 + Math.floor(seededRandom() * 2);
  for (let w = 0; w < numWaterways; w++) {
    const coords = [];
    let curLat = centerLat - offsetRange;
    let curLng = centerLng + (seededRandom() - 0.5) * offsetRange * 1.5;
    coords.push([curLat, curLng]);
    
    for (let s = 0; s < 3; s++) {
      curLat += offsetRange * 0.6;
      curLng += (seededRandom() - 0.5) * offsetRange * 0.8;
      coords.push([curLat, curLng]);
    }
    
    waterways.push({
      id: `canal-gen-${w}`,
      name: `Canal ${w === 0 ? "Alpha" : "Beta"}`,
      coordinates: coords
    });
  }

  return { roads, waterways, waterBodies };
}


function generateDrainageAssets(centerLat, centerLng, roads, waterways) {
  const drains = [];
  const drainTypes = ["Grate Inlet", "Catch Basin", "Culvert", "Open Channel", "Outfall"];
  const numDrains = 18;
  
  // Deterministic seed helper based on coordinate summing
  const getSeed = (idx) => Math.abs(Math.sin(centerLat + centerLng + idx));

  // Place D-27 specifically as our high-priority target for the demo!
  const d27Lat = centerLat + 0.0015;
  const d27Lng = centerLng - 0.002;
  
  drains.push({
    id: "D-27",
    latitude: parseFloat(d27Lat.toFixed(6)),
    longitude: parseFloat(d27Lng.toFixed(6)),
    drainType: "Catch Basin",
    theoreticalCapacity: 160, // m3/hr
    effectiveCapacityPct: 52, // degraded to 52%
    effectiveCapacity: 83.2, // theoretical * 52%
    catchmentArea: 9500, // sq meters
    runoffCoefficient: 0.85, // highly impervious urban
    elevation: "Low",
    lastMaintenanceDaysAgo: 42,
    historicalIncidents: 4,
    blockageCondition: "Severely Blocked",
    maintenanceStatus: "NONE",
    notes: "Located near commercial intersection. Prone to leaf/silt blockage."
  });

  // Generate the rest
  for (let i = 1; i < numDrains; i++) {
    const seed1 = getSeed(i);
    const seed2 = getSeed(i + 50);
    const seed3 = getSeed(i + 100);

    // Pick a point from a road or waterway to make it look realistic, otherwise use random offset
    let lat = centerLat;
    let lng = centerLng;

    if (roads.length > 0 && i % 2 === 0) {
      const roadIdx = Math.floor(seed1 * roads.length);
      const road = roads[roadIdx];
      const ptIdx = Math.floor(seed2 * road.coordinates.length);
      const roadPt = road.coordinates[ptIdx];
      // Offset slightly from the road centerline
      lat = roadPt[0] + (seed3 - 0.5) * 0.0003;
      lng = roadPt[1] + (seed1 - 0.5) * 0.0003;
    } else if (waterways.length > 0 && i % 3 === 0) {
      const waterIdx = Math.floor(seed1 * waterways.length);
      const canal = waterways[waterIdx];
      const ptIdx = Math.floor(seed2 * canal.coordinates.length);
      const canalPt = canal.coordinates[ptIdx];
      lat = canalPt[0];
      lng = canalPt[1];
    } else {
      // Direct random offset
      lat = centerLat + (seed1 - 0.5) * 0.01;
      lng = centerLng + (seed2 - 0.5) * 0.01;
    }

    const id = `D-${i + 10}`; // e.g. D-11, D-12...
    if (id === "D-27") continue; // skip if collision (which is unlikely but let's be safe)

    const drainType = drainTypes[Math.floor(seed3 * drainTypes.length)];
    const theoreticalCapacity = Math.round(80 + seed1 * 120); // 80 to 200 m3/hr
    
    // Some drains start degraded, some are clean
    const isDegraded = seed2 > 0.65;
    const effectiveCapacityPct = isDegraded ? Math.round(40 + seed3 * 30) : 100;
    
    const catchmentArea = Math.round(2000 + seed1 * 10000); // 2000 to 12000 sqm
    
    // Coefficients mapping
    const coefRand = seed2;
    let runoffCoefficient = 0.60; // mixed
    if (coefRand < 0.3) runoffCoefficient = 0.25; // vegetated
    else if (coefRand > 0.7) runoffCoefficient = 0.85; // highly impervious

    let elevation = "Medium";
    if (seed3 < 0.25) elevation = "Low";
    else if (seed3 > 0.75) elevation = "High";

    const lastMaintenanceDaysAgo = Math.round(5 + seed2 * 115);
    const historicalIncidents = Math.floor(seed3 * 5);

    let blockageCondition = "Clear";
    if (effectiveCapacityPct < 60) blockageCondition = "Severely Blocked";
    else if (effectiveCapacityPct < 90) blockageCondition = "Partially Blocked";

    drains.push({
      id,
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lng.toFixed(6)),
      drainType,
      theoreticalCapacity,
      effectiveCapacityPct,
      effectiveCapacity: parseFloat(((theoreticalCapacity * effectiveCapacityPct) / 100).toFixed(2)),
      catchmentArea,
      runoffCoefficient,
      elevation,
      lastMaintenanceDaysAgo,
      historicalIncidents,
      blockageCondition,
      maintenanceStatus: "NONE",
      notes: `Asset serving catchment of ${catchmentArea} sqm.`
    });
  }

  return drains;
}
