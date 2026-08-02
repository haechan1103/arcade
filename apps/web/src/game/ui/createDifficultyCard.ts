import Phaser from "phaser";
import { UI_FONT, UI_TEXT_RESOLUTION } from "../layout";

export interface DifficultyCardOptions {
  width: number;
  height: number;
  accentColor: number;
  level: number;
  subtitle: string;
  tag: string;
  power: number;
  layout: "tile" | "row";
}

export function createDifficultyCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: DifficultyCardOptions,
): Phaser.GameObjects.Container {
  const {
    width,
    height,
    accentColor,
    level,
    subtitle,
    tag,
    power,
    layout,
  } = options;
  const tile = layout === "tile";
  const left = -width / 2;
  const right = width / 2;
  const radius = tile ? 19 : 17;

  const glow = scene.add.graphics();
  const shadow = scene.add.graphics();
  const surface = scene.add.graphics();
  const meter = scene.add.graphics();
  const tagBackground = scene.add.graphics();
  const badge = scene.add
    .circle(
      tile ? left + 38 : left + 48,
      tile ? -33 : 0,
      tile ? 21 : 23,
      accentColor,
      0.15,
    )
    .setStrokeStyle(1.5, accentColor, 0.56);
  const badgeText = scene.add
    .text(
      badge.x,
      badge.y + 1,
      String(level).padStart(2, "0"),
      {
        fontFamily: UI_FONT,
        fontSize: tile ? "14px" : "16px",
        fontStyle: "bold",
        color: "#f6fbff",
        resolution: UI_TEXT_RESOLUTION,
      },
    )
    .setOrigin(0.5);

  const eyebrowX = tile ? left + 68 : left + 87;
  const eyebrowY = tile ? -48 : -27;
  const titleY = tile ? -25 : -4;
  const eyebrow = scene.add
    .text(eyebrowX, eyebrowY, "BOT LEVEL", {
      fontFamily: UI_FONT,
      fontSize: tile ? "9px" : "10px",
      fontStyle: "bold",
      color: "#7189ae",
      letterSpacing: 1.4,
      resolution: UI_TEXT_RESOLUTION,
    })
    .setOrigin(0, 0.5);
  const title = scene.add
    .text(eyebrowX, titleY, label, {
      fontFamily: UI_FONT,
      fontSize: tile ? "23px" : "26px",
      fontStyle: "bold",
      color: "#f7fbff",
      resolution: UI_TEXT_RESOLUTION,
    })
    .setOrigin(0, 0.5);
  const description = scene.add
    .text(
      tile ? left + 24 : left + 87,
      tile ? 12 : 23,
      subtitle,
      {
        fontFamily: UI_FONT,
        fontSize: tile ? "12px" : "17px",
        color: "#a7b9d5",
        resolution: UI_TEXT_RESOLUTION,
        wordWrap: {
          width: tile ? width - 48 : width - 290,
          useAdvancedWrap: true,
        },
      },
    )
    .setOrigin(0, 0.5);

  const tagWidth = tile ? 52 : 64;
  const tagHeight = tile ? 23 : 25;
  const tagX = tile ? right - 43 : right - 107;
  const tagY = tile ? 44 : -18;
  tagBackground.fillStyle(accentColor, 0.16);
  tagBackground.fillRoundedRect(
    tagX - tagWidth / 2,
    tagY - tagHeight / 2,
    tagWidth,
    tagHeight,
    tagHeight / 2,
  );
  tagBackground.lineStyle(1, accentColor, 0.42);
  tagBackground.strokeRoundedRect(
    tagX - tagWidth / 2,
    tagY - tagHeight / 2,
    tagWidth,
    tagHeight,
    tagHeight / 2,
  );
  const tagText = scene.add
    .text(tagX, tagY + 1, tag, {
      fontFamily: UI_FONT,
      fontSize: tile ? "10px" : "13px",
      fontStyle: "bold",
      color: "#eefaff",
      resolution: UI_TEXT_RESOLUTION,
    })
    .setOrigin(0.5);

  const meterLabel = scene.add
    .text(
      tile ? left + 24 : right - 176,
      tile ? 44 : 21,
      tile ? "판단 속도" : "속도",
      {
        fontFamily: UI_FONT,
        fontSize: tile ? "9px" : "12px",
        fontStyle: "bold",
        color: "#657fa7",
        resolution: UI_TEXT_RESOLUTION,
      },
    )
    .setOrigin(tile ? 0 : 1, 0.5);
  const meterStartX = tile ? left + 82 : right - 162;
  const meterY = tile ? 40 : 17;
  const meterWidth = tile ? 25 : 29;
  for (let index = 0; index < 3; index += 1) {
    meter.fillStyle(
      index < power ? accentColor : 0x29405f,
      index < power ? 0.92 : 0.5,
    );
    meter.fillRoundedRect(
      meterStartX + index * (meterWidth + 6),
      meterY,
      meterWidth,
      7,
      3.5,
    );
  }

  const arrowX = tile ? right - 28 : right - 34;
  const arrowY = tile ? -33 : 0;
  const arrow = scene.add
    .circle(
      arrowX,
      arrowY,
      tile ? 17 : 19,
      accentColor,
      0.13,
    )
    .setStrokeStyle(1, accentColor, 0.38);
  const arrowText = scene.add
    .text(arrowX + 1, arrowY - 1, "›", {
      fontFamily: UI_FONT,
      fontSize: tile ? "25px" : "28px",
      fontStyle: "bold",
      color: "#dceaff",
      resolution: UI_TEXT_RESOLUTION,
    })
    .setOrigin(0.5);
  const hitTarget = scene.add
    .rectangle(0, 0, width, height, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });

  const drawCard = (hovered: boolean): void => {
    glow.clear();
    glow.fillStyle(accentColor, hovered ? 0.13 : 0.055);
    glow.fillRoundedRect(
      left - 5,
      -height / 2 - 4,
      width + 10,
      height + 14,
      radius + 5,
    );

    shadow.clear();
    shadow.fillStyle(0x000000, hovered ? 0.34 : 0.28);
    shadow.fillRoundedRect(
      left,
      -height / 2 + 6,
      width,
      height,
      radius,
    );

    surface.clear();
    surface.fillStyle(0x0b1931, 0.98);
    surface.fillRoundedRect(left, -height / 2, width, height, radius);
    surface.fillStyle(accentColor, hovered ? 0.17 : 0.095);
    surface.fillRoundedRect(left, -height / 2, width, height, radius);
    surface.fillStyle(0xffffff, hovered ? 0.045 : 0.025);
    surface.fillRoundedRect(
      left + 2,
      -height / 2 + 2,
      width - 4,
      Math.max(22, height * 0.42),
      radius - 2,
    );
    surface.lineStyle(hovered ? 2 : 1.2, accentColor, hovered ? 0.8 : 0.34);
    surface.strokeRoundedRect(left, -height / 2, width, height, radius);

    badge.setFillStyle(accentColor, hovered ? 0.28 : 0.15);
    badge.setStrokeStyle(hovered ? 2 : 1.5, accentColor, hovered ? 0.9 : 0.56);
    arrow.setFillStyle(accentColor, hovered ? 0.92 : 0.13);
    arrow.setStrokeStyle(1, accentColor, hovered ? 1 : 0.38);
    arrowText.setColor(hovered ? "#071322" : "#dceaff");
    eyebrow.setColor(hovered ? "#a7c5e9" : "#7189ae");
  };

  drawCard(false);
  const container = scene.add.container(x, y, [
    glow,
    shadow,
    surface,
    meter,
    tagBackground,
    badge,
    badgeText,
    eyebrow,
    title,
    description,
    tagText,
    meterLabel,
    arrow,
    arrowText,
    hitTarget,
  ]);
  container.setName(`difficulty-${level}`);

  hitTarget.on("pointerover", () => {
    drawCard(true);
    container.setScale(1.018);
  });
  hitTarget.on("pointerout", () => {
    drawCard(false);
    container.setScale(1);
  });
  hitTarget.on("pointerdown", () => {
    container.setScale(0.985);
  });
  hitTarget.on("pointerup", () => {
    container.setScale(1);
    onClick();
  });
  hitTarget.on("pointerupoutside", () => {
    drawCard(false);
    container.setScale(1);
  });

  return container;
}
