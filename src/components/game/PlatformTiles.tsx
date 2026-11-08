"use client";

import { useState } from "react";
import { usePlatformOptions } from "./PlatformField";
import styles from "./loot.module.css";

/** Plataformas a la vista, a un clic; «Otra…» permite escribir una nueva. */
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
  const options = usePlatformOptions(custom ? [] : [value]);

  return (
    <>
      <div className={styles.tiles} role="radiogroup" aria-labelledby={labelledBy} aria-describedby={describedBy}>
        {options.map((platform, i) => (
          <button
            key={platform}
            id={i === 0 ? id : undefined}
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
        ))}
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
