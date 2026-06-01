/**
 * Geolocation calculations for drawn fields (polygons)
 */

/**
 * Calculates the distance between two points in meters using the Haversine formula.
 */
export function calculateDistance(p1: number[], p2: number[]): number {
  const RADIUS = 6378137.0; // Earth's radius in meters
  const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLon = ((p2[0] - p1[0]) * Math.PI) / 180;
  const lat1 = (p1[1] * Math.PI) / 180;
  const lat2 = (p2[1] * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIUS * c;
}

/**
 * Calculates the perimeter of a polygon in meters.
 */
export function calculatePolygonPerimeter(coordinates: number[][]): number {
  let perimeter = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    perimeter += calculateDistance(coordinates[i], coordinates[i + 1]);
  }
  return perimeter;
}

/**
 * Calculates the area of a spherical polygon in square meters.
 * Based on the spherical ring area formula used by Turf.js
 */
export function calculatePolygonArea(coordinates: number[][]): number {
  let area = 0;
  if (coordinates.length > 2) {
    const RADIUS = 6378137.0; // Earth's radius in meters
    for (let i = 0; i < coordinates.length - 1; i++) {
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];
      const lambda1 = (p1[0] * Math.PI) / 180;
      const lambda2 = (p2[0] * Math.PI) / 180;
      const phi1 = (p1[1] * Math.PI) / 180;
      const phi2 = (p2[1] * Math.PI) / 180;
      area += (lambda2 - lambda1) * (2 + Math.sin(phi1) + Math.sin(phi2));
    }
    area = (area * RADIUS * RADIUS) / 2.0;
  }
  return Math.abs(area);
}

/**
 * Calculates the centroid (average coordinates) of a polygon.
 * Useful for centering the map view on a polygon.
 */
export function calculatePolygonCentroid(coordinates: number[][]): [number, number] {
  let x = 0;
  let y = 0;
  // Exclude the last point if it is duplicate of the first
  const n = coordinates.length > 1 && 
    coordinates[0][0] === coordinates[coordinates.length - 1][0] && 
    coordinates[0][1] === coordinates[coordinates.length - 1][1]
      ? coordinates.length - 1
      : coordinates.length;

  for (let i = 0; i < n; i++) {
    x += coordinates[i][0];
    y += coordinates[i][1];
  }
  return [x / n, y / n];
}

/**
 * Formats area in a human readable way (e.g. m², hectares)
 */
export function formatArea(areaSqMeters: number): string {
  if (areaSqMeters >= 10000) {
    const ha = areaSqMeters / 10000;
    return `${ha.toFixed(2)} ha`;
  }
  return `${areaSqMeters.toFixed(0)} m²`;
}

/**
 * Formats distance in a human readable way (e.g. m, km)
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters >= 1000) {
    const km = distanceMeters / 1000;
    return `${km.toFixed(2)} km`;
  }
  return `${distanceMeters.toFixed(0)} m`;
}
