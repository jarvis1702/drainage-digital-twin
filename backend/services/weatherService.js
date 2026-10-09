import axios from 'axios';

// Cache weather responses by lat_lon to prevent hitting API rate limits unnecessarily
const weatherCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

export async function fetchWeatherData(lat, lon) {
  const cacheKey = `${parseFloat(lat).toFixed(4)}_${parseFloat(lon).toFixed(4)}`;
  const cached = weatherCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return { ...cached.data, isCached: true };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,rain,showers,weather_code&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=precipitation_sum,precipitation_hours,precipitation_probability_max&timezone=auto`;
    const response = await axios.get(url, { timeout: 8000 });
    
    const parsedData = parseOpenMeteoResponse(response.data);
    
    // Cache the result
    weatherCache.set(cacheKey, {
      timestamp: Date.now(),
      data: parsedData
    });
    
    return parsedData;
  } catch (error) {
    console.error("Open-Meteo API failed, falling back to simulated weather:", error.message);
    return getSimulatedWeather(lat, lon, "API_UNAVAILABLE");
  }
}

function parseOpenMeteoResponse(data) {
  const current = data.current || {};
  const hourly = data.hourly || {};
  
  const currentRain = (current.precipitation || 0); // mm/hr
  const temp = current.temperature_2m || 15;
  const weatherCode = current.weather_code || 0;
  
  // Calculate next 3 hours and next 6 hours precipitation sums
  const hourlyRain = hourly.precipitation || [];
  const next3hRain = hourlyRain.slice(0, 3).reduce((a, b) => a + b, 0);
  const next6hRain = hourlyRain.slice(0, 6).reduce((a, b) => a + b, 0);
  
  // Peak rain intensity in forecast
  const peakRain = Math.max(...hourlyRain.slice(0, 12), currentRain);
  
  // Current precipitation probability
  const currentProb = (hourly.precipitation_probability && hourly.precipitation_probability[0]) || 0;

  return {
    source: "Open-Meteo API",
    status: "LIVE",
    timestamp: new Date().toISOString(),
    temperature: temp,
    currentRain: parseFloat(currentRain.toFixed(2)),
    next3hRain: parseFloat(next3hRain.toFixed(2)),
    next6hRain: parseFloat(next6hRain.toFixed(2)),
    peakIntensity: parseFloat(peakRain.toFixed(2)),
    rainProbability: currentProb,
    weatherCode: weatherCode,
    weatherCondition: getWeatherConditionByCode(weatherCode),
    forecastDuration: 24, // hours
  };
}

export function getSimulatedWeather(lat, lon, reason = "USER_REQUESTED") {
  // Generate slightly deterministic weather based on lat/lng coordinates
  const coordSum = Math.abs(parseFloat(lat) + parseFloat(lon));
  const isRainyLocation = (coordSum % 2) > 0.8; 
  
  const currentRain = isRainyLocation ? (coordSum % 5) + 1 : 0;
  const peakIntensity = isRainyLocation ? currentRain + 3 : 0.5;
  const next3hRain = currentRain * 2.8;
  const next6hRain = currentRain * 5.2;

  return {
    source: `Open-Meteo Simulated (Fallback: ${reason})`,
    status: "SIMULATED",
    timestamp: new Date().toISOString(),
    temperature: Math.round(15 + (coordSum % 15)),
    currentRain: parseFloat(currentRain.toFixed(2)),
    next3hRain: parseFloat(next3hRain.toFixed(2)),
    next6hRain: parseFloat(next6hRain.toFixed(2)),
    peakIntensity: parseFloat(peakIntensity.toFixed(2)),
    rainProbability: isRainyLocation ? 80 : 15,
    weatherCode: isRainyLocation ? 61 : 1,
    weatherCondition: isRainyLocation ? "Moderate Rain" : "Partly Cloudy",
    forecastDuration: 24
  };
}

function getWeatherConditionByCode(code) {
  if (code === 0) return "Clear Sky";
  if (code >= 1 && code <= 3) return "Partly Cloudy";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing Drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain Showers";
  if (code >= 85 && code <= 86) return "Snow Showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Overcast";
}

export async function fetchHistoricalRainCustom(lat, lon, startDate, endDate) {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum&timezone=auto`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'DrainageDigitalTwinHackathonPrototype/1.0'
      },
      timeout: 8000
    });
    
    if (response.data && response.data.daily) {
      const daily = response.data.daily;
      return daily.time.map((time, idx) => ({
        date: time,
        rainSum: daily.precipitation_sum[idx] || 0,
        rainRate: parseFloat(((daily.precipitation_sum[idx] || 0) / 24).toFixed(2))
      }));
    }
    throw new Error("No data returned");
  } catch (error) {
    console.error("Failed to fetch custom historical weather:", error.message);
    throw error;
  }
}

export async function fetchHistoricalRain(lat, lon) {
  try {
    const today = new Date();
    const lastYear = today.getFullYear() - 1;
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = String(today.getDate()).padStart(2, '0');

    const endDate = `${lastYear}-${month}-${date}`;

    const startDateObj = new Date(today);
    startDateObj.setFullYear(lastYear);
    startDateObj.setDate(startDateObj.getDate() - 7);
    const startYear = startDateObj.getFullYear();
    const startMonth = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const startDateDay = String(startDateObj.getDate()).padStart(2, '0');
    const startDate = `${startYear}-${startMonth}-${startDateDay}`;

    return await fetchHistoricalRainCustom(lat, lon, startDate, endDate);
  } catch (error) {
    console.error("Failed to fetch real historical weather, using fallback:", error.message);
    return [
      { date: "2025-08-12", rainSum: 14.5, rainRate: 0.6 },
      { date: "2025-08-13", rainSum: 45.2, rainRate: 1.88 },
      { date: "2025-08-14", rainSum: 0.0, rainRate: 0.0 },
      { date: "2025-08-15", rainSum: 78.4, rainRate: 3.27 },
      { date: "2025-08-16", rainSum: 12.1, rainRate: 0.5 },
      { date: "2025-08-17", rainSum: 3.0, rainRate: 0.12 },
      { date: "2025-08-18", rainSum: 0.0, rainRate: 0.0 }
    ];
  }
}


