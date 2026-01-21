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
 * Calculate offset position for overlapping markers using a radial pattern.
 * Instead of just stacking vertically, markers spread out in a circle for better visibility.
 */
function getOffsetLngLat(map, lng, lat, seenCount) {
  if (seenCount <= 0) return [lng, lat];

  const center = map.project([lng, lat]);

  // Radial offset pattern: spread markers in a circle
  // First marker at seenCount=1 goes right, then down, left, up, and spiral out
  const radius = 20; // pixels from center
  const angle = (seenCount - 1) * (Math.PI / 2); // 90 degrees apart
  const spiralFactor = 1 + Math.floor((seenCount - 1) / 4) * 0.5; // Expand radius for each full rotation

  const offsetX = Math.cos(angle) * radius * spiralFactor;
  const offsetY = Math.sin(angle) * radius * spiralFactor;

  const offsetPx = { x: center.x + offsetX, y: center.y + offsetY };
  const newLngLat = map.unproject([offsetPx.x, offsetPx.y]);
  return [newLngLat.lng, newLngLat.lat];
}

const MapBoxMarkers = ({ map, segments = [], singleEvents = [], isMapLoaded }) => {
  const markersRef = useRef([]);
  const hasInitialFit = useRef(false);

  useEffect(() => {
    if (!map || !isMapLoaded) return;

    clearMapMarkers(markersRef.current);
    const newMarkers = [];
    const locationCount = new Map();
    const allCoordinates = []; // Track all coordinates for fitBounds

    const addedKeys = new Set();

    // Build stable label mapping for class events (exclude Home) so labels
    // remain consistent even when a starting point is added/removed.
    const labelMap = new Map();
    const seenLabelKeys = new Set();
    const allCandidates = [];

    // Collect events from segments
    if (segments.length > 0) {
      segments.forEach((pair) => {
        if (pair[0]) allCandidates.push(pair[0]);
      });
      const last = segments[segments.length - 1][1];
      if (last) allCandidates.push(last);
    }

    // Include singleEvents
    if (singleEvents && singleEvents.length > 0) {
      singleEvents.forEach((ev) => allCandidates.push(ev));
    }

    // Deduplicate and filter out Home markers
    const stableList = [];
    allCandidates.forEach((ev) => {
      if (!ev) return;
      if (ev.title === 'Home') return;
      const k = `${ev.title || ''}::${ev.start_date || ev.start || ''}::${ev.longitude || ''}::${ev.latitude || ''}`;
      if (seenLabelKeys.has(k)) return;
      seenLabelKeys.add(k);
      stableList.push(ev);
    });

    // Sort chronologically: by date first, then by start time within each day
    // This ensures events are numbered in the order they occur
    stableList.sort((a, b) => {
      const dateA = a.start_date || '';
      const dateB = b.start_date || '';
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      // Same date: sort by start time
      const timeA = a.start || '';
      const timeB = b.start || '';
      return timeA < timeB ? -1 : timeA > timeB ? 1 : 0;
    });

    stableList.forEach((ev, i) => {
      const k = `${ev.title || ''}::${ev.start_date || ev.start || ''}::${ev.longitude || ''}::${ev.latitude || ''}`;
      labelMap.set(k, i + 1); // 1-based labels
    });

    const addMarkerAt = (event) => {
      if (!event.longitude || !event.latitude) return;
      const key = `${event.longitude},${event.latitude}`;
      // Avoid adding duplicate markers for the same event/location
      const dedupeKey = `${key}:${event.title || ''}`;
      if (addedKeys.has(dedupeKey)) return;

      const seen = locationCount.get(key) || 0;
      // If a marker already exists at this exact coordinate and title, skip
      if (seen > 0 && addedKeys.has(key)) return;

      const targetLngLat = getOffsetLngLat(map, event.longitude, event.latitude, seen);

      // Determine stable label number if available
      const labelKey = `${event.title || ''}::${event.start_date || event.start || ''}::${event.longitude || ''}::${event.latitude || ''}`;
      const labelNumber = labelMap.get(labelKey) || null;

      const marker = createLabeledMarker(event, labelNumber).setLngLat(targetLngLat).addTo(map);
      newMarkers.push(marker);
      allCoordinates.push([event.longitude, event.latitude]);
      locationCount.set(key, seen + 1);
      addedKeys.add(dedupeKey);
      addedKeys.add(key);
    };

    try {
      // Segment markers
      if (segments.length > 0) {
        segments.forEach((pair, i) => {
          if (pair[0]) {
            pair[0].idx = i;
            addMarkerAt(pair[0]);
          }
        });
        const last = segments[segments.length - 1][1];
        last.idx = segments.length;
        if (last) addMarkerAt(last);
      }

      // Single events
      if (singleEvents.length > 0) {
        singleEvents.forEach((event) => {
          addMarkerAt(event);
        });
      }

      markersRef.current = newMarkers;

      // Fit map to show all markers
      if (allCoordinates.length > 0) {
        if (allCoordinates.length === 1) {
          // Single marker - center on it
          map.flyTo({
            center: allCoordinates[0],
            zoom: 16,
            pitch: 45,
            bearing: 0,
            duration: 1000,
          });
        } else {
          // Multiple markers - fit bounds to show all
          const bounds = new mapboxgl.LngLatBounds();
          allCoordinates.forEach((coord) => bounds.extend(coord));

          map.fitBounds(bounds, {
            padding: { top: 80, bottom: 80, left: 80, right: 80 },
            maxZoom: 16,
            pitch: 45,
            bearing: 0,
            duration: 1000,
          });
        }
        hasInitialFit.current = true;
      }
    } catch (err) {
      logger.error('Error adding markers:', err);
    }

    return () => clearMapMarkers(markersRef.current);
  }, [map, segments, singleEvents, isMapLoaded]);

  return null;
};

export default MapBoxMarkers;
