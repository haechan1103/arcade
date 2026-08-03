import {
  BALLOON_FUSE_TICKS,
  BLAST_DURATION_TICKS,
  STORM_RING_INTERVAL_TICKS,
  STORM_START_TICK,
  TILE_UNITS,
  speedUnitsPerTick,
} from "./config";
import {
  balloonAt,
  bodyIntersectsCell,
  CARDINAL_STEPS,
  cellCenter,
  cellKey,
  inBounds,
  isPlayerCentered,
  isWalkableCell,
  playerCell,
  toIndex,
} from "./geometry";
import { nextRandom, normalizeSeed } from "./rng";
import type {
  AiDebugInfo,
  BalloonState,
  Cell,
  Difficulty,
  Direction,
  GameState,
  PlayerInput,
  PlayerState,
} from "./types";

interface DangerWindow {
  start: number;
  end: number;
}

type DangerMap = Map<string, DangerWindow[]>;

interface DifficultyConfig {
  reactionTicks: number;
  dangerLeadTicks: number;
  safeHoldTicks: number;
  mistakeChance: number;
  aggression: number;
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    reactionTicks: 10,
    dangerLeadTicks: 32,
    safeHoldTicks: 16,
    mistakeChance: 0.18,
    aggression: 0.36,
  },
  normal: {
    reactionTicks: 5,
    dangerLeadTicks: 52,
    safeHoldTicks: 24,
    mistakeChance: 0.05,
    aggression: 0.62,
  },
  hard: {
    reactionTicks: 2,
    dangerLeadTicks: 78,
    safeHoldTicks: 34,
    mistakeChance: 0.01,
    aggression: 0.84,
  },
};

const DIRECTION_BY_STEP = new Map<string, Direction>([
  ["0,-1", "up"],
  ["1,0", "right"],
  ["0,1", "down"],
  ["-1,0", "left"],
]);

function addDanger(
  danger: DangerMap,
  cell: Cell,
  window: DangerWindow,
): void {
  const key = cellKey(cell);
  const windows = danger.get(key) ?? [];
  windows.push(window);
  windows.sort((a, b) => a.start - b.start || a.end - b.end);
  danger.set(key, windows);
}

function projectedBlastCells(
  state: GameState,
  balloon: BalloonState,
  allBalloons: readonly BalloonState[],
): Cell[] {
  const cells: Cell[] = [{ col: balloon.col, row: balloon.row }];

  for (const direction of CARDINAL_STEPS) {
    for (let distance = 1; distance <= balloon.range; distance += 1) {
      const cell = {
        col: balloon.col + direction.col * distance,
        row: balloon.row + direction.row * distance,
      };
      if (!inBounds(state, cell.col, cell.row)) {
        break;
      }

      const tile = state.tiles[toIndex(state.width, cell.col, cell.row)];
      if (tile === undefined || tile.kind === "hard") {
        break;
      }

      cells.push(cell);
      if (tile.kind === "soft") {
        break;
      }

      const blockingBalloon = allBalloons.find(
        (candidate) =>
          candidate.id !== balloon.id &&
          candidate.col === cell.col &&
          candidate.row === cell.row,
      );
      if (blockingBalloon !== undefined) {
        break;
      }
    }
  }

  return cells;
}

