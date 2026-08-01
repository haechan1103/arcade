import {
  BALLOON_FUSE_TICKS,
  BLAST_DURATION_TICKS,
  CORNER_ASSIST_UNITS,
  HALF_TILE,
  MAX_BALLOON_CAPACITY,
  MAX_BLAST_RANGE,
  MAX_NEEDLES,
  MAX_SPEED_LEVEL,
  NEEDLE_INVULNERABILITY_TICKS,
  PLAYER_BODY_HALF,
  ROUND_DURATION_TICKS,
  SPEED_UNITS_PER_TICK,
  STORM_RING_INTERVAL_TICKS,
  STORM_START_TICK,
  STORM_TRAP_DURATION_TICKS,
  TILE_UNITS,
  TRAPPED_DURATION_TICKS,
  TRAPPED_SPEED_UNITS_PER_TICK,
} from "./config";
import {
  balloonAt,
  blastIntersectsPlayer,
  bodyIntersectsCell,
  CARDINAL_STEPS,
  cellCenter,
  cellKey,
  inBounds,
  isStormCell,
  playerCell,
  playersTouch,
  toIndex,
} from "./geometry";
import type {
  BalloonState,
  BlastState,
  Cell,
  Direction,
  GameEvent,
  GameState,
  InputByPlayer,
  ItemType,
  PlayerState,
  RoundResult,
  TileKind,
} from "./types";

const DIRECTION_VECTOR: Record<Direction, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

function tileKindAt(
  state: Pick<GameState, "tiles" | "width" | "height">,
  col: number,
  row: number,
): TileKind | null {
  if (!inBounds(state, col, row)) {
    return null;
  }
  return state.tiles[toIndex(state.width, col, row)]?.kind ?? null;
}

function cellIsInBlast(state: GameState, cell: Cell): boolean {
  return state.blasts.some((blast) =>
    blast.cells.some((blastCell) => cellKey(blastCell) === cellKey(cell)),
  );
}

function positionIsBlocked(
  state: GameState,
  playerId: number,
  x: number,
  y: number,
): boolean {
  const minCol = Math.floor((x - PLAYER_BODY_HALF) / TILE_UNITS);
  const maxCol = Math.floor((x + PLAYER_BODY_HALF - 1) / TILE_UNITS);
  const minRow = Math.floor((y - PLAYER_BODY_HALF) / TILE_UNITS);
  const maxRow = Math.floor((y + PLAYER_BODY_HALF - 1) / TILE_UNITS);

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!inBounds(state, col, row)) {
        return true;
      }

      const tile = state.tiles[toIndex(state.width, col, row)];
      if (tile === undefined || tile.kind !== "floor") {
        return true;
      }

      if (isStormCell(state, col, row)) {
        return true;
      }

      const balloon = balloonAt(state, col, row);
      if (
        balloon !== undefined &&
        !balloon.passThroughPlayerIds.includes(playerId)
      ) {
        return true;
      }
    }
  }

  return false;
}

function moveAlongAxis(
  state: GameState,
  player: PlayerState,
  axis: "x" | "y",
  delta: number,
): void {
  if (delta === 0) {
    return;
  }

  const start = player[axis];
  const target = start + delta;
  const targetX = axis === "x" ? target : player.x;
  const targetY = axis === "y" ? target : player.y;

  if (!positionIsBlocked(state, player.id, targetX, targetY)) {
    player[axis] = target;
    return;
  }

  const sign = Math.sign(delta);
  let low = 0;
  let high = Math.abs(delta);

  while (low < high) {
    const midpoint = Math.ceil((low + high) / 2);
    const candidate = start + sign * midpoint;
    const candidateX = axis === "x" ? candidate : player.x;
    const candidateY = axis === "y" ? candidate : player.y;

    if (positionIsBlocked(state, player.id, candidateX, candidateY)) {
      high = midpoint - 1;
    } else {
      low = midpoint;
    }
  }

  player[axis] = start + sign * low;
}

function nearestTileCenter(value: number): number {
  return (
    Math.round((value - HALF_TILE) / TILE_UNITS) * TILE_UNITS + HALF_TILE
  );
}

