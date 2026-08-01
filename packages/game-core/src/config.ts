export const TICK_RATE = 30;
export const TICK_MS = 1000 / TICK_RATE;

export const TILE_UNITS = 1024;
export const HALF_TILE = TILE_UNITS / 2;
export const PLAYER_BODY_HALF = 282;
export const BLAST_HITBOX_HALF = 196;
export const CORNER_ASSIST_UNITS = 340;

export const BALLOON_FUSE_TICKS = 75;
export const BLAST_DURATION_TICKS = 12;
export const TRAPPED_DURATION_TICKS = 90;
export const NEEDLE_INVULNERABILITY_TICKS = 18;

export const ROUND_DURATION_TICKS = 150 * TICK_RATE;
export const STORM_START_TICK = 120 * TICK_RATE;
export const STORM_RING_INTERVAL_TICKS = 4 * TICK_RATE;
export const STORM_TRAP_DURATION_TICKS = 30;

export const MAX_BALLOON_CAPACITY = 6;
export const MAX_BLAST_RANGE = 7;
export const MAX_SPEED_LEVEL = 6;
export const MAX_NEEDLES = 1;

export const SPEED_UNITS_PER_TICK = [
  104,
  116,
  128,
  140,
  152,
  164,
  176,
] as const;

export const TRAPPED_SPEED_UNITS_PER_TICK = 38;
