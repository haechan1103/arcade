import { describe, expect, it } from "vitest";
import {
  BALLOON_FUSE_TICKS,
  DEFAULT_SPEED_STAT,
  GAME_MAPS,
  HALF_TILE,
  MAX_SPEED_STAT,
  MIN_SPEED_STAT,
  PLAYER_BODY_HALF,
  PLAYER_FEET_HITBOX_HALF_WIDTH,
  STORM_START_TICK,
  TILE_UNITS,
  createGameState,
  getGameMap,
  mapFromAscii,
  noInput,
  stateHash,
  stepGame,
  selectGameMap,
  speedUnitsPerTick,
  toIndex,
  type BalloonState,
  type GameState,
  type InputByPlayer,
} from "../src";

const OPEN_MAP = mapFromAscii("open", "Open", [
  "#######",
  "#1...2#",
  "#.....#",
  "#.....#",
  "#######",
]);

function createOpenGame(seed = 1234): GameState {
  return createGameState({
    seed,
    map: OPEN_MAP,
    playerNames: ["Human", "Bot"],
  });
}

function emptyInputs(): InputByPlayer {
  return {
    1: noInput(),
    2: noInput(),
  };
}

function advance(state: GameState, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) {
    stepGame(state, emptyInputs());
  }
}

describe("built-in maps", () => {
  it("provides three distinct authored arenas", () => {
    expect(GAME_MAPS).toHaveLength(3);
    expect(new Set(GAME_MAPS.map((map) => map.id)).size).toBe(3);
    expect(
      new Set(GAME_MAPS.map((map) => map.layout.join("\n"))).size,
    ).toBe(3);

    for (const map of GAME_MAPS) {
      expect(map.width).toBe(15);
      expect(map.height).toBe(13);
      expect(map.layout).toHaveLength(map.height);
      expect(map.layout.every((row) => row.length === map.width)).toBe(
        true,
      );
      expect(map.layout.join("").match(/1/g)).toHaveLength(1);
      expect(map.layout.join("").match(/2/g)).toHaveLength(1);
    }
  });

  it("selects by seed and also accepts an explicit map id", () => {
    const selectedIds = [1, 2, 3].map(
      (seed) => selectGameMap(seed).id,
    );
    expect(new Set(selectedIds)).toEqual(
      new Set(GAME_MAPS.map((map) => map.id)),
    );
    expect(createGameState({ seed: 1 }).mapId).toBe(
      selectGameMap(1).id,
    );

    const requested = getGameMap("coral-maze");
    expect(requested?.name).toBe("코럴 메이즈");
    expect(
      createGameState({ seed: 1, mapId: "coral-maze" }).mapId,
    ).toBe("coral-maze");
    expect(() =>
      createGameState({ seed: 1, mapId: "missing-map" }),
    ).toThrow("Unknown map id: missing-map");
  });
});

describe("deterministic simulation", () => {
  it("applies and clamps a configured starting speed", () => {
    const standard = createGameState({ seed: 10 });
    const boosted = createGameState({
      seed: 10,
      initialSpeedStat: MIN_SPEED_STAT,
    });
    const clamped = createGameState({
      seed: 10,
      initialSpeedStat: 999,
    });

    expect(standard.players.map((player) => player.speedStat)).toEqual([
      DEFAULT_SPEED_STAT,
      DEFAULT_SPEED_STAT,
    ]);
    expect(boosted.players.map((player) => player.speedStat)).toEqual([
      MIN_SPEED_STAT,
      MIN_SPEED_STAT,
    ]);
    expect(clamped.players.map((player) => player.speedStat)).toEqual([
      MAX_SPEED_STAT,
      MAX_SPEED_STAT,
    ]);
  });

  it("produces the same state for the same seed and inputs", () => {
    const first = createGameState({ seed: 0x12345678 });
    const second = createGameState({ seed: 0x12345678 });

    for (let tick = 0; tick < 240; tick += 1) {
      const input: InputByPlayer = {
        1: {
          move: tick < 16 ? "right" : tick < 28 ? "down" : null,
          placeBalloon: tick === 2 || tick === 100,
          useNeedle: false,
        },
        2: noInput(),
      };
      stepGame(first, input);
      stepGame(second, input);
    }

    expect(stateHash(first)).toBe(stateHash(second));
    expect(first).toEqual(second);
  });

  it("creates symmetric hard walls and random soft blocks", () => {
    for (const map of GAME_MAPS) {
      const state = createGameState({ seed: 99, mapId: map.id });

      for (let row = 0; row < state.height; row += 1) {
        for (let col = 0; col < state.width; col += 1) {
          const mirrorCol = state.width - 1 - col;
          const mirrorRow = state.height - 1 - row;
          const tile = state.tiles[toIndex(state.width, col, row)];
          const mirror =
            state.tiles[toIndex(state.width, mirrorCol, mirrorRow)];
          expect(tile?.kind).toBe(mirror?.kind);
        }
      }
    }
  });
});

