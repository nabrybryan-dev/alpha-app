import { useState } from 'react'
import { objetivosDelBloque } from '../../domain/objetivosDelBloque'

/** Cuántas secciones se ven sin desplegar. */
const VISIBLES = 3

/**
 * El objetivo del bloque, escaneable.
 *
 * Antes se pintaba el campo entero en un párrafo: en las altas nuevas son 1.700
 * y 2.600 caracteres de corrido, con el plan de pasos, el de sueño, la rodilla y
 * el agua todo seguido. Es el «párrafo denso que nadie lee» del handoff.
 *
 * Ahora: titular en display, entrada corta, y cada sección del coach como fila
 * con su etiqueta. A partir de la tercera se pliega — el objetivo es que se
 * entienda en diez segundos, no que quepa todo a la vez.
 */
export function ObjetivoDelBloque({ objetivos }: { objetivos?: string }) {
  const [abierto, setAbierto] = useState(false)
  const { titular, entrada, secciones } = objetivosDelBloque(objetivos)
  if (!titular && !entrada && secciones.length === 0) return null

  const mostradas = abierto ? secciones : secciones.slice(0, VISIBLES)
  const ocultas = secciones.length - mostradas.length

  return (
    <div>
      {titular && (
        <h3 className="font-display text-[17px] font-black uppercase leading-[1.1] tracking-[-0.015em] text-texto">
          {titular}
        </h3>
      )}
      {entrada && (
        <p
          className={`mt-1.5 text-[13px] leading-relaxed text-tenue ${
            abierto ? '' : 'line-clamp-3'
          }`}
        >
          {entrada}
        </p>
      )}

      {mostradas.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {mostradas.map((s, i) => (
            <li
              key={`${s.etiqueta ?? 'texto'}-${i}`}
              className="rounded-xl border border-hairline bg-surface-2 px-3 py-2.5"
            >
              {s.etiqueta && (
                <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-accion-osc">
                  {s.etiqueta}
                </p>
              )}
              <p className={`text-[12.5px] leading-relaxed text-texto ${s.etiqueta ? 'mt-1' : ''}`}>
                {s.texto}
              </p>
            </li>
          ))}
        </ul>
      )}

      {(ocultas > 0 || abierto) && (
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          className="press mt-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accion-osc"
        >
          {abierto ? 'Ver menos' : `Ver todo · ${ocultas} más`}
        </button>
      )}
    </div>
  )
}
