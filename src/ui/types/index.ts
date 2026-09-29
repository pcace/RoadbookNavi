import { FeatureCollection, LineString } from 'geojson';

// Parsed Route Data
export interface RoutePoint {
  longitude: number;
  latitude: number;
  prevPoint: { latitude: number; longitude: number };
  nextPoint: { latitude: number; longitude: number };
  elevation: number;
  distance: number;
  time: number;
  wayTags: string;
  nodeTags: string;
  totalDistance: number;
}

// Turn Detection
export interface Turn {
  id: string;
  points: RoutePoint[]; // Can contain multiple points for complex turns
  angle: number; // Angle in degrees: negative = left, positive = right
  bearing: number; // Absolute bearing in degrees (0-360, where 0 is North)
  distanceFromStart: number;
  instruction: string;
  terrainChange?: TerrainChange;
  specialNote?: string; // railway crossing, etc.
}

export interface TerrainChange {
  from: TerrainType;
  to: TerrainType;
  description: string;
}

export enum TerrainType {
  HIGHWAY = 'highway',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary',
  RESIDENTIAL = 'residential',
  TRACK = 'track',
  PATH = 'path',
  UNKNOWN = 'unknown',
}

// GPS & Navigation
export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface NavigationState {
  currentPosition?: GPSPosition;
  nextTurn?: Turn;
  nextTurnIndex?: number;
  distanceToNextTurn: number;
  isOnRoute: boolean;
  routeProgress: number; // 0-1
}

// App State
export interface AppState {
  route?: FeatureCollection<LineString>;
  routePoints?: any[]; // Route points for roadbook generation
  turns: Turn[];
  navigation: NavigationState;
  settings: AppSettings;
  odometer: number; // Track distance traveled along route
  autoFollow: boolean; // Auto-follow mode for roadbook
  isMoving?: boolean; // Whether the device is considered moving
}

export interface AppSettings {
  keepScreenOn: boolean;
  odometerDecreaseKey: string;
  odometerIncreaseKey: string;
  roadbookScrollUpKey: string;
  roadbookScrollDownKey: string;
  autoFollowToggleKey: string;
  roadbookScrollMode: 'entry' | 'continuous'; // 'entry' = jump between entries, 'continuous' = smooth scroll
  roadbookScrollSpeed: number; // Pixels per frame for continuous scrolling (default: 3)
  closeDistanceThreshold: number; // Distance in meters to mark entries as close (default: 200)
  defaultMapStyle?: string; // Default map style to use in the route builder
  defaultRoutingProfile?: string; // Default routing profile to use in the route builder
}

// User Limits
export interface UserLimits {
  max_route_length: number; // in meters
  max_distance_km: number; // max distance between waypoints
  max_route_count: number; // max saved routes
}

export interface RouteUsage {
  current_route_count: number;
  max_route_count: number;
  can_create_more: boolean;
  routes_remaining: number;
}
