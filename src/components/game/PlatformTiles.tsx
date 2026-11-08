"use client";

import { useState } from "react";
import { DEFAULT_PLATFORMS, PLATFORM_FAMILIES } from "@/lib/model";
import { usePlatformOptions } from "./PlatformField";
import styles from "./loot.module.css";

const KNOWN = new Set(DEFAULT_PLATFORMS);
const LAST_FAMILY = PLATFORM_FAMILIES.length - 1;

/** Consolas a la vista por familia, a un clic; «Otra…» permite escribir una nueva. */
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
  const [custom, setCustom] = useState(false);
  // Las que escribiste alguna vez a mano se quedan junto a «Otra…».
  const yours = usePlatformOptions(custom ? [] : [value]).filter((platform) => !KNOWN.has(platform));

  const tile = (platform: string) => (
    <button
      key={platform}
      id={platform === DEFAULT_PLATFORMS[0] ? id : undefined}
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

  return (
    <>
      <div className={styles.families} role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy}>
        {PLATFORM_FAMILIES.map((family, index) => (
          <div key={family.name} className={styles.family} role="group" aria-label={family.name}>
            <span className={styles.familyName} aria-hidden>
              {family.name}
            </span>
            <div className={styles.tiles}>
              {family.platforms.map(tile)}
              {index === LAST_FAMILY && yours.map(tile)}
              {index === LAST_FAMILY && (
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
              )}
            </div>
          </div>
        ))}
      </div>
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
