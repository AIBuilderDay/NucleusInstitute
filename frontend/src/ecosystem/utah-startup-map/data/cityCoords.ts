// Utah city centroids. Used to position markers when we only know the city
// from the CSV. Each marker gets jittered by a deterministic seed so multiple
// startups in the same city don't stack on one pixel.

export const UTAH_CITY_COORDS: Record<string, [number, number]> = {
  // [longitude, latitude]
  "salt lake city": [-111.891, 40.7608],
  "south salt lake": [-111.888, 40.7186],
  "west valley city": [-112.0011, 40.6916],
  "west jordan": [-111.9391, 40.6097],
  "south jordan": [-111.9297, 40.5621],
  "sandy": [-111.8389, 40.5649],
  "draper": [-111.8638, 40.5247],
  "midvale": [-111.8993, 40.6111],
  "murray": [-111.888, 40.6669],
  "millcreek": [-111.8757, 40.6869],
  "cottonwood heights": [-111.8101, 40.6197],
  "holladay": [-111.8243, 40.6688],
  "taylorsville": [-111.9389, 40.6678],
  "kearns": [-112.0019, 40.6597],
  "provo": [-111.6585, 40.2338],
  "orem": [-111.6946, 40.2969],
  "lehi": [-111.8508, 40.3916],
  "american fork": [-111.7949, 40.3769],
  "pleasant grove": [-111.7385, 40.3641],
  "spanish fork": [-111.6549, 40.115],
  "saratoga springs": [-111.9046, 40.3494],
  "eagle mountain": [-111.9133, 40.3144],
  "park city": [-111.4978, 40.6461],
  "heber city": [-111.4133, 40.5072],
  "midway": [-111.4744, 40.5119],
  "ogden": [-111.9738, 41.223],
  "south ogden": [-111.962, 41.197],
  "north ogden": [-111.9802, 41.305],
  "roy": [-112.0263, 41.1616],
  "layton": [-111.9711, 41.0602],
  "kaysville": [-111.9385, 41.0353],
  "farmington": [-111.8869, 40.9805],
  "centerville": [-111.872, 40.9183],
  "bountiful": [-111.8807, 40.8894],
  "clearfield": [-112.0238, 41.1108],
  "syracuse": [-112.0647, 41.0894],
  "logan": [-111.8338, 41.7355],
  "smithfield": [-111.832, 41.8388],
  "north logan": [-111.8077, 41.7693],
  "st. george": [-113.5841, 37.0965],
  "saint george": [-113.5841, 37.0965],
  "st george": [-113.5841, 37.0965],
  "washington": [-113.508, 37.13],
  "hurricane": [-113.2891, 37.1753],
  "ivins": [-113.6783, 37.1672],
  "santa clara": [-113.6535, 37.1305],
  "cedar city": [-113.0619, 37.6775],
  "moab": [-109.5498, 38.5733],
  "vernal": [-109.5288, 40.4555],
  "tooele": [-112.2983, 40.5308],
  "tremonton": [-112.1656, 41.7102],
  "brigham city": [-112.0155, 41.5102],
  "richfield": [-112.0858, 38.7716],
  "price": [-110.8107, 39.5994],
  "blanding": [-109.4787, 37.6233],
  "monticello": [-109.342, 37.871],
  "delta": [-112.575, 39.3527],
  "fillmore": [-112.3271, 38.9683],
  "manti": [-111.6369, 39.2683],
  "ephraim": [-111.5829, 39.3597],
};

const UTAH_FALLBACK: [number, number] = [-111.85, 40.5]; // somewhere in the Wasatch Front

/**
 * Extract a city key from a free-form address string.
 *
 *   "815 West 1250 South, Orem, UT" → "orem"
 *   "1557 West Innovation Way, Lehi, UT" → "lehi"
 *
 * We grab the second-to-last comma-separated chunk and lowercase it.
 */
export function extractCity(address: string): string {
  if (!address) return "";
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  const candidate = parts[parts.length - 2] ?? "";
  return candidate.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Deterministic jitter so startups in the same city don't stack on one pixel.
 * Uses a hash of the seed (typically the startup id/name) to produce a stable
 * offset within a small radius (~0.012° ≈ 1.3km at this latitude).
 */
function jitter(seed: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // map to [-1, 1] in two dimensions
  const dx = ((h >>> 0) % 1000) / 1000 - 0.5;
  const dy = (((h >>> 8) >>> 0) % 1000) / 1000 - 0.5;
  return [dx * 0.024, dy * 0.024];
}

export function coordsFor(city: string, seed: string): [number, number] {
  const key = city.toLowerCase().trim();
  const base = UTAH_CITY_COORDS[key] ?? UTAH_FALLBACK;
  const [dx, dy] = jitter(seed);
  return [base[0] + dx, base[1] + dy];
}

export function isKnownCity(city: string): boolean {
  return Object.prototype.hasOwnProperty.call(
    UTAH_CITY_COORDS,
    city.toLowerCase().trim(),
  );
}
