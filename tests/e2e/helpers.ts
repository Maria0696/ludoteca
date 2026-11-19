import { type Locator, type Page, expect } from "@playwright/test";

export async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByText("Cargando tu biblioteca…")).toHaveCount(0);
}

/** Abre un apartado del menú de Ajustes (copia, datos, demostracion, catalogo, steam, creditos, eliminar). */
export async function openAjustes(page: Page, apartado: string) {
  await openApp(page, `/ajustes?apartado=${apartado}`);
}

export async function loadDemo(page: Page) {
  await openApp(page, "/biblioteca");
  await page.getByRole("button", { name: "Probar con datos de demostración" }).click();
  await expect(page.getByText("22 títulos · 24 copias")).toBeVisible();
}

/** Elige plataforma en la ventana de añadir juego. */
export async function choosePlatform(dialog: Locator, platform: string) {
  const tile = dialog.getByRole("radiogroup", { name: "Plataforma" }).getByRole("radio", { name: platform, exact: true });
  // Con juegos en la biblioteca, las demás plataformas esperan tras «Más plataformas».
  const more = dialog.getByRole("button", { name: "Más plataformas" });
  if (!(await tile.isVisible()) && (await more.isVisible())) await more.click();
  await tile.click();
}

export async function addGame(
  page: Page,
  game: { title: string; platform: string; format?: "Físico" | "Digital"; status?: string },
) {
  await page.getByRole("button", { name: "Añadir juego" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const title = dialog.getByLabel("Título");
  if (await title.count()) await title.fill(game.title);
  await choosePlatform(dialog, game.platform);
  if (game.format) await dialog.getByRole("radio", { name: game.format, exact: true }).click();
  if (game.status) await dialog.getByRole("radio", { name: game.status, exact: true }).click();
  await dialog.getByRole("button", { name: /^Añadir (a la biblioteca|copia)$/ }).click();
  await expect(dialog.getByRole("button", { name: "Añadir otro" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(dialog).toBeHidden();
}

/**
 * Comprueba que todo el texto visible de `root` está en la carcasa: ni Albert
 * Sans ni Bricolage Grotesque, y nada en VT323 por debajo de 18 px.
 */
export async function expectCarcasaText(root: Locator): Promise<void> {
  const offenders = await root.evaluate((rootEl) => {
    const out: string[] = [];
    for (const el of [rootEl, ...rootEl.querySelectorAll("*")]) {
      const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
      if (!own) continue;
      const rect = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      // Solo lo que se ve: fuera lo invisible y el texto solo para lectores de pantalla.
      if (!rect.width || !rect.height || s.visibility === "hidden" || el.closest(".sr-only")) continue;
      const family = s.fontFamily;
      const size = parseFloat(s.fontSize);
      const text = (el.textContent ?? "").trim().slice(0, 40);
      if (/Albert|Bricolage/i.test(family)) out.push(`«${text}»: ${family.split(",")[0]} ${size}px`);
      else if (/VT323/i.test(family) && size < 18) out.push(`«${text}»: VT323 ${size}px`);
    }
    return out;
  });
  if (offenders.length) throw new Error(`Texto fuera de la carcasa:\n${offenders.join("\n")}`);
}

/** Tarjetas visibles en la rejilla de la biblioteca. */
export function cards(page: Page) {
  return page.getByRole("list", { name: "Juegos" }).getByRole("listitem").filter({ has: page.getByRole("link") });
}

/** Contraste WCAG entre dos colores `rgb()`/`rgba()` tal como los da getComputedStyle (se ignora la transparencia). */
export function contrastRatio(fg: string, bg: string): number {
  const luminance = (color: string) => {
    const [r, g, b] = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** Lo que sobra en un campo después de su texto de ejemplo: negativo si el ejemplo se corta. */
export async function placeholderRoom(field: Locator): Promise<number> {
  return field.evaluate((el) => {
    const s = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${s.fontSize} ${s.fontFamily}`;
    const free = el.getBoundingClientRect().width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - parseFloat(s.borderLeftWidth) - parseFloat(s.borderRightWidth);
    return free - ctx.measureText((el as HTMLInputElement).placeholder).width;
  });
}