describe("movement", () => {
  it("uses one cardinal axis per tick and can turn along a wall", () => {
    const map = mapFromAscii("wall-slide", "Wall Slide", [
      "#######",
      "#....2#",
      "#1#...#",
      "#.....#",
      "#######",
    ]);
    const state = createGameState({ seed: 25, map });
    const human = state.players[0]!;
    human.x = 2 * TILE_UNITS - PLAYER_BODY_HALF;
    const startX = human.x;
    const startY = human.y;

    stepGame(state, {
      1: {
        move: "right",
        placeBalloon: false,
        useNeedle: false,
      },
      2: noInput(),
    });

    expect(human.x).toBe(startX);
    expect(human.y).toBe(startY);
    expect(human.direction).toBe("right");

    stepGame(state, {
      1: {
        move: "up",
        placeBalloon: false,
        useNeedle: false,
      },
      2: noInput(),
    });

    expect(human.x).toBe(startX);
    expect(startY - human.y).toBe(
      speedUnitsPerTick(DEFAULT_SPEED_STAT),
    );
    expect(human.direction).toBe("up");
  });

  it("preserves sub-tile offsets without automatic centering", () => {
    const state = createOpenGame();
    const human = state.players[0]!;
    human.y += 180;
    const startX = human.x;
    const startY = human.y;

    stepGame(state, {
      1: {
        move: "right",
        placeBalloon: false,
        useNeedle: false,
      },
      2: noInput(),
    });

    expect(human.x - startX).toBe(
      speedUnitsPerTick(DEFAULT_SPEED_STAT),
    );
    expect(human.y).toBe(startY);
  });

  it("rounds a nearby open corner within the movement budget", () => {
    const map = mapFromAscii("corner-turn", "Corner Turn", [
      "#######",
      "#....2#",
      "#1#...#",
      "#.....#",
      "#######",
    ]);
    const state = createGameState({ seed: 26, map });
    const human = state.players[0]!;
    human.x = 2 * TILE_UNITS - PLAYER_BODY_HALF;
    human.y = TILE_UNITS + HALF_TILE + 300;
    const startX = human.x;
    const startY = human.y;

    stepGame(state, {
      1: {
        move: "right",
        placeBalloon: false,
        useNeedle: false,
      },
      2: noInput(),
    });

    expect(human.x).toBeGreaterThan(startX);
    expect(human.y).toBeLessThan(startY);
    expect(human.x - startX + startY - human.y).toBe(
      speedUnitsPerTick(DEFAULT_SPEED_STAT),
    );
  });

  it("does not drift sideways when the requested wall stays closed", () => {
    const map = mapFromAscii("closed-turn", "Closed Turn", [
      "#######",
      "#....2#",
      "#1#...#",
      "#.....#",
      "#######",
    ]);
    const state = createGameState({ seed: 27, map });
    const human = state.players[0]!;
    human.x = 2 * TILE_UNITS - PLAYER_BODY_HALF;
    human.y += 180;
    const startX = human.x;
    const startY = human.y;

    stepGame(state, {
      1: {
        move: "right",
        placeBalloon: false,
        useNeedle: false,
      },
      2: noInput(),
    });

    expect(human.x).toBe(startX);
    expect(human.y).toBe(startY);
  });
});

