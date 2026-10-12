/** Reject missing, malformed and out-of-range source coordinates instead of guessing a location. */
export function parseCoordinate(value: unknown, axis: 'latitude' | 'longitude'): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return undefined;
  const number = Number(value);
  const limit = axis === 'latitude' ? 90 : 180;
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : undefined;
}

export function hasValidCoordinates(point: { latitude?: unknown; longitude?: unknown }): boolean {
  return typeof point.latitude === 'number' && typeof point.longitude === 'number'
    && parseCoordinate(point.latitude, 'latitude') !== undefined
    && parseCoordinate(point.longitude, 'longitude') !== undefined;
}