function movePlayerInDirection(
  state: GameState,
  player: PlayerState,
  direction: Direction,
): boolean {
  const startX = player.x;
  const startY = player.y;
  player.direction = direction;
  const baseSpeed =
    player.status === "trapped"
      ? TRAPPED_SPEED_UNITS_PER_TICK
      : (SPEED_UNITS_PER_TICK[player.speedLevel] ??
        SPEED_UNITS_PER_TICK[0]);
  const vector = DIRECTION_VECTOR[direction];

  if (vector.col !== 0) {
    const centerY = nearestTileCenter(player.y);
    const offsetY = centerY - player.y;
    if (Math.abs(offsetY) <= CORNER_ASSIST_UNITS) {
      moveAlongAxis(
        state,
        player,
        "y",
        Math.sign(offsetY) * Math.min(Math.abs(offsetY), baseSpeed),
      );
    }
    moveAlongAxis(state, player, "x", vector.col * baseSpeed);
    return player.x !== startX;
  } else {
    const centerX = nearestTileCenter(player.x);
    const offsetX = centerX - player.x;
    if (Math.abs(offsetX) <= CORNER_ASSIST_UNITS) {
      moveAlongAxis(
        state,
        player,
        "x",
        Math.sign(offsetX) * Math.min(Math.abs(offsetX), baseSpeed),
      );
    }
    moveAlongAxis(state, player, "y", vector.row * baseSpeed);
    return player.y !== startY;
  }
}

function movePlayer(
  state: GameState,
  player: PlayerState,
  direction: Direction | null,
  fallbackDirection: Direction | null,
): void {
  if (direction === null || player.status === "dead") {
    return;
  }

  const startX = player.x;
  const startY = player.y;
  const movedInPrimaryDirection = movePlayerInDirection(
    state,
    player,
    direction,
  );
  const primaryIsHorizontal =
    direction === "left" || direction === "right";
  const fallbackIsHorizontal =
    fallbackDirection === "left" || fallbackDirection === "right";
  if (
    movedInPrimaryDirection ||
    fallbackDirection === null ||
    primaryIsHorizontal === fallbackIsHorizontal
  ) {
    return;
  }

  player.x = startX;
  player.y = startY;
  movePlayerInDirection(state, player, fallbackDirection);
}

function placeBalloon(
  state: GameState,
  player: PlayerState,
  events: GameEvent[],
): void {
  if (
    player.status !== "alive" ||
    player.activeBalloons >= player.balloonCapacity
  ) {
    return;
  }

  const cell = playerCell(player);
  if (
    balloonAt(state, cell.col, cell.row) !== undefined ||
    cellIsInBlast(state, cell) ||
    isStormCell(state, cell.col, cell.row)
  ) {
    return;
  }

  const tile = state.tiles[toIndex(state.width, cell.col, cell.row)];
  if (tile === undefined || tile.kind !== "floor") {
    return;
  }

  const passThroughPlayerIds = state.players
    .filter(
      (candidate) =>
        candidate.status !== "dead" &&
        bodyIntersectsCell(candidate, cell),
    )
    .map((candidate) => candidate.id)
    .sort((a, b) => a - b);

  const balloon: BalloonState = {
    id: state.nextEntityId,
    ownerId: player.id,
    col: cell.col,
    row: cell.row,
    placedTick: state.tick,
    explodeTick: state.tick + BALLOON_FUSE_TICKS,
    range: player.blastRange,
    passThroughPlayerIds,
  };

  state.nextEntityId += 1;
  state.balloons.push(balloon);
  state.balloons.sort((a, b) => a.id - b.id);
  player.activeBalloons += 1;
  events.push({
    type: "balloon-placed",
    balloonId: balloon.id,
    ownerId: balloon.ownerId,
    cell,
  });
}

function updateBalloonPassThrough(state: GameState): void {
  for (const balloon of state.balloons) {
    const cell = { col: balloon.col, row: balloon.row };
    balloon.passThroughPlayerIds = balloon.passThroughPlayerIds.filter(
      (playerId) => {
        const player = state.players.find(
          (candidate) => candidate.id === playerId,
        );
        return (
          player !== undefined &&
          player.status !== "dead" &&
          bodyIntersectsCell(player, cell)
        );
      },
    );
  }
}

function applyNeedles(
  state: GameState,
  inputs: InputByPlayer,
  events: GameEvent[],
): void {
  for (const player of state.players) {
    const input = inputs[player.id];
    if (
      input?.useNeedle !== true ||
      player.status !== "trapped" ||
      player.needles <= 0
    ) {
      continue;
    }

    player.needles -= 1;
    player.status = "alive";
    player.trappedUntilTick = -1;
    player.invulnerableUntilTick =
      state.tick + NEEDLE_INVULNERABILITY_TICKS;
    events.push({
      type: "player-freed",
      playerId: player.id,
      source: "needle",
    });
  }
}