export function computeDangerMap(
  state: GameState,
  extraBalloon: BalloonState | null = null,
): DangerMap {
  const danger: DangerMap = new Map();

  for (const blast of state.blasts) {
    for (const cell of blast.cells) {
      addDanger(danger, cell, {
        start: state.tick,
        end: blast.expireTick,
      });
    }
  }

  const allBalloons =
    extraBalloon === null
      ? [...state.balloons]
      : [...state.balloons, extraBalloon];
  const effectiveTicks = new Map(
    allBalloons.map((balloon) => [balloon.id, balloon.explodeTick]),
  );

  for (let iteration = 0; iteration < allBalloons.length; iteration += 1) {
    let changed = false;
    const ordered = [...allBalloons].sort(
      (a, b) =>
        (effectiveTicks.get(a.id) ?? a.explodeTick) -
          (effectiveTicks.get(b.id) ?? b.explodeTick) ||
        a.id - b.id,
    );

    for (const balloon of ordered) {
      const sourceTick =
        effectiveTicks.get(balloon.id) ?? balloon.explodeTick;
      const cells = projectedBlastCells(state, balloon, allBalloons);
      for (const cell of cells) {
        const chained = allBalloons.find(
          (candidate) =>
            candidate.id !== balloon.id &&
            candidate.col === cell.col &&
            candidate.row === cell.row,
        );
        if (chained === undefined) {
          continue;
        }

        const currentTick =
          effectiveTicks.get(chained.id) ?? chained.explodeTick;
        if (sourceTick < currentTick) {
          effectiveTicks.set(chained.id, sourceTick);
          changed = true;
        }
      }
    }

    if (!changed) {
      break;
    }
  }

  for (const balloon of allBalloons) {
    const explosionTick =
      effectiveTicks.get(balloon.id) ?? balloon.explodeTick;
    for (const cell of projectedBlastCells(state, balloon, allBalloons)) {
      addDanger(danger, cell, {
        start: explosionTick,
        end: explosionTick + BLAST_DURATION_TICKS,
      });
    }
  }

  for (let row = 0; row < state.height; row += 1) {
    for (let col = 0; col < state.width; col += 1) {
      const ring = Math.min(
        col,
        row,
        state.width - 1 - col,
        state.height - 1 - row,
      );
      const stormTick =
        STORM_START_TICK + ring * STORM_RING_INTERVAL_TICKS;
      addDanger(danger, { col, row }, {
        start: Math.max(state.tick, stormTick),
        end: Number.POSITIVE_INFINITY,
      });
    }
  }

  return danger;
}

function isSafeBetween(
  danger: DangerMap,
  cell: Cell,
  startTick: number,
  endTick: number,
): boolean {
  const windows = danger.get(cellKey(cell)) ?? [];
  return windows.every(
    (window) => endTick < window.start || startTick > window.end,
  );
}

function hasDangerSoon(
  danger: DangerMap,
  cell: Cell,
  tick: number,
  leadTicks: number,
): boolean {
  const windows = danger.get(cellKey(cell)) ?? [];
  return windows.some(
    (window) =>
      window.end >= tick && window.start <= tick + leadTicks,
  );
}

function playerHasDangerSoon(
  state: GameState,
  danger: DangerMap,
  player: PlayerState,
  tick: number,
  leadTicks: number,
): boolean {
  const center = playerCell(player);

  for (let row = center.row - 1; row <= center.row + 1; row += 1) {
    for (
      let col = center.col - 1;
      col <= center.col + 1;
      col += 1
    ) {
      const cell = { col, row };
      if (
        inBounds(state, col, row) &&
        bodyIntersectsCell(player, cell) &&
        hasDangerSoon(danger, cell, tick, leadTicks)
      ) {
        return true;
      }
    }
  }

  return false;
}

function travelTicksPerTile(player: PlayerState): number {
  const speed = speedUnitsPerTick(player.speedStat);
  return Math.ceil(TILE_UNITS / speed);
}

function reconstructDirection(from: Cell, to: Cell): Direction | null {
  return (
    DIRECTION_BY_STEP.get(`${to.col - from.col},${to.row - from.row}`) ??
    null
  );
}

interface PathOptions {
  danger: DangerMap;
  minimumSafeUntilTick: number;
  maxDepth: number;
  blockedAfterExit: Cell | null;
  goal: (cell: Cell, arrivalTick: number, depth: number) => boolean;
}

