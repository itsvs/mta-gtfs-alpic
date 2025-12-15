import React from "react";
import { createRoot } from "react-dom/client";
import { useOpenAiGlobal } from "./use-openai-global";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Custom marker icons
const startIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#22c55e" stroke="#ffffff" stroke-width="2"/>
      <circle cx="12.5" cy="12.5" r="6" fill="#ffffff"/>
    </svg>
  `),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const endIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 8.4 12.5 28.5 12.5 28.5S25 20.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
      <path d="M8 8h3v3h3V8h3v3h-3v3h3v3h-3v-3h-3v3H8v-3h3v-3H8z" fill="#ffffff"/>
    </svg>
  `),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

type StationMarker = {
  lat: number;
  lng: number;
  name: string;
  stopId: string;
};

type RouteShape = {
  routeName: string;
  coordinates: [number, number][];
  color: string;
  filteredSegment: boolean;
  pointCount: number;
  startMarker?: StationMarker;
  endMarker?: StationMarker;
};

type StructuredContent = {
  mapLocation?: string;
  routeShape?: RouteShape;
}

// It's weirdly unclear what the intended format is for toolOutput passed to an
// Apps SDK component. We've seen both of the following types before, so we'll
// accept them both.
type Props = StructuredContent & {result: {structuredContent: StructuredContent}}

function App() {
  const toolOutput = useOpenAiGlobal("toolOutput") as Props | null;

  if (toolOutput === null) {
    return (
      "Loading map..."
    )
  }

  // Extract route shape from structured content
  const routeShape = toolOutput.routeShape ?? toolOutput.result?.structuredContent?.routeShape;

  // Calculate map center and bounds based on route data
  const getMapCenter = (): [number, number] => {
    if (routeShape && routeShape.coordinates.length > 0) {
      // Calculate center using average of all coordinates (not just min/max)
      const totalLat = routeShape.coordinates.reduce((sum, coord) => sum + coord[0], 0);
      const totalLng = routeShape.coordinates.reduce((sum, coord) => sum + coord[1], 0);
      const centerLat = totalLat / routeShape.coordinates.length;
      const centerLng = totalLng / routeShape.coordinates.length;

      return [centerLat, centerLng];
    }
    // Default SF Bay Area center if no route data
    return [37.7749, -122.4194];
  };

  // Calculate appropriate zoom level based on route extent
  const getZoom = (): number => {
    if (routeShape && routeShape.coordinates.length > 0) {
      const lats = routeShape.coordinates.map(coord => coord[0]);
      const lngs = routeShape.coordinates.map(coord => coord[1]);
      const latSpan = Math.max(...lats) - Math.min(...lats);
      const lngSpan = Math.max(...lngs) - Math.min(...lngs);
      const maxSpan = Math.max(latSpan, lngSpan);

      // Better zoom calculation for train routes
      if (maxSpan > 0.8) return 9;   // Very long routes (like full lines)
      if (maxSpan > 0.4) return 10;  // Long routes
      if (maxSpan > 0.2) return 11;  // Medium routes
      if (maxSpan > 0.1) return 12;  // Short routes
      if (maxSpan > 0.05) return 13; // Very short segments
      return 14; // Tiny segments
    }
    return 10;
  };

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '500px', backgroundColor: '#f9f9f9' }}>
      {routeShape && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px',
          borderBottom: '1px solid #e5e5e5',
          backgroundColor: 'white'
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>
              {routeShape.routeName}
            </div>
            <div style={{ fontSize: '14px', color: '#666' }}>
              {routeShape.filteredSegment ? 'Route Segment' : 'Full Route'} • {routeShape.pointCount} points
            </div>
          </div>
          <div
            style={{
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              backgroundColor: routeShape.color,
              border: '1px solid #ccc'
            }}
            title={`Route color: ${routeShape.color}`}
          />
        </div>
      )}
      <div style={{ width: '100%', height: routeShape ? 'calc(100% - 80px)' : '100%', minHeight: '400px' }}>
        <MapContainer
          center={getMapCenter()}
          zoom={getZoom()}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', display: 'block' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {routeShape && routeShape.coordinates.length > 0 && (
            <Polyline
              positions={routeShape.coordinates}
              color={routeShape.color}
              weight={4}
              opacity={0.8}
              interactive={false}
            />
          )}
          {routeShape?.startMarker && (
            <Marker
              position={[routeShape.startMarker.lat, routeShape.startMarker.lng]}
              icon={startIcon}
            >
              <Popup>
                <strong>{routeShape.startMarker.name}</strong><br />
                <span style={{ color: '#22c55e' }}>● Start Station</span><br />
                ID: {routeShape.startMarker.stopId}
              </Popup>
            </Marker>
          )}
          {routeShape?.endMarker && (
            <Marker
              position={[routeShape.endMarker.lat, routeShape.endMarker.lng]}
              icon={endIcon}
            >
              <Popup>
                <strong>{routeShape.endMarker.name}</strong><br />
                <span style={{ color: '#ef4444' }}>■ End Station</span><br />
                ID: {routeShape.endMarker.stopId}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}

createRoot(document.getElementById("map-root")!).render(<App />);