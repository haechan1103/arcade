import { expect, test, type Page } from "@playwright/test";
import {
  PLAYER_BODY_HALF,
  TILE_UNITS,
} from "@bubble-battle/game-core";

interface DebugPlayer {
  id: number;
  x: number;
  y: number;
  status: string;
  speedLevel: number;
}

interface DebugState {
  seed: number;
  mapId: string;
  mapName: string;
  tick: number;
  phase: string;
  width: number;
  height: number;
  tiles: Array<{ kind: string }>;
  players: DebugPlayer[];
  balloons: Array<{
    ownerId: number;
    col: number;
    row: number;
  }>;
}

interface DebugUiState {
  countdownMs: number;
  paused: boolean;
  resultVisible: boolean;
}

interface DebugLayout {
  width: number;
  height: number;
  compact: boolean;
  portrait: boolean;
}

async function state(page: Page): Promise<DebugState> {
  return page.evaluate(
    () => window.__BUBBLE_BATTLE__.getState() as DebugState,
  );
}

async function uiState(page: Page): Promise<DebugUiState> {
  return page.evaluate(
    () =>
      window.__BUBBLE_BATTLE__.getUiState() as DebugUiState,
  );
}

async function forceHumanDefeat(page: Page): Promise<void> {
  await page.evaluate(() => {
    const debugState =
      window.__BUBBLE_BATTLE__.getState() as DebugState;
    const human = debugState.players.find(
      (player) => player.id === 1,
    );
    if (human !== undefined) {
      human.status = "dead";
    }
  });
  await expect
    .poll(async () => (await state(page)).phase)
    .toBe("ended");
  await expect
    .poll(async () => (await uiState(page)).resultVisible, {
      timeout: 3_000,
    })
    .toBe(true);
}

async function clickGamePoint(
  page: Page,
  x: number,
  y: number,
): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("Game canvas is not visible.");
  }

  await page.mouse.click(
    box.x + (x / 1100) * box.width,
    box.y + (y / 720) * box.height,
  );
}

test("menu starts a playable local match", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      runtimeErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("Failed to load resource")
    ) {
      runtimeErrors.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page.locator("#game-container canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => window.__BUBBLE_BATTLE__.layout as DebugLayout,
    ),
  ).toEqual({
    width: 1_100,
    height: 720,
    compact: false,
    portrait: false,
  });
  await page.screenshot({
    path: "test-results/menu.png",
    fullPage: true,
  });

  await clickGamePoint(page, 550, 383);
  await expect
    .poll(async () => (await state(page)).tick, { timeout: 6_000 })
    .toBeGreaterThan(2);

  const beforeMove = await state(page);
  const playerBefore = beforeMove.players.find(
    (player) => player.id === 1,
  );
  await page.keyboard.down("ArrowRight");
  await expect
    .poll(
      async () => {
        const human = (await state(page)).players.find(
          (player) => player.id === 1,
        );
        return Math.floor((human?.x ?? 0) / 1_024);
      },
      {
        timeout: 1_500,
        intervals: [10],
      },
    )
    .toBe(2);
  await page.keyboard.up("ArrowRight");

  const afterMove = await state(page);
  const playerAfter = afterMove.players.find(
    (player) => player.id === 1,
  );
  expect(playerAfter?.x).toBeGreaterThan(playerBefore?.x ?? 0);
  const occupiedCol = Math.floor((playerAfter?.x ?? 0) / 1_024);
  const occupiedRow = Math.floor((playerAfter?.y ?? 0) / 1_024);
  const occupiedCenterX = occupiedCol * 1_024 + 512;
  expect(
    Math.abs((playerAfter?.x ?? 0) - occupiedCenterX),
  ).toBeGreaterThan(180);

  await page.keyboard.down("Space");
  await page.waitForTimeout(120);
  await page.keyboard.up("Space");
  await expect
    .poll(async () =>
      (await state(page)).balloons.some(
        (balloon) => balloon.ownerId === 1,
      ),
    )
    .toBe(true);
  expect(
    (await state(page)).balloons.find(
      (balloon) => balloon.ownerId === 1,
    ),
  ).toMatchObject({
    col: occupiedCol,
    row: occupiedRow,
  });

  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(370);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(390);
  await page.keyboard.up("ArrowDown");

  await page.waitForTimeout(1_520);
  await page.screenshot({
    path: "test-results/battle.png",
    fullPage: true,
  });
  await page.waitForTimeout(500);
  expect(
    (await state(page)).players.find((player) => player.id === 1)
      ?.status,
  ).toBe("alive");

  expect(runtimeErrors).toEqual([]);
});

