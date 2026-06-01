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

export default function Dashboard() {
  const [mapboxToken, setMapboxToken] = useState("");
  const [features, setFeatures] = useState<any[]>([]);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  
  // AI Simulation States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  // Load Mapbox token from localStorage or environment variables on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("agri_ai_mapbox_token");
    if (savedToken) {
      setMapboxToken(savedToken);
    } else if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
      setMapboxToken(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
    }
  }, []);

  const handleTokenChange = (newToken: string) => {
    setMapboxToken(newToken);
    if (newToken) {
      localStorage.setItem("agri_ai_mapbox_token", newToken);
    } else {
      localStorage.removeItem("agri_ai_mapbox_token");
    }
  };

  const handleDeleteFeature = (id: string) => {
    setFeatures((prev) => prev.filter((feat) => feat.id !== id));
    if (selectedFeatureId === id) {
      setSelectedFeatureId(null);
    }
  };

  const handleSelectFeature = (id: string | null) => {
    setSelectedFeatureId(id);
  };

  // Run simulated crop detection AI pipeline
  const handleStartAnalysis = () => {
    if (features.length === 0) return;
    
    setIsAnalyzing(true);
    setAnalysisResults(null);
    setActiveStep(0);

    const intervalTime = 1250; // 1.25s per stepper task
    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      if (step <= 3) {
        setActiveStep(step);
      } else {
        clearInterval(interval);
        setIsAnalyzing(false);
        setAnalysisResults({
          analyzedAt: new Date().toISOString(),
          ndviMean: 0.73,
          healthStatus: "Excellent",
          stage: "Vegetative / Tillering",
          yieldTonsPerHa: 5.4,
          soilMoisturePercent: 62
        });
      }
    }, intervalTime);
  };

  const handleResetAnalysis = () => {
    setAnalysisResults(null);
    setIsAnalyzing(false);
    setActiveStep(0);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#090d16] text-[#f8fafc] font-sans">
      {/* Control Sidebar */}
      <Sidebar
        mapboxToken={mapboxToken}
        onTokenChange={handleTokenChange}
        features={features}
        onDeleteFeature={handleDeleteFeature}
        selectedFeatureId={selectedFeatureId}
        onSelectFeature={handleSelectFeature}
        isAnalyzing={isAnalyzing}
        onStartAnalysis={handleStartAnalysis}
        analysisResults={analysisResults}
        onResetAnalysis={handleResetAnalysis}
        activeStep={activeStep}
      />

      {/* Interactive Map Surface */}
      <div className="flex-1 h-full relative overflow-hidden">
        <Map
          mapboxToken={mapboxToken}
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
