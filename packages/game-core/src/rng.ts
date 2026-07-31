export function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? 0x9e3779b9 : normalized;
}

export function nextRandom(state: number): {
  state: number;
  value: number;
} {
  let next = normalizeSeed(state);
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;

  return {
    state: next,
    value: next / 0x1_0000_0000,
  };
}

export function randomInt(
  state: number,
  minInclusive: number,
  maxExclusive: number,
): {
  state: number;
  value: number;
} {
  const random = nextRandom(state);
  return {
    state: random.state,
    value:
      minInclusive +
      Math.floor(random.value * (maxExclusive - minInclusive)),
  };
}
