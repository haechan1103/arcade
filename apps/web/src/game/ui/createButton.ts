import Phaser from "phaser";
import { UI_FONT } from "../layout";

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  hoverColor?: number;
  textColor?: string;
  fontSize?: number;
  subtitle?: string;
}

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const width = options.width ?? 280;
  const height = options.height ?? 64;
  const color = options.color ?? 0x1ab8d6;
  const hoverColor = options.hoverColor ?? 0x2ed5ef;
  const textColor = options.textColor ?? "#071322";
  const fontSize = options.fontSize ?? 23;

  const shadow = scene.add
    .rectangle(0, 5, width, height, 0x000000, 0.26)
    .setOrigin(0.5);
  const background = scene.add
    .rectangle(0, 0, width, height, color, 1)
    .setOrigin(0.5)
    .setStrokeStyle(2, 0xffffff, 0.22)
    .setInteractive({ useHandCursor: true });
  const labelText = scene.add
    .text(0, options.subtitle === undefined ? 0 : -9, label, {
      fontFamily: UI_FONT,
      fontSize: `${fontSize}px`,
      fontStyle: "bold",
      color: textColor,
      align: "center",
    })
    .setOrigin(0.5);

  const children: Phaser.GameObjects.GameObject[] = [
    shadow,
    background,
    labelText,
  ];

  if (options.subtitle !== undefined) {
    children.push(
      scene.add
        .text(0, 17, options.subtitle, {
          fontFamily: UI_FONT,
          fontSize: "12px",
          color: textColor,
          align: "center",
        })
        .setOrigin(0.5)
        .setAlpha(0.72),
    );
  }

  const container = scene.add.container(x, y, children);
  background.on("pointerover", () => {
    background.setFillStyle(hoverColor);
    container.setScale(1.025);
  });
  background.on("pointerout", () => {
    background.setFillStyle(color);
    container.setScale(1);
  });
  background.on("pointerdown", () => {
    container.setScale(0.98);
  });
  background.on("pointerup", () => {
    container.setScale(1.025);
    onClick();
  });

  return container;
}