describe("balloons and blasts", () => {
  it("snaps a balloon to the occupied tile while the player is off-center", () => {
    const state = createOpenGame();
    const human = state.players[0]!;
    human.x = TILE_UNITS + HALF_TILE + 260;

    const events = stepGame(state, {
      1: {
        move: null,
        placeBalloon: true,
        useNeedle: false,
      },
      2: noInput(),
    });

    expect(events).toContainEqual({
      type: "balloon-placed",
      balloonId: expect.any(Number),
      ownerId: 1,
      cell: { col: 1, row: 1 },
    });
    expect(state.balloons[0]).toMatchObject({
      col: 1,
      row: 1,
    });
  });

  it("places, explodes, and returns balloon capacity", () => {
    const state = createOpenGame();
    const placeEvents = stepGame(state, {
      1: {
        move: null,
        placeBalloon: true,
        useNeedle: false,
      },
      2: noInput(),
    });

    expect(placeEvents.some((event) => event.type === "balloon-placed"))
      .toBe(true);
    expect(state.players[0]?.activeBalloons).toBe(1);
    expect(state.balloons).toHaveLength(1);

    advance(state, BALLOON_FUSE_TICKS);

    expect(state.balloons).toHaveLength(0);
    expect(state.players[0]?.activeBalloons).toBe(0);
    expect(
      state.blasts.some((blast) =>
        blast.cells.some((cell) => cell.col === 2 && cell.row === 1),
      ),
    ).toBe(true);
  });

  it("stops at a soft block and destroys it", () => {
    const map = mapFromAscii("soft", "Soft", [
      "#######",
      "#1+..2#",
      "#.....#",
      "#.....#",
      "#######",
    ]);
    const state = createGameState({ seed: 7, map });
    const human = state.players[0];
    if (human === undefined) {
      throw new Error("Missing human player.");
    }
    human.blastRange = 4;

    stepGame(state, {
      1: {
        move: null,
        placeBalloon: true,
        useNeedle: false,
      },
      2: noInput(),
    });
    advance(state, BALLOON_FUSE_TICKS);

    expect(state.tiles[toIndex(state.width, 2, 1)]?.kind).toBe("floor");
    const blast = state.blasts.at(-1);
    expect(blast?.cells).toContainEqual({ col: 2, row: 1 });
    expect(blast?.cells).not.toContainEqual({ col: 3, row: 1 });
  });

  it("chains a later balloon in the same tick", () => {
    const state = createOpenGame();
    const first: BalloonState = {
      id: 10,
      ownerId: 1,
      col: 2,
      row: 2,
      placedTick: 0,
      explodeTick: 1,
      range: 3,
      passThroughPlayerIds: [],
    };
    const second: BalloonState = {
      id: 11,
      ownerId: 2,
      col: 4,
      row: 2,
      placedTick: 0,
      explodeTick: 999,
      range: 1,
      passThroughPlayerIds: [],
    };
    state.balloons = [first, second];
    state.players[0]!.activeBalloons = 1;
    state.players[1]!.activeBalloons = 1;

    const events = stepGame(state, emptyInputs());

    const explodedIds = events
      .filter((event) => event.type === "balloon-exploded")
      .map((event) => event.balloonId);
    expect(explodedIds).toEqual([10, 11]);
    expect(state.balloons).toHaveLength(0);
  });
});

