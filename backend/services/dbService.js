import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const defaultState = {
  location: {
    lat: null,
    lng: null,
    name: "No location selected",
    lastUpdated: null
  },
  drains: [],
  tasks: [],
  timeline: [],
  weather: null,
  historicalRain: []
};

// Ensure database directory and file exist
export function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
  }
}

export function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.historicalRain) {
      parsed.historicalRain = [];
    }
    return parsed;
  } catch (error) {
    console.error("Error reading database file:", error);
    return defaultState;
  }
}

export function writeDb(data) {
  initDb();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error("Error writing to database file:", error);
    return false;
  }
}

export function resetDb() {
  writeDb(defaultState);
  return defaultState;
}
