export interface Turn {
  id: string;
  instruction: string;
  angle: number;
  distanceFromStart: number;
  bearing: number;
  points: RoutePoint[];
  terrainChange?: {
    description: string;
  };
}

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
  commandIndex?: number; // BRouter maneuver type from voicehints
  turnAngleFromHint?: number; // Turn angle from voicehints
}

// BRouter related types
export type BRouterMessage = [
  string, // longitude
  string, // latitude
  string, // elevation
  string, // distance
  string, // costPerKm
  string, // elevCost
  string, // turnCost
  string, // nodeCost
  string, // initialCost
  string, // wayTags
  string, // nodeTags
  string, // time
];

export type BRouterVoiceHint = [
  number, // indexInTrack - position in coordinates array
  number, // commandIndex - maneuver type (0=straight, 1=TR, 2=TL, etc.)
  number, // exitNumber - for roundabouts (0 if not roundabout)
  number, // distanceToNext - distance to next hint in meters
  number, // angle - turn angle in degrees (negative=left, positive=right)
];

export interface BRouterFeature {
  type: 'Feature';
  properties: {
    'track-length': number;
    'filtered ascend': number;
    'plain-ascend': number;
    'total-time': number;
    'total-energy': number;
    creator: string;
    messages: (string[] | BRouterMessage)[];
    voicehints?: BRouterVoiceHint[];
  };
  geometry: {
    type: 'LineString';
    coordinates: [number, number, number][];
  };
}

export interface BRouterGeoJSON {
  type: 'FeatureCollection';
  features: BRouterFeature[];
}

export interface LocalCoordinate {
  x: number;
  y: number;
}

export interface TransformContext {
  centerLat: number;
  centerLon: number;
  pixelsPerMeter: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}
