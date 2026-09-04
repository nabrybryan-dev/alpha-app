import { ejercicioCompleto } from '../../../../domain/cumplimiento'
import { etiquetaDeSerie } from '../../../../domain/calendario'
import type { EjercicioPrescrito } from '../../../../domain/types'
import { leerBorrador } from './borrador'

/**
 * LA SERIE EN CURSO, COLAPSADA A UNA BARRA.
 *
 * Bryan lo vio en el iPhone y lo dijo así: «el registro se comía el tercio inferior como
 * tarjeta grande y permanente». Tres steppers, sus rótulos y un botón grande ocupan más de
 * doscientos píxeles de alto que están puestos todo el rato para una acción que se usa una
 * vez cada dos o tres minutos. Con el sujeto a pantalla completa detrás, esa tarjeta no
 * ocupaba un tercio de la pantalla: ocupaba un tercio del cuerpo.
 *
 * Así que ahora es una barra de una línea. Lo que se ve sin tocar nada es exactamente lo
 * que Bryan pidió que se viera de la serie en curso —qué serie es, y su carga, sus
 * repeticiones y su RIR— más el botón de guardar. Los mandos para cambiar esos tres
 * números están a un toque, debajo.
 *
 ## LOS MANDOS SE FUERON AL CAJÓN, y este mando se quedó con lo que sabe hacer
 *
 * Los tres steppers vivían aquí dentro y se desplegaban hacia abajo. Dos costes, y el
 * segundo es el que decidió: el cuadro está colgado a 1,62 m del muro, así que crecer lo
 * empuja contra el marcador de siete segmentos; y un panel que brota de un cuadro de pared
 * convierte la pared en formulario, que es justo de lo que este salón lleva saliendo.
 *
 * Ahora llenar y guardar viven en `CajonDeSerie`, que entra desde el borde izquierdo. Este
 * mando se queda con las dos cosas que sí son de la pared: DECIR qué serie toca y con qué,
 * y ser lo que se toca para sacar la ficha.
 *
 * ## Un solo `RegistroSerieSalon` en la pantalla, y no es una preferencia
 *
 * Antes había uno montado y escondido aquí. Si además hubiera otro en el cajón, los dos
 * leerían el mismo borrador al montarse y llevarían su propio estado a partir de ahí: se
 * teclea 82,5 en el cajón, el escondido sigue creyendo 80, y guardar desde el sitio
 * equivocado escribe el número viejo. No falla, no avisa, y queda en la base.
 *
 * ## El resumen se lee del mismo borrador que escriben los mandos
 *
 * No hay una segunda copia de la carga en este componente. Se lee de `registro/borrador`,
 * que es la clave que escribe el registro y la que lee el módulo de la cámara. Se lee al
 * pintar, y la barra se vuelve a pintar cada vez que se pliega o se despliega — que es
 * justo cuando el número ha podido cambiar.
 */

export interface BarraRegistroProps {
  /** `true` si cuelga de un `CuadroDePared`: el marco lo pone el cuadro. */
  enCuadro?: boolean
  microcicloId: string
  ejercicio: EjercicioPrescrito
  /** Sacar la ficha. La pared no la contiene: la llama. */
  onAbrirFicha: () => void
  /** Si la ficha está fuera, para que el mando lo diga y no repita el gesto. */
  fichaAbierta: boolean
}