function applyPickup(player: PlayerState, itemType: ItemType): void {
  if (itemType === "capacity") {
    player.balloonCapacity = Math.min(
      MAX_BALLOON_CAPACITY,
      player.balloonCapacity + 1,
    );
  } else if (itemType === "range") {
    player.blastRange = Math.min(
      MAX_BLAST_RANGE,
      player.blastRange + 1,
    );
  } else if (itemType === "speed") {
    player.speedLevel = Math.min(
      MAX_SPEED_LEVEL,
      player.speedLevel + 1,
    );
  } else {
    player.needles = Math.min(MAX_NEEDLES, player.needles + 1);
  }
}

function collectPickups(
  state: GameState,
  events: GameEvent[],
): void {
  const collectedIds = new Set<number>();

  for (const player of state.players) {
    if (player.status !== "alive") {
      continue;
    }

    for (const pickup of state.pickups) {
      if (
        !collectedIds.has(pickup.id) &&
        bodyIntersectsCell(player, pickup)
      ) {
        collectedIds.add(pickup.id);
        applyPickup(player, pickup.type);
        events.push({
          type: "item-picked",
          playerId: player.id,
          itemType: pickup.type,
          cell: { col: pickup.col, row: pickup.row },
        });
      }
    }
  }

  if (collectedIds.size > 0) {
    state.pickups = state.pickups.filter(
      (pickup) => !collectedIds.has(pickup.id),
    );
  }
}

function createStormRing(
  state: GameState,
  level: number,
): Cell[] {
  const ring: Cell[] = [];
  const left = level;
  const right = state.width - 1 - level;
  const top = level;
  const bottom = state.height - 1 - level;

  if (left > right || top > bottom) {
    return ring;
  }

  for (let col = left; col <= right; col += 1) {
    ring.push({ col, row: top });
    if (bottom !== top) {
      ring.push({ col, row: bottom });
    }
  }

  for (let row = top + 1; row < bottom; row += 1) {
    ring.push({ col: left, row });
    if (right !== left) {
      ring.push({ col: right, row });
    }
  }

  return ring;
}

function advanceStorm(
  state: GameState,
  events: GameEvent[],
): void {
  const scheduledTick =
    STORM_START_TICK +
    state.stormLevel * STORM_RING_INTERVAL_TICKS;

  if (state.tick < scheduledTick) {
    return;
  }

  const cells = createStormRing(state, state.stormLevel);
  if (cells.length === 0) {
    return;
  }

  state.stormLevel += 1;
  const existing = new Set(state.stormCells.map(cellKey));
  for (const cell of cells) {
    if (!existing.has(cellKey(cell))) {
      state.stormCells.push(cell);
    }
  }
  state.stormCells.sort(
    (a, b) => a.row - b.row || a.col - b.col,
  );

  const stormKeys = new Set(cells.map(cellKey));
  state.pickups = state.pickups.filter(
    (pickup) => !stormKeys.has(cellKey(pickup)),
  );

  for (const balloon of state.balloons) {
    if (stormKeys.has(cellKey(balloon))) {
      balloon.explodeTick = Math.min(balloon.explodeTick, state.tick);
    }
  }

  events.push({
    type: "storm-advanced",
    level: state.stormLevel,
    cells,
  });
}

function uniqueCells(cells: Cell[]): Cell[] {
  const seen = new Set<string>();
  const result: Cell[] = [];
  for (const cell of cells) {
    const key = cellKey(cell);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cell);
    }
  }
  return result;
}