function findPath(
  state: GameState,
  player: PlayerState,
  options: PathOptions,
): Cell[] {
  const start = playerCell(player);
  const ticksPerTile = travelTicksPerTile(player);
  const queue: Array<{ cell: Cell; path: Cell[]; depth: number }> = [
    { cell: start, path: [], depth: 0 },
  ];
  const visited = new Set<string>([cellKey(start)]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }

    const arrivalTick = state.tick + current.depth * ticksPerTile;
    if (
      current.depth > 0 &&
      options.goal(current.cell, arrivalTick, current.depth)
    ) {
      return current.path;
    }

    if (current.depth >= options.maxDepth) {
      continue;
    }

    for (const step of CARDINAL_STEPS) {
      const next = {
        col: current.cell.col + step.col,
        row: current.cell.row + step.row,
      };
      const key = cellKey(next);
      if (visited.has(key)) {
        continue;
      }

      if (
        options.blockedAfterExit !== null &&
        current.depth > 0 &&
        key === cellKey(options.blockedAfterExit)
      ) {
        continue;
      }

      const ignoreAt =
        current.depth === 0 ? options.blockedAfterExit : null;
      if (!isWalkableCell(state, next.col, next.row, ignoreAt)) {
        continue;
      }

      const nextDepth = current.depth + 1;
      const nextArrival = state.tick + nextDepth * ticksPerTile;
      const nextEntry =
        state.tick + (nextDepth - 1) * ticksPerTile;
      if (
        !isSafeBetween(
          options.danger,
          next,
          nextEntry,
          Math.max(
            nextArrival + 3,
            options.minimumSafeUntilTick,
          ),
        )
      ) {
        continue;
      }

      visited.add(key);
      queue.push({
        cell: next,
        path: [...current.path, next],
        depth: nextDepth,
      });
    }
  }

  return [];
}

function findEscapePath(
  state: GameState,
  player: PlayerState,
  danger: DangerMap,
  safeHoldTicks: number,
  blockedAfterExit: Cell | null,
): Cell[] {
  const escapeHorizonTick =
    state.tick +
    BALLOON_FUSE_TICKS +
    BLAST_DURATION_TICKS +
    3;

  return findPath(state, player, {
    danger,
    minimumSafeUntilTick: state.tick,
    maxDepth: 14,
    blockedAfterExit,
    goal: (cell, arrivalTick) =>
      isSafeBetween(
        danger,
        cell,
        arrivalTick,
        Math.max(
          arrivalTick + safeHoldTicks,
          escapeHorizonTick,
        ),
      ),
  });
}

function findGoalPath(
  state: GameState,
  player: PlayerState,
  danger: DangerMap,
  predicate: (cell: Cell) => boolean,
  minimumSafeUntilTick: number,
): Cell[] {
  return findPath(state, player, {
    danger,
    minimumSafeUntilTick,
    maxDepth: state.width + state.height,
    blockedAfterExit: null,
    goal: (cell) => predicate(cell),
  });
}

function hasAdjacentSoftBlock(state: GameState, cell: Cell): boolean {
  return CARDINAL_STEPS.some((step) => {
    const col = cell.col + step.col;
    const row = cell.row + step.row;
    if (!inBounds(state, col, row)) {
      return false;
    }
    return state.tiles[toIndex(state.width, col, row)]?.kind === "soft";
  });
}

function hasLineAttack(
  state: GameState,
  player: PlayerState,
  opponent: PlayerState,
): boolean {
  const origin = playerCell(player);
  const target = playerCell(opponent);

  if (origin.col !== target.col && origin.row !== target.row) {
    return false;
  }

  const distance =
    origin.col === target.col
      ? Math.abs(origin.row - target.row)
      : Math.abs(origin.col - target.col);
  if (distance > player.blastRange) {
    return false;
  }

  const step = {
    col: Math.sign(target.col - origin.col),
    row: Math.sign(target.row - origin.row),
  };
  for (let index = 1; index < distance; index += 1) {
    const col = origin.col + step.col * index;
    const row = origin.row + step.row * index;
    const tile = state.tiles[toIndex(state.width, col, row)];
    if (
      tile === undefined ||
      tile.kind !== "floor" ||
      balloonAt(state, col, row) !== undefined
    ) {
      return false;
    }
  }

  return true;
}