export function BarraRegistro({
  microcicloId,
  ejercicio,
  enCuadro = false,
  onAbrirFicha,
  fichaAbierta,
}: BarraRegistroProps) {
  const completo = ejercicioCompleto(ejercicio)
  const orden = ejercicio.series.length + 1
  const borrador = leerBorrador(microcicloId, ejercicio, orden)
  const etiqueta = completo ? undefined : etiquetaDeSerie(ejercicio, orden)

  return (
    <div className={enCuadro ? "flex flex-col gap-[0.35em]" : "flex flex-col gap-1.5"}>
      <div className={enCuadro ? "flex items-stretch gap-[0.35em]" : "flex items-stretch gap-1.5"}>
        <button
          type="button"
          aria-expanded={fichaAbierta}
          onClick={onAbrirFicha}
          className={`press flex min-w-0 flex-1 items-center text-left ${enCuadro ? "muro-mando gap-[0.5em] px-[0.7em] py-[0.5em]" : "gap-2 rounded-[0.6em] border border-accion/35 bg-ink-900/90 px-3 py-2"}`}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5">
              <span className={enCuadro ? 'muro-rotulo text-[0.6em] text-accion' : 'text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-accion'}>
                {completo ? `${ejercicio.sets} series hechas` : `Serie ${orden} de ${ejercicio.sets}`}
              </span>
              {etiqueta && (
                <span className="rounded-tag bg-accion/15 px-1.5 py-0.5 text-[8px] font-bold leading-none tracking-[0.12em] text-accion">
                  {etiqueta}
                </span>
              )}
            </span>
            {!completo &&
              // EN EL MURO, los tres números se leen como el tablón de enfrente: rótulo
              // arriba y cifra debajo, en tres columnas. La línea corrida con puntos
              // —«20 kg · 9 reps · RIR 2»— es una línea de app: cabe en una tarjeta y en
              // un mando de pared se aplasta contra el botón. Fuera del muro se queda como
              // estaba, porque ahí sí es una barra.
              (enCuadro ? (
                <span className="mt-[0.4em] flex items-baseline gap-[0.7em]">
                  {[
                    { rotulo: 'Carga', valor: `${String(borrador.cargaKg).replace('.', ',')} kg` },
                    { rotulo: 'Reps', valor: String(borrador.reps) },
                    { rotulo: 'RIR', valor: String(borrador.rir) },
                  ].map((c) => (
                    // `whitespace-nowrap`: sin él «20 kg» partía en dos líneas dentro de
                    // su columna y el mando crecía de alto por un espacio.
                    <span key={c.rotulo} className="flex flex-col gap-[0.22em] whitespace-nowrap">
                      <span className="muro-rotulo text-[0.48em]">{c.rotulo}</span>
                      <span className="cifras muro-dato text-[0.92em] font-semibold leading-none">
                        {c.valor}
                      </span>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="cifras mt-1 block text-[12px] font-semibold leading-none text-silver-100">
                  {String(borrador.cargaKg).replace('.', ',')} kg
                  <span className="mx-1.5 text-silver-500">·</span>
                  {borrador.reps} reps
                  <span className="mx-1.5 text-silver-500">·</span>
                  RIR {borrador.rir}
                </span>
              ))}
          </span>
          {/* La flecha acusa el plegado con materia, no con un rótulo: el estado ya lo
              dice `aria-expanded`, y escribirlo además sería ruido para el lector. */}
          <span
            aria-hidden="true"
            className={`grid shrink-0 place-items-center rounded-full text-silver-400 transition-transform duration-base ease-salida ${enCuadro ? "h-[1.5em] w-[1.5em] border border-silver-500/45" : "h-6 w-6 border border-white/15"}`}
            style={{ transform: fichaAbierta ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            {/* La flecha apunta a la IZQUIERDA, que es de donde sale la ficha. Apuntando
                hacia arriba decía «esto se despliega», que es lo que ya no hace. */}
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </span>
        </button>

        {!completo && (
          // EL BOTÓN DE ABRIR LA FICHA. Deja de decir «Guardar» y pasa a decir qué saca,
          // porque guardar ya no ocurre aquí: llenar y guardar están los dos en la ficha,
          // que es lo que hace que no haya dos sitios donde escribir la misma serie.
          //
          // Sigue siendo el mismo interruptor encendido: canto de 2 px y resplandor rojo
          // hacia fuera, que es lo que dice que este trozo de aparato está vivo.
          <button
            type="button"
            onClick={onAbrirFicha}
            aria-label={`Anotar la serie ${orden}`}
            className={`press shrink-0 font-display uppercase leading-none tracking-wide text-white ${enCuadro ? "rounded-[2px] px-[0.9em] text-[0.95em]" : "rounded-[0.6em] px-3.5 text-[13px]"}`}
            style={{
              background: enCuadro
                ? 'linear-gradient(180deg, var(--accion), var(--accion-osc))'
                : 'var(--accion)',
              boxShadow: enCuadro
                ? '0 0 1.4em -0.2em rgb(var(--accion-rgb) / 0.75), inset 0 1px 0 rgb(255 255 255 / 0.28)'
                : 'var(--glow-accion)',
            }}
          >
            Anotar
            <span className="cifras ml-1">{orden}</span>
          </button>
        )}
      </div>
    </div>
  )
}
