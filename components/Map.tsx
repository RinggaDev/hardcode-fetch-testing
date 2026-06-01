"use client";

import React, { useEffect, useRef, useState } from "react";
import { Edit3, Trash2, ZoomIn, ZoomOut, Compass, Info, Layers } from "lucide-react";
import { calculatePolygonCentroid } from "@/utils/geoHelpers";

// Point-in-polygon helper for AI analysis grid overlay
function isPointInPolygon(point: number[], polygon: number[][]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Generate grid cells inside a polygon for simulated NDVI overlay
function generateNDVIGrid(polygonCoords: number[][][], cellSizeDeg = 0.0005): any[] {
  const gridCells: any[] = [];
  const outerRing = polygonCoords[0];
  
  // Find bounding box
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  for (const pt of outerRing) {
    if (pt[0] < minLng) minLng = pt[0];
    if (pt[0] > maxLng) maxLng = pt[0];
    if (pt[1] < minLat) minLat = pt[1];
    if (pt[1] > maxLat) maxLat = pt[1];
  }
  
  // Generate grid points and check if they are inside the polygon
  for (let lng = minLng; lng < maxLng; lng += cellSizeDeg) {
    for (let lat = minLat; lat < maxLat; lat += cellSizeDeg) {
      const cellCenter = [lng + cellSizeDeg / 2, lat + cellSizeDeg / 2];
      
      if (isPointInPolygon(cellCenter, outerRing)) {
        // Generate random NDVI between 0.2 (poor/soil) and 0.9 (very healthy rice)
        // Group fields into spatial clusters using a noise-like function
        const noise = Math.sin(lng * 2000) * Math.cos(lat * 2000);
        const ndvi = 0.55 + noise * 0.35;
        
        // Define color based on NDVI value
        let color = "#ef4444"; // Red (stressed / bare)
        let healthLabel = "Bare Soil / Stressed";
        if (ndvi > 0.4 && ndvi <= 0.6) {
          color = "#eab308"; // Yellow (moderate / tillering)
          healthLabel = "Moderate / Tillering";
        } else if (ndvi > 0.6 && ndvi <= 0.75) {
          color = "#22c55e"; // Light Green (healthy / vegetative)
          healthLabel = "Healthy / Vegetative";
        } else if (ndvi > 0.75) {
          color = "#15803d"; // Dark Green (excellent / flowering)
          healthLabel = "Excellent / Heading";
        }
        
        gridCells.push({
          type: "Feature",
          properties: { ndvi, color, healthLabel },
          geometry: {
            type: "Polygon",
            coordinates: [[
              [lng, lat],
              [lng + cellSizeDeg, lat],
              [lng + cellSizeDeg, lat + cellSizeDeg],
              [lng, lat + cellSizeDeg],
              [lng, lat]
            ]]
          }
        });
      }
    }
  }
  
  return gridCells;
}

interface MapProps {
  features: any[];
  onFeaturesChange: (features: any[]) => void;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  isAnalyzing: boolean;
  analysisResults: any | null;
}

export default function Map({
  features,
  onFeaturesChange,
  selectedFeatureId,
  onSelectFeature,
  isAnalyzing,
  analysisResults,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const drawnItemsRef = useRef<any>(null);
  const ndviLayerRef = useRef<any>(null);
  const layersRef = useRef<{ satellite: any; outdoors: any } | null>(null);
  
  // Map control states
  const [mapStyle, setMapStyle] = useState<"satellite" | "outdoors">("satellite");
  const [drawMode, setDrawMode] = useState<"select" | "draw">("select");
  const [showHelp, setShowHelp] = useState(true);
  
  const [zoomState, setZoomState] = useState(13);
  const [centerState, setCenterState] = useState<[number, number]>([105.1258, 10.1224]); // Mekong Delta [lng, lat]
  
  // Flag to avoid infinite loops during state synchronization
  const isSyncingRef = useRef(false);

  // 1. Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    let mapInstance: any;

    const initMap = async () => {
      // Import Leaflet and Leaflet Geoman dynamically on the client side
      const L = (await import("leaflet")).default;
      await import("@geoman-io/leaflet-geoman-free");

      if (!mapContainerRef.current) return;
      
      // Leaflet coordinates are [lat, lng] (Mapbox is [lng, lat])
      mapInstance = L.map(mapContainerRef.current, {
        center: [centerState[1], centerState[0]],
        zoom: zoomState,
        zoomControl: false,
        attributionControl: true,
      });
      
      mapRef.current = mapInstance;
      
      // Define tile layers
      const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
      });
      
      const outdoors = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
      });
      
      // Set initial style
      if (mapStyle === "satellite") {
        satellite.addTo(mapInstance);
      } else {
        outdoors.addTo(mapInstance);
      }
      
      layersRef.current = { satellite, outdoors };
      
      // FeatureGroup to hold drawn geometries
      const drawnItems = new L.FeatureGroup();
      mapInstance.addLayer(drawnItems);
      drawnItemsRef.current = drawnItems;
      
      // Configure Leaflet Geoman
      mapInstance.pm.setGlobalOptions({
        limitMarkersToCount: 60,
        pathOptions: {
          color: "#10b981",
          fillColor: "rgba(16, 185, 129, 0.15)",
          fillOpacity: 0.15,
          weight: 3,
        },
      });
      
      const syncFeatures = () => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        
        const geojsonFeatures: any[] = [];
        drawnItems.eachLayer((layer: any) => {
          const geojson = layer.toGeoJSON();
          geojson.id = layer.pmId;
          geojsonFeatures.push(geojson);
        });
        
        onFeaturesChange(geojsonFeatures);
        isSyncingRef.current = false;
      };
      
      // Listen to Geoman events
      mapInstance.on("pm:create", (e: any) => {
        const layer = e.layer;
        if (!layer.pmId) {
          layer.pmId = `leaflet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        drawnItems.addLayer(layer);
        
        // Listeners for geometry modification
        layer.on("pm:edit", syncFeatures);
        layer.on("pm:dragend", syncFeatures);
        
        // Selection click handler
        layer.on("click", (clickEvent: any) => {
          L.DomEvent.stopPropagation(clickEvent);
          onSelectFeature(layer.pmId);
        });
        
        // Reset drawing state back to select
        mapInstance.pm.disableDraw();
        setDrawMode("select");
        
        syncFeatures();
      });
      
      mapInstance.on("pm:remove", (e: any) => {
        if (selectedFeatureId === e.layer.pmId) {
          onSelectFeature(null);
        }
        syncFeatures();
      });

      // Track viewport changes
      mapInstance.on("move", () => {
        const center = mapInstance.getCenter();
        setCenterState([center.lng, center.lat]);
      });
      
      mapInstance.on("zoomend", () => {
        setZoomState(mapInstance.getZoom());
      });

      // Load initial features from props if present
      if (features.length > 0) {
        features.forEach((feat) => {
          if (feat.geometry?.type === "Polygon") {
            const geojsonLayer = L.geoJSON(feat);
            geojsonLayer.eachLayer((layer: any) => {
              layer.pmId = feat.id || `leaflet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              
              const isSelected = layer.pmId === selectedFeatureId;
              layer.setStyle({
                color: isSelected ? "#10b981" : "rgba(255, 255, 255, 0.4)",
                fillColor: isSelected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                fillOpacity: isSelected ? 0.15 : 0.05,
                weight: isSelected ? 3 : 1.5,
              });

              drawnItems.addLayer(layer);

              layer.on("pm:edit", syncFeatures);
              layer.on("pm:dragend", syncFeatures);
              layer.on("click", (clickEvent: any) => {
                L.DomEvent.stopPropagation(clickEvent);
                onSelectFeature(layer.pmId);
              });
            });
          }
        });
      }
    };
    
    initMap();
    
    return () => {
      if (mapInstance) {
        mapInstance.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Synchronize Map Style
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    
    if (mapStyle === "satellite") {
      if (map.hasLayer(layers.outdoors)) {
        map.removeLayer(layers.outdoors);
      }
      layers.satellite.addTo(map);
    } else {
      if (map.hasLayer(layers.satellite)) {
        map.removeLayer(layers.satellite);
      }
      layers.outdoors.addTo(map);
    }
  }, [mapStyle]);

  // 3. Synchronize External Features Changes (e.g. deletion from sidebar)
  useEffect(() => {
    const map = mapRef.current;
    const drawnItems = drawnItemsRef.current;
    if (!map || !drawnItems || isSyncingRef.current) return;
    
    const L = (window as any).L;
    if (!L) return;

    isSyncingRef.current = true;
    
    const currentLayersMap = new globalThis.Map<string, any>();
    drawnItems.eachLayer((layer: any) => {
      if (layer.pmId) currentLayersMap.set(layer.pmId, layer);
    });
    
    const propIds = new Set(features.map(f => f.id));
    
    // Remove layers no longer in state
    currentLayersMap.forEach((layer, pmId) => {
      if (!propIds.has(pmId)) {
        drawnItems.removeLayer(layer);
      }
    });
    
    // Add/Update existing layers
    features.forEach((feat) => {
      if (!feat.geometry || feat.geometry.type !== "Polygon") return;
      
      const existingLayer = currentLayersMap.get(feat.id);
      if (existingLayer) {
        const isSelected = feat.id === selectedFeatureId;
        existingLayer.setStyle({
          color: isSelected ? "#10b981" : "rgba(255, 255, 255, 0.4)",
          fillColor: isSelected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
          fillOpacity: isSelected ? 0.15 : 0.05,
          weight: isSelected ? 3 : 1.5,
        });
      } else {
        const geojsonLayer = L.geoJSON(feat);
        geojsonLayer.eachLayer((layer: any) => {
          layer.pmId = feat.id || `leaflet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const isSelected = layer.pmId === selectedFeatureId;
          layer.setStyle({
            color: isSelected ? "#10b981" : "rgba(255, 255, 255, 0.4)",
            fillColor: isSelected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
            fillOpacity: isSelected ? 0.15 : 0.05,
            weight: isSelected ? 3 : 1.5,
          });

          drawnItems.addLayer(layer);

          const syncFeatures = () => {
            if (isSyncingRef.current) return;
            isSyncingRef.current = true;
            const geojsonFeatures: any[] = [];
            drawnItems.eachLayer((l: any) => {
              const gj = l.toGeoJSON();
              gj.id = l.pmId;
              geojsonFeatures.push(gj);
            });
            onFeaturesChange(geojsonFeatures);
            isSyncingRef.current = false;
          };

          layer.on("pm:edit", syncFeatures);
          layer.on("pm:dragend", syncFeatures);
          layer.on("click", (clickEvent: any) => {
            L.DomEvent.stopPropagation(clickEvent);
            onSelectFeature(layer.pmId);
          });
        });
      }
    });
    
    isSyncingRef.current = false;
  }, [features, selectedFeatureId]);

  // 4. Center selected feature on click
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedFeatureId) return;
    
    const feat = features.find(f => f.id === selectedFeatureId);
    if (!feat || !feat.geometry || feat.geometry.type !== "Polygon") return;
    
    const coords = feat.geometry.coordinates[0];
    const centroid = calculatePolygonCentroid(coords);
    
    map.panTo([centroid[1], centroid[0]]);
  }, [selectedFeatureId]);

  // 5. Synchronize NDVI grids when analysis results are generated
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    
    const L = (window as any).L;
    if (!L) return;

    if (ndviLayerRef.current) {
      map.removeLayer(ndviLayerRef.current);
      ndviLayerRef.current = null;
    }
    
    if (analysisResults && features.length > 0) {
      const cells: any[] = [];
      for (const feat of features) {
        if (feat.geometry?.type === "Polygon") {
          cells.push(...generateNDVIGrid(feat.geometry.coordinates));
        }
      }
      
      if (cells.length > 0) {
        const ndviGeoJSON = {
          type: "FeatureCollection",
          features: cells
        };

        const ndviLayer = L.geoJSON(ndviGeoJSON as any, {
          style: (feature: any) => {
            return {
              fillColor: feature.properties.color,
              fillOpacity: 0.5,
              color: "rgba(255, 255, 255, 0.15)",
              weight: 0.5,
            };
          }
        });

        ndviLayer.addTo(map);
        ndviLayerRef.current = ndviLayer;
      }
    }
  }, [analysisResults, features]);

  // Toggle Draw Action
  const toggleDrawMode = () => {
    const map = mapRef.current;
    if (!map) return;
    
    if (drawMode === "select") {
      map.pm.enableDraw("Polygon", {
        snappable: true,
        snapDistance: 20,
      });
      setDrawMode("draw");
    } else {
      map.pm.disableDraw();
      setDrawMode("select");
    }
  };

  // Delete Selection Action
  const deleteSelected = () => {
    if (!selectedFeatureId || !drawnItemsRef.current) return;
    
    drawnItemsRef.current.eachLayer((layer: any) => {
      if (layer.pmId === selectedFeatureId) {
        drawnItemsRef.current.removeLayer(layer);
      }
    });
    
    onSelectFeature(null);
    
    // Sync back
    isSyncingRef.current = true;
    const geojsonFeatures: any[] = [];
    drawnItemsRef.current.eachLayer((l: any) => {
      const gj = l.toGeoJSON();
      gj.id = l.pmId;
      geojsonFeatures.push(gj);
    });
    onFeaturesChange(geojsonFeatures);
    isSyncingRef.current = false;
  };

  // Zoom Helpers
  const zoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };
  
  const zoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  return (
    <div className="relative w-full h-full bg-[#080d19] flex-1 overflow-hidden">
      
      {/* Leaflet Map Div */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />
      
      {/* Satellite Scanline Animation overlay during AI analysis */}
      {isAnalyzing && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden bg-emerald-950/5">
          <div className="absolute top-0 left-0 w-full h-24 scanner-line" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,53,36,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(18,53,36,0.1)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        </div>
      )}

      {/* Floating Map Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        {/* Draw Buttons */}
        <div className="glass-card flex flex-col gap-1 p-1 rounded-xl shadow-2xl">
          <button
            onClick={toggleDrawMode}
            title={drawMode === "select" ? "Draw Rice Field Boundary" : "Cancel Drawing"}
            className={`p-3 rounded-lg transition-all ${
              drawMode === "draw"
                ? "bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                : "text-zinc-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Edit3 className="w-5 h-5" />
          </button>
          
          <button
            onClick={deleteSelected}
            disabled={!selectedFeatureId}
            title="Delete Selected Boundary"
            className={`p-3 rounded-lg transition-all ${
              selectedFeatureId
                ? "text-red-400 hover:bg-red-500/10"
                : "text-zinc-600 cursor-not-allowed"
            }`}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* View Controls */}
        <div className="glass-card flex flex-col gap-1 p-1 rounded-xl shadow-2xl">
          <button
            onClick={zoomIn}
            title="Zoom In"
            className="p-3 rounded-lg text-zinc-300 hover:bg-white/5 hover:text-white transition-all"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={zoomOut}
            title="Zoom Out"
            className="p-3 rounded-lg text-zinc-300 hover:bg-white/5 hover:text-white transition-all"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => setMapStyle(prev => prev === "satellite" ? "outdoors" : "satellite")}
            title="Toggle Map Style"
            className={`p-3 rounded-lg transition-all ${
              mapStyle === "satellite" ? "text-emerald-400" : "text-zinc-300"
            } hover:bg-white/5 hover:text-white`}
          >
            <Layers className="w-5 h-5" />
          </button>
        </div>

        {/* Help Toggle */}
        <button
          onClick={() => setShowHelp(prev => !prev)}
          title="Toggle Help Overlay"
          className={`glass-card p-3 rounded-xl shadow-2xl transition-all ${
            showHelp ? "text-emerald-400 border-emerald-500/30" : "text-zinc-300"
          }`}
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Floating Instructions/Legend */}
      {showHelp && (
        <div className="absolute bottom-6 right-4 z-10 glass-card bg-slate-950/80 p-4 rounded-xl shadow-2xl border-white/5 max-w-[280px]">
          <div className="flex items-center gap-2 mb-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Map controls</h4>
          </div>
          <ul className="text-xs space-y-1.5 text-zinc-400 list-disc list-inside">
            <li>Click the <Edit3 className="w-3.5 h-3.5 inline text-emerald-400 mx-0.5" /> icon to start drawing.</li>
            <li>Click on the map to place polygon nodes.</li>
            <li>Click the starting node or double-click to finish.</li>
            <li>Click on a field boundary to select it.</li>
            <li>Click and drag nodes or boundaries to edit.</li>
            <li>Click the trash icon to delete selection.</li>
          </ul>
        </div>
      )}
      
      {/* Map Center Coordinate Indicator */}
      <div className="absolute bottom-4 left-4 z-10 glass-card px-3 py-1.5 rounded-lg text-[10px] font-mono text-zinc-400 tracking-wider">
        LNG: {centerState[0].toFixed(5)}°E | LAT: {centerState[1].toFixed(5)}°N | ZOOM: {zoomState.toFixed(1)}
      </div>
    </div>
  );
}
