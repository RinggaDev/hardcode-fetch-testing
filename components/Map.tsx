"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Edit3, Trash2, ZoomIn, ZoomOut, Compass, Info, AlertCircle, Layers } from "lucide-react";
import { calculatePolygonCentroid, calculatePolygonArea } from "@/utils/geoHelpers";

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
  mapboxToken: string;
  features: any[];
  onFeaturesChange: (features: any[]) => void;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  isAnalyzing: boolean;
  analysisResults: any | null;
}

export default function Map({
  mapboxToken,
  features,
  onFeaturesChange,
  selectedFeatureId,
  onSelectFeature,
  isAnalyzing,
  analysisResults,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Map control states
  const [mapStyle, setMapStyle] = useState<"satellite-hybrid" | "outdoors">("satellite-hybrid");
  const [drawMode, setDrawMode] = useState<"select" | "draw">("select");
  const [showHelp, setShowHelp] = useState(true);
  
  // Demo Mode viewport states
  const [demoZoom, setDemoZoom] = useState(13);
  const [demoCenter, setDemoCenter] = useState<[number, number]>([105.1258, 10.1224]); // Mekong Delta
  const [isDraggingDemo, setIsDraggingDemo] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; centerLng: number; centerLat: number } | null>(null);
  const [demoDrawPoints, setDemoDrawPoints] = useState<[number, number][]>([]);
  const [demoMousePos, setDemoMousePos] = useState<[number, number] | null>(null);

  // Constants for demo mode scaling
  const getDemoScale = (zoom: number) => Math.pow(2, zoom) * 8; // Pixels per degree
  
  // 1. Mapbox GL JS Map Initialization
  useEffect(() => {
    if (!mapboxToken || !mapContainerRef.current) return;
    
    try {
      mapboxgl.accessToken = mapboxToken;
      
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: `mapbox://styles/mapbox/${mapStyle}-v11`,
        center: demoCenter,
        zoom: demoZoom,
        pitch: 0,
      });
      
      mapRef.current = map;
      
      // Initialize Mapbox Draw
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {
          polygon: true,
          trash: true,
        },
        defaultMode: "simple_select",
      });
      
      drawRef.current = draw;
      map.addControl(draw, "top-right");
      
      map.on("load", () => {
        // Load initial features from state if any
        if (features.length > 0) {
          draw.set({
            type: "FeatureCollection",
            features: features
          });
        }
        
        // Add source and layer for NDVI grid cells overlay
        map.addSource("ndvi-grid-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: []
          }
        });
        
        map.addLayer({
          id: "ndvi-grid-layer",
          type: "fill",
          source: "ndvi-grid-source",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.5,
            "fill-outline-color": "rgba(255, 255, 255, 0.2)"
          }
        });
      });
      
      // Event Listeners for Draw tool
      const updateSourceData = () => {
        const data = draw.getAll();
        onFeaturesChange(data.features);
      };
      
      map.on("draw.create", updateSourceData);
      map.on("draw.delete", updateSourceData);
      map.on("draw.update", updateSourceData);
      
      map.on("draw.selectionchange", (e: any) => {
        if (e.features && e.features.length > 0) {
          onSelectFeature(e.features[0].id as string);
        } else {
          onSelectFeature(null);
        }
      });
      
      // Sync zoom/center from Mapbox back to states
      map.on("moveend", () => {
        setDemoCenter([map.getCenter().lng, map.getCenter().lat]);
      });
      map.on("zoomend", () => {
        setDemoZoom(map.getZoom());
      });
      
      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      console.error("Failed to initialize Mapbox GL:", error);
    }
  }, [mapboxToken]);

  // 2. Synchronize Map Style
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setStyle(`mapbox://styles/mapbox/${mapStyle}-v11`);
      
      // Re-add NDVI source/layer after style loads
      mapRef.current.once("style.load", () => {
        if (!mapRef.current) return;
        
        mapRef.current.addSource("ndvi-grid-source", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: []
          }
        });
        
        mapRef.current.addLayer({
          id: "ndvi-grid-layer",
          type: "fill",
          source: "ndvi-grid-source",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.5,
            "fill-outline-color": "rgba(255, 255, 255, 0.2)"
          }
        });
        
        // Redraw NDVI overlays if they were visible
        if (analysisResults && features.length > 0) {
          const cells: any[] = [];
          for (const feat of features) {
            if (feat.geometry?.type === "Polygon") {
              cells.push(...generateNDVIGrid(feat.geometry.coordinates));
            }
          }
          const source = mapRef.current.getSource("ndvi-grid-source") as mapboxgl.GeoJSONSource;
          if (source) {
            source.setData({
              type: "FeatureCollection",
              features: cells
            });
          }
        }
      });
    }
  }, [mapStyle]);

  // 3. Synchronize selected features (pan to center when clicked in sidebar)
  useEffect(() => {
    if (!selectedFeatureId) return;
    
    const feat = features.find(f => f.id === selectedFeatureId);
    if (!feat || !feat.geometry || feat.geometry.type !== "Polygon") return;
    
    const coords = feat.geometry.coordinates[0];
    const centroid = calculatePolygonCentroid(coords);
    
    if (mapRef.current) {
      mapRef.current.easeTo({
        center: centroid,
        zoom: Math.max(14, mapRef.current.getZoom())
      });
      // Mapbox Draw selection
      if (drawRef.current) {
        drawRef.current.changeMode("simple_select", { featureIds: [selectedFeatureId] });
      }
    } else {
      // Demo Mode pan
      setDemoCenter(centroid);
    }
  }, [selectedFeatureId]);

  // 4. Synchronize NDVI grids when analysis results are generated
  useEffect(() => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource("ndvi-grid-source") as mapboxgl.GeoJSONSource;
    if (!source) return;
    
    if (analysisResults && features.length > 0) {
      const cells: any[] = [];
      for (const feat of features) {
        if (feat.geometry?.type === "Polygon") {
          cells.push(...generateNDVIGrid(feat.geometry.coordinates));
        }
      }
      source.setData({
        type: "FeatureCollection",
        features: cells
      });
    } else {
      source.setData({
        type: "FeatureCollection",
        features: []
      });
    }
  }, [analysisResults, features]);

  // 5. Canvas Drawing Loop for Demo Mode Fallback
  useEffect(() => {
    if (mapboxToken) return; // Skip if using Mapbox
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    let animationFrameId: number;
    
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    
    const scale = getDemoScale(demoZoom);
    const centerLng = demoCenter[0];
    const centerLat = demoCenter[1];
    
    const toCanvasCoords = (lng: number, lat: number): [number, number] => {
      const x = canvas.width / 2 + (lng - centerLng) * scale;
      const y = canvas.height / 2 - (lat - centerLat) * scale;
      return [x, y];
    };
    
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw gridlines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      
      const gridSpacing = 0.002; // Degrees
      const startLng = Math.floor((centerLng - (canvas.width / 2) / scale) / gridSpacing) * gridSpacing;
      const endLng = Math.ceil((centerLng + (canvas.width / 2) / scale) / gridSpacing) * gridSpacing;
      const startLat = Math.floor((centerLat - (canvas.height / 2) / scale) / gridSpacing) * gridSpacing;
      const endLat = Math.ceil((centerLat + (canvas.height / 2) / scale) / gridSpacing) * gridSpacing;
      
      for (let lng = startLng; lng <= endLng; lng += gridSpacing) {
        const [x] = toCanvasCoords(lng, centerLat);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        
        // Coordinate label
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "10px monospace";
        ctx.fillText(lng.toFixed(4) + "°E", x + 4, canvas.height - 8);
      }
      
      for (let lat = startLat; lat <= endLat; lat += gridSpacing) {
        const [, y] = toCanvasCoords(centerLng, lat);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "10px monospace";
        ctx.fillText(lat.toFixed(4) + "°N", 8, y - 4);
      }
      
      // Draw static circular radar sweep background
      ctx.strokeStyle = "rgba(16, 185, 129, 0.1)";
      ctx.lineWidth = 1;
      const radarRadii = [100, 200, 300, 400];
      for (const r of radarRadii) {
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw radar scanning sweep (spinning line)
      const sweepAngle = (Date.now() / 1500) % (Math.PI * 2);
      ctx.strokeStyle = "rgba(16, 185, 129, 0.15)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, canvas.height / 2);
      ctx.lineTo(
        canvas.width / 2 + Math.cos(sweepAngle) * 500,
        canvas.height / 2 + Math.sin(sweepAngle) * 500
      );
      ctx.stroke();
      
      // Render existing features
      features.forEach((feat) => {
        if (!feat.geometry || feat.geometry.type !== "Polygon") return;
        
        const isSelected = feat.id === selectedFeatureId;
        const coords = feat.geometry.coordinates[0];
        
        // Generate simulated NDVI cells overlay inside polygon if analyzed
        if (analysisResults) {
          const cells = generateNDVIGrid(feat.geometry.coordinates, 0.0006);
          cells.forEach((cell) => {
            const cellCoords = cell.geometry.coordinates[0];
            ctx.fillStyle = cell.properties.color + "55"; // Adding transparent opacity
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 0.5;
            
            ctx.beginPath();
            const [cx, cy] = toCanvasCoords(cellCoords[0][0], cellCoords[0][1]);
            ctx.moveTo(cx, cy);
            for (let j = 1; j < cellCoords.length; j++) {
              const [cpx, cpy] = toCanvasCoords(cellCoords[j][0], cellCoords[j][1]);
              ctx.lineTo(cpx, cpy);
            }
            ctx.fill();
            ctx.stroke();
          });
        }
        
        // Draw the polygon boundaries
        ctx.beginPath();
        const [x0, y0] = toCanvasCoords(coords[0][0], coords[0][1]);
        ctx.moveTo(x0, y0);
        for (let i = 1; i < coords.length; i++) {
          const [xi, yi] = toCanvasCoords(coords[i][0], coords[i][1]);
          ctx.lineTo(xi, yi);
        }
        
        ctx.fillStyle = isSelected ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)";
        ctx.fill();
        ctx.strokeStyle = isSelected ? "#10b981" : "rgba(255, 255, 255, 0.4)";
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.stroke();
        
        // Draw vertices handles if selected
        if (isSelected) {
          ctx.fillStyle = "#ffffff";
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          coords.forEach((coord: number[]) => {
            const [vx, vy] = toCanvasCoords(coord[0], coord[1]);
            ctx.beginPath();
            ctx.arc(vx, vy, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
      });
      
      // Render active drawing state
      if (drawMode === "draw" && demoDrawPoints.length > 0) {
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const [dx, dy] = toCanvasCoords(demoDrawPoints[0][0], demoDrawPoints[0][1]);
        ctx.moveTo(dx, dy);
        for (let i = 1; i < demoDrawPoints.length; i++) {
          const [dxi, dyi] = toCanvasCoords(demoDrawPoints[i][0], demoDrawPoints[i][1]);
          ctx.lineTo(dxi, dyi);
        }
        
        // Line to current mouse cursor
        if (demoMousePos) {
          ctx.lineTo(demoMousePos[0], demoMousePos[1]);
        }
        ctx.stroke();
        
        // Highlight closed polygon connector
        if (demoDrawPoints.length >= 3 && demoMousePos) {
          const [firstX, firstY] = toCanvasCoords(demoDrawPoints[0][0], demoDrawPoints[0][1]);
          const dist = Math.hypot(demoMousePos[0] - firstX, demoMousePos[1] - firstY);
          if (dist < 15) {
            ctx.fillStyle = "rgba(16, 185, 129, 0.6)";
            ctx.beginPath();
            ctx.arc(firstX, firstY, 12, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        
        // Draw vertices for current drawing path
        ctx.fillStyle = "#10b981";
        demoDrawPoints.forEach((pt) => {
          const [px, py] = toCanvasCoords(pt[0], pt[1]);
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      
      animationFrameId = requestAnimationFrame(render);
    };
    
    render();
    
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [mapboxToken, demoZoom, demoCenter, features, selectedFeatureId, drawMode, demoDrawPoints, demoMousePos, analysisResults]);

  // Canvas interaction handlers for Demo Mode drawing/panning
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mapboxToken) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const scale = getDemoScale(demoZoom);
    
    // Map click pixel to geo coordinates
    const clickLng = demoCenter[0] + (clickX - canvas.width / 2) / scale;
    const clickLat = demoCenter[1] - (clickY - canvas.height / 2) / scale;
    
    if (drawMode === "draw") {
      // Check if closing polygon (clicked near starting point)
      if (demoDrawPoints.length >= 3) {
        const [firstX, firstY] = [
          canvas.width / 2 + (demoDrawPoints[0][0] - demoCenter[0]) * scale,
          canvas.height / 2 - (demoDrawPoints[0][1] - demoCenter[1]) * scale
        ];
        const dist = Math.hypot(clickX - firstX, clickY - firstY);
        
        if (dist < 15) {
          // Close polygon!
          const closedCoords = [...demoDrawPoints, demoDrawPoints[0]];
          const newFeature = {
            id: `demo-${Date.now()}`,
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [closedCoords]
            }
          };
          
          onFeaturesChange([...features, newFeature]);
          setDemoDrawPoints([]);
          setDrawMode("select");
          return;
        }
      }
      // Add node
      setDemoDrawPoints([...demoDrawPoints, [clickLng, clickLat]]);
    } else {
      // Selection Mode
      // Check if clicked inside or close to any polygon bounding box
      let clickedFeatId: string | null = null;
      
      for (const feat of features) {
        if (feat.geometry?.type === "Polygon") {
          const outerRing = feat.geometry.coordinates[0];
          if (isPointInPolygon([clickLng, clickLat], outerRing)) {
            clickedFeatId = feat.id;
            break;
          }
        }
      }
      
      onSelectFeature(clickedFeatId);
      
      // Initialize drag-panning if clicked empty space
      if (!clickedFeatId) {
        setIsDraggingDemo(true);
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          centerLng: demoCenter[0],
          centerLat: demoCenter[1],
        };
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mapboxToken) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (drawMode === "draw") {
      setDemoMousePos([mouseX, mouseY]);
    }
    
    if (isDraggingDemo && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const scale = getDemoScale(demoZoom);
      
      setDemoCenter([
        dragStartRef.current.centerLng - dx / scale,
        dragStartRef.current.centerLat + dy / scale
      ]);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingDemo(false);
    dragStartRef.current = null;
  };

  // Toggle Draw Action
  const toggleDrawMode = () => {
    if (mapboxToken) {
      if (drawRef.current) {
        if (drawMode === "select") {
          drawRef.current.changeMode("draw_polygon");
          setDrawMode("draw");
        } else {
          drawRef.current.changeMode("simple_select");
          setDrawMode("select");
        }
      }
    } else {
      if (drawMode === "select") {
        setDrawMode("draw");
        setDemoDrawPoints([]);
      } else {
        setDrawMode("select");
        setDemoDrawPoints([]);
      }
    }
  };

  // Delete Selection Action
  const deleteSelected = () => {
    if (!selectedFeatureId) return;
    
    if (mapboxToken && drawRef.current) {
      drawRef.current.delete(selectedFeatureId);
      onFeaturesChange(drawRef.current.getAll().features);
    } else {
      onFeaturesChange(features.filter(f => f.id !== selectedFeatureId));
    }
    onSelectFeature(null);
  };

  // Zoom Helpers
  const zoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    } else {
      setDemoZoom(prev => Math.min(prev + 1, 20));
    }
  };
  
  const zoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    } else {
      setDemoZoom(prev => Math.max(prev - 1, 1));
    }
  };

  return (
    <div className="relative w-full h-full bg-[#080d19] flex-1 overflow-hidden">
      
      {/* Map Containers */}
      {mapboxToken ? (
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
      ) : (
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="absolute inset-0 w-full h-full cursor-crosshair block"
        />
      )}
      
      {/* Demo Mode Notice */}
      {!mapboxToken && (
        <div className="absolute top-4 left-4 z-10 glass-card bg-emerald-500/10 border-emerald-500/20 px-3 py-2 rounded-lg flex items-center gap-2 max-w-sm">
          <AlertCircle className="w-5 h-5 text-emerald-400 shrink-0 animate-pulse" />
          <div className="text-xs text-zinc-300">
            <span className="font-semibold text-emerald-400 block">Demo Canvas Mode Active</span>
            Drawn coordinate nodes mapped to WGS84 Mekong Delta, Vietnam grid. Paste a token in settings for full Mapbox satellite overlays.
          </div>
        </div>
      )}

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
          
          {mapboxToken && (
            <button
              onClick={() => setMapStyle(prev => prev === "satellite-hybrid" ? "outdoors" : "satellite-hybrid")}
              title="Toggle Map Style"
              className={`p-3 rounded-lg transition-all ${
                mapStyle === "satellite-hybrid" ? "text-emerald-400" : "text-zinc-300"
              } hover:bg-white/5 hover:text-white`}
            >
              <Layers className="w-5 h-5" />
            </button>
          )}
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
            {mapboxToken ? (
              <>
                <li>Click the <Edit3 className="w-3.5 h-3.5 inline text-emerald-400 mx-0.5" /> icon to start drawing.</li>
                <li>Click on the map to define polygon nodes.</li>
                <li>Double-click to close and finish field.</li>
                <li>Click and drag nodes to adjust boundary.</li>
                <li>Click any field to select/highlight.</li>
              </>
            ) : (
              <>
                <li>Activate <Edit3 className="w-3.5 h-3.5 inline text-emerald-400 mx-0.5" /> mode to draw.</li>
                <li>Click to place vertices on coordinate grids.</li>
                <li>Click close to starting node to complete.</li>
                <li>Drag empty space with mouse to pan grid.</li>
                <li>Use scroll or buttons to zoom in/out.</li>
              </>
            )}
          </ul>
        </div>
      )}
      
      {/* Map Center Coordinate Indicator */}
      <div className="absolute bottom-4 left-4 z-10 glass-card px-3 py-1.5 rounded-lg text-[10px] font-mono text-zinc-400 tracking-wider">
        LNG: {demoCenter[0].toFixed(5)}°E | LAT: {demoCenter[1].toFixed(5)}°N | ZOOM: {demoZoom.toFixed(1)}
      </div>
    </div>
  );
}
