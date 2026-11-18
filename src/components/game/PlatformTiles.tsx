"use client";

import { useMemo, useState } from "react";
import { DEFAULT_PLATFORMS, PLATFORM_FAMILIES } from "@/lib/model";
import { useLibrary } from "@/lib/store";
import { usePlatformOptions } from "./PlatformField";
import styles from "./loot.module.css";

const KNOWN = new Set(DEFAULT_PLATFORMS);
const LAST_FAMILY = PLATFORM_FAMILIES.length - 1;

/**
 * Consolas a un clic. Con juegos en la biblioteca, primero las tuyas (de más a menos usada) y
 * el resto por familias tras «Más plataformas»; sin juegos, todas. «Otra…» permite escribir una nueva.
 */
export function PlatformTiles({
  id,
  value,
  onChange,
  labelledBy,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (platform: string) => void;
  labelledBy: string;
  describedBy?: string;
}) {
  const { library } = useLibrary();
  const [custom, setCustom] = useState(false);
  const [more, setMore] = useState(false);
  // Las que escribiste alguna vez a mano se quedan junto a «Otra…».
  const typed = usePlatformOptions(custom ? [] : [value]).filter((platform) => !KNOWN.has(platform));
  // Las de tus copias, de más a menos usada; la elegida (p. ej. por el catálogo) también.
  const mine = useMemo(() => {
    const count = new Map<string, number>();
    for (const c of library.copies) count.set(c.platform, (count.get(c.platform) ?? 0) + 1);
    const sorted = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).map(([platform]) => platform);
    if (!custom && value && !count.has(value)) sorted.push(value);
    return sorted;
  }, [library.copies, value, custom]);
  const short = mine.length > 0 && !more;
  const firstId = short ? mine[0] : DEFAULT_PLATFORMS[0];

  const tile = (platform: string) => (
    <button
      key={platform}
      id={platform === firstId ? id : undefined}
      type="button"
      className={styles.tile}
      role="radio"
      aria-checked={!custom && value === platform}
      onClick={() => {
        setCustom(false);
        onChange(platform);
      }}
    >
      {platform}
    </button>
  );

  const other = (
    <button
      type="button"
      className={styles.tile}
      role="radio"
      aria-checked={custom}
      onClick={() => {
        setCustom(true);
        onChange("");
      }}
    >
      Otra…
    </button>
  );

  return (
    <>
      {short ? (
        <div className={styles.tiles} role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy}>
          {mine.map(tile)}
          {other}
        </div>
      ) : (
        <div className={styles.families} role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy}>
          {PLATFORM_FAMILIES.map((family, index) => (
            <div key={family.name} className={styles.family} role="group" aria-label={family.name}>
              <span className={styles.familyName} aria-hidden>
                {family.name}
              </span>
              <div className={styles.tiles}>
                {family.platforms.map(tile)}
                {index === LAST_FAMILY && typed.map(tile)}
                {index === LAST_FAMILY && other}
              </div>
            </div>
          ))}
        </div>
      )}
      {short && (
        <button type="button" className={styles.more} aria-expanded={false} onClick={() => setMore(true)}>
          Más plataformas
        </button>
      )}
      {custom && (
        <input
          className={styles.customPlatform}
          value={value}
          placeholder="Nombre de la plataforma"
          aria-label="Nombre de la plataforma"
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </>
  );
}