function hypotheticalBalloon(
  state: GameState,
  player: PlayerState,
): BalloonState {
  const cell = playerCell(player);
  return {
    id: -player.id,
    ownerId: player.id,
    col: cell.col,
    row: cell.row,
    placedTick: state.tick,
    explodeTick: state.tick + BALLOON_FUSE_TICKS,
    range: player.blastRange,
    passThroughPlayerIds: [player.id],
  };
}

function canPlaceBalloon(state: GameState, player: PlayerState): boolean {
  const cell = playerCell(player);
  return (
    player.status === "alive" &&
    player.activeBalloons < player.balloonCapacity &&
    balloonAt(state, cell.col, cell.row) === undefined
  );
}

interface Plan {
  move: Direction | null;
  placeBalloon: boolean;
  useNeedle: boolean;
  debug: AiDebugInfo;
}

export class BotController {
  readonly playerId: number;
  readonly difficulty: Difficulty;

  private nextThinkTick = 0;
  private heldMove: Direction | null = null;
  private escapeTarget: Cell | null = null;
  private escapePath: Cell[] = [];
  private escapeUntilTick = -1;
  private navigationTarget: Cell | null = null;
  private navigationMode: AiDebugInfo["mode"] = "wander";
  private rngState: number;
  private debugInfo: AiDebugInfo = {
    mode: "wander",
    target: null,
    path: [],
  };

  constructor(playerId: number, difficulty: Difficulty, seed: number) {
    this.playerId = playerId;
    this.difficulty = difficulty;
    this.rngState = normalizeSeed(seed ^ (playerId * 0x45d9f3b));
  }

  getDebugInfo(): AiDebugInfo {
    return {
      mode: this.debugInfo.mode,
      target:
        this.debugInfo.target === null
          ? null
          : { ...this.debugInfo.target },
      path: this.debugInfo.path.map((cell) => ({ ...cell })),
    };
  }

  decide(state: GameState): PlayerInput {
    const player = state.players.find(
      (candidate) => candidate.id === this.playerId,
    );
    if (player === undefined || state.phase === "ended") {
      return {
        move: null,
        placeBalloon: false,
        useNeedle: false,
      };
    }

    if (
      player.status === "alive" &&
      state.tick < this.nextThinkTick
    ) {
      const hadStoredMovement =
        this.escapePath.length > 0 ||
        this.navigationTarget !== null;
      const storedPlan = this.continueStoredMovement(player);
      if (storedPlan !== null) {
        this.heldMove = storedPlan.move;
        this.debugInfo = storedPlan.debug;
        return {
          move: storedPlan.move,
          placeBalloon: false,
          useNeedle: false,
        };
      }
      if (hadStoredMovement) {
        this.heldMove = null;
        this.nextThinkTick = state.tick;
      }
    }

    if (state.tick < this.nextThinkTick) {
      return {
        move: this.heldMove,
        placeBalloon: false,
        useNeedle: false,
      };
    }

    const config = DIFFICULTY_CONFIG[this.difficulty];
    this.nextThinkTick = state.tick + config.reactionTicks;
    const plan = this.createPlan(state, player, config);
    this.heldMove = plan.move;
    this.debugInfo = plan.debug;

    return {
      move: plan.move,
      placeBalloon: plan.placeBalloon,
      useNeedle: plan.useNeedle,
    };
  }