function resolveExplosions(
  state: GameState,
  events: GameEvent[],
): void {
  const initiallyTriggered = state.balloons
    .filter((balloon) => balloon.explodeTick <= state.tick)
    .map((balloon) => balloon.id)
    .sort((a, b) => a - b);

  if (initiallyTriggered.length === 0) {
    return;
  }

  const tileSnapshot = state.tiles.map((tile) => tile.kind);
  const balloonsAtStart = [...state.balloons];
  const balloonById = new Map(
    balloonsAtStart.map((balloon) => [balloon.id, balloon]),
  );
  const balloonByCell = new Map(
    balloonsAtStart.map((balloon) => [cellKey(balloon), balloon]),
  );
  const queue = [...initiallyTriggered];
  const triggeredIds = new Set<number>();
  const destroyedSoftKeys = new Set<string>();
  const blastRecords: Array<{
    balloon: BalloonState;
    cells: Cell[];
  }> = [];

  while (queue.length > 0) {
    const balloonId = queue.shift();
    if (balloonId === undefined || triggeredIds.has(balloonId)) {
      continue;
    }

    const balloon = balloonById.get(balloonId);
    if (balloon === undefined) {
      continue;
    }

    triggeredIds.add(balloon.id);
    const cells: Cell[] = [{ col: balloon.col, row: balloon.row }];

    for (const step of CARDINAL_STEPS) {
      for (let distance = 1; distance <= balloon.range; distance += 1) {
        const cell = {
          col: balloon.col + step.col * distance,
          row: balloon.row + step.row * distance,
        };
        if (!inBounds(state, cell.col, cell.row)) {
          break;
        }

        const kind =
          tileSnapshot[toIndex(state.width, cell.col, cell.row)];
        if (kind === "hard" || kind === undefined) {
          break;
        }

        cells.push(cell);

        if (kind === "soft") {
          destroyedSoftKeys.add(cellKey(cell));
          break;
        }

        const chainedBalloon = balloonByCell.get(cellKey(cell));
        if (
          chainedBalloon !== undefined &&
          !triggeredIds.has(chainedBalloon.id)
        ) {
          queue.push(chainedBalloon.id);
          queue.sort((a, b) => a - b);
          break;
        }
      }
    }

    blastRecords.push({
      balloon,
      cells: uniqueCells(cells),
    });
  }

  const allBlastKeys = new Set<string>();
  for (const record of blastRecords) {
    const blast: BlastState = {
      id: state.nextEntityId,
      balloonId: record.balloon.id,
      ownerId: record.balloon.ownerId,
      cells: record.cells,
      createdTick: state.tick,
      expireTick: state.tick + BLAST_DURATION_TICKS,
    };
    state.nextEntityId += 1;
    state.blasts.push(blast);

    for (const cell of record.cells) {
      allBlastKeys.add(cellKey(cell));
    }

    events.push({
      type: "balloon-exploded",
      balloonId: record.balloon.id,
      ownerId: record.balloon.ownerId,
      cells: record.cells,
    });
  }

  for (const player of state.players) {
    const returnedCount = blastRecords.filter(
      (record) => record.balloon.ownerId === player.id,
    ).length;
    player.activeBalloons = Math.max(
      0,
      player.activeBalloons - returnedCount,
    );
  }

  state.balloons = state.balloons.filter(
    (balloon) => !triggeredIds.has(balloon.id),
  );

  state.pickups = state.pickups.filter(
    (pickup) => !allBlastKeys.has(cellKey(pickup)),
  );

  for (let row = 0; row < state.height; row += 1) {
    for (let col = 0; col < state.width; col += 1) {
      const key = cellKey({ col, row });
      const tile = state.tiles[toIndex(state.width, col, row)];
      if (tile === undefined) {
        continue;
      }

      if (destroyedSoftKeys.has(key) && tile.kind === "soft") {
        tile.kind = "floor";
        tile.revealTick = state.tick + BLAST_DURATION_TICKS;
        events.push({
          type: "block-destroyed",
          cell: { col, row },
        });
      } else if (
        allBlastKeys.has(key) &&
        tile.kind === "floor" &&
        tile.revealTick >= 0
      ) {
        tile.hiddenItem = null;
        tile.revealTick = -1;
      }
    }
  }
}

function revealItems(
  state: GameState,
  events: GameEvent[],
): void {
  for (let row = 0; row < state.height; row += 1) {
    for (let col = 0; col < state.width; col += 1) {
      const tile = state.tiles[toIndex(state.width, col, row)];
      if (
        tile === undefined ||
        tile.revealTick < 0 ||
        tile.revealTick > state.tick
      ) {
        continue;
      }

      tile.revealTick = -1;
      if (tile.hiddenItem === null || isStormCell(state, col, row)) {
        tile.hiddenItem = null;
        continue;
      }

      const pickup = {
        id: state.nextEntityId,
        col,
        row,
        type: tile.hiddenItem,
      };
      state.nextEntityId += 1;
      tile.hiddenItem = null;
      state.pickups.push(pickup);
      state.pickups.sort((a, b) => a.id - b.id);
      events.push({
        type: "item-revealed",
        itemId: pickup.id,
        itemType: pickup.type,
        cell: { col, row },
      });
    }
  }
}

