export type Point = { x: number; y: number };

export type LatLonPoint = { latitude: number; longitude: number };

export interface Rn2TransformContext {
  toRn2Point: (p: Point) => Point;
  turnPath: Point[];
}
