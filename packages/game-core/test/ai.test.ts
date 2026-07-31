import { describe, expect, it } from "vitest";
import {
  BotController,
  TILE_UNITS,
  createGameState,
  isPlayerCentered,
  mapFromAscii,
  noInput,
  stepGame,
  type BalloonState,
  type Difficulty,
} from "../src";

describe("BotController", () => {
  it("places a balloon near a soft block only when it has an exit", () => {
    const map = mapFromAscii("bot-break", "Bot Break", [
      "#########",
      "#1....+2#",
      "#.......#",
      "#.......#",
      "#########",
    ]);
    const state = createGameState({ seed: 42, map });
    const bot = new BotController(2, "normal", 42);

    const input = bot.decide(state);

    expect(input.placeBalloon).toBe(true);
    expect(input.move).toBe("down");
    expect(bot.getDebugInfo().mode).toBe("break");
  });

  it("moves out of a projected blast instead of placing", () => {
    const map = mapFromAscii("bot-escape", "Bot Escape", [
      "#########",
      "#1.....2#",
      "#.......#",
      "#.......#",
      "#########",
    ]);
    const state = createGameState({ seed: 11, map });
    const botPlayer = state.players[1]!;
    const balloon: BalloonState = {
      id: 77,
      ownerId: 1,
      col: 5,
      row: 1,
      placedTick: 0,
      explodeTick: 10,
      range: 2,
      passThroughPlayerIds: [],
    };
    state.balloons.push(balloon);
    state.players[0]!.activeBalloons = 1;
    botPlayer.x = 7 * TILE_UNITS + TILE_UNITS / 2;
    botPlayer.y = 1 * TILE_UNITS + TILE_UNITS / 2;

    const bot = new BotController(2, "hard", 11);
    const input = bot.decide(state);

    expect(input.placeBalloon).toBe(false);
    expect(input.move).toBe("down");
    expect(bot.getDebugInfo().mode).toBe("escape");
  });

  it("escapes early balloons across seeds and difficulties", () => {
    const failures: Array<{
      difficulty: Difficulty;
      seed: number;
      tick: number;
      cell: [number, number];
      mode: string;
    }> = [];

    const difficulties: Difficulty[] = [
      "easy",
      "normal",
      "hard",
    ];
    for (const difficulty of difficulties) {
      for (let seed = 1; seed <= 512; seed += 1) {
        const state = createGameState({ seed });
        const bot = new BotController(2, difficulty, seed);

        for (let tick = 0; tick < 240; tick += 1) {
          const botInput = bot.decide(state);
          stepGame(state, {
            1: noInput(),
            2: botInput,
          });

          const botPlayer = state.players[1];
          if (
            botPlayer === undefined ||
            botPlayer.status !== "alive"
          ) {
            if (failures.length < 20) {
              failures.push({
                difficulty,
                seed,
                tick: state.tick,
                cell: [
                  Math.floor(
                    (botPlayer?.x ?? 0) / TILE_UNITS,
                  ),
                  Math.floor(
                    (botPlayer?.y ?? 0) / TILE_UNITS,
                  ),
                ],
                mode: bot.getDebugInfo().mode,
              });
            }
            break;
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("keeps navigating after reaching a safe escape tile", () => {
    const map = mapFromAscii("bot-flow", "Bot Flow", [
      "#########",
      "#1....+2#",
      "#.......#",
      "#.......#",
      "#########",
    ]);
    const state = createGameState({ seed: 42, map });
    const bot = new BotController(2, "normal", 42);
    let idleTicks = 0;
    let longestIdleRun = 0;

    for (let tick = 0; tick < 90; tick += 1) {
      const input = bot.decide(state);
      const hasLiveBalloon = state.balloons.length > 0;
      if (hasLiveBalloon && input.move === null) {
        idleTicks += 1;
        longestIdleRun = Math.max(longestIdleRun, idleTicks);
      } else {
        idleTicks = 0;
      }

      stepGame(state, {
        1: noInput(),
        2: input,
      });
    }

    expect(longestIdleRun).toBeLessThan(20);
    expect(state.players[1]?.status).toBe("alive");
  });

  it("does not reverse direction before reaching a tile center", () => {
    const map = mapFromAscii("bot-steering", "Bot Steering", [
      "#########",
      "#1#....2#",
      "#.#.....#",
      "#.#.....#",
      "#########",
    ]);
    const opposites = new Set([
      "up:down",
      "down:up",
      "left:right",
      "right:left",
    ]);
    const failures: Array<{
      seed: number;
      tick: number;
      previous: string;
      next: string;
    }> = [];

    for (let seed = 1; seed <= 24; seed += 1) {
      const state = createGameState({ seed, map });
      const botPlayer = state.players[1]!;
      botPlayer.activeBalloons = botPlayer.balloonCapacity;
      const bot = new BotController(2, "normal", seed);
      let previousMove: string | null = null;

      for (let tick = 0; tick < 120; tick += 1) {
        const input = bot.decide(state);
        if (
          previousMove !== null &&
          input.move !== null &&
          opposites.has(`${previousMove}:${input.move}`) &&
          !isPlayerCentered(botPlayer)
        ) {
          failures.push({
            seed,
            tick: state.tick,
            previous: previousMove,
            next: input.move,
          });
          break;
        }

        previousMove = input.move;
        stepGame(state, {
          1: noInput(),
          2: input,
        });
      }
    }

    expect(failures).toEqual([]);
  });
});
