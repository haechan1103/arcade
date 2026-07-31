import { describe, expect, it } from "vitest";
import {
  BALLOON_FUSE_TICKS,
  HALF_TILE,
  STORM_START_TICK,
  TILE_UNITS,
  createGameState,
  mapFromAscii,
  noInput,
  stateHash,
  stepGame,
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

describe("deterministic simulation", () => {
  it("applies and clamps a configured starting speed", () => {
    const boosted = createGameState({
      seed: 10,
      initialSpeedLevel: 1,
    });
    const clamped = createGameState({
      seed: 10,
      initialSpeedLevel: 999,
    });

    expect(boosted.players.map((player) => player.speedLevel)).toEqual([
      1, 1,
    ]);
    expect(clamped.players.map((player) => player.speedLevel)).toEqual([
      6, 6,
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

  it("creates symmetric random soft-block positions", () => {
    const state = createGameState({ seed: 99 });

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
