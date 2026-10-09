import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapComponent({ location, drains, roads, waterways, waterBodies, selectedDrain, onSelectDrain }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({
    roadsGroup: null,
    waterwaysGroup: null,
    drainsGroup: null,
    activeMarkerGlow: null
  });

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Create Leaflet map centered on location
    const center = [location.lat || 0, location.lng || 0];
    const zoom = 15;

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true
    });

    // Use Esri World Imagery tiles for a satellite view
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    // Initialize Layer Groups
    layersRef.current.roadsGroup = L.layerGroup().addTo(map);
    layersRef.current.waterwaysGroup = L.layerGroup().addTo(map);
    layersRef.current.drainsGroup = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Fly to location when it changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !location.lat || !location.lng) return;

    map.flyTo([location.lat, location.lng], 15, {
      animate: true,
      duration: 1.5
    });
  }, [location.lat, location.lng]);

  // 3. Render Roads, Waterways, Waterbodies
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const { roadsGroup, waterwaysGroup } = layersRef.current;
    
    // Clear old lines
    roadsGroup.clearLayers();
    waterwaysGroup.clearLayers();

    // Draw Roads (Slate-grey lines)
    if (roads && roads.length > 0) {
      roads.forEach(road => {
        L.polyline(road.coordinates, {
          color: '#475569',
          weight: 2.5,
          opacity: 0.45,
          lineJoin: 'round'
        }).addTo(roadsGroup);
      });
    }

    // Draw Waterways (Neon Cyan lines)
    if (waterways && waterways.length > 0) {
      waterways.forEach(canal => {
        L.polyline(canal.coordinates, {
          color: '#06B6D4',
          weight: 4,
          opacity: 0.8,
          lineJoin: 'round'
        }).addTo(waterwaysGroup);
      });
    }

    // Draw Waterbodies (Emerald/Cyan fills)
    if (waterBodies && waterBodies.length > 0) {
      waterBodies.forEach(body => {
        L.polygon(body.coordinates, {
          color: '#0E7490',
          fillColor: '#06B6D4',
          fillOpacity: 0.25,
          weight: 1
        }).addTo(waterwaysGroup);
      });
    }

  }, [roads, waterways, waterBodies]);

  // 4. Render Drains (Status Markers)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const { drainsGroup } = layersRef.current;
    drainsGroup.clearLayers();

    drains.forEach(drain => {
      // Choose colors and pulse styling based on status
      let colorClass = 'bg-emerald-500 shadow-glowEmerald';
      let pulseClass = '';
      let borderClass = 'border-emerald-300';
      let size = 'w-4 h-4';

      if (drain.status === 'Overflow') {
        colorClass = 'bg-rose-500 shadow-glowRose marker-pulse-red';
        borderClass = 'border-rose-200';
        size = 'w-5 h-5';
      } else if (drain.status === 'Stressed') {
        colorClass = 'bg-amber-500 shadow-glow marker-pulse-yellow';
        borderClass = 'border-amber-200';
        size = 'w-[18px] h-[18px]';
      }

      // Special visual indicator if selected
      const isSelected = selectedDrain && selectedDrain.id === drain.id;
      const selectionRing = isSelected 
        ? 'ring-4 ring-blue-500 ring-opacity-60 scale-125' 
        : '';

      // Create Custom HTML Div Icon
      const icon = L.divIcon({
        className: 'custom-drain-icon',
        html: `
          <div class="relative flex items-center justify-center ${size} transition-all duration-300 transform ${selectionRing}">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-75 ${colorClass}"></span>
            <span class="relative inline-flex rounded-full ${size} ${colorClass} border-2 ${borderClass}"></span>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([drain.latitude, drain.longitude], { icon })
        .addTo(drainsGroup);

      // Tooltip on Hover
      marker.bindTooltip(`
        <div class="text-xs font-semibold px-1">
          <div class="text-slate-300">${drain.id} (${drain.drainType})</div>
          <div class="mt-0.5 flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full ${drain.status === 'Overflow' ? 'bg-rose-500' : drain.status === 'Stressed' ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
            <span class="capitalize text-slate-100">${drain.status === 'Overflow' ? 'Overflow Risk' : drain.status}</span>
          </div>
          <div class="text-[10px] text-slate-400 mt-0.5">Cap: ${Math.round(drain.effectiveCapacity)}/${drain.theoreticalCapacity} m³/h</div>
        </div>
      `, {
        direction: 'top',
        offset: [0, -10],
        opacity: 0.95
      });

      // Click to select
      marker.on('click', () => {
        onSelectDrain(drain);
      });
    });

  }, [drains, selectedDrain, onSelectDrain]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-darkBorder shadow-glass">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '400px' }} />
      
      {/* Small floating map controls / key */}
      <div className="absolute bottom-3 left-3 z-[1000] glass-panel p-3 rounded-lg border border-white/10 flex flex-col gap-1.5 text-xs text-slate-300">
        <div className="font-semibold text-slate-100 mb-1 border-b border-white/5 pb-1">Asset Status Key</div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          <span>Safe (Runoff &lt; 70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 marker-pulse-yellow inline-block"></span>
          <span>Stressed (Runoff 70%-100%)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 marker-pulse-red inline-block"></span>
          <span>Overflow (Runoff &gt; Capacity)</span>
        </div>
      </div>
    </div>
  );
}
