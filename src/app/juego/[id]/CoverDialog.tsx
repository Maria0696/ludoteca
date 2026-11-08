"use client";

import { ImageUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { TitleWithCatalog } from "@/components/game/CatalogSearch";
import { Cover } from "@/components/ui/Cover";
import { Dialog } from "@/components/ui/Dialog";
import { fileToCoverDataUrl } from "@/lib/image";
import styles from "./detail.module.css";

export function CoverDialog({
  title,
  current,
  onClose,
  onSave,
}: {
  title: string;
  current: string | null | undefined;
  onClose: () => void;
  onSave: (url: string | null) => void;
}) {
  const [url, setUrl] = useState(current?.startsWith("data:") ? "" : current ?? "");
  const [preview, setPreview] = useState<string | null>(current ?? null);
  const [search, setSearch] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Cambiar carátula"
      footer={
        <>
          {current && (
            <button type="button" className="btn btn-danger" style={{ marginRight: "auto" }} onClick={() => onSave(null)}>
              Quitar carátula
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-ink" disabled={!preview || preview === current} onClick={() => onSave(preview)}>
            Guardar carátula
          </button>
        </>
      }
    >
      <div className={styles.coverEdit}>
        <Cover src={preview} title={title} className={styles.coverPreview} />
        <div className={styles.coverFields}>
          <div className="field">
            <label htmlFor="cover-search">Buscar en el catálogo</label>
            <TitleWithCatalog
              id="cover-search"
              value={search}
              onChange={setSearch}
              onPick={(g) => {
                if (g.coverUrl) setPreview(g.coverUrl);
                else toast("Ese resultado no tiene carátula en el catálogo.");
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="cover-url">O pega un enlace a una imagen</label>
            <input
              id="cover-url"
              className="input"
              type="url"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => {
                if (!url.trim()) return;
                if (!/^https?:\/\//i.test(url.trim())) return setError("El enlace debe empezar por http:// o https://.");
                setError(null);
                setPreview(url.trim());
              }}
            />
          </div>
          <div className="field">
            <span className="label">O sube un archivo</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              id="cover-file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  setPreview(await fileToCoverDataUrl(file));
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "No se pudo leer la imagen.");
                }
              }}
            />
            <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={() => fileRef.current?.click()}>
              <ImageUp aria-hidden />
              Elegir imagen
            </button>
            <p className="hint">Se guarda reducida a 600 px de ancho.</p>
          </div>
          {error && (
            <p className="notice is-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </Dialog>
  );
}