  private createPlan(
    state: GameState,
    player: PlayerState,
    config: DifficultyConfig,
  ): Plan {
    const currentCell = playerCell(player);

    if (player.status === "trapped") {
      this.clearEscapeCommitment();
      this.clearNavigation();
      return {
        move: this.directionAwayFromOpponent(state, player),
        placeBalloon: false,
        useNeedle: player.needles > 0,
        debug: {
          mode: "trapped",
          target: null,
          path: [],
        },
      };
    }

    if (player.status === "dead") {
      this.clearEscapeCommitment();
      this.clearNavigation();
      return {
        move: null,
        placeBalloon: false,
        useNeedle: false,
        debug: {
          mode: "trapped",
          target: null,
          path: [],
        },
      };
    }

    const danger = computeDangerMap(state);
    const committedPlan = this.continueEscapeCommitment(
      state,
      player,
      danger,
      config,
    );
    if (committedPlan !== null) {
      return committedPlan;
    }

    if (
      playerHasDangerSoon(
        state,
        danger,
        player,
        state.tick,
        config.dangerLeadTicks,
      )
    ) {
      const path = findEscapePath(
        state,
        player,
        danger,
        config.safeHoldTicks,
        balloonAt(state, currentCell.col, currentCell.row) !== undefined
          ? currentCell
          : null,
      );
      this.commitToEscape(
        path,
        state.tick +
          BALLOON_FUSE_TICKS +
          BLAST_DURATION_TICKS +
          3,
        player,
      );
      return (
        this.continueStoredMovement(player) ??
        this.planFromPath("escape", currentCell, [], false)
      );
    }

    const minimumSafeUntilTick = Math.max(
      state.tick + 8,
      this.escapeUntilTick,
    );
    const navigationPlan = this.continueNavigation(
      state,
      player,
      danger,
      minimumSafeUntilTick,
    );
    if (navigationPlan !== null) {
      return navigationPlan;
    }

    const random = nextRandom(this.rngState);
    this.rngState = random.state;
    if (random.value < config.mistakeChance) {
      return this.wanderPlan(
        state,
        player,
        danger,
        minimumSafeUntilTick,
      );
    }

    const opponent = state.players.find(
      (candidate) =>
        candidate.id !== player.id && candidate.status !== "dead",
    );
    const hasDirectAttack =
      opponent !== undefined &&
      hasLineAttack(state, player, opponent);
    const wantsAttack =
      opponent !== undefined &&
      (hasDirectAttack || random.value < config.aggression);
    const wantsBreak = hasAdjacentSoftBlock(state, currentCell);

    if (
      canPlaceBalloon(state, player) &&
      (wantsBreak || wantsAttack)
    ) {
      const candidate = hypotheticalBalloon(state, player);
      const dangerAfterPlacement = computeDangerMap(state, candidate);
      const escapePath = findEscapePath(
        state,
        player,
        dangerAfterPlacement,
        config.safeHoldTicks,
        currentCell,
      );
      if (escapePath.length > 0) {
        this.commitToEscape(
          escapePath,
          candidate.explodeTick + BLAST_DURATION_TICKS + 3,
          player,
        );
        const movementPlan = this.continueStoredMovement(player);
        const placementMode = hasDirectAttack
          ? "attack"
          : wantsBreak
            ? "break"
            : "attack";
        return {
          move: movementPlan?.move ?? null,
          placeBalloon: true,
          useNeedle: false,
          debug: {
            mode: placementMode,
            target: escapePath.at(-1) ?? null,
            path: escapePath,
          },
        };
      }
    }

    const pickupKeys = new Set(
      state.pickups.map((pickup) => cellKey(pickup)),
    );
    if (pickupKeys.size > 0) {
      const itemPath = findGoalPath(
        state,
        player,
        danger,
        (cell) => pickupKeys.has(cellKey(cell)),
        minimumSafeUntilTick,
      );
      if (itemPath.length > 0) {
        return this.planFromPath(
          "pickup",
          currentCell,
          itemPath,
          false,
        );
      }
    }

    const breakPath = findGoalPath(
      state,
      player,
      danger,
      (cell) => hasAdjacentSoftBlock(state, cell),
      minimumSafeUntilTick,
    );
    if (breakPath.length > 0) {
      return this.planFromPath(
        "break",
        currentCell,
        breakPath,
        false,
      );
    }

    if (opponent !== undefined) {
      const opponentCell = playerCell(opponent);
      const attackPath = findGoalPath(
        state,
        player,
        danger,
        (cell) =>
          Math.abs(cell.col - opponentCell.col) +
            Math.abs(cell.row - opponentCell.row) <=
          1,
        minimumSafeUntilTick,
      );
      if (attackPath.length > 0) {
        return this.planFromPath(
          "attack",
          currentCell,
          attackPath,
          false,
        );
      }
    }

    return this.wanderPlan(
      state,
      player,
      danger,
      minimumSafeUntilTick,
    );
  }

