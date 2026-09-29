// Route point representation used by the route builder UI.
export interface RoutePoint {
  id: string;
  lat: number;
  lon: number;
  color?: string; // Marker and list item color.
  displayName?: string; // Place name resolved by reverse geocoding.
}