test("renders all three authored arenas", async ({ page }) => {
  const mapIds = [
    "neon-garden",
    "metro-crossing",
    "coral-maze",
  ];
  const hardWallLayouts = new Set<string>();

  await page.goto("/");
  for (const mapId of mapIds) {
    await page.evaluate((selectedMapId) => {
      window.__BUBBLE_BATTLE__.game.scene.start("BattleScene", {
        difficulty: "normal",
        mapId: selectedMapId,
      });
    }, mapId);
    await expect.poll(async () => (await state(page)).mapId).toBe(mapId);

    const current = await state(page);
    hardWallLayouts.add(
      current.tiles
        .map((tile) => (tile.kind === "hard" ? "#" : "."))
        .join(""),
    );
    await page.screenshot({
      path: `test-results/map-${mapId}.png`,
      fullPage: true,
    });
  }

  expect(hardWallLayouts.size).toBe(3);
});

test("escape pauses and resumes the fixed-tick simulation", async ({
  page,
}) => {
  await page.goto("/");
  await clickGamePoint(page, 550, 383);
  await expect
    .poll(async () => (await state(page)).tick, { timeout: 6_000 })
    .toBeGreaterThan(2);

  await page.keyboard.down("Escape");
  await page.waitForTimeout(50);
  await page.keyboard.up("Escape");
  const pausedTick = (await state(page)).tick;
  await page.waitForTimeout(350);
  expect((await state(page)).tick).toBe(pausedTick);

  await page.keyboard.down("Escape");
  await page.waitForTimeout(50);
  await page.keyboard.up("Escape");
  await expect
    .poll(async () => (await state(page)).tick)
    .toBeGreaterThan(pausedTick);
});

test("retry resets countdown and can show a second result", async ({
  page,
}) => {
  await page.goto("/");
  await clickGamePoint(page, 550, 383);
  await expect
    .poll(async () => (await state(page)).tick, { timeout: 6_000 })
    .toBeGreaterThan(2);

  await forceHumanDefeat(page);
  const firstSeed = (await state(page)).seed;
  await clickGamePoint(page, 286, 460);

  await expect
    .poll(async () => (await state(page)).seed)
    .not.toBe(firstSeed);
  expect((await state(page)).tick).toBe(0);
  const restartedUi = await uiState(page);
  expect(restartedUi.resultVisible).toBe(false);
  expect(restartedUi.countdownMs).toBeGreaterThan(2_500);

  await page.waitForTimeout(900);
  const countingUi = await uiState(page);
  expect(countingUi.countdownMs).toBeLessThan(
    restartedUi.countdownMs,
  );
  expect(countingUi.countdownMs).toBeGreaterThan(0);

  await expect
    .poll(async () => (await state(page)).tick, { timeout: 5_000 })
    .toBeGreaterThan(2);
  await forceHumanDefeat(page);
});