  private continueEscapeCommitment(
    state: GameState,
    player: PlayerState,
    danger: DangerMap,
    config: DifficultyConfig,
  ): Plan | null {
    if (state.tick > this.escapeUntilTick) {
      this.clearEscapeCommitment();
      return null;
    }
    if (this.escapeTarget === null) {
      return null;
    }

    const currentCell = playerCell(player);
    const target = this.escapeTarget;
    const waypoint = this.escapePath[0];
    const targetIsUsable =
      isWalkableCell(state, target.col, target.row) &&
      isSafeBetween(
        danger,
        target,
        state.tick,
        Math.max(
          this.escapeUntilTick,
          state.tick + config.safeHoldTicks,
        ),
      );
    const waypointIsUsable =
      waypoint !== undefined &&
      ((currentCell.col === waypoint.col &&
        currentCell.row === waypoint.row) ||
        isWalkableCell(state, waypoint.col, waypoint.row));

    if (!targetIsUsable || !waypointIsUsable) {
      const replacementPath = findEscapePath(
        state,
        player,
        danger,
        config.safeHoldTicks,
        balloonAt(state, currentCell.col, currentCell.row) !== undefined
          ? currentCell
          : null,
      );
      const replacementTarget = replacementPath.at(-1);
      if (replacementTarget === undefined) {
        return this.planFromPath(
          "escape",
          currentCell,
          [],
          false,
        );
      }

      this.commitToEscape(
        replacementPath,
        Math.max(
          this.escapeUntilTick,
          state.tick +
            BALLOON_FUSE_TICKS +
            BLAST_DURATION_TICKS +
            3,
        ),
        player,
      );
      return this.continueStoredMovement(player);
    }

    return this.continueStoredMovement(player);
  }

  private continueStoredMovement(
    player: PlayerState,
  ): Plan | null {
    while (this.escapePath.length > 0) {
      const waypoint = this.escapePath[0];
      if (waypoint === undefined) {
        break;
      }

      const current = playerCell(player);
      const reachedWaypoint =
        current.col === waypoint.col &&
        current.row === waypoint.row &&
        isPlayerCentered(player);
      if (!reachedWaypoint) {
        return this.planTowardCell(
          "escape",
          player,
          waypoint,
        );
      }

      this.escapePath.shift();
    }

    if (this.escapeTarget !== null && this.escapePath.length === 0) {
      this.escapeTarget = null;
      this.clearNavigation();
      return null;
    }

    const navigationTarget = this.navigationTarget;
    if (navigationTarget === null) {
      return null;
    }

    const current = playerCell(player);
    if (
      current.col === navigationTarget.col &&
      current.row === navigationTarget.row &&
      isPlayerCentered(player)
    ) {
      this.clearNavigation();
      return null;
    }

    return this.planTowardCell(
      this.navigationMode,
      player,
      navigationTarget,
    );
  }

  private continueNavigation(
    state: GameState,
    player: PlayerState,
    danger: DangerMap,
    minimumSafeUntilTick: number,
  ): Plan | null {
    const target = this.navigationTarget;
    if (target === null) {
      return null;
    }

    const current = playerCell(player);
    const distance =
      Math.abs(current.col - target.col) +
      Math.abs(current.row - target.row);
    const targetIsCurrent =
      current.col === target.col && current.row === target.row;
    const targetIsUsable =
      (targetIsCurrent ||
        isWalkableCell(state, target.col, target.row)) &&
      isSafeBetween(
        danger,
        target,
        state.tick,
        minimumSafeUntilTick,
      );

    if (!targetIsUsable || distance > 1) {
      this.clearNavigation();
      return null;
    }

    if (targetIsCurrent && isPlayerCentered(player)) {
      this.clearNavigation();
      return null;
    }

    return this.planTowardCell(
      this.navigationMode,
      player,
      target,
    );
  }

