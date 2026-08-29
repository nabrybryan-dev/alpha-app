import { useRef, useState } from 'react'
import { ejercicioCompleto } from '../../../../domain/cumplimiento'
import { etiquetaDeSerie } from '../../../../domain/calendario'
import type { EjercicioPrescrito } from '../../../../domain/types'
import { leerBorrador } from './borrador'
import { RegistroSerieSalon, type RegistroSerieSalonHandle } from './RegistroSerieSalon'

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
 * ## Los mandos se montan aunque estén plegados
 *
 * `RegistroSerieSalon` está siempre en el árbol y se esconde con `hidden`, no se
 * desmonta. Dos motivos, y el segundo es el que manda: el borrador vive en su estado y
 * remontarlo en cada plegado lo volvería a leer del almacenamiento —perdiendo lo tecleado
 * si el efecto que persiste aún no había corrido—; y el botón de guardar de la barra
 * necesita poder llamarle, y a un componente desmontado no se le llama.
 *
 * ## Un solo botón de guardar
 *
 * El de la barra. `RegistroSerieSalon` sabe pintar el suyo —y lo pinta cuando se usa
 * suelto, que es como está probado— pero aquí se le apaga: dos botones «Guardar serie 3»
 * en la misma pantalla son dos formas de hacer lo mismo, y el día que una de las dos deje
 * de funcionar nadie sabrá cuál era la buena.
 *
 * ## El resumen se lee del mismo borrador que escriben los mandos
 *
 * No hay una segunda copia de la carga en este componente. Se lee de `registro/borrador`,
 * que es la clave que escribe el registro y la que lee el módulo de la cámara. Se lee al
 * pintar, y la barra se vuelve a pintar cada vez que se pliega o se despliega — que es
 * justo cuando el número ha podido cambiar.
 */

export interface BarraRegistroProps {
  microcicloId: string
  ejercicio: EjercicioPrescrito
}

export function BarraRegistro({ microcicloId, ejercicio }: BarraRegistroProps) {
  const [abierta, setAbierta] = useState(false)
  const registro = useRef<RegistroSerieSalonHandle>(null)

  const completo = ejercicioCompleto(ejercicio)
  const orden = ejercicio.series.length + 1
  const borrador = leerBorrador(microcicloId, ejercicio, orden)
  const etiqueta = completo ? undefined : etiquetaDeSerie(ejercicio, orden)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          aria-expanded={abierta}
          onClick={() => setAbierta((v) => !v)}
          className="press flex min-w-0 flex-1 items-center gap-2 rounded-[12px] border border-accion/35 bg-ink-900/90 px-3 py-2 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-accion">
                {completo ? `${ejercicio.sets} series hechas` : `Serie ${orden} de ${ejercicio.sets}`}
              </span>
              {etiqueta && (
                <span className="rounded-tag bg-accion/15 px-1.5 py-0.5 text-[8px] font-bold leading-none tracking-[0.12em] text-accion">
                  {etiqueta}
                </span>
              )}
            </span>
            {!completo && (
              <span className="cifras mt-1 block text-[12px] font-semibold leading-none text-silver-100">
                {String(borrador.cargaKg).replace('.', ',')} kg
                <span className="mx-1.5 text-silver-500">·</span>
                {borrador.reps} reps
                <span className="mx-1.5 text-silver-500">·</span>
                RIR {borrador.rir}
              </span>
            )}
          </span>
          {/* La flecha acusa el plegado con materia, no con un rótulo: el estado ya lo
              dice `aria-expanded`, y escribirlo además sería ruido para el lector. */}
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 text-silver-400 transition-transform duration-base ease-salida"
            style={{ transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 15 6-6 6 6" />
            </svg>
          </span>
        </button>

        {!completo && (
          <button
            type="button"
            onClick={() => registro.current?.guardar()}
            className="press shrink-0 rounded-[12px] bg-accion px-3.5 font-display text-[13px] uppercase leading-none tracking-wide text-white"
            style={{ boxShadow: 'var(--glow-accion)' }}
          >
            Guardar
            <span className="cifras ml-1">{orden}</span>
          </button>
        )}
      </div>

      {/* Los mandos. Montados siempre, escondidos mientras la barra está plegada: `hidden`
          los saca del árbol de accesibilidad y del cuadro, pero no del árbol de React. */}
      <div hidden={!abierta}>
        <RegistroSerieSalon
          // La `key` remonta el registro cuando cambia la serie: el borrador arranca en
          // `useState`, que solo corre en el primer montaje, y sin remontar la serie 2
          // saldría con lo que se tecleó en la 1.
          key={`${ejercicio.id}-${orden}`}
          ref={registro}
          microcicloId={microcicloId}
          ejercicio={ejercicio}
          mostrarBoton={false}
          onGuardado={() => setAbierta(false)}
        />
      </div>
    </div>
  )
}
