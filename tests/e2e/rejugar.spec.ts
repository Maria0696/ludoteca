import { expect, test } from "@playwright/test";
import { type Game, createGame, gameSchema } from "../../src/lib/model";
import { archiveRun, finishDates, reopenSameDayRun, runNumber, timesFinished } from "../../src/lib/runs";

/* Rejugar un juego ya superado: las vueltas anteriores se guardan con su inicio y su fin. */

const game = (patch: Partial<Game>): Game => ({ ...createGame({ title: "Ocarina of Time" }), ...patch });

test("las vueltas: número, veces superado y fechas de fin", () => {
  const replaying = game({ pastRuns: [{ start: "2019-03-12", end: "2019-05-02" }], startedAt: "2026-11-23", finishedAt: null });
  expect(runNumber(replaying)).toBe(2);
  expect(timesFinished(replaying)).toBe(1);
  expect(finishDates(replaying)).toEqual(["2019-05-02"]);
  const finished = { ...replaying, finishedAt: "2026-11-30" };
  expect(timesFinished(finished)).toBe(2);
  expect(finishDates(finished)).toEqual(["2019-05-02", "2026-11-30"]);
});

test("archivar una vuelta la guarda y deja la nueva vacía", () => {
  const done = game({ startedAt: "2019-03-12", finishedAt: "2019-05-02", pastRuns: [] });
  const archived = archiveRun(done);
  expect(archived.pastRuns).toEqual([{ start: "2019-03-12", end: "2019-05-02" }]);
  expect(archived.startedAt).toBeNull();
  expect(archived.finishedAt).toBeNull();
  // Sin vuelta terminada no hay nada que archivar.
  const unfinished = game({ startedAt: "2026-11-01", finishedAt: null });
  expect(archiveRun(unfinished)).toBe(unfinished);
});

test("el error del mismo día recupera la vuelta", () => {
  const today = "2026-11-23";
  const reopened = reopenSameDayRun(game({ pastRuns: [{ start: "2026-11-01", end: today }], startedAt: today, finishedAt: null }), today);
  expect(reopened?.pastRuns).toEqual([]);
  expect(reopened?.startedAt).toBe("2026-11-01");
  expect(reopened?.finishedAt).toBe(today);
  // Una vuelta que acabó otro día es de verdad otra vuelta.
  expect(reopenSameDayRun(game({ pastRuns: [{ start: null, end: "2026-11-20" }], startedAt: today, finishedAt: null }), today)).toBeNull();
});

test("una copia antigua, sin vueltas, se sigue leyendo", () => {
  const { pastRuns, ...old } = game({});
  void pastRuns;
  expect(gameSchema.parse(old).pastRuns).toEqual([]);
});
