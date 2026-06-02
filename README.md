# AgriAI: Rice Field Analyzer

AgriAI is a specialized geographic intelligence platform prototype designed for agricultural monitoring, specifically focused on rice field analysis. It provides an interactive interface for defining field boundaries, simulating satellite-based AI analysis, and managing agricultural spatial data.

![AgriAI Dashboard](public/next.svg) <!-- Replace with actual screenshot if available -->

## 🌟 Key Features

### 🗺️ Interactive Precision Mapping
- **Boundary Definition:** Use advanced polygon drawing tools powered by Leaflet Geoman to accurately define rice field boundaries.
- **Real-time Metrics:** Instant calculation of field area (square meters/hectares) and perimeter as you draw.
- **Dual Map Views:** Seamlessly toggle between high-resolution Satellite imagery (Esri) and OpenStreetMap Outdoors view.

### 🧠 AI Analysis Simulation
- **Multi-step Pipeline:** Simulated deep learning inference pipeline:
  - Sentinel-2 multi-spectral band acquisition.
  - NDVI (Normalized Difference Vegetation Index) computation.
  - Rice field segmentation neural net execution.
  - Automated statistics and report generation.
- **Dynamic NDVI Overlays:** Generates a spatial health grid within drawn boundaries, visualizing crop vitality from "Bare Soil" to "Excellent Heading".
- **Predictive Analytics:** Provides estimated yield (tons/ha), soil moisture levels, and projected harvest windows based on growth cycle models.

### 📊 Data Management & Export
- **Field Inventory:** Manage multiple field boundaries from a dedicated sidebar.
- **GeoJSON Export:** Export your drawn fields and enriched analysis results (area, centroid, health indices) as standard GeoJSON vector data for use in GIS software.

## 🛠️ Tech Stack

- **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
- **Library:** [React 19](https://reactjs.org/)
- **Map Engine:** [Leaflet](https://leafletjs.com/) with [@geoman-io/leaflet-geoman-free](https://geoman.io/)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)

## 📂 Project Structure

```text
hardcode-fetch-frontend/
├── app/                # Next.js App Router entry points
├── components/         # React components (Dashboard, Map, Sidebar)
├── utils/              # Geospatial helper functions (Area, distance calculations)
├── assets/geojson/     # Sample GeoJSON data
├── public/             # Static assets
└── types/              # TypeScript definitions
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ 
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📝 Usage Guide

1. **Draw a Field:** Click the 🖊️ (Edit) icon in the map controls and click on the map to define a polygon. Double-click or click the first point to finish.
2. **Select & Review:** Click on a drawn boundary to see its metrics in the sidebar.
3. **Analyze:** Click "Analyze Drawn Rice Fields" in the sidebar to run the simulated AI pipeline.
4. **Visualize:** View the generated NDVI grid overlay on the map.
5. **Export:** Once analysis is complete, use the "Export GeoJSON" button to save your data.

---
*Developed for agricultural research and precision farming visualization.*
