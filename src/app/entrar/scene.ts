/*
 * La escena de «Entrar», dibujada en un lienzo de píxeles grandes: el muro,
 * las estanterías de cajas de juegos, la puerta y la guardiana (un personaje
 * propio de la app).
 */

const KEEPER = [
  ".....hhhhhh.......",
  "...hhHHHHHHhh.....",
  "..hHHHHHHHHHHh....",
  "..hHHHHHHHHHHh....",
  "..hHHffffffHHh....",
  "..hHfeffffefHh....",
  "..hHffffffffHh....",
  "..hHfffmmfffHh....",
  "...hHffffffHh.....",
  "....hhHHHHhh......",
  "...rRRgggRRr......",
  "..rRRRRgRRRRr.....",
  ".rRRrRRgRRrRRr....",
  ".rRrrRRgRRrrRRr...",
  ".ffrrRRgRRrr.ffLL.",
  ".ffrrRRgRRrr..LYYL",
  "...rRRRgRRRr..LYYL",
  "...rRRRgRRRr..LLLL",
  "...rRRRgRRRr......",
  "..rRRRRgRRRRr.....",
  "..rRRRRgRRRRr.....",
  "..rRRRRgRRRRr.....",
  "...bbb...bbb......",
  "...bbb...bbb......",
];

const PALETTE: Record<string, string> = {
  h: "#1f5d6b",
  H: "#2f8a99",
  f: "#e9c39b",
  e: "#1a1426",
  m: "#b5705a",
  r: "#3d2a6b",
  R: "#5a3f9a",
  g: "#ffd76a",
  L: "#3a3340",
  Y: "#ffe27a",
  b: "#2a2030",
};

/** Letras de 3×5 para el rótulo de encima de la puerta. */
const SIGN: Record<string, string[]> = {
  L: ["100", "100", "100", "100", "111"],
  U: ["101", "101", "101", "101", "111"],
  D: ["110", "101", "101", "101", "110"],
  O: ["111", "101", "101", "101", "111"],
  T: ["111", "010", "010", "010", "010"],
  E: ["111", "100", "110", "100", "111"],
  C: ["111", "100", "100", "100", "111"],
  A: ["111", "101", "111", "101", "101"],
};

const BOX_COLORS = ["#c8473f", "#3f7fc8", "#e0a92e", "#3fa66f", "#8a4fc0", "#e8e0cf", "#d76a2e", "#2fa3a8"];

export interface GameBox {
  w: number;
  h: number;
  color: string;
}

export interface SceneState {
  time: number;
  /** De 0 (cerrada) a 1 (abierta). */
  open: number;
  opening: boolean;
  /** Se agita al equivocarse: de 1 a 0. */
  shake: number;
  /** Punto de la puerta, de 0 a 1, hacia el que acerca la cámara. */
  focus: { x: number; y: number };
}

export const initialScene = (): SceneState => ({ time: 0, open: 0, opening: false, shake: 0, focus: { x: 0.5, y: 0.5 } });

/** Tamaño de cada punto lógico en pantalla, según el espacio disponible. */
export function pixelSize(width: number, height: number): number {
  return Math.max(3, Math.min(7, Math.floor(Math.min(width / 288, height / 150))));
}

export function makeGameBoxes(): GameBox[] {
  return Array.from({ length: 400 }, () => ({
    w: Math.random() < 0.2 ? 6 : 2 + Math.floor(Math.random() * 3),
    h: 8 + Math.floor(Math.random() * 5),
    color: BOX_COLORS[Math.floor(Math.random() * BOX_COLORS.length)],
  }));
}

function drawSprite(g: CanvasRenderingContext2D, x: number, y: number) {
  KEEPER.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = PALETTE[row[i]];
      if (!color) continue;
      g.fillStyle = color;
      g.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
    }
  });
}

function drawLight(g: CanvasRenderingContext2D, x: number, y: number, radius: number, rgb: string, alpha: number) {
  g.save();
  g.globalCompositeOperation = "lighter";
  const glow = g.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, `rgba(${rgb},${alpha})`);
  glow.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = glow;
  g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  g.restore();
}

