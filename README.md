# Drainage Digital Twin 💧

An AI-powered, location-agnostic urban drainage management platform designed for predictive flood prevention, maintenance routing, and automated visual work verification.

---

## 1. Problem
Traditional municipal stormwater drainage management is reactive. Operations teams respond only after streets flood, causing traffic disruptions, property damage, and safety hazards. 

Flooding is often not a structural failure but a maintenance one: catch basins, grates, and inlets get clogged with leaf litter, trash, and silt, reducing their capacity. 

By combining real-time rainfall forecasts with the degraded capacity models of individual drainage assets, we can proactively predict flooding risk and resolve blockages *before* the rain causes overflow.

---

## 2. Solution: The Drainage Digital Twin
Our prototype introduces a complete closed-loop workflow:
1. **Predict**: Uses Open-Meteo rainfall intensity forecast to estimate catchment runoff.
2. **Detect**: Identifies degraded drainage assets (low effective capacity) that will fail under expected runoff.
3. **Assign**: Automatically flags blockages and coordinates worker dispatches with digital work orders.
4. **Verify**: Workers upload Before/After photos of the asset.
5. **Update**: A Vision-capable Large Language Model (Google Gemini AI) inspects the photos. Upon validation, the asset's digital twin capacity is restored to 95% in real-time.
6. **Improve**: The map dynamically recalculates flood risk, showing the hazard resolved.

---

## 3. Architecture Flow
```text
Live Weather (Open-Meteo) 
      ↓
Runoff Estimation (Rational Method)
      ↓
Drainage Digital Twin State (db.json)
      ↓
Risk Analysis (Safe / Stressed / Overflow)
      ↓
Maintenance Crew Dispatch
      ↓
Multimodal AI Verification (Google Gemini)
      ↓
Twin Capacity Update & Recalculation
```

---

## 4. Data Sources

| Layer | Source | Type | Description |
| :--- | :--- | :--- | :--- |
| **Weather** | Open-Meteo API | 🟢 **LIVE** | Precipitation rate, 3h sum, peak intensity |
| **Geographic Features** | OSM / Overpass API | 🟢 **LIVE** | Roads, rivers, and water bodies around coordinates |
| **Drainage Capacity** | Digital Twin Engine | 🟡 **SIMULATED** | Theoretical capacity, blockage ratios |
| **Incident Logs** | Local JSON Database | 🟡 **SIMULATED** | Historical flood frequency, timeline history |
| **Photo Inspection** | Google Gemini 1.5 Flash | 🤖 **AI-GENERATED** | Before/After image comparison & clearing verdict |

---

## 5. Environment Variables
To enable live AI image verification, create a `.env` file in the project root:
```env
AI_API_KEY=your_gemini_api_key_here
PORT=5000
```
*Note: If no API key is specified, the server will output console warnings and run in simulated verification mode, ensuring the guided demo operates successfully without external key dependencies.*

---

## 6. How to Run Locally

### Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### Setup and Start
1. Clone or open the repository.
2. Install all dependencies from the root directory:
   ```bash
   npm run install-all
   ```
3. Start both backend and frontend development servers concurrently:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:5000`

---

## 7. Limitations
Real-time, municipal stormwater pipe dimensions, silt levels, and storm drain locations are rarely available via public APIs. In this prototype, we query OSM roads and canals using the Overpass API to map realistic pathways, then procedurally generate and distribute drainage markers along those paths. 

Reverse-forensics metadata checking and GPS coordinates matching from images are simulated for this hackathon prototype and would require native field app APIs in production.
