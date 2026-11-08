/*
 * Dibujos de píxeles propios de la app: la guardiana (también en «Entrar»)
 * y el trofeo del 100 %.
 */

export const KEEPER = [
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

export const KEEPER_PALETTE: Record<string, string> = {
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

const TROPHY = [
  "...YYYYYYYYYY...",
  ".GGYWWYYYYYOYGG.",
  "G..YWWYYYYYOY..G",
  "G..YWYYYYYYOY..G",
  ".G.YWYYYYYYOY.G.",
  "..GGYYYYYYOOGG..",
  "....YYYYYYOO....",
  ".....YYYYOO.....",
  "......YYOO......",
  ".......YO.......",
  ".......YO.......",
  ".....YYYOOO.....",
  "....BBBBBBBB....",
  "....BYYYYYOB....",
  "....BBBBBBBB....",
];

const TROPHY_PALETTE: Record<string, string> = { Y: "#ffd76a", W: "#fff8d0", O: "#c8962a", G: "#e9b94a", B: "#6b4a2a" };

/** Convierte un dibujo en una imagen SVG nítida a cualquier tamaño. */
function spriteUrl(rows: string[], palette: Record<string, string>): string {
  const width = Math.max(...rows.map((row) => row.length));
  let rects = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      let run = 1;
      while (row[x + run] === row[x]) run++;
      const fill = palette[row[x]];
      if (fill) rects += `<rect x='${x}' y='${y}' width='${run}' height='1' fill='${fill}'/>`;
      x += run;
    }
  });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${rows.length}' shape-rendering='crispEdges'>${rects}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const KEEPER_URL = spriteUrl(KEEPER, KEEPER_PALETTE);
export const TROPHY_URL = spriteUrl(TROPHY, TROPHY_PALETTE);
