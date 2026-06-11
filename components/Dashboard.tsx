"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";

// Import Map component dynamically to avoid Next.js SSR errors with Mapbox GL
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-full bg-[#080d19] flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs text-zinc-500 font-mono tracking-wider">LOADING GEO ENGINE...</span>
    </div>
  ),
});

import { formatToBackendGeoJSON } from "@/utils/geoHelpers";

export default function Dashboard() {
  const [features, setFeatures] = useState<any[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  
  // Crop & API States
  const [cropType, setCropType] = useState<string>("Padi");
  const [apiUrl, setApiUrl] = useState<string>("http://localhost:8000/api/analyze");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleDeleteFeature = (id: string) => {
    setFeatures((prev) => prev.filter((feat) => feat.id !== id));
    if (selectedFeatureId === id) {
      setSelectedFeatureId(null);
    }
  };

  const handleSelectFeature = (id: string | null) => {
    setSelectedFeatureId(id);
  };

  // POST standardized GeoJSON data to real backend API
  const handleStartAnalysis = async () => {
    const activeFeat = features.find(f => f.id === selectedFeatureId) || features[features.length - 1];
    if (!activeFeat) return;
    
    setIsAnalyzing(true);
    setApiError(null);
    setAnalysisResults(null);

    const payload = formatToBackendGeoJSON(activeFeat, cropType);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setAnalysisResults(data);
    } catch (err: any) {
      console.error("API error during analysis:", err);
      setApiError(err.message || "Failed to connect to backend model API. Make sure your local FastAPI server is running.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fallback to load a high-quality mock response offline
  const handleLoadMockResponse = () => {
    setIsAnalyzing(true);
    setApiError(null);
    setAnalysisResults(null);
    
    setTimeout(() => {
      setIsAnalyzing(false);
      setAnalysisResults({
        guide: [
          "Maintain water levels at 2-5 cm depth during active tillering to suppress weed germination.",
          "Apply recommended nitrogen top-dressing at early panicle initiation.",
          "Conduct routine scout monitoring for Blast Disease (Pyricularia oryzae) symptoms under high relative humidity (>85%).",
          "Ensure efficient drainage lines to keep soil moisture levels from exceeding 75% capacity."
        ],
        prediction: {
          harvest_forecast: "September 12 – September 20, 2026",
          future_conditions: "Centroid environmental indicators suggest optimal canopy growth (NDVI ~0.73). However, the upcoming 7-day Open-Meteo forecast indicates a high relative humidity window. Monitoring is advised to prevent early blast disease outbreaks and biological vulnerability."
        }
      });
    }, 800);
  };

  const handleResetAnalysis = () => {
    setAnalysisResults(null);
    setApiError(null);
    setIsAnalyzing(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-[#f8fafc] font-sans">
      {/* Control Sidebar */}
      <Sidebar
        features={features}
        onDeleteFeature={handleDeleteFeature}
        selectedFeatureId={selectedFeatureId}
        onSelectFeature={handleSelectFeature}
        isAnalyzing={isAnalyzing}
        onStartAnalysis={handleStartAnalysis}
        analysisResults={analysisResults}
        onResetAnalysis={handleResetAnalysis}
        cropType={cropType}
        onCropTypeChange={setCropType}
        apiUrl={apiUrl}
        onApiUrlChange={setApiUrl}
        apiError={apiError}
        onClearError={() => setApiError(null)}
        onLoadMockResponse={handleLoadMockResponse}
      />

      {/* Interactive Map Surface */}
      <div className="flex-1 h-full relative overflow-hidden">
        <Map
          features={features}
          onFeaturesChange={setFeatures}
          selectedFeatureId={selectedFeatureId}
          onSelectFeature={handleSelectFeature}
          isAnalyzing={isAnalyzing}
          analysisResults={analysisResults}
        />
      </div>
    </div>
  );
}