function trapPlayer(
  state: GameState,
  player: PlayerState,
  source: "blast" | "storm",
  events: GameEvent[],
): void {
  if (
    player.status !== "alive" ||
    player.invulnerableUntilTick > state.tick
  ) {
    return;
  }

  player.status = "trapped";
  player.trappedUntilTick =
    state.tick +
    (source === "storm"
      ? STORM_TRAP_DURATION_TICKS
      : TRAPPED_DURATION_TICKS);
  events.push({
    type: "player-trapped",
    playerId: player.id,
    source,
  });
}

function applyHazards(
  state: GameState,
  events: GameEvent[],
): void {
  for (const player of state.players) {
    if (player.status !== "alive") {
      continue;
    }

    const touchesBlast = state.blasts.some((blast) =>
      blast.cells.some((cell) => blastIntersectsPlayer(player, cell)),
    );
    if (touchesBlast) {
      trapPlayer(state, player, "blast", events);
      continue;
    }

    const touchesStorm = state.stormCells.some((cell) =>
      bodyIntersectsCell(player, cell),
    );
    if (touchesStorm) {
      trapPlayer(state, player, "storm", events);
    }
  }
}

function resolveTrappedPlayers(
  state: GameState,
  events: GameEvent[],
): void {
  const statusesAtStart = new Map(
    state.players.map((player) => [player.id, player.status]),
  );

  for (const trapped of state.players) {
    if (statusesAtStart.get(trapped.id) !== "trapped") {
      continue;
    }

    const touchingPlayers = state.players
      .filter(
        (candidate) =>
          candidate.id !== trapped.id &&
          statusesAtStart.get(candidate.id) === "alive" &&
          playersTouch(trapped, candidate),
      )
      .sort((a, b) => a.id - b.id);
    const touching = touchingPlayers[0];

    if (touching !== undefined) {
      if (touching.team === trapped.team) {
        trapped.status = "alive";
        trapped.trappedUntilTick = -1;
        trapped.invulnerableUntilTick =
          state.tick + NEEDLE_INVULNERABILITY_TICKS;
        events.push({
          type: "player-freed",
          playerId: trapped.id,
          source: "teammate",
        });
      } else {
        trapped.status = "dead";
        trapped.trappedUntilTick = -1;
        events.push({
          type: "player-died",
          playerId: trapped.id,
          source: "opponent",
        });
      }
      continue;
    }

    if (trapped.trappedUntilTick <= state.tick) {
      trapped.status = "dead";
      trapped.trappedUntilTick = -1;
      events.push({
        type: "player-died",
        playerId: trapped.id,
        source: "timeout",
      });
    }
  }
}

function concludeRound(
  state: GameState,
  events: GameEvent[],
): void {
  const survivors = state.players.filter(
    (player) => player.status !== "dead",
  );

  if (survivors.length > 1 && state.tick < ROUND_DURATION_TICKS) {
    return;
  }

  if (survivors.length > 1) {
    for (const survivor of survivors) {
      survivor.status = "dead";
      events.push({
        type: "player-died",
        playerId: survivor.id,
        source: "timeout",
      });
    }
  }

  const finalSurvivors = state.players.filter(
    (player) => player.status !== "dead",
  );
  const result: RoundResult =
    finalSurvivors.length === 1
      ? {
          winnerId: finalSurvivors[0]?.id ?? null,
          reason: "knockout",
        }
      : {
          winnerId: null,
          reason: "draw",
        };

  state.phase = "ended";
  state.result = result;
  events.push({
    type: "round-ended",
    result,
  });
}

export function stepGame(
  state: GameState,
  inputs: InputByPlayer,
): GameEvent[] {
  if (state.phase === "ended") {
    return [];
  }

  state.tick += 1;
  state.blasts = state.blasts.filter(
    (blast) => blast.expireTick > state.tick,
  );

  const events: GameEvent[] = [];
  applyNeedles(state, inputs, events);

  for (const player of state.players) {
    const input = inputs[player.id];
    if (input?.placeBalloon === true) {
      placeBalloon(state, player, events);
    }
  }

  for (const player of state.players) {
    const input = inputs[player.id];
    movePlayer(
      state,
      player,
      input?.move ?? null,
      input?.fallbackMove ?? null,
    );
  }

  updateBalloonPassThrough(state);
  collectPickups(state, events);
  advanceStorm(state, events);
  resolveExplosions(state, events);
  revealItems(state, events);
  applyHazards(state, events);
  resolveTrappedPlayers(state, events);
  concludeRound(state, events);

  return events;
}

export function noInput(): {
  move: null;
  placeBalloon: false;
  useNeedle: false;
} {
  return {
    move: null,
    placeBalloon: false,
    useNeedle: false,
  };
}
