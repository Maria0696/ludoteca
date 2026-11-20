"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured } from "@/lib/config";
import { safeNextPath } from "@/lib/redirect";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { markTitleScreenSeen } from "@/lib/title-screen";
import styles from "./entrar.module.css";
import { arcade, terminal } from "./fonts";
import { drawScene, initialScene, makeGameBoxes, pixelSize } from "./scene";

const LINES = {
  askEmail: "¡Alto! Esto es la Ludoteca. ¿Quién va? Dime tu correo.",
  askEmailAgain: "De acuerdo. ¿Quién va, entonces? Dime tu correo.",
  goodbye: "¡Hasta pronto! Cierro la puerta. Cuando vuelvas, dime tu correo y te abro.",
  askPassword: "Ajá, te conozco. ¿Y la contraseña secreta?",
  notHeard: "No te he oído. ¿Puedes repetirlo?",
  notEmail: "Eso no parece un correo. ¿Puedes repetirlo?",
  checking: "Deja que compruebe la llave…",
  welcome: "Todo en orden. Pasa, tu colección te espera.",
  wrong: "El correo o la contraseña no coinciden. Prueba otra vez.",
  tooMany: "Demasiados intentos. Espera un poco y vuelve a probar.",
  noAnswer: "La puerta no responde ahora mismo. Inténtalo de nuevo en un momento.",
  noAccess: "Esta cuenta no tiene acceso a la biblioteca. Dime otro correo.",
  noSync: "Esta copia de la app no tiene la sincronización configurada. Abre la página de inicio para usar el modo local.",
};

type Step = "email" | "password";
type Line = { id: number; text: string; alert: boolean };

const prefersCalm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const LETTER_MS = 24;

/** Lo que tarda la guardiana en decir una frase, más una pausa para leerla. */
const timeToRead = (text: string, pause: number) => (prefersCalm() ? 0 : text.length * LETTER_MS) + pause;

