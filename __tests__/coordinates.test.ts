import { hasValidCoordinates, parseCoordinate } from '@/lib/coordinates';

test('rejects astronomical source coordinates that move every marker off the map', () => {
  expect(hasValidCoordinates({ latitude: 41, longitude: 25139000 })).toBe(false);
  expect(hasValidCoordinates({ latitude: 900, longitude: 69 })).toBe(false);
  expect(hasValidCoordinates({ latitude: NaN, longitude: 69 })).toBe(false);
});
test('parses complete numeric values without turning missing or malformed input into zero', () => {
  expect(parseCoordinate(' 41.2995 ', 'latitude')).toBe(41.2995);
  for (const value of [null, undefined, '', ' ', '41garbage', Infinity, true]) {
    expect(parseCoordinate(value, 'latitude')).toBeUndefined();
  }
  expect(parseCoordinate(0, 'latitude')).toBe(0);
  expect(parseCoordinate('-180', 'longitude')).toBe(-180);
});
