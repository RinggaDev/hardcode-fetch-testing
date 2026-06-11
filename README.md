<img width="1292" height="610" alt="image" src="https://github.com/user-attachments/assets/7573799d-8f25-4dd5-9fc5-5b708f84319b" />
<img width="1919" height="1077" alt="image" src="https://github.com/user-attachments/assets/ecce34f9-718b-4a19-83a0-79aebe04cff1" />

# AgriAI: GeoJSON Data Contract Standardizer (MVP)

AgriAI is a targeted MVP frontend application designed to act as a **Cooperative Data Contract Integrity System**. It is *not* a standalone full-stack GIS platform. Instead, it serves as a specialized, standardized drawing and validation interface that prepares clean, backend-ready GeoJSON payloads for a downstream LLM processing engine.

This tool bridges the gap between human operators (who draw agricultural field boundaries) and a deterministic backend data pipeline, ensuring all spatial data passes strict validation rules before inference.

## 🌟 Core Concept: The Data Contract

Our backend pipeline expects a standard, strictly formatted spatial payload. This frontend guarantees:
- **RFC 7946 GeoJSON Compliance:** Valid `FeatureCollection` structures.
- **Metadata Injection:** Automatic embedding of variables like `crop_type` (e.g., Padi, Jagung, Tebu).
- **Geometry Verification:** Ensuring polygon rings are closed, coordinate ordering is strictly `[Longitude, Latitude]`, and drawing distances stay within valid bounds.

## ✨ Key Features

- **Precision Drawing Tools:** Built on Leaflet Geoman to draw strict spatial boundaries (Polygons) or pinpoint fallback locations (Markers).
- **Live Validation & Specs Verification:** Real-time checking of polygon closure loop, coordinate order, and geometry standards (Blueprint A/Polygon, Blueprint B/Point).
- **Live Payload Construction:** A dedicated UI panel that auto-generates and displays the exact JSON payload ready for `POST` transmission.
- **Seamless API Integration:** Includes built-in mechanisms to `POST` directly to a local backend API (e.g., FastAPI at `http://localhost:8000/api/analyze`) or export the standard `.geojson` artifact manually.

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
├── utils/              # Geospatial validation and formatting logic (geoHelpers.ts)
├── assets/geojson/     # Sample payload data
└── types/              # TypeScript definitions
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ 
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/RinggaDev/hardcode-fetch-testing.git
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

1. **Set Target Crop:** Select the commodity type (Padi, Jagung, Tebu) in the sidebar control panel.
2. **Draw a Boundary:** Click the 🖊️ (Edit) icon on the map to draw a field polygon, or use the 📍 (Marker) for a coordinate pin.
3. **Verify Contract:** Review the "Specification Verification" section in the sidebar to ensure the geometry passes the data contract rules.
4. **Export / Analyze:** Copy the standard JSON payload, download the `.geojson` file, or simulate the backend API POST directly from the dashboard.

---
*Built as the standardized frontend ingestion layer for cooperative data processing models.*
Made with Love © Ringga 2026