test.describe("mobile touch controls", () => {
  test.use({
    viewport: {
      width: 780,
      height: 430,
    },
    hasTouch: true,
    isMobile: true,
  });

  test("moves, places a balloon, and pauses without a keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    expect(
      await page.evaluate(
        () => window.__BUBBLE_BATTLE__.layout as DebugLayout,
      ),
    ).toEqual({
      width: 800,
      height: 680,
      compact: true,
      portrait: false,
    });
    await expect(
      page.locator("[data-fullscreen-toggle]"),
    ).toBeVisible();
    await clickGamePoint(page, 550, 383);

    const touchControls = page.locator("[data-touch-controls]");
    await expect(touchControls).toBeVisible();
    await expect
      .poll(async () => (await state(page)).tick, {
        timeout: 6_000,
      })
      .toBeGreaterThan(2);

    const humanBefore = (await state(page)).players.find(
      (player) => player.id === 1,
    );
    expect(humanBefore?.speedLevel).toBe(1);

    const joystick = page.locator("[data-joystick]");
    await expect(joystick).toBeVisible();
    const joystickBox = await joystick.boundingBox();
    if (joystickBox === null) {
      throw new Error("Mobile joystick is not visible.");
    }
    await joystick.dispatchEvent("pointerdown", {
      pointerId: 11,
      pointerType: "touch",
      isPrimary: true,
      clientX: joystickBox.x + joystickBox.width / 2 + 18,
      clientY: joystickBox.y + joystickBox.height / 2,
    });
    await expect(joystick).toHaveAttribute("data-direction", "idle");
    await joystick.dispatchEvent("pointermove", {
      pointerId: 11,
      pointerType: "touch",
      isPrimary: true,
      clientX: joystickBox.x + joystickBox.width / 2 + 36,
      clientY: joystickBox.y + joystickBox.height / 2,
    });
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await expect(joystick).toHaveAttribute(
      "data-fallback-direction",
      "idle",
    );
    await page.waitForTimeout(360);
    await joystick.dispatchEvent("pointermove", {
      pointerId: 11,
      pointerType: "touch",
      isPrimary: true,
      clientX: joystickBox.x + joystickBox.width / 2 + 36,
      clientY: joystickBox.y + joystickBox.height / 2 + 20,
    });
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await expect(joystick).toHaveAttribute(
      "data-fallback-direction",
      "down",
    );
    await joystick.dispatchEvent("pointermove", {
      pointerId: 11,
      pointerType: "touch",
      isPrimary: true,
      clientX: joystickBox.x + joystickBox.width / 2 + 28,
      clientY: joystickBox.y + joystickBox.height / 2 + 28,
    });
    await expect(joystick).toHaveAttribute("data-direction", "down");
    await joystick.dispatchEvent("pointerup", {
      pointerId: 11,
      pointerType: "touch",
      isPrimary: true,
      clientX: joystickBox.x + joystickBox.width / 2 + 28,
      clientY: joystickBox.y + joystickBox.height / 2 + 28,
    });

    const humanAfter = (await state(page)).players.find(
      (player) => player.id === 1,
    );
    expect(humanAfter?.x).toBeGreaterThan(humanBefore?.x ?? 0);
    await expect(joystick).toHaveAttribute("data-direction", "idle");
    await expect(joystick).toHaveAttribute(
      "data-fallback-direction",
      "idle",
    );

    expect(
      await joystick.evaluate((element) => {
        const contextMenu = new Event("contextmenu", {
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(contextMenu);
        return {
          contextMenuPrevented: contextMenu.defaultPrevented,
          userSelect: getComputedStyle(element).userSelect,
        };
      }),
    ).toEqual({
      contextMenuPrevented: true,
      userSelect: "none",
    });

    await page.evaluate(
      ({ tileUnits, bodyHalf }) => {
        const debugState =
          window.__BUBBLE_BATTLE__.getState() as DebugState;
        const human = debugState.players.find(
          (player) => player.id === 1,
        );
        if (human === undefined) {
          return;
        }
        human.x = 2 * tileUnits - bodyHalf;
        human.y = tileUnits + tileUnits / 2;
        const wall = debugState.tiles[debugState.width + 2];
        if (wall !== undefined) {
          wall.kind = "hard";
        }
      },
      { tileUnits: TILE_UNITS, bodyHalf: PLAYER_BODY_HALF },
    );
    const wallSlideStart = (await state(page)).players.find(
      (player) => player.id === 1,
    );
    await joystick.dispatchEvent("pointerdown", {
      pointerId: 12,
      pointerType: "touch",
      isPrimary: true,
      clientX: joystickBox.x + joystickBox.width / 2 + 10,
      clientY: joystickBox.y + joystickBox.height / 2,
    });
    await joystick.dispatchEvent("pointermove", {
      pointerId: 12,
      pointerType: "touch",
      isPrimary: true,
      clientX: joystickBox.x + joystickBox.width / 2 + 34,
      clientY: joystickBox.y + joystickBox.height / 2 + 22,
    });
    await expect(joystick).toHaveAttribute("data-direction", "right");
    await expect(joystick).toHaveAttribute(
      "data-fallback-direction",
      "down",
    );
    await expect
      .poll(
        async () =>
          (await state(page)).players.find(
            (player) => player.id === 1,
          )?.y ?? 0,
        { timeout: 1_000, intervals: [25] },
      )
      .toBeGreaterThan(wallSlideStart?.y ?? 0);
    await joystick.dispatchEvent("pointerup", {
      pointerId: 12,
      pointerType: "touch",
      isPrimary: true,
      clientX: joystickBox.x + joystickBox.width / 2 + 34,
      clientY: joystickBox.y + joystickBox.height / 2 + 22,
    });
    const wallSlideEnd = (await state(page)).players.find(
      (player) => player.id === 1,
    );
    expect(wallSlideEnd?.x).toBeLessThanOrEqual(
      wallSlideStart?.x ?? 0,
    );
    expect(wallSlideEnd?.y).toBeGreaterThan(wallSlideStart?.y ?? 0);

    await page.locator('[data-control="balloon"]').tap();
    await expect
      .poll(async () =>
        (await state(page)).balloons.some(
          (balloon) => balloon.ownerId === 1,
        ),
      )
      .toBe(true);

    await page.locator('[data-control="pause"]').tap();
    const pausedTick = (await state(page)).tick;
    await page.waitForTimeout(320);
    expect((await state(page)).tick).toBe(pausedTick);

    await page.locator('[data-control="pause"]').tap();
    await expect
      .poll(async () => (await state(page)).tick)
      .toBeGreaterThan(pausedTick);
    await page.screenshot({
      path: "test-results/mobile.png",
      fullPage: true,
    });
  });
});