  private planTowardCell(
    mode: AiDebugInfo["mode"],
    player: PlayerState,
    target: Cell,
  ): Plan {
    const center = cellCenter(target);
    const horizontalOffset = center.x - player.x;
    const verticalOffset = center.y - player.y;
    let move: Direction | null = null;

    if (Math.abs(horizontalOffset) > Math.abs(verticalOffset)) {
      move = horizontalOffset > 0 ? "right" : "left";
    } else if (verticalOffset !== 0) {
      move = verticalOffset > 0 ? "down" : "up";
    }

    return {
      move,
      placeBalloon: false,
      useNeedle: false,
      debug: {
        mode,
        target: { ...target },
        path: [{ ...target }],
      },
    };
  }

  private commitToEscape(
    path: Cell[],
    untilTick: number,
    player: PlayerState,
  ): void {
    const target = path.at(-1);
    if (target === undefined) {
      return;
    }

    const current = playerCell(player);
    const storedPath = path.map((cell) => ({ ...cell }));
    const first = storedPath[0];
    if (
      !isPlayerCentered(player) &&
      (first === undefined ||
        first.col !== current.col ||
        first.row !== current.row)
    ) {
      storedPath.unshift({ ...current });
    }

    this.escapeTarget = { ...target };
    this.escapePath = storedPath;
    this.escapeUntilTick = untilTick;
    this.clearNavigation();
  }

  private clearEscapeCommitment(): void {
    this.escapeTarget = null;
    this.escapePath = [];
    this.escapeUntilTick = -1;
  }

  private clearNavigation(): void {
    this.navigationTarget = null;
  }

  private planFromPath(
    mode: AiDebugInfo["mode"],
    origin: Cell,
    path: Cell[],
    placeBalloon: boolean,
  ): Plan {
    const next = path[0];
    if (
      next !== undefined &&
      mode !== "escape" &&
      !placeBalloon
    ) {
      this.navigationTarget = { ...next };
      this.navigationMode = mode;
    }
    return {
      move:
        next === undefined ? null : reconstructDirection(origin, next),
      placeBalloon,
      useNeedle: false,
      debug: {
        mode,
        target: path.at(-1) ?? null,
        path,
      },
    };
  }

  private wanderPlan(
    state: GameState,
    player: PlayerState,
    danger: DangerMap,
    minimumSafeUntilTick: number,
  ): Plan {
    const origin = playerCell(player);
    const candidates = CARDINAL_STEPS.map((step) => ({
      step,
      cell: {
        col: origin.col + step.col,
        row: origin.row + step.row,
      },
    })).filter(
      ({ cell }) =>
        isWalkableCell(state, cell.col, cell.row) &&
        isSafeBetween(
          danger,
          cell,
          state.tick,
          minimumSafeUntilTick,
        ),
    );

    const random = nextRandom(this.rngState);
    this.rngState = random.state;
    const choice =
      candidates[Math.floor(random.value * candidates.length)];
    const direction =
      choice === undefined
        ? null
        : reconstructDirection(origin, choice.cell);
    if (choice !== undefined) {
      this.navigationTarget = { ...choice.cell };
      this.navigationMode = "wander";
    }

    return {
      move: direction,
      placeBalloon: false,
      useNeedle: false,
      debug: {
        mode: "wander",
        target: choice?.cell ?? null,
        path: choice === undefined ? [] : [choice.cell],
      },
    };
  }

  private directionAwayFromOpponent(
    state: GameState,
    player: PlayerState,
  ): Direction | null {
    const opponent = state.players.find(
      (candidate) =>
        candidate.id !== player.id && candidate.status === "alive",
    );
    if (opponent === undefined) {
      return null;
    }

    const horizontalDistance = player.x - opponent.x;
    const verticalDistance = player.y - opponent.y;
    if (Math.abs(horizontalDistance) >= Math.abs(verticalDistance)) {
      return horizontalDistance >= 0 ? "right" : "left";
    }
    return verticalDistance >= 0 ? "down" : "up";
  }
}
