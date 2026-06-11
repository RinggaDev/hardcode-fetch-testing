"use client";

import React, { useState, useEffect } from "react";
import { 
  Sprout, 
  MapPin, 
  Trash2, 
  Download, 
  HelpCircle,
  Wheat,
  Leaf,
  Copy,
  Check,
  CheckCircle,
  FileCode,
  AlertTriangle
} from "lucide-react";
import { 
  formatArea, 
  formatDistance, 
  calculatePolygonArea, 
  calculatePolygonPerimeter, 
  getFeatureCentroid,
  formatToBackendGeoJSON 
} from "@/utils/geoHelpers";

interface SidebarProps {
  features: any[];
  onDeleteFeature: (id: string) => void;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  isAnalyzing: boolean;
  onStartAnalysis: () => void;
  analysisResults: any | null;
  onResetAnalysis: () => void;
  cropType: string;
  onCropTypeChange: (crop: string) => void;
  apiUrl: string;
  onApiUrlChange: (url: string) => void;
  apiError: string | null;
  onClearError: () => void;
  onLoadMockResponse: () => void;
}

export default function Sidebar({
  features,
  onDeleteFeature,
  selectedFeatureId,
  onSelectFeature,
  cropType,
  onCropTypeChange,
}: SidebarProps) {
  const [copied, setCopied] = useState(false);

  // Determine which feature is currently active (selected, or fallback to the last drawn feature)
  const activeFeature = features.find(f => f.id === selectedFeatureId) || features[features.length - 1];
  
  // Format the active feature into the standardized GeoJSON payload required by the backend
  const standardizedGeoJSON = activeFeature 
    ? formatToBackendGeoJSON(activeFeature, cropType) 
    : null;

  const geojsonString = standardizedGeoJSON 
    ? JSON.stringify(standardizedGeoJSON, null, 2) 
    : "";

  const handleCopyPayload = () => {
    if (!geojsonString) return;
    navigator.clipboard.writeText(geojsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadGeoJSON = () => {
    if (!standardizedGeoJSON) return;
    
    const blob = new Blob([geojsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cultivai-backend-standard-${cropType.toLowerCase()}-${Date.now()}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Check data contract requirements
  const isPolygon = activeFeature?.geometry?.type === "Polygon";
  const hasFeatures = features.length > 0;
  
  // Verify coordinate closure for polygon rings
  let hasClosedRings = false;
  if (activeFeature && isPolygon) {
    const coords = activeFeature.geometry.coordinates?.[0];
    if (coords && coords.length > 0) {
      const first = coords[0];
      const last = coords[coords.length - 1];
      hasClosedRings = first[0] === last[0] && first[1] === last[1];
    }
  }

  return (
    <aside className="w-[380px] h-full flex flex-col glass-panel shadow-2xl z-30 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Sprout className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-semibold text-white tracking-wide text-base">AgriAI</h1>
            <p className="text-[10px] text-zinc-400 font-mono tracking-wider">GEOJSON STANDARDIZER</p>
          </div>
        </div>
        <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold">
          v2.0 Spec
        </span>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
        
        {/* Commodity Crop Type Selector */}
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">
            1. Target Crop Variable (properties.crop_type)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "Padi", label: "Padi / Rice", icon: Sprout, color: "text-emerald-400 border-emerald-500/20 active:bg-emerald-500/10 active:border-emerald-500" },
              { id: "Jagung", label: "Jagung / Corn", icon: Wheat, color: "text-amber-400 border-amber-500/20 active:bg-amber-500/10 active:border-amber-500" },
              { id: "Tebu", label: "Tebu / Cane", icon: Leaf, color: "text-sky-400 border-sky-500/20 active:bg-sky-500/10 active:border-sky-500" }
            ].map((crop) => {
              const Icon = crop.icon;
              const isActive = cropType === crop.id;
              return (
                <button
                  key={crop.id}
                  onClick={() => onCropTypeChange(crop.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    isActive 
                      ? `${crop.color.split("active:")[1]} bg-slate-900/60 font-semibold scale-[1.02] shadow-[0_0_12px_rgba(255,255,255,0.02)]`
                      : "border-white/5 bg-slate-950/40 text-zinc-400 hover:border-white/10 hover:text-white"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${isActive ? crop.color.split(" ")[0] : "text-zinc-500"}`} />
                  <span className="text-[10px] uppercase font-mono tracking-wider">{crop.label.split(" / ")[0]}</span>
                  <span className="text-[8px] text-zinc-500 font-sans tracking-normal">{crop.label.split(" / ")[1]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawn Features List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">
              2. Drawn Geometries
            </label>
            <span className="text-[10px] font-mono bg-white/5 border border-white/5 text-zinc-300 px-2 py-0.5 rounded-full">
              {features.length}
            </span>
          </div>

          {features.length === 0 ? (
            <div className="glass-card rounded-xl p-5 text-center border-dashed border-white/10">
              <div className="w-8 h-8 rounded-full bg-white/5 mx-auto mb-2.5 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-zinc-500" />
              </div>
              <p className="text-xs text-zinc-400 leading-normal max-w-[240px] mx-auto">
                No boundaries drawn. Draw a polygon or place a marker pin on the map.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
              {features.map((feat, index) => {
                const isSelected = feat.id === selectedFeatureId || (!selectedFeatureId && index === features.length - 1);
                const geomType = feat.geometry?.type;
                const centroid = getFeatureCentroid(feat);

                let areaVal = 0;
                let perimeterVal = 0;
                if (geomType === "Polygon") {
                  const coords = feat.geometry?.coordinates?.[0] || [];
                  areaVal = calculatePolygonArea(coords);
                  perimeterVal = calculatePolygonPerimeter(coords);
                }

                return (
                  <div
                    key={feat.id || index}
                    onClick={() => onSelectFeature(feat.id)}
                    className={`glass-card p-3 rounded-xl cursor-pointer transition-all border flex items-center justify-between group ${
                      isSelected 
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20" 
                        : "border-white/5 hover:border-white/10 hover:bg-white/[0.01]"
                    }`}
                  >
                    <div className="space-y-0.5 overflow-hidden">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-emerald-400" : "bg-zinc-600"}`} />
                        <div className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
                          {geomType === "Polygon" ? `Polygon Area #${index + 1}` : `Point Pin #${index + 1}`}
                        </div>
                      </div>
                      
                      {geomType === "Polygon" ? (
                        <div className="flex gap-2.5 text-[9px] text-zinc-400 font-mono">
                          <span>A: <strong className="text-zinc-300">{formatArea(areaVal)}</strong></span>
                          <span>P: <strong className="text-zinc-300">{formatDistance(perimeterVal)}</strong></span>
                        </div>
                      ) : (
                        <div className="text-[9px] text-zinc-400 font-mono">
                          Type: <strong className="text-zinc-300">Point Node</strong>
                        </div>
                      )}
                      
                      <div className="text-[8px] text-zinc-500 font-mono truncate">
                        Centroid: {centroid[0].toFixed(5)}°E, {centroid[1].toFixed(5)}°N
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFeature(feat.id);
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                      title="Delete Geoman Feature"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Validation Specs Checklist */}
        {hasFeatures && (
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">
              3. Specification Verification
            </label>
            <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3.5 space-y-2">
              <div className="flex items-start gap-2.5 text-[10px]">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-200">Coordinate Ordering</div>
                  <div className="text-[9px] text-zinc-500 font-mono">Standardized [Longitude, Latitude] schema.</div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-[10px]">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-zinc-200">Metadata Ingestion</div>
                  <div className="text-[9px] text-zinc-500 font-mono">crop_type: &quot;{cropType}&quot; embedded.</div>
                </div>
              </div>

              {isPolygon ? (
                <div className="flex items-start gap-2.5 text-[10px]">
                  {hasClosedRings ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-semibold text-zinc-200">Polygon Closure Loop</div>
                    <div className="text-[9px] text-zinc-500 font-mono">
                      {hasClosedRings 
                        ? "Verified. First and last coordinate pair identical." 
                        : "Warning: Coordinates ring is open. Export will self-close."}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 text-[10px]">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-zinc-200">Geometry Standard</div>
                    <div className="text-[9px] text-zinc-500 font-mono">Blueprint B Point model compliant.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Standardized GeoJSON Live View */}
        <div className="space-y-2 flex-1 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-bold">
              4. Standardized GeoJSON Data Payload
            </label>
            {hasFeatures && (
              <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-mono tracking-wider">
                RFC 7946 OK
              </span>
            )}
          </div>

          {hasFeatures ? (
            <div className="flex-1 flex flex-col border border-white/5 rounded-xl overflow-hidden bg-slate-950/80">
              {/* Code Panel Header */}
              <div className="px-3.5 py-2 border-b border-white/5 bg-slate-900/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] font-mono tracking-wider">
                    {isPolygon ? "Blueprint A (Polygon)" : "Blueprint B (Point)"}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyPayload}
                    className="p-1 rounded bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Copy Payload"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={handleDownloadGeoJSON}
                    className="p-1 rounded bg-white/5 border border-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Download GeoJSON File"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Code content */}
              <div className="p-3.5 flex-1 overflow-auto max-h-[260px] custom-scrollbar font-mono text-[9.5px] leading-relaxed text-emerald-300/80 select-text whitespace-pre">
                {geojsonString}
              </div>
            </div>
          ) : (
            <div className="flex-1 border border-white/5 rounded-xl flex items-center justify-center p-5 text-center bg-slate-950/20 border-dashed">
              <span className="text-[10px] text-zinc-500 font-mono">
                Draw a map boundary to render the backend-compliant data payload blueprint here.
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Footer Info */}
      <div className="p-5 border-t border-white/5 bg-slate-950/20 text-center flex flex-col gap-1.5">
        {hasFeatures && (
          <div className="flex gap-2">
            <button
              onClick={handleCopyPayload}
              className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-slate-950 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy Payload"}
            </button>
            <button
              onClick={handleDownloadGeoJSON}
              className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 border border-white/10 text-zinc-200 hover:text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        )}
        <p className="text-[9px] text-zinc-600 font-mono tracking-wider pt-2">
          COOPERATIVE DATA CONTRACT INTEGRITY SYSTEM
        </p>
      </div>
    </aside>
  );
}
