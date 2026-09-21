import seedrandom from "seedrandom";

let currentSeed: string = Date.now().toString();
let rng: seedrandom.PRNG = seedrandom(currentSeed);

export function setSeed(seed: string): void {
  currentSeed = seed;
  rng = seedrandom(seed);
}

export function getCurrentSeed(): string {
  return currentSeed;
}

// use this instead of Math.random() anywhere generation needs randomness
export function random(): number {
  return rng();
}