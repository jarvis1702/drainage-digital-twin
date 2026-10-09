const API_BASE = 'http://localhost:5000/api';

export async function fetchState() {
  const res = await fetch(`${API_BASE}/state`);
  if (!res.ok) throw new Error("Failed to load digital twin state");
  return res.json();
}

export async function searchLocation(query) {
  const res = await fetch(`${API_BASE}/location/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to search location");
  }
  return res.json();
}

export async function updateRainfall(currentRain, isSimulated, duration = 3) {
  const res = await fetch(`${API_BASE}/rainfall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentRain, isSimulated, simulatedDuration: duration })
  });
  if (!res.ok) throw new Error("Failed to update rainfall scenario");
  return res.json();
}

export async function assignTask(taskId, payload) {
  const res = await fetch(`${API_BASE}/tasks/${taskId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Failed to assign maintenance worker");
  return res.json();
}

export async function verifyTask(taskId, beforePhoto, afterPhoto, reportedLocation, isDemo = false) {
  const formData = new FormData();
  formData.append('isDemo', isDemo);
  formData.append('reportedLocation', reportedLocation);
  
  if (!isDemo) {
    if (beforePhoto) formData.append('beforePhoto', beforePhoto);
    if (afterPhoto) formData.append('afterPhoto', afterPhoto);
  }

  const res = await fetch(`${API_BASE}/tasks/${taskId}/verify`, {
    method: 'POST',
    body: formData // Content-Type header is set automatically by the browser with multipart boundaries
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "AI verification failed");
  }
  
  return res.json();
}

export async function resetDatabase() {
  const res = await fetch(`${API_BASE}/reset`, { method: 'POST' });
  if (!res.ok) throw new Error("Failed to reset database");
  return res.json();
}

export async function fetchCustomHistory(lat, lon, startDate, endDate) {
  const res = await fetch(`${API_BASE}/weather/historical?lat=${lat}&lon=${lon}&startDate=${startDate}&endDate=${endDate}`);
  if (!res.ok) throw new Error("Failed to fetch custom weather archive");
  return res.json();
}
