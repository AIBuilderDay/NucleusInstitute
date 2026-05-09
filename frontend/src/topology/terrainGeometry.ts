import { BufferGeometry, Float32BufferAttribute } from "three";
import type { TopologyScores } from "./types";
import { DIMENSION_ORDER } from "./types";

const SPOKE_COUNT = 7;
const ANGULAR_SUBDIVS = 12;
const TOTAL_ANGULAR = SPOKE_COUNT * ANGULAR_SUBDIVS;
const LAT_SEGMENTS = 24;
const LON_SEGMENTS = TOTAL_ANGULAR;

function catmullRomPoint(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function interpolateScores(scores: TopologyScores): Float64Array {
  const values = DIMENSION_ORDER.map((d) => scores[d]);
  const result = new Float64Array(TOTAL_ANGULAR);

  for (let spoke = 0; spoke < SPOKE_COUNT; spoke++) {
    const p0 = values[(spoke - 1 + SPOKE_COUNT) % SPOKE_COUNT];
    const p1 = values[spoke];
    const p2 = values[(spoke + 1) % SPOKE_COUNT];
    const p3 = values[(spoke + 2) % SPOKE_COUNT];

    for (let sub = 0; sub < ANGULAR_SUBDIVS; sub++) {
      const t = sub / ANGULAR_SUBDIVS;
      const idx = spoke * ANGULAR_SUBDIVS + sub;
      result[idx] = catmullRomPoint(p0, p1, p2, p3, t);
    }
  }
  return result;
}

export function buildBlobGeometry(
  scores: TopologyScores,
  opts?: { baseRadius?: number },
): BufferGeometry {
  const baseRadius = opts?.baseRadius ?? 2;
  const radii = interpolateScores(scores);

  // UV sphere with modulated radius at the equator
  // Latitude: 0 (north pole) to PI (south pole)
  // Longitude: 0 to 2*PI (maps to our 7-spoke angles)
  const vertCount = (LAT_SEGMENTS + 1) * (LON_SEGMENTS + 1);
  const positions = new Float32Array(vertCount * 3);

  let vi = 0;
  for (let lat = 0; lat <= LAT_SEGMENTS; lat++) {
    const phi = (lat / LAT_SEGMENTS) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    // How much the spoke scores affect this latitude ring
    // Full effect at equator (phi=PI/2), no effect at poles
    const influence = sinPhi;

    for (let lon = 0; lon <= LON_SEGMENTS; lon++) {
      const lonIdx = lon % TOTAL_ANGULAR;
      const spokeValue = radii[lonIdx];

      // Radius: blend between a minimum sphere and the spoke-modulated radius
      const r = baseRadius * (0.35 + 0.65 * (1.0 - influence + influence * spokeValue));

      const theta = (lon / LON_SEGMENTS) * Math.PI * 2;
      const idx = vi * 3;
      positions[idx] = r * sinPhi * Math.cos(theta);
      positions[idx + 1] = r * cosPhi;
      positions[idx + 2] = r * sinPhi * Math.sin(theta);
      vi++;
    }
  }

  // Indices
  const faces: number[] = [];
  for (let lat = 0; lat < LAT_SEGMENTS; lat++) {
    for (let lon = 0; lon < LON_SEGMENTS; lon++) {
      const a = lat * (LON_SEGMENTS + 1) + lon;
      const b = a + LON_SEGMENTS + 1;
      faces.push(a, b, a + 1);
      faces.push(a + 1, b, b + 1);
    }
  }

  const geom = new BufferGeometry();
  geom.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geom.setIndex(new Float32BufferAttribute(new Uint32Array(faces), 1));
  geom.computeVertexNormals();

  return geom;
}
