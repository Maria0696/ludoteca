import { type Page, expect, test } from "@playwright/test";
import { keepaliveFetch } from "../../src/lib/supabase/keepalive";
import { addGame, openApp } from "./helpers";

/* Que un cambio no se pierda al cerrar rápido: keepalive en la nube, aviso al cerrar y «Guardando…» si tarda. */

/** Un fetch de mentira que apunta con qué opciones lo llamaron. */
function recorder() {
  const calls: (RequestInit | undefined)[] = [];
  const fake = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init);
    return new Response("{}");
  }) as typeof fetch;
  return { calls, fetch: keepaliveFetch(fake) };
}

test("en la nube, una escritura pequeña sigue viva aunque se cierre la página; una grande o una lectura, como siempre", async () => {
  const r = recorder();
  await r.fetch("https://x.supabase.co/rest/v1/games", { method: "POST", body: JSON.stringify([{ id: "1", title: "Hades" }]) });
  await r.fetch("https://x.supabase.co/rest/v1/games?id=eq.1", { method: "DELETE" });
  await r.fetch("https://x.supabase.co/rest/v1/games", { method: "POST", body: "x".repeat(70_000) });
  await r.fetch("https://x.supabase.co/rest/v1/games?select=*");
  expect(r.calls.map((c) => c?.keepalive)).toEqual([true, true, undefined, undefined]);
});

/** Retrasa 2,5 s el final de cada escritura en el navegador, como una conexión lenta. */
async function slowSaves(page: Page) {
  await page.evaluate(() => {
    const desc = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, "oncomplete")!;
    Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
      configurable: true,
      get() {
        return desc.get!.call(this);
      },
      set(fn: ((ev: Event) => void) | null) {
        desc.set!.call(this, fn && ((ev: Event) => setTimeout(() => fn.call(this, ev), 2500)));
      },
    });
  });
}

/** Si cerrar o recargar ahora pediría confirmación. */
const wouldAsk = (page: Page) =>
  page.evaluate(() => {
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  });

test("si guardar tarda, la cabecera dice «Guardando…» y cerrar pide confirmación hasta que termina", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await slowSaves(page);
  await addGame(page, { title: "Tunic", platform: "PC" });
  const saving = page.getByRole("banner").getByRole("status");
  await expect(saving).toHaveText("Guardando…");
  expect(await wouldAsk(page)).toBe(true);
  await expect(saving).toHaveCount(0, { timeout: 5000 });
  expect(await wouldAsk(page)).toBe(false);
});

test("con un guardado normal, «Guardando…» no llega a salir", async ({ page }) => {
  await openApp(page, "/biblioteca");
  await page.evaluate(() => {
    const w = window as unknown as { visto: boolean };
    w.visto = false;
    new MutationObserver(() => {
      if (document.querySelector("header [role=status]")) w.visto = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await addGame(page, { title: "Tunic", platform: "PC" });
  await expect(page.locator("html")).not.toHaveAttribute("data-guardando");
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => (window as unknown as { visto: boolean }).visto)).toBe(false);
});
