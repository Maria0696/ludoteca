/**
 * Reduce una imagen subida a una carátula ligera (JPEG de 600 px de ancho
 * como máximo) para guardarla junto a los datos sin servicios extra.
 */
export async function fileToCoverDataUrl(file: File, maxWidth = 600): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo no es una imagen.");
  if (file.size > 15 * 1024 * 1024) throw new Error("La imagen pesa más de 15 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Este navegador no puede procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