test.describe("mobile portrait layout", () => {
  test.use({
    viewport: {
      width: 390,
      height: 844,
    },
    hasTouch: true,
    isMobile: true,
  });

  test("keeps the game and controls inside the viewport", async ({
    page,
  }) => {
    await page.goto("/");
    expect(
      await page.evaluate(
        () => window.__BUBBLE_BATTLE__.layout as DebugLayout,
      ),
    ).toEqual({
      width: 800,
      height: 680,
      compact: true,
      portrait: true,
    });
    await page.screenshot({
      path: "test-results/mobile-portrait-menu.png",
      fullPage: true,
    });
    await expect(
      page.locator("[data-fullscreen-toggle]"),
    ).toBeVisible();
    await clickGamePoint(page, 550, 383);

    const touchControls = page.locator("[data-touch-controls]");
    const balloonButton = page.locator(
      '[data-control="balloon"]',
    );
    await expect(touchControls).toBeVisible();
    await expect(balloonButton).toBeVisible();

    const controlsBox = await touchControls.boundingBox();
    const canvas = page.locator("#game-container canvas");
    await expect(canvas).toHaveAttribute("width", "800");
    await expect(canvas).toHaveAttribute("height", "680");
    expect(controlsBox).not.toBeNull();
    expect(
      (controlsBox?.y ?? 0) + (controlsBox?.height ?? 0),
    ).toBeLessThanOrEqual(844);
    await page.screenshot({
      path: "test-results/mobile-portrait.png",
      fullPage: true,
    });
  });
});
