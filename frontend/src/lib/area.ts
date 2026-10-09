// Mirrors backend/src/floodsense/config.py
export const CENTER: [number, number] = [28.63, 77.2275];
export const BBOX: [number, number, number, number] = [28.615, 77.205, 28.645, 77.25];

export const inArea = (lat: number, lon: number) =>
  lat >= BBOX[0] && lat <= BBOX[2] && lon >= BBOX[1] && lon <= BBOX[3];

export const clock = (iso: string) => iso.slice(11, 16);
