"use client";

import { Pause, Play } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { isSupabaseConfigured } from "@/lib/config";
import { safeNextPath } from "@/lib/redirect";
import { getBrowserSupabase } from "@/lib/supabase/client";
import styles from "./entrar.module.css";
import { PROJECTION, SECONDS_PER_WORK } from "./projection";

const prefersCalm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "acceso" ? "Esta cuenta no tiene acceso a la biblioteca." : null,
  );

  // Solo se montan la obra actual y la siguiente, que así ya está cargada al llegar su turno.
  const [reel, setReel] = useState({ current: 0, mounted: 2 });
  const [paused, setPaused] = useState(false);

  const roomRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (paused || entering || prefersCalm()) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setReel(({ current, mounted }) => {
        const next = (current + 1) % PROJECTION.length;
        return { current: next, mounted: Math.min(PROJECTION.length, Math.max(mounted, next + 2)) };
      });
    }, SECONDS_PER_WORK * 1000);
    return () => clearInterval(timer);
  }, [paused, entering]);

  // Con ratón, la pantalla y las butacas siguen levemente al puntero.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || prefersCalm()) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        room.style.setProperty("--mx", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        room.style.setProperty("--my", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // En el ordenador se puede escribir nada más llegar; en el móvil no se abre el teclado solo.
  useEffect(() => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) emailRef.current?.focus();
  }, []);

  /** Cada pulsación da un golpe de luz a la sala. */
  function flickerLight() {
    if (prefersCalm()) return;
    glowRef.current?.animate([{ filter: "brightness(1.35)" }, { filter: "brightness(1)" }], { duration: 380, easing: "ease-out" });
  }

  function shakeForm() {
    if (prefersCalm()) return;
    formRef.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-7px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 340, easing: "ease-out" },
    );
  }

  /** La pantalla crece hasta llenarlo todo y funde a negro. */
  async function playEntrance() {
    const screen = screenRef.current;
    const room = roomRef.current;
    if (!screen || !room || prefersCalm()) return;
    setEntering(true);
    const box = screen.getBoundingClientRect();
    const scale = Math.max(window.innerWidth / box.width, window.innerHeight / box.height) * 1.02;
    const dx = window.innerWidth / 2 - (box.left + box.width / 2);
    const dy = window.innerHeight / 2 - (box.top + box.height / 2);
    const grow = screen.animate(
      [
        { transform: getComputedStyle(screen).transform, borderRadius: "10px" },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, borderRadius: "0px" },
      ],
      { duration: 1000, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" },
    );
    const fade = room.animate([{ opacity: 1 }, { opacity: 0 }], { delay: 680, duration: 320, easing: "ease-in", fill: "forwards" });
    await Promise.all([grow.finished, fade.finished]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured || pending) return;
    if (!email.trim() || !password) {
      setError("Escribe tu correo y tu contraseña para entrar.");
      (email.trim() ? passwordRef : emailRef).current?.focus();
      shakeForm();
      return;
    }
    setPending(true);
    setError(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setPending(false);
      setError(
        error.message === "Invalid login credentials"
          ? "El correo o la contraseña no coinciden."
          : `No se pudo iniciar sesión: ${error.message}`,
      );
      shakeForm();
      return;
    }
    const target = safeNextPath(params.get("next"), window.location.origin);
    router.prefetch(target);
    await playEntrance();
    router.replace(target);
    router.refresh();
  }

  const work = PROJECTION[reel.current];
  const mountedWorks = PROJECTION.slice(0, reel.mounted);

  return (
    <main ref={roomRef} className={styles.room} data-fase={entering ? "entrando" : "sala"} data-pausa={paused || undefined}>
      {/* La luz de la obra proyectada se derrama por la sala. */}
      <div ref={glowRef} className={styles.glow} aria-hidden>
        {mountedWorks.map((w, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- luz difuminada, sin contenido propio
          <img key={w.src} src={w.src} alt="" className={`${styles.glowImage} ${i === reel.current ? styles.on : ""}`} />
        ))}
      </div>

      <div className={styles.stage}>
        <div ref={screenRef} className={styles.screen}>
          {mountedWorks.map((w, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- arte de fondo decorativo
            <img
              key={w.src}
              src={w.src}
              alt=""
              fetchPriority={i === 0 ? "high" : undefined}
              className={`${styles.frame} ${i === reel.current ? styles.on : ""}`}
            />
          ))}
          <div className={styles.titleCard}>
            <BrandMark />
          </div>
          <div className={styles.sheen} aria-hidden />
        </div>
        <div className={styles.credits}>
          <p key={work.src} className={styles.credit} aria-hidden>
            {work.title} <span>· {work.author}</span>
          </p>
          <button
            type="button"
            className={styles.pause}
            aria-label={paused ? "Reanudar la proyección" : "Pausar la proyección"}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
          </button>
        </div>
      </div>

      <div className={styles.entry}>
        <h1>Entrar en tu biblioteca</h1>
        {!isSupabaseConfigured ? (
          <p className="notice">
            Esta copia de la app no tiene la sincronización configurada. Abre la página de inicio para usar el modo local.
          </p>
        ) : (
          <form ref={formRef} onSubmit={submit} onInput={flickerLight} className={styles.form} noValidate>
            <div className="field">
              <label htmlFor="email">Correo</label>
              <input
                ref={emailRef}
                id="email"
                className={`input ${styles.input}`}
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                ref={passwordRef}
                id="password"
                className={`input ${styles.input}`}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className={`btn btn-ink ${styles.submit}`} type="submit" disabled={pending} aria-busy={pending}>
              {pending ? "Entrando…" : "Entrar"}
            </button>
            {error && (
              <p className={`notice is-error ${styles.error}`} role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>

      <div className={styles.seats} aria-hidden />
    </main>
  );
}
