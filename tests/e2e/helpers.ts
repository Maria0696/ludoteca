import { type Locator, type Page, expect } from "@playwright/test";
import { createDemoLibrary } from "../../src/lib/demo";
import { FORMAT } from "../../src/lib/repo/local";

/**
 * Espera a que acabe la transición de pantalla (si la hay): mientras dura, lo que anima no recibe toques, así que medir
 * qué se toca en un punto antes de tiempo engaña.
 */
export async function screenSettled(page: Page) {
  await page.waitForFunction(() => !document.getAnimations().some((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition")));
}

/**
 * Espera a que la app termine de guardar en el navegador (mientras guarda, la página lleva `data-guardando`).
 * Recargar o ir a otra página antes cortaría el guardado y el cambio se perdería.
 */
export async function saved(page: Page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-guardando"));
}

export async function openApp(page: Page, path = "/") {
  await saved(page);
  await page.goto(path);
  await expect(page.getByText("Cargando tu biblioteca…")).toHaveCount(0);
}

/** Recarga la página cuando ya está guardado lo último que se hizo. */
export async function reloadApp(page: Page) {
  await saved(page);
  await page.reload();
  await expect(page.getByText("Cargando tu biblioteca…")).toHaveCount(0);
}

/**
 * La biblioteca de demostración, escrita directamente en el navegador: lo mismo que deja «Probar con datos de
 * demostración», pero sin cargar la app dos veces. Se escribe desde una página estática del mismo sitio; después hay
 * que abrir la app (openApp).
 */
export async function seedDemo(page: Page) {
  await page.goto("/offline.html");
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("ludoteca", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("library");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("library", "readwrite");
          tx.objectStore("library").put(value, "data");
          // Hasta que la transacción no termina, lo escrito no está guardado.
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { ...createDemoLibrary(), format: FORMAT },
  );
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
