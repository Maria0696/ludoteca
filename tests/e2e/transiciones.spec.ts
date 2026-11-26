import { type Page, expect, test } from "@playwright/test";
import { loadDemo, openApp } from "./helpers";

/* Cambiar de pantalla: la vieja se va con un fundido y la nueva entra con un fundido breve (y sube un poco). */

/** Los nombres de las animaciones de la transición que se vean mientras dura (se miran en cada fotograma). */
async function watchTransitions(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __vt: string[] };
    w.__vt = [];
    const look = () => {
      for (const a of document.getAnimations()) {
        const name = (a as CSSAnimation).animationName;
        if (name && !w.__vt.includes(name)) w.__vt.push(name);
      }
      requestAnimationFrame(look);
    };
    look();
  });
}
const seen = (page: Page) => page.evaluate(() => (window as unknown as { __vt: string[] }).__vt);

test("cambiar de pantalla funde la vieja y hace entrar la nueva; la cabecera no se mueve", async ({ page }) => {
  await loadDemo(page);
  await openApp(page, "/");
  await watchTransitions(page);
  await page.getByRole("navigation", { name: "Principal" }).first().getByRole("link", { name: "Biblioteca" }).click();
  await expect(page).toHaveURL(/\/biblioteca$/);
  await expect.poll(() => seen(page)).toEqual(expect.arrayContaining(["pantalla-sale", "pantalla-entra"]));
});

test("con «Reducir movimiento», solo un fundido, sin desplazamiento", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loadDemo(page);
  await openApp(page, "/");
  await watchTransitions(page);
  await page.getByRole("navigation", { name: "Principal" }).first().getByRole("link", { name: "Deseos" }).click();
  await expect(page).toHaveURL(/\/deseos$/);
  await expect.poll(() => seen(page)).toContain("pantalla-fundido");
  expect(await seen(page)).not.toContain("pantalla-entra");
});
