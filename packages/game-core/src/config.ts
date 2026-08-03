export const TICK_RATE = 30;
export const TICK_MS = 1000 / TICK_RATE;

export const TILE_UNITS = 1024;
export const HALF_TILE = TILE_UNITS / 2;
export const PLAYER_BODY_HALF = 282;
// The official rule uses a short, wide collision zone at the player's
// feet and traps at 66% coverage. Nexon does not publish its dimensions,
// so only these dimensions are calibrated from the official diagram.
export const PLAYER_FEET_HITBOX_HALF_WIDTH = 350;
export const PLAYER_FEET_HITBOX_HALF_HEIGHT = 150;
export const BLAST_HIT_COVERAGE_PERCENT = 66;

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
export const MAX_NEEDLES = 1;

// Crazy Arcade exposes speed as an integer character stat. The official
// character range is 4 through 10; these per-tick world values are local
// calibration because the original client does not publish pixel timing.
export const MIN_SPEED_STAT = 4;
export const DEFAULT_SPEED_STAT = 5;
export const MAX_SPEED_STAT = 10;
export const SPEED_UNITS_PER_TICK = [
  104,
  116,
  128,
  140,
  152,
  164,
  176,
] as const;

export function speedUnitsPerTick(speedStat: number): number {
  const normalized = Number.isFinite(speedStat)
    ? Math.trunc(speedStat)
    : DEFAULT_SPEED_STAT;
  const clamped = Math.min(
    MAX_SPEED_STAT,
    Math.max(MIN_SPEED_STAT, normalized),
  );
  return (
    SPEED_UNITS_PER_TICK[clamped - MIN_SPEED_STAT] ??
    SPEED_UNITS_PER_TICK[0]
  );
}

export const TRAPPED_SPEED_UNITS_PER_TICK = 38;
