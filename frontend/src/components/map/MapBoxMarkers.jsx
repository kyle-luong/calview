import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

import { logger } from '../../lib/logger';

function createLabeledMarker(event, labelNumber = null) {
  const element = document.createElement('div');
  element.className = 'mapboxgl-marker-label';

  if (event.title === 'Home') {
    element.textContent = '🏠';
    element.style.fontSize = '22px';
    element.style.lineHeight = '1';
    element.style.userSelect = 'none';
    element.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))';
    return new mapboxgl.Marker({ element, anchor: 'bottom' });
  }

  element.style.backgroundColor = 'white';
  element.style.border = '1px solid #888';
  element.style.borderRadius = '6px';
  element.style.padding = '2px 6px';
  element.style.fontSize = '12px';
  element.style.fontWeight = 'bold';
  element.style.whiteSpace = 'nowrap';
  element.style.boxShadow = '0 1px 4px rgb(0,0,0,0.1)';
  // Determine label number: prefer provided labelNumber (1-based),
  // otherwise fall back to event.idx + 1 for backwards compatibility.
  const idxNum = labelNumber != null ? Number(labelNumber) : (Number(event.idx) || 0) + 1;
  element.innerText = `${idxNum}. ${event.title}`;

  return new mapboxgl.Marker({ element });
}

function clearMapMarkers(markers) {
  markers.forEach((marker) => marker.remove());
}

/**
 * Calculate offset position for overlapping markers using a radial/spiderify pattern.
 * Offset scales dynamically with zoom level - markers spread apart more when zoomed in.
 * @param {Object} map - Mapbox map instance
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude  
 * @param {number} seenCount - Number of markers already at this location
 * @param {number} zoom - Current map zoom level
 */
function getOffsetLngLat(map, lng, lat, seenCount, zoom = 14) {
  if (seenCount <= 0) return [lng, lat];

  const center = map.project([lng, lat]);
  
  // Use a simple spiral or circle pattern
  const baseRadius = 15; // Base pixel distance
  const angle = (seenCount - 1) * (Math.PI / 2); // 90 degrees separation
  
  // Expand radius slightly for every 4 items to spiral out
  const spiralFactor = 1 + Math.floor((seenCount - 1) / 4) * 0.3; 
  
  const offsetX = Math.cos(angle) * baseRadius * spiralFactor;
  const offsetY = Math.sin(angle) * baseRadius * spiralFactor;

  const offsetPx = { x: center.x + offsetX, y: center.y + offsetY };
  
  // Convert the pixel offset back to geographic coordinates
  const newLngLat = map.unproject([offsetPx.x, offsetPx.y]);
  return [newLngLat.lng, newLngLat.lat];
}

const MapBoxMarkers = ({ map, segments = [], singleEvents = [], isMapLoaded }) => {
  const markersRef = useRef([]);
  // We use this to prevent refitting bounds every time the component re-renders 
  // if the data hasn't actually changed, but here we reset it on data change.
  const hasInitialFit = useRef(false);

  useEffect(() => {
    if (!map || !isMapLoaded) return;

    // 1. Clear existing markers
    clearMapMarkers(markersRef.current);
    const newMarkers = [];
    const locationCount = new Map(); // Tracks how many markers are at "lng,lat"
    const allCoordinates = []; 
    const addedEventKeys = new Set(); // Tracks unique events to prevent duplicates

    // 2. Build Candidate List
    const allCandidates = [];

    if (segments.length > 0) {
      segments.forEach((pair) => {
        if (pair[0]) allCandidates.push(pair[0]);
      });
      const last = segments[segments.length - 1][1];
      if (last) allCandidates.push(last);
    }

    if (singleEvents && singleEvents.length > 0) {
      singleEvents.forEach((ev) => allCandidates.push(ev));
    }

    // 3. Sort Candidates (Time Based)
    // We sort strictly so the labeling (1, 2, 3) makes sense chronologically
    allCandidates.sort((a, b) => {
      const dateA = a.start_date || '';
      const dateB = b.start_date || '';
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      const timeA = a.start || '';
      const timeB = b.start || '';
      return timeA < timeB ? -1 : timeA > timeB ? 1 : 0;
    });

    // 4. Create Markers
    allCandidates.forEach((event, index) => {
      if (!event || !event.longitude || !event.latitude) return;
      if (event.title === 'Home') {
          // Handle Home separately if needed, or let it fall through logic
          // usually Home doesn't need indexing numbers.
      }

      // Unique Key for this specific event instance
      // We use start time to differentiate the SAME class at DIFFERENT times
      const uniqueEventKey = `${event.title}::${event.start_date}::${event.start}::${event.longitude}::${event.latitude}`;
      
      if (addedEventKeys.has(uniqueEventKey)) return; // Skip exact duplicates
      
      // Location Key for collision detection
      const locKey = `${event.longitude},${event.latitude}`;
      const seenAtLocation = locationCount.get(locKey) || 0;

      // --- CALCULATE OFFSET ---
      const currentZoom = map.getZoom() || 14;
      const targetLngLat = getOffsetLngLat(map, event.longitude, event.latitude, seenAtLocation, currentZoom);

      // Create the marker
      // We pass (index + 1) explicitly so the numbers match the sorted order
      const marker = createLabeledMarker(event, index + 1)
        .setLngLat(targetLngLat)
        .addTo(map);

      newMarkers.push(marker);
      allCoordinates.push([event.longitude, event.latitude]); // Use original coords for bounds
      
      // Update counters
      locationCount.set(locKey, seenAtLocation + 1);
      addedEventKeys.add(uniqueEventKey);
    });

    markersRef.current = newMarkers;

    // 5. Fit Bounds (Restricted)
    if (allCoordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      allCoordinates.forEach((coord) => bounds.extend(coord));

      map.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
        maxZoom: 15, // <--- THIS RESTRICTION PREVENTS OVER-ZOOMING
        pitch: 0,    // Usually better to be flat for initial view, 45 is ok if preferred
        duration: 1000,
      });
    }

    // Cleanup
    return () => clearMapMarkers(markersRef.current);
  }, [map, segments, singleEvents, isMapLoaded]);

  return null;
};

export default MapBoxMarkers;
