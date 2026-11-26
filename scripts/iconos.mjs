// Genera los iconos de la app (la guardiana sobre morado noche) a partir de su dibujo de píxeles.
// Uso: node scripts/iconos.mjs   (Node 23.6+ lee el dibujo directamente del .ts)
// Salen: public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png, src/app/apple-icon.png y
// src/app/icon.svg (el de la pestaña del navegador). También mete la guardiana en public/offline.html, que sin
// conexión no puede cargar nada de fuera.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { KEEPER, KEEPER_PALETTE } from "../src/components/pixel/sprites.ts";

const BG = "#1a1526";
// La cabeza y los hombros de la guardiana: las 14 primeras filas, recortadas a lo que tiene color.
const rows = KEEPER.slice(0, 14);
const cols = rows.flatMap((r) => [...r].flatMap((c, x) => (c === "." ? [] : [x])));
const left = Math.min(...cols);
const width = Math.max(...cols) - left + 1;
const height = rows.length;

/**
 * El icono en SVG: un retrato, con los hombros apoyados en el borde de abajo. `grid` es cuántas celdas mide de lado:
 * con más celdas, la guardiana queda más pequeña. En el adaptable (Android lo recorta en círculo) la cara queda dentro
 * de la zona segura; los hombros sí pueden cortarse, como en una foto de perfil.
 */
function iconSvg(grid, size) {
  const ox = Math.floor((grid - width) / 2);
  const oy = grid - height;
  let art = "";
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const fill = KEEPER_PALETTE[c];
      if (fill) art += `<rect x="${ox + x - left}" y="${oy + y}" width="1" height="1" fill="${fill}"/>`;
    });
  });
  // Líneas de pantalla finas, como en el Wrapped: una de cada cuatro píxeles del icono final.
  const step = (grid / size) * 4;
  let scan = "";
  for (let y = 0; y < grid; y += step) scan += `<rect x="0" y="${y.toFixed(3)}" width="${grid}" height="${(step / 4).toFixed(3)}" fill="#000" opacity="0.22"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${grid} ${grid}" shape-rendering="crispEdges"><rect width="${grid}" height="${grid}" fill="${BG}"/>${art}${scan}</svg>`;
}

/** Solo la guardiana, sin fondo: para la pantalla sin conexión. */
function artSvg() {
  let art = "";
  rows.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const fill = KEEPER_PALETTE[c];
      if (fill) art += `<rect x="${x - left}" y="${y}" width="1" height="1" fill="${fill}"/>`;
    });
  });
  return `<svg viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges" aria-hidden="true">${art}</svg>`;
}

const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(file);

await png(iconSvg(20, 192), "public/icon-192.png");
await png(iconSvg(20, 512), "public/icon-512.png");
await png(iconSvg(22, 512), "public/icon-maskable-512.png");
await png(iconSvg(20, 180), "src/app/apple-icon.png");
// En la pestaña se ve a 16–32 px: sin líneas de pantalla, que ahí solo ensucian.
await writeFile("src/app/icon.svg", iconSvg(16, 32).replace(/<rect x="0" y="[\d.]+" width="\d+" height="[\d.]+" fill="#000" opacity="0.22"\/>/g, "") + "\n");
const offline = await readFile("public/offline.html", "utf8");
const marked = /(<!-- guardiana:[^>]*-->\n)[\s\S]*?(\s*<!-- \/guardiana -->)/;
if (!marked.test(offline)) throw new Error("public/offline.html no tiene las marcas de la guardiana");
await writeFile("public/offline.html", offline.replace(marked, (_, open, close) => `${open}      ${artSvg()}${close}`));
console.log("Iconos listos.");
