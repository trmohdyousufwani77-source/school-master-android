import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  X,
  ShieldCheck,
  AlertTriangle,
  Navigation,
  School,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Compass,
  Radio,
  Layers,
} from 'lucide-react';

export interface CheckInLocationData {
  personName: string;
  role: 'Teacher' | 'Student' | 'Staff';
  identifier?: string; // Roll Number or Employee ID
  status: string;
  time?: string;
  date: string;
  latitude: number;
  longitude: number;
  distanceFromSchoolMeters?: number;
  isWithinBoundary?: boolean;
  accuracyMeters?: number;
  schoolName: string;
  schoolLatitude?: number;
  schoolLongitude?: number;
  geofenceRadiusMeters?: number;
  schoolAddress?: string;
}

interface LocationMapModalProps {
  locationData: CheckInLocationData | null;
  onClose: () => void;
  language?: 'en' | 'ur';
}

export const LocationMapModal: React.FC<LocationMapModalProps> = ({
  locationData,
  onClose,
  language = 'en',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [copied, setCopied] = useState(false);
  const [mapStyle, setMapStyle] = useState<'osm' | 'topo' | 'radar'>('osm');
  const [isExpanded, setIsExpanded] = useState(false);

  if (!locationData) return null;

  const {
    personName,
    role,
    identifier,
    status,
    time,
    date,
    latitude,
    longitude,
    distanceFromSchoolMeters = 0,
    isWithinBoundary = true,
    accuracyMeters = 5,
    schoolName,
    schoolLatitude,
    schoolLongitude,
    geofenceRadiusMeters = 250,
    schoolAddress,
  } = locationData;

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;

  const handleCopyCoordinates = () => {
    navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up previous instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    if (mapStyle === 'radar') return;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 17,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true,
      });

      // Tile Layer selection
      const tileUrl =
        mapStyle === 'topo'
          ? 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
          : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      });
      tileLayer.addTo(map);

      // School Campus Geofence Boundary Circle & Marker
      if (schoolLatitude !== undefined && schoolLongitude !== undefined) {
        // Geofence Circle
        L.circle([schoolLatitude, schoolLongitude], {
          radius: geofenceRadiusMeters,
          color: '#10b981',
          weight: 2,
          fillColor: '#10b981',
          fillOpacity: 0.12,
          dashArray: '5, 8',
        }).addTo(map);

        // School Icon Marker
        const schoolIcon = L.divIcon({
          className: 'bg-transparent',
          html: `
            <div style="background-color: #1e293b; color: white; padding: 6px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid #6366f1; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m4 6 8-4 8 4"/>
                <path d="m18 10 4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2"/>
                <path d="M14 22v-4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v4"/>
                <path d="M18 5v17"/>
                <path d="M6 5v17"/>
              </svg>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const schoolMarker = L.marker([schoolLatitude, schoolLongitude], { icon: schoolIcon }).addTo(map);
        schoolMarker.bindPopup(`
          <div style="font-family: inherit; font-size: 11px; padding: 2px;">
            <div style="font-weight: 800; color: #0f172a;">${schoolName}</div>
            <div style="color: #64748b; font-size: 10px;">Official Campus Center</div>
            <div style="color: #10b981; font-weight: 700; margin-top: 4px;">Geofence: ${geofenceRadiusMeters}m radius</div>
          </div>
        `);

        // Distance Vector Line between School and Check-In Pin
        L.polyline([[schoolLatitude, schoolLongitude], [latitude, longitude]], {
          color: isWithinBoundary ? '#10b981' : '#f59e0b',
          weight: 2.5,
          dashArray: '6, 6',
          opacity: 0.85,
        }).addTo(map);

        // Fit bounds to show both school and check-in location comfortably
        const bounds = L.latLngBounds([
          [latitude, longitude],
          [schoolLatitude, schoolLongitude],
        ]);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
      }

      // Check-In Pin Marker (Custom high-contrast glowing pinpoint)
      const pinColor = isWithinBoundary ? '#10b981' : '#f59e0b';
      const checkInIcon = L.divIcon({
        className: 'bg-transparent',
        html: `
          <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background-color: ${pinColor}; opacity: 0.25; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: relative; width: 28px; height: 28px; border-radius: 9999px; background-color: ${pinColor}; border: 3px solid #ffffff; box-shadow: 0 4px 14px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const checkInMarker = L.marker([latitude, longitude], { icon: checkInIcon }).addTo(map);
      checkInMarker
        .bindPopup(`
          <div style="font-family: inherit; font-size: 11px; padding: 2px;">
            <div style="font-weight: 800; color: #0f172a;">${personName}</div>
            <div style="color: #64748b; font-size: 10px;">${role}${identifier ? ` • ${identifier}` : ''}</div>
            <div style="margin-top: 4px; font-weight: 700; color: ${isWithinBoundary ? '#059669' : '#d97706'};">
              ${isWithinBoundary ? '✓ Inside Campus Boundary' : '⚠ Outside Campus Boundary'} (${distanceFromSchoolMeters}m)
            </div>
            ${time ? `<div style="color: #475569; font-size: 10px; margin-top: 2px;">Check-in: ${time}</div>` : ''}
          </div>
        `)
        .openPopup();

      mapInstanceRef.current = map;

      // Ensure proper tile rendering after DOM paint
      const timer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        map.remove();
        mapInstanceRef.current = null;
      };
    } catch (err) {
      console.warn('Leaflet map initialization warning:', err);
    }
  }, [latitude, longitude, schoolLatitude, schoolLongitude, mapStyle, geofenceRadiusMeters, isWithinBoundary]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-map-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div
        className={`bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col transition-all duration-200 ${
          isExpanded ? 'w-full h-[95vh] max-w-5xl' : 'w-full max-w-2xl max-h-[90vh]'
        }`}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                isWithinBoundary
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}
            >
              <MapPin className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 id="location-map-modal-title" className="text-sm sm:text-base font-bold text-white truncate">
                  {personName}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {role}
                </span>
                {identifier && (
                  <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                    ({identifier})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">
                Attendance Check-In Location • {date} {time ? `at ${time}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors hidden sm:flex"
              title={isExpanded ? 'Restore Size' : 'Expand View'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Close map"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Mode Toolbar */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-700">Map Layer:</span>
            <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-200 shadow-xs">
              <button
                type="button"
                onClick={() => setMapStyle('osm')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  mapStyle === 'osm'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Street Map
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('topo')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  mapStyle === 'topo'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Topographic
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('radar')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  mapStyle === 'radar'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Geofence Radar
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isWithinBoundary
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isWithinBoundary ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified On-Campus</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Outside Campus Boundary</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Map Container Area */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[360px] bg-slate-950 overflow-hidden">
          {mapStyle === 'radar' ? (
            /* Built-in Offline Geofence Radar Canvas / Graphic View */
            <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-slate-950 text-white relative select-none">
              {/* Radar Rings Grid */}
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full border border-slate-800 flex items-center justify-center">
                {/* 1000m ring */}
                <div className="absolute inset-0 rounded-full border border-dashed border-slate-800/80" />
                {/* 500m ring */}
                <div className="absolute inset-8 rounded-full border border-slate-800/80" />
                {/* Campus Geofence Circle (e.g. 250m) */}
                <div className="absolute inset-16 rounded-full border-2 border-emerald-500/60 bg-emerald-500/10 flex items-center justify-center animate-pulse">
                  <span className="text-[10px] font-mono text-emerald-400 absolute top-1 font-bold">
                    Campus Geofence ({geofenceRadiusMeters}m)
                  </span>
                </div>

                {/* Center School Landmark Pin */}
                <div className="relative z-10 w-9 h-9 rounded-full bg-indigo-600 text-white border-2 border-white shadow-lg flex items-center justify-center">
                  <School className="w-4 h-4" />
                </div>

                {/* Check-In Location Pin Offset */}
                {(() => {
                  // Compute radar offset based on distance
                  const distRatio = Math.min(distanceFromSchoolMeters / (geofenceRadiusMeters * 2), 0.85);
                  // Fixed angle for consistent representation (e.g., 35 degrees)
                  const rad = 0.65;
                  const offsetX = Math.cos(rad) * distRatio * 130;
                  const offsetY = -Math.sin(rad) * distRatio * 130;

                  return (
                    <>
                      {/* Vector line */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        <line
                          x1="50%"
                          y1="50%"
                          x2={`calc(50% + ${offsetX}px)`}
                          y2={`calc(50% + ${offsetY}px)`}
                          stroke={isWithinBoundary ? '#10b981' : '#f59e0b'}
                          strokeWidth="2"
                          strokeDasharray="4 4"
                        />
                      </svg>

                      {/* Check-In Marker */}
                      <div
                        style={{
                          transform: `translate(${offsetX}px, ${offsetY}px)`,
                        }}
                        className="absolute z-20 flex flex-col items-center"
                      >
                        <div
                          className={`w-7 h-7 rounded-full text-white border-2 border-white shadow-xl flex items-center justify-center ${
                            isWithinBoundary ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </div>
                        <div className="mt-1 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] font-bold text-white whitespace-nowrap shadow-md">
                          {personName} ({distanceFromSchoolMeters}m)
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Crosshairs */}
                <div className="absolute w-full h-px bg-slate-800/80 pointer-events-none" />
                <div className="absolute h-full w-px bg-slate-800/80 pointer-events-none" />
              </div>

              {/* Radar Footer Legend */}
              <div className="absolute bottom-3 inset-x-4 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>{schoolName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${isWithinBoundary ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span>{personName} ({distanceFromSchoolMeters}m)</span>
                </div>
              </div>
            </div>
          ) : (
            /* Leaflet Interactive Read-Only Map */
            <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-0" />
          )}

          {/* Quick HUD Overlay */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 pointer-events-none">
            <div className="px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur-xs text-white border border-slate-700/80 text-[11px] font-mono shadow-md">
              <span className="text-slate-400">Dist: </span>
              <strong className={isWithinBoundary ? 'text-emerald-400' : 'text-amber-400'}>
                {distanceFromSchoolMeters} m
              </strong>
            </div>
            <div className="px-2.5 py-1 rounded-lg bg-slate-900/85 backdrop-blur-xs text-white border border-slate-700/80 text-[11px] font-mono shadow-md">
              <span className="text-slate-400">Acc: </span>
              <strong className="text-indigo-300">±{accuracyMeters} m</strong>
            </div>
          </div>
        </div>

        {/* Telemetry & Metadata Footer */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-200 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Latitude */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Latitude
              </span>
              <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                {latitude.toFixed(6)}° N
              </span>
            </div>

            {/* Longitude */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Longitude
              </span>
              <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                {longitude.toFixed(6)}° E
              </span>
            </div>

            {/* School Campus Distance */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Distance From Campus
              </span>
              <span
                className={`font-mono font-bold text-xs sm:text-sm ${
                  isWithinBoundary ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {distanceFromSchoolMeters} meters
              </span>
            </div>

            {/* Geofence Status */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Geofence Limit
              </span>
              <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                {geofenceRadiusMeters} m radius
              </span>
            </div>
          </div>

          {schoolAddress && (
            <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 truncate">
              <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                <strong>School Campus:</strong> {schoolName} • {schoolAddress}
              </span>
            </div>
          )}

          {/* Action Links & Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Coordinates Copied!' : 'Copy GPS Coordinates'}</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm active:scale-95"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={osmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
              >
                <span>OpenStreetMap</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
