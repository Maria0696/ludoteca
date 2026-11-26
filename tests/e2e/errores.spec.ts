import { type Page, expect, test } from "@playwright/test";
import { cut, describeError, isNoise } from "../../src/lib/error-report";
import { openApp } from "./helpers";

const nextReport = (page: Page) =>
  page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/errores");

test("qué se cuenta de un error y qué se descarta", () => {
  expect(describeError(new TypeError("x no es una función"))).toMatchObject({ name: "TypeError", message: "x no es una función" });
  expect(describeError("texto suelto")).toEqual({ name: "Error", message: "texto suelto" });
  expect(describeError({ codigo: 42 })).toEqual({ name: "Valor lanzado", message: '{"codigo":42}' });
  expect(isNoise({ name: "Error", message: "ResizeObserver loop completed with undelivered notifications." })).toBe(true);
  // Una transición de pantalla que el navegador corta (cambió el tamaño de la ventana, otra navegación…).
  expect(isNoise({ name: "InvalidStateError", message: "Transition was aborted because of invalid state. Viewport size changed" })).toBe(true);
  expect(isNoise({ name: "AbortError", message: "Transition was skipped" })).toBe(true);
  expect(isNoise({ name: "Error", message: "boom", stack: "at chrome-extension://abc/content.js:1:1" })).toBe(true);
  expect(isNoise({ name: "TypeError", message: "boom", stack: "at /_next/static/chunks/app.js:1:1" })).toBe(false);
  expect(cut("abcdef", 4)).toBe("abc…");
  expect(cut("abc", 4)).toBe("abc");
});

test("los fallos del navegador se avisan al servidor, una sola vez cada uno", async ({ page }) => {
  await openApp(page, "/biblioteca");

  // Un fallo en un botón o en una tarea suelta.
  let report = nextReport(page);
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("Fallo de prueba en un botón");
    });
  });
  let request = await report;
  expect(request.postDataJSON()).toMatchObject({
    kind: "navegador",
    name: "Error",
    message: "Fallo de prueba en un botón",
    path: "/biblioteca",
  });
  expect((await request.response())?.status()).toBe(204);

  // Una promesa rechazada sin control.
  report = nextReport(page);
  await page.evaluate(() => {
    void Promise.reject(new TypeError("Promesa rota de prueba"));
  });
  request = await report;
  expect(request.postDataJSON()).toMatchObject({ kind: "promesa", name: "TypeError", message: "Promesa rota de prueba" });

  // El mismo fallo otra vez no se vuelve a enviar.
  let repeated = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/errores") repeated++;
  });
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error("Fallo de prueba en un botón");
    });
  });
  await page.waitForTimeout(500);
  expect(repeated).toBe(0);
});

test("la ruta de avisos rechaza lo que no es un aviso", async ({ request }) => {
  expect((await request.post("/api/errores", { data: { hola: "mundo" } })).status()).toBe(400);
  const tooLong = { kind: "navegador", name: "Error", message: "x".repeat(501), path: "/" };
  expect((await request.post("/api/errores", { data: tooLong })).status()).toBe(400);
  const ok = { kind: "navegador", name: "Error", message: "Aviso de prueba", path: "/" };
  expect((await request.post("/api/errores", { data: ok })).status()).toBe(204);
});
