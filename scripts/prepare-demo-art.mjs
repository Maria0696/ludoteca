// Prepara las obras de dominio público que ilustran los datos de demostración:
// una carátula 3:4 y un fondo apaisado, en WebP ligero.
// Uso: node scripts/prepare-demo-art.mjs <carpeta-originales> <clave=archivo.jpg[@izq,arriba,ancho,alto]>...
// El recorte opcional quita márgenes o pies de imprenta antes de encuadrar.
// Ejemplo usado: hades=gustave-dore-dante-alighieri-inferno-plate-9.jpg@230,230,1460,1900
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [srcDir, ...pairs] = process.argv.slice(2);
const out = path.join("public", "demo-art");
await mkdir(out, { recursive: true });

for (const pair of pairs) {
  const [key, spec] = pair.split("=");
  const [file, crop] = spec.split("@");
  const input = path.join(srcDir, file);
  const base = () => {
    const img = sharp(input);
    if (!crop) return img;
    const [left, top, width, height] = crop.split(",").map(Number);
    return img.extract({ left, top, width, height });
  };
  const position = crop ? "centre" : sharp.strategy.attention;
  await base().resize(600, 800, { fit: "cover", position }).webp({ quality: 78 }).toFile(path.join(out, `${key}-portada.webp`));
  await base().resize(1600, 900, { fit: "cover", position }).webp({ quality: 70 }).toFile(path.join(out, `${key}-fondo.webp`));
  console.log(`${key}: listo`);
}