export function drawScene(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  floorFromBottom: number,
  boxes: GameBox[],
  scene: SceneState,
  calm: boolean,
) {
  const { time, open, shake } = scene;
  const floor = Math.round(H - floorFromBottom);
  const cx = Math.round(W / 2);
  const doorW = Math.min(52, Math.round(W * 0.36));
  const doorH = Math.min(82, Math.max(46, floor - 18));
  const doorX = cx - Math.round(doorW / 2);
  const doorY = floor - doorH;
  scene.focus = { x: cx / W, y: (doorY + doorH * 0.55) / H };

  /* Muro de piedra y suelo. */
  g.fillStyle = "#2b2438";
  g.fillRect(0, 0, W, floor);
  g.fillStyle = "#231d30";
  for (let y = 0; y < floor; y += 6) {
    g.fillRect(0, y, W, 1);
    for (let x = (y / 6) % 2 ? 0 : 7; x < W; x += 14) g.fillRect(x, y, 1, 6);
  }
  for (let y = floor; y < H; y += 7) {
    for (let x = ((y - floor) / 7) % 2 ? 0 : 9; x < W + 18; x += 18) {
      g.fillStyle = (x + y) % 2 ? "#3a3047" : "#332a40";
      g.fillRect(x - 9, y, 18, 7);
      g.fillStyle = "#2a2236";
      g.fillRect(x - 9, y, 18, 1);
    }
  }

  /* Estanterías de cajas a los lados de la puerta. */
  const shelves = Math.max(2, Math.floor((floor - 12) / 17));
  let next = 0;
  const bookcase = (from: number, to: number) => {
    if (to - from < 16) return;
    g.fillStyle = "#4a3524";
    g.fillRect(from, floor - shelves * 17 - 3, to - from, shelves * 17 + 3);
    for (let s = 0; s < shelves; s++) {
      const y = floor - s * 17 - 3;
      g.fillStyle = "#1c1420";
      g.fillRect(from + 2, y - 14, to - from - 4, 14);
      let x = from + 3;
      while (x < to - 8) {
        const box = boxes[next++ % boxes.length];
        g.fillStyle = box.color;
        g.fillRect(x, y - box.h, box.w, box.h);
        g.fillStyle = "#ffffff55";
        g.fillRect(x, y - box.h, 1, box.h);
        x += box.w + 1;
      }
      g.fillStyle = "#6b4d33";
      g.fillRect(from, y, to - from, 3);
    }
  };
  bookcase(4, doorX - 20);
  bookcase(doorX + doorW + 20, W - 4);

  /* Rótulo. */
  if (doorY >= 16) {
    const signX = cx - 18;
    const signY = doorY - 15;
    g.fillStyle = "#47301c";
    g.fillRect(signX - 1, signY - 1, 38, 11);
    g.fillStyle = "#6b4d33";
    g.fillRect(signX, signY, 36, 9);
    g.fillStyle = "#ffd76a";
    [..."LUDOTECA"].forEach((letter, n) => {
      SIGN[letter].forEach((row, j) => {
        for (let i = 0; i < 3; i++) if (row[i] === "1") g.fillRect(signX + 3 + n * 4 + i - 1, signY + 2 + j, 1, 1);
      });
    });
  }

  /* Puerta: dos hojas que se abren hacia los lados. */
  g.fillStyle = "#6b5a3e";
  g.fillRect(doorX - 4, doorY - 4, doorW + 8, doorH + 4);
  const light = g.createLinearGradient(0, doorY, 0, floor);
  light.addColorStop(0, "#fff6d8");
  light.addColorStop(1, "#ffd76a");
  g.fillStyle = light;
  g.fillRect(doorX, doorY, doorW, doorH);
  const leaf = Math.round((doorW / 2) * (1 - open));
  const paintLeaf = (x: number, w: number) => {
    if (w <= 0) return;
    g.fillStyle = "#5a3b22";
    g.fillRect(x, doorY, w, doorH);
    g.fillStyle = "#47301c";
    for (let i = 0; i < w; i += 5) g.fillRect(x + i, doorY, 1, doorH);
    g.fillStyle = "#2a2a30";
    [0.18, 0.74].forEach((f) => g.fillRect(x, doorY + Math.round(doorH * f), w, 3));
  };
  paintLeaf(doorX, leaf);
  paintLeaf(doorX + doorW - leaf, leaf);
  if (open < 0.1) {
    g.fillStyle = "#ffd76a";
    g.fillRect(cx - 3, doorY + Math.round(doorH * 0.5), 2, 4);
    g.fillRect(cx + 1, doorY + Math.round(doorH * 0.5), 2, 4);
  }

  /* Antorchas. */
  [doorX - 12, doorX + doorW + 12].forEach((x) => {
    const y = doorY + 10;
    const flicker = calm ? 0 : Math.round(Math.sin(time * 19 + x) * 1.2 + Math.random() * 1.4);
    g.fillStyle = "#3a2a1c";
    g.fillRect(x - 1, y, 3, 8);
    g.fillStyle = "#ff7a2e";
    g.fillRect(x - 2, y - 5 - flicker, 5, 6 + flicker);
    g.fillStyle = "#ffd76a";
    g.fillRect(x - 1, y - 3 - flicker, 3, 4 + flicker);
    drawLight(g, x, y - 3, 32 + flicker * 2, "255,154,60", 0.4);
  });

  if (open > 0) drawLight(g, cx, floor - doorH / 2, doorH * 1.6, "255,226,150", 0.75 * open);

  /* Guardiana: respira, parpadea, niega si te equivocas y se aparta al abrir. */
  const bob = calm ? 0 : Math.round(Math.sin(time * 2.4));
  const refuse = shake > 0 && !calm ? Math.round(Math.sin(time * 40) * 2 * shake) : 0;
  const keeperX = cx - 9 + Math.round(open * Math.min(46, doorW * 0.95)) + refuse;
  const keeperY = floor - 22 + bob;
  drawSprite(g, keeperX, keeperY);
  if (!calm && Math.sin(time * 1.3) > 0.985) {
    g.fillStyle = PALETTE.f;
    g.fillRect(keeperX + 4, keeperY + 5, 1, 1);
    g.fillRect(keeperX + 9, keeperY + 5, 1, 1);
  }
  drawLight(g, keeperX + 16, keeperY + 16, 16, "255,226,122", calm ? 0.4 : 0.3 + Math.random() * 0.1);
}
