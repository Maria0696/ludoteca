"use client";

import { toast } from "sonner";
import { STAGES } from "@/app/juego/[id]/progress";
import { StatusMark } from "@/components/ui/StatusMark";
import { GAME_STATUSES } from "@/lib/model";
import { reiniciarPistas } from "@/lib/pistas";
import styles from "./settings.module.css";

/** Todo lo que la guardiana cuenta en su momento, recogido para volver cuando se quiera. */
export function HowItWorks() {
  return (
    <section id="como-funciona" className={`window ${styles.row} ${styles.help}`} aria-labelledby="h-como-funciona">
      <div className={styles.label}>
        <h2 id="h-como-funciona">Cómo funciona</h2>
        <p>Lo esencial de tu ludoteca, en pocas líneas.</p>
      </div>
      <div className={styles.panel}>
        <dl className={styles.helpList}>
          <div>
            <dt>Juegos y copias</dt>
            <dd>Un juego es la obra; cada copia, un ejemplar que tienes: su plataforma, su formato y de dónde salió.</dd>
          </div>
          <div>
            <dt>Estados</dt>
            <dd>
              <ul className={styles.helpStates}>
                {GAME_STATUSES.map((s) => (
                  <li key={s}>
                    <StatusMark status={s} />
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt>El mapa de la ficha</dt>
            <dd>
              Cada juego es una aventura de siete niveles. Toca uno y te lleva a su misión:
              <ol className={styles.helpStages}>
                {STAGES.map((stage) => (
                  <li key={stage}>{stage}</li>
                ))}
              </ol>
            </dd>
          </div>
          <div>
            <dt>Inserta moneda</dt>
            <dd>En la ficha, apunta que has jugado hoy: lo verás en «Última partida» y en tu inicio.</dd>
          </div>
          <div>
            <dt>Añadir un juego</dt>
            <dd>Título, plataforma y formato bastan. Precio, horas, notas y estantería se completan después en la ficha.</dd>
          </div>
          <div>
            <dt>¿A qué juego?</dt>
            <dd>Propone solo entre los juegos que tienes disponibles, según tu tiempo y tu compañía, y explica por qué.</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <button
            type="button"
            className={`btn ${styles.helpReset}`}
            onClick={() => {
              reiniciarPistas();
              toast("Las pistas volverán a salir en las fichas");
            }}
          >
            Volver a ver las pistas de la guardiana
          </button>
        </div>
      </div>
    </section>
  );
}
