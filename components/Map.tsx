"use client";

import React, { useEffect, useRef, useState } from "react";
import { Edit3, Trash2, ZoomIn, ZoomOut, Compass, Info, Layers, MapPin, AlertTriangle } from "lucide-react";
import { calculatePolygonCentroid, getFeatureCentroid, validateDrawingDistances } from "@/utils/geoHelpers";



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
  const [drawMode, setDrawMode] = useState<"select" | "draw-polygon" | "draw-marker">("select");
  const [showHelp, setShowHelp] = useState(true);
  
  const [zoomState, setZoomState] = useState(18);
  const [centerState, setCenterState] = useState<[number, number]>([112.9064, -7.6413]); // Default target coord [lng, lat]
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Auto-clear warning alerts
  useEffect(() => {
    if (warningMessage) {
      const timer = setTimeout(() => setWarningMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [warningMessage]);
  
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
        minZoom: 5,
        maxZoom: 20,
        maxBounds: L.latLngBounds([-11.0, 95.0], [6.0, 141.0]), // Limit viewport to Indonesia overall
        maxBoundsViscosity: 1.0, // Strict viewport bounce configuration
        zoomControl: false,
        attributionControl: true,
      });
      
      mapRef.current = mapInstance;
      
      // Define tile layers
      const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxZoom: 20,
        maxNativeZoom: 18 // Auto-scale tiles at zooms 19 & 20 to avoid gray blank grids
      });
      
      const outdoors = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
        maxZoom: 20,
        maxNativeZoom: 19 // Auto-scale tiles at zoom 20 to avoid gray blank grids
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
        
        // Perform maximum drawing distance validation on creation
        const geojson = layer.toGeoJSON();
        if (geojson.geometry && geojson.geometry.type === "Polygon") {
          const coords = geojson.geometry.coordinates[0];
          const validation = validateDrawingDistances(coords);
          if (!validation.valid) {
            setWarningMessage(validation.reason || "Rejected: Drawing exceeds maximum distance bounds.");
            mapInstance.removeLayer(layer);
            mapInstance.pm.disableDraw();
            setDrawMode("select");
            return;
          }
        }
        
        if (!layer.pmId) {
          layer.pmId = `leaflet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        drawnItems.addLayer(layer);
        
        // Listeners for geometry modification
        const handleModification = () => {
          const modGeoJSON = layer.toGeoJSON();
          if (modGeoJSON.geometry && modGeoJSON.geometry.type === "Polygon") {
            const modCoords = modGeoJSON.geometry.coordinates[0];
            const modValidation = validateDrawingDistances(modCoords);
            if (!modValidation.valid) {
              setWarningMessage(modValidation.reason || "Rejected: Shape is too large.");
              mapInstance.removeLayer(layer);
              syncFeatures();
              return;
            }
          }
          syncFeatures();
        };

        layer.on("pm:edit", handleModification);
        layer.on("pm:dragend", handleModification);
        
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
      if (!feat.geometry || (feat.geometry.type !== "Polygon" && feat.geometry.type !== "Point")) return;
      
      const existingLayer = currentLayersMap.get(feat.id);
      if (existingLayer) {
        const isSelected = feat.id === selectedFeatureId;
        if (existingLayer.setStyle) {
          existingLayer.setStyle({
            color: isSelected ? "#10b981" : "rgba(255, 255, 255, 0.4)",
            fillColor: isSelected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
            fillOpacity: isSelected ? 0.15 : 0.05,
            weight: isSelected ? 3 : 1.5,
          });
        } else {
          const el = existingLayer.getElement?.();
          if (el) {
            el.style.filter = isSelected 
              ? "drop-shadow(0px 0px 8px #10b981) hue-rotate(40deg)" 
              : "none";
          }
        }
      } else {
        const geojsonLayer = L.geoJSON(feat);
        geojsonLayer.eachLayer((layer: any) => {
          layer.pmId = feat.id || `leaflet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const isSelected = layer.pmId === selectedFeatureId;
          if (layer.setStyle) {
            layer.setStyle({
              color: isSelected ? "#10b981" : "rgba(255, 255, 255, 0.4)",
              fillColor: isSelected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
              fillOpacity: isSelected ? 0.15 : 0.05,
              weight: isSelected ? 3 : 1.5,
            });
          } else {
            setTimeout(() => {
              const el = layer.getElement?.();
              if (el) {
                el.style.filter = isSelected 
                  ? "drop-shadow(0px 0px 8px #10b981) hue-rotate(40deg)" 
                  : "none";
              }
            }, 100);
          }

          drawnItems.addLayer(layer);

          const syncFeaturesInner = () => {
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

          layer.on("pm:edit", syncFeaturesInner);
          layer.on("pm:dragend", syncFeaturesInner);
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
    if (!feat || !feat.geometry) return;
    
    const centroid = getFeatureCentroid(feat);
    map.panTo([centroid[1], centroid[0]]);
  }, [selectedFeatureId, features]);

  // Cancel drawing if zoom level drops below 16
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (zoomState < 16 && drawMode !== "select") {
      map.pm.disableDraw();
      setDrawMode("select");
      setWarningMessage("Drawing cancelled. You must stay close to the surface (Zoom >= 16).");
    }
  }, [zoomState, drawMode]);

  // Start drawing a specific geometry type
  const startDrawing = (type: "Polygon" | "Marker") => {
    const map = mapRef.current;
    if (!map) return;
    
    // Enforce drawing limit zoom level: must be >= 16 (close to the surface)
    if (zoomState < 16) {
      setWarningMessage("Please zoom in closer to the surface (Min Zoom 16) to draw boundaries.");
      return;
    }
    
    const targetMode = type === "Polygon" ? "draw-polygon" : "draw-marker";
    
    if (drawMode === targetMode) {
      map.pm.disableDraw();
      setDrawMode("select");
    } else {
      map.pm.enableDraw(type, {
        snappable: true,
        snapDistance: 20,
      });
      setDrawMode(targetMode);
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

      {/* Warning Notification Banner */}
      {warningMessage && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 animate-fadeIn pointer-events-none">
          <div className="glass-card flex items-center gap-3 px-5 py-3 border border-red-500/30 bg-red-950/80 rounded-2xl shadow-[0_4px_30px_rgba(239,68,68,0.2)] max-w-sm pointer-events-auto">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
            <div className="text-xs text-red-200 font-medium leading-normal">
              {warningMessage}
            </div>
          </div>
        </div>
      )}
      
      {/* Satellite Scanline Animation overlay during active processing */}
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
            onClick={() => startDrawing("Polygon")}
            title={drawMode === "draw-polygon" ? "Cancel Polygon" : "Draw Area Polygon (Primary)"}
            className={`p-3 rounded-lg transition-all ${
              drawMode === "draw-polygon"
                ? "bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                : "text-zinc-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Edit3 className="w-5 h-5" />
          </button>

          <button
            onClick={() => startDrawing("Marker")}
            title={drawMode === "draw-marker" ? "Cancel Marker" : "Place Coordinate Pin (Point Fallback)"}
            className={`p-3 rounded-lg transition-all ${
              drawMode === "draw-marker"
                ? "bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                : "text-zinc-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <MapPin className="w-5 h-5" />
          </button>
          
          <button
            onClick={deleteSelected}
            disabled={!selectedFeatureId}
            title="Delete Selected Feature"
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
            <li>Click <Edit3 className="w-3.5 h-3.5 inline text-emerald-400 mx-0.5" /> to draw an area boundary.</li>
            <li>Click <MapPin className="w-3.5 h-3.5 inline text-emerald-400 mx-0.5" /> to place a fallback coordinate pin.</li>
            <li>Click and drag nodes or markers to edit.</li>
            <li>Click on any shape or pin to select it.</li>
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
