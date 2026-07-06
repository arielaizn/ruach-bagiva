// Model factory facade. Implementations live in models-life.js (people,
// animals, hostiles) and models-structures.js (buildings, vehicles, props).
import { LIFE_BUILDERS } from './models-life.js';
import { STRUCTURE_BUILDERS } from './models-structures.js';

const BUILDERS = { ...LIFE_BUILDERS, ...STRUCTURE_BUILDERS };

// createModel(type, opts) -> THREE.Group, origin at ground center, +Z forward.
// group.userData.anim may hold {legs:[], arms:[], head, tail, flag, door, ...}.
export function createModel(type, opts = {}) {
  const builder = BUILDERS[type];
  if (!builder) {
    console.warn('[models] unknown type:', type);
    return BUILDERS.__fallback(opts);
  }
  const g = builder(opts);
  g.userData.modelType = type;
  return g;
}

export function hasModel(type) { return !!BUILDERS[type]; }
