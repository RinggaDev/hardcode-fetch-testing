"use client";

import React, { useState } from "react";
import { 
  Sprout, 
  Settings, 
  MapPin, 
  Trash2, 
  BrainCircuit, 
  ChevronRight, 
  Download, 
  CheckCircle, 
  Activity, 
  Layers, 
  Droplets,
  HelpCircle,
  KeyRound
} from "lucide-react";
import { formatArea, formatDistance, calculatePolygonCentroid, calculatePolygonArea, calculatePolygonPerimeter } from "@/utils/geoHelpers";

interface SidebarProps {
  mapboxToken: string;
  onTokenChange: (token: string) => void;
  features: any[];
  onDeleteFeature: (id: string) => void;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  isAnalyzing: boolean;
  onStartAnalysis: () => void;
  analysisResults: any | null;
  onResetAnalysis: () => void;
  activeStep: number;
}

export default function Sidebar({
  mapboxToken,
  onTokenChange,
  features,
  onDeleteFeature,
  selectedFeatureId,
  onSelectFeature,
  isAnalyzing,
  onStartAnalysis,
  analysisResults,
  onResetAnalysis,
  activeStep
}: SidebarProps) {
  const [tokenInput, setTokenInput] = useState(mapboxToken);
  const [showSettings, setShowSettings] = useState(false);
  const [modelType, setModelType] = useState("rice-seg");
  const [confidence, setConfidence] = useState(0.75);

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onTokenChange(tokenInput.trim());
    setShowSettings(false);
  };

  const handleClearToken = () => {
    setTokenInput("");
    onTokenChange("");
  };

  const handleExportGeoJSON = () => {
    if (features.length === 0) return;
    
    // Enrich features with calculated area & perimeter details
    const enrichedFeatures = features.map((feat) => {
      if (feat.geometry?.type === "Polygon") {
        const coords = feat.geometry.coordinates[0];
        const area = calculatePolygonArea(coords);
        const perimeter = calculatePolygonPerimeter(coords);
        const centroid = calculatePolygonCentroid(coords);
        
        return {
          ...feat,
          properties: {
            ...feat.properties,
            areaSqMeters: area,
            areaHectares: area / 10000,
            perimeterMeters: perimeter,
            centroidLngLat: centroid,
            cropStage: analysisResults ? "Vegetative / Tillering" : "Unknown",
            estimatedYieldTons: analysisResults ? (area / 10000 * 5.4).toFixed(1) : 0,
            ndviHealthIndex: analysisResults ? 0.73 : 0
          }
        };
      }
      return feat;
    });

    const geojson = {
      type: "FeatureCollection",
      features: enrichedFeatures,
    };

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `agri-ai-rice-fields-${Date.now()}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // AI analysis pipeline steps description
  const analysisSteps = [
    "Acquiring Sentinel-2 multi-spectral bands...",
    "Computing NDVI (Vegetation Index) overlays...",
    "Running Rice Field Segmentation Neural Nets...",
    "Generating statistics & reports..."
  ];

  return (
    <aside className="w-[360px] h-full flex flex-col glass-panel shadow-2xl z-30 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Sprout className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-semibold text-white tracking-wide text-base">AgriAI</h1>
            <p className="text-[10px] text-zinc-400 font-mono tracking-wider">RICE FIELD ANALYZER</p>
          </div>
        </div>
        <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
          v1.0 Beta
        </span>
      </div>

      {/* Collapsible Settings / Mapbox Token Panel */}
      <div className="border-b border-white/5">
        <button
          onClick={() => setShowSettings(prev => !prev)}
          className="w-full px-6 py-3 flex items-center justify-between text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-500" />
            <span>Mapbox Integration</span>
          </div>
          <span className="text-[10px] text-zinc-500 hover:text-zinc-400">
            {mapboxToken ? "Connected" : "Demo Mode"}
          </span>
        </button>

        {showSettings && (
          <form onSubmit={handleTokenSubmit} className="px-6 pb-5 pt-2 flex flex-col gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-emerald-400" />
                Mapbox Access Token
              </label>
              <input
                type="password"
                placeholder="paste pk.eyJ1... token here"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/80 border border-white/10 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono"
              />
            </div>
            <div className="flex gap-2 justify-end">
              {mapboxToken && (
                <button
                  type="button"
                  onClick={handleClearToken}
                  className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors"
                >
                  Clear Token
                </button>
              )}
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-xs font-semibold transition-colors"
              >
                Apply Token
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        
        {/* Drawn Fields Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Drawn Fields</h3>
            </div>
            <span className="text-[10px] font-mono bg-white/5 border border-white/5 text-zinc-300 px-2 py-0.5 rounded-full">
              {features.length}
            </span>
          </div>

          {features.length === 0 ? (
            <div className="glass-card rounded-xl p-5 text-center border-dashed border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/5 mx-auto mb-3 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-zinc-500" />
              </div>
              <p className="text-xs text-zinc-400 leading-normal max-w-[200px] mx-auto">
                No boundaries drawn. Use the polygon tool on the map to define a rice field boundary.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
              {features.map((feat, index) => {
                const isSelected = feat.id === selectedFeatureId;
                const coords = feat.geometry?.coordinates?.[0] || [];
                const area = calculatePolygonArea(coords);
                const perimeter = calculatePolygonPerimeter(coords);
                const centroid = calculatePolygonCentroid(coords);

                return (
                  <div
                    key={feat.id || index}
                    onClick={() => onSelectFeature(feat.id)}
                    className={`glass-card p-3.5 rounded-xl cursor-pointer transition-all border flex items-center justify-between group ${
                      isSelected 
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20" 
                        : "border-white/5 hover:border-white/10 hover:bg-white/[0.01]"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        Rice Field Area #{index + 1}
                      </div>
                      <div className="flex gap-3 text-[10px] text-zinc-500 font-mono">
                        <span>Area: <strong className="text-zinc-300">{formatArea(area)}</strong></span>
                        <span>Perim: <strong className="text-zinc-300">{formatDistance(perimeter)}</strong></span>
                      </div>
                      <div className="text-[9px] text-zinc-600 font-mono">
                        Centroid: {centroid[0].toFixed(4)}°E, {centroid[1].toFixed(4)}°N
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFeature(feat.id);
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Delete Field"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Detection Controls */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">AI Detection Settings</h3>
          </div>

          <div className="glass-card rounded-xl p-4 space-y-4">
            {/* Model Type */}
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">AI Neural Model</label>
              <select 
                value={modelType} 
                onChange={(e) => setModelType(e.target.value)}
                disabled={isAnalyzing || analysisResults}
                className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-white/5 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="rice-seg">Rice Field Segmenter v2.4</option>
                <option value="ndvi-health">Crop NDVI Health Analyzer</option>
              </select>
            </div>

            {/* Confidence Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] uppercase font-mono">
                <span className="text-zinc-400">Confidence Threshold</span>
                <span className="text-emerald-400">{(confidence * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                disabled={isAnalyzing || analysisResults}
                className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
              />
            </div>
            
            {/* Run Analysis Trigger */}
            {features.length === 0 ? (
              <p className="text-[10px] text-amber-500/80 text-center bg-amber-500/5 py-2 px-3 rounded-lg border border-amber-500/10">
                Draw a field polygon boundary first to enable AI satellite analysis.
              </p>
            ) : !analysisResults && !isAnalyzing ? (
              <button
                onClick={onStartAnalysis}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-slate-950 rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1.5"
              >
                <BrainCircuit className="w-4 h-4" />
                Analyze Drawn Rice Fields
              </button>
            ) : isAnalyzing ? (
              // Active Stepper Simulation Loading
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-[10px] text-zinc-300 font-medium">Running Deep Inference...</span>
                </div>
                <div className="space-y-1.5">
                  {analysisSteps.map((stepMsg, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[10px]">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        idx < activeStep 
                          ? "bg-emerald-500" 
                          : idx === activeStep 
                            ? "bg-emerald-400 animate-ping" 
                            : "bg-zinc-800"
                      }`} />
                      <span className={idx === activeStep ? "text-emerald-400 font-medium" : idx < activeStep ? "text-zinc-400 line-through" : "text-zinc-600"}>
                        {stepMsg}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              // Reset / Re-run state
              <button
                onClick={onResetAnalysis}
                className="w-full py-2 border border-white/10 hover:bg-white/5 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Clear Analysis Results
              </button>
            )}
          </div>
        </div>

        {/* AI Results Card */}
        {analysisResults && (
          <div className="space-y-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Analysis Results</h3>
            </div>

            <div className="glass-card rounded-2xl border-emerald-500/20 bg-slate-900/60 p-4 space-y-4">
              
              {/* Rice Field Health NDVI */}
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-400 font-medium uppercase font-mono">Mean NDVI Health</div>
                    <div className="text-xs font-bold text-emerald-400">0.73 (Excellent)</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-white">Vegetative Stage</div>
                  <div className="text-[9px] text-zinc-500">Tillering / Heading</div>
                </div>
              </div>

              {/* Crop Stats */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-mono uppercase mb-1">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>Est. Yield</span>
                  </div>
                  <div className="text-xs font-bold text-white">5.4 tons/ha</div>
                </div>
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-mono uppercase mb-1">
                    <Droplets className="w-3.5 h-3.5 text-blue-400" />
                    <span>Soil Moisture</span>
                  </div>
                  <div className="text-xs font-bold text-white">62% (Optimal)</div>
                </div>
              </div>

              {/* Progress: Rice Coverage */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-zinc-400">Classified Rice Coverage</span>
                  <span className="text-emerald-400 font-bold">87.5%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "87.5%" }} />
                </div>
                <p className="text-[9px] text-zinc-500 leading-normal">
                  Remaining 12.5% classified as field bunds, access canals, and border vegetation.
                </p>
              </div>

              {/* Estimated Harvest */}
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl">
                <div className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5 font-mono">
                  Projected Harvest Window
                </div>
                <div className="text-xs font-bold text-zinc-200">
                  September 12 – September 20, 2026
                </div>
                <div className="text-[9px] text-zinc-500 mt-1">
                  Estimated based on thermal accumulation indices (GDD) and growth cycle segmentation models.
                </div>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExportGeoJSON}
                className="w-full py-2 bg-slate-950 hover:bg-slate-900 border border-white/10 hover:border-emerald-500/30 text-white hover:text-emerald-400 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export GeoJSON Vector Data
              </button>

            </div>
          </div>
        )}

      </div>

      {/* Footer Info */}
      <div className="p-6 border-t border-white/5 bg-slate-950/20 text-center">
        <p className="text-[9px] text-zinc-600 font-mono tracking-wider">
          AGRICULTURAL INTEL SYSTEM • POWERED BY CANYON-NET INF
        </p>
      </div>
    </aside>
  );
}