describe("players and items", () => {
  it("collects a capacity pickup", () => {
    const state = createOpenGame();
    state.pickups.push({
      id: 50,
      col: 1,
      row: 1,
      type: "capacity",
    });

    const events = stepGame(state, emptyInputs());

    expect(state.players[0]?.balloonCapacity).toBe(2);
    expect(state.pickups).toHaveLength(0);
    expect(events).toContainEqual({
      type: "item-picked",
      playerId: 1,
      itemType: "capacity",
      cell: { col: 1, row: 1 },
    });
  });

  it("raises the official speed stat by one and clamps at ten", () => {
    const state = createOpenGame();
    const human = state.players[0]!;
    human.speedStat = MAX_SPEED_STAT - 1;
    state.pickups.push({
      id: 50,
      col: 1,
      row: 1,
      type: "speed",
    });

    stepGame(state, emptyInputs());
    expect(human.speedStat).toBe(MAX_SPEED_STAT);

    state.pickups.push({
      id: 51,
      col: 1,
      row: 1,
      type: "speed",
    });
    stepGame(state, emptyInputs());
    expect(human.speedStat).toBe(MAX_SPEED_STAT);
  });

  it("traps a player and lets a needle free them", () => {
    const state = createOpenGame();
    state.players[0]!.needles = 1;
    state.blasts.push({
      id: 70,
      balloonId: 71,
      ownerId: 2,
      cells: [{ col: 1, row: 1 }],
      createdTick: 0,
      expireTick: 20,
    });

    stepGame(state, emptyInputs());
    expect(state.players[0]?.status).toBe("trapped");

    stepGame(state, {
      1: {
        move: null,
        placeBalloon: false,
        useNeedle: true,
      },
      2: noInput(),
    });

    expect(state.players[0]?.status).toBe("alive");
    expect(state.players[0]?.needles).toBe(0);
    expect(state.players[0]?.invulnerableUntilTick).toBeGreaterThan(
      state.tick,
    );
  });

  it("requires 66 percent of the foot hitbox to be covered", () => {
    const state = createOpenGame();
    const human = state.players[0]!;
    const blastBoundary = 2 * TILE_UNITS;
    const hitboxWidth = PLAYER_FEET_HITBOX_HALF_WIDTH * 2;
    state.blasts.push({
      id: 70,
      balloonId: 71,
      ownerId: 2,
      cells: [{ col: 2, row: 1 }],
      createdTick: 0,
      expireTick: 20,
    });
    human.x =
      blastBoundary -
      PLAYER_FEET_HITBOX_HALF_WIDTH +
      Math.ceil(hitboxWidth * 0.66) -
      1;

    stepGame(state, emptyInputs());
    expect(human.status).toBe("alive");

    human.x += 1;
    stepGame(state, emptyInputs());
    expect(human.status).toBe("trapped");
  });

  it("does not double-count overlapping blast cells", () => {
    const state = createOpenGame();
    const human = state.players[0]!;
    human.x = 2 * TILE_UNITS;
    const duplicateCell = { col: 2, row: 1 };
    state.blasts.push(
      {
        id: 70,
        balloonId: 71,
        ownerId: 2,
        cells: [duplicateCell],
        createdTick: 0,
        expireTick: 20,
      },
      {
        id: 72,
        balloonId: 73,
        ownerId: 2,
        cells: [duplicateCell],
        createdTick: 0,
        expireTick: 20,
      },
    );

    stepGame(state, emptyInputs());

    expect(human.status).toBe("alive");
  });

  it("combines coverage from unique active blast cells", () => {
    const state = createOpenGame();
    const human = state.players[0]!;
    human.x = 2 * TILE_UNITS;
    human.y = 2 * TILE_UNITS;
    state.blasts.push({
      id: 70,
      balloonId: 71,
      ownerId: 2,
      cells: [
        { col: 1, row: 1 },
        { col: 2, row: 1 },
        { col: 1, row: 2 },
      ],
      createdTick: 0,
      expireTick: 20,
    });

    stepGame(state, emptyInputs());

    expect(human.status).toBe("trapped");
  });

  it("eliminates a trapped player when their timer expires", () => {
    const state = createOpenGame();
    const human = state.players[0]!;
    human.status = "trapped";
    human.trappedUntilTick = 1;

    const events = stepGame(state, emptyInputs());

    expect(human.status).toBe("dead");
    expect(state.phase).toBe("ended");
    expect(state.result?.winnerId).toBe(2);
    expect(
      events.some(
        (event) =>
          event.type === "player-died" && event.playerId === 1,
      ),
    ).toBe(true);
  });

  it("starts the closing storm at the configured tick", () => {
    const state = createOpenGame();
    state.tick = STORM_START_TICK - 1;

    const events = stepGame(state, emptyInputs());

    expect(state.stormLevel).toBe(1);
    expect(state.stormCells.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === "storm-advanced"))
      .toBe(true);
  });
});