/** El texto de la guardiana aparece letra a letra, sin bloquear el campo. */
function TypedLine({ text }: { text: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (shown >= text.length) return;
    const timer = setTimeout(() => setShown(prefersCalm() ? text.length : shown + 1), LETTER_MS);
    return () => clearTimeout(timer);
  }, [shown, text.length]);
  return <span aria-hidden>{text.slice(0, shown)}</span>;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [pending, setPending] = useState(false);
  const [entering, setEntering] = useState(false);
  const [line, setLine] = useState<Line>(() => {
    if (!isSupabaseConfigured) return { id: 0, text: LINES.noSync, alert: false };
    const denied = params.get("error") === "acceso";
    // Quien acaba de salir desde Ajustes se encuentra a la guardiana despidiéndose.
    const leaving = params.get("adios") === "1";
    return { id: 0, text: denied ? LINES.noAccess : leaving ? LINES.goodbye : LINES.askEmail, alert: denied };
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const scene = useRef(initialScene());

  const say = (text: string, alert = false) => setLine((current) => ({ id: current.id + 1, text, alert }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !box || !g) return;
    const boxes = makeGameBoxes();
    const calm = prefersCalm();
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const px = pixelSize(canvas.clientWidth, canvas.clientHeight);
      const W = Math.max(1, Math.ceil(canvas.clientWidth / px));
      const H = Math.max(1, Math.ceil(canvas.clientHeight / px));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      const s = scene.current;
      s.time += dt;
      s.shake = Math.max(0, s.shake - dt * 2.4);
      if (s.opening) s.open = Math.min(1, s.open + dt / 0.9);
      drawScene(g, W, H, (box.offsetHeight + 62) / px, boxes, s, calm);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  // En el ordenador se puede escribir nada más llegar; en el móvil no se abre el teclado solo.
  useEffect(() => {
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) emailRef.current?.focus();
  }, []);

  function complain(text: string, field: HTMLInputElement | null) {
    say(text, true);
    scene.current.shake = 1;
    field?.focus();
  }

  /** La puerta se abre, la cámara entra y la luz funde a negro. */
  async function playEntrance() {
    const canvas = canvasRef.current;
    const veil = veilRef.current;
    if (!canvas || !veil || prefersCalm()) return;
    setEntering(true);
    scene.current.opening = true;
    await wait(950);
    const { x, y } = scene.current.focus;
    canvas.style.transformOrigin = `${x * 100}% ${y * 100}%`;
    const zoom = canvas.animate([{ transform: "scale(1)" }, { transform: "scale(5)" }], {
      duration: 850,
      easing: "cubic-bezier(0.5, 0, 0.8, 0.4)",
      fill: "forwards",
    });
    const fade = veil.animate(
      [
        { opacity: 0, backgroundColor: "#fff6d8" },
        { opacity: 1, backgroundColor: "#fff6d8", offset: 0.7 },
        { opacity: 1, backgroundColor: "#0b0b0d" },
      ],
      { delay: 250, duration: 820, fill: "forwards" },
    );
    await Promise.all([zoom.finished, fade.finished]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isSupabaseConfigured || pending) return;
    // Se leen del propio campo para contar también lo que rellena el gestor de contraseñas.
    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";

    if (step === "email") {
      if (!email) return complain(LINES.notHeard, emailRef.current);
      if (!email.includes("@")) return complain(LINES.notEmail, emailRef.current);
      if (!password) {
        setStep("password");
        say(LINES.askPassword);
        passwordRef.current?.focus();
        return;
      }
    } else if (!password) {
      return complain(LINES.notHeard, passwordRef.current);
    }

    setPending(true);
    say(LINES.checking);
    const [{ error }] = await Promise.all([
      getBrowserSupabase().auth.signInWithPassword({ email, password }),
      wait(timeToRead(LINES.checking, 300)),
    ]);
    if (error) {
      setPending(false);
      setStep("password");
      if (passwordRef.current) passwordRef.current.value = "";
      const text =
        error.message === "Invalid login credentials" ? LINES.wrong : error.status === 429 ? LINES.tooMany : LINES.noAnswer;
      complain(text, passwordRef.current);
      return;
    }
    // Quien acaba de cruzar la puerta ya ha entrado: hoy no hace falta «Pulsa Start».
    markTitleScreenSeen();
    const target = safeNextPath(params.get("next"), window.location.origin);
    router.prefetch(target);
    say(LINES.welcome);
    // La puerta no se abre hasta que la guardiana ha terminado de hablar.
    await wait(timeToRead(LINES.welcome, 900));
    await playEntrance();
    router.replace(target);
    router.refresh();
  }

  function backToEmail() {
    setStep("email");
    say(LINES.askEmailAgain);
    emailRef.current?.focus();
    emailRef.current?.select();
  }

  return (
    <main className={`${styles.room} ${arcade.variable} ${terminal.variable}`} data-fase={entering ? "entrando" : "sala"}>
      <h1 className={styles.hidden}>Entrar en tu biblioteca</h1>
      <canvas ref={canvasRef} className={styles.scene} aria-hidden />

      <div ref={boxRef} className={styles.box}>
        <span className={styles.name}>Guardiana</span>
        <p className={styles.text}>
          <TypedLine key={line.id} text={line.text} />
        </p>
        <p key={line.id} className={styles.hidden} role={line.alert ? "alert" : "status"}>
          {line.text}
        </p>

        {!isSupabaseConfigured ? (
          <Link href="/" className={styles.say}>
            Ir al inicio
          </Link>
        ) : (
          <form onSubmit={submit} className={styles.form} autoComplete="on" noValidate>
            <span className={styles.caret} aria-hidden />
            {/* Los dos campos están siempre en la página para que los gestores de contraseñas los encuentren. */}
            <div className={styles.slot}>
              <div className={step === "email" ? styles.field : styles.parked} aria-hidden={step !== "email"}>
                <label htmlFor="email">Correo</label>
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  tabIndex={step === "email" ? 0 : -1}
                  readOnly={pending}
                />
              </div>
              <div className={step === "password" ? styles.field : styles.parked} aria-hidden={step !== "password"}>
                <label htmlFor="password">Contraseña</label>
                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  tabIndex={step === "password" ? 0 : -1}
                  readOnly={pending}
                />
              </div>
            </div>
            {step === "password" && !pending && (
              <button type="button" className={styles.back} onClick={backToEmail}>
                Volver
              </button>
            )}
            <button type="submit" className={styles.say} disabled={pending} aria-busy={pending}>
              Decir
            </button>
          </form>
        )}
      </div>

      <div ref={veilRef} className={styles.veil} />
    </main>
  );
}
