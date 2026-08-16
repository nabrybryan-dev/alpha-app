import { useState } from 'react'
import { fraseDelMicrociclo } from '../../data/contenido/frasesDelMicrociclo'
import { cargaPorGrupo, formatearSeries } from '../../domain/fatiga'
import { notasDelMicrociclo } from '../../domain/notasDeLaSemana'
import type { Microciclo } from '../../domain/types'
import { escribirJSON, leerJSON } from '../../lib/persistencia'
import { NotasDeLaSemana } from './NotasDeLaSemana'

const CLAVE = 'alpha-portada-vista'

/**
 * El letrero de inicio de semana: lo primero que ve el asesorado al abrir un
 * microciclo nuevo, antes de las rutinas.
 *
 * SE VE UNA VEZ. Al cerrarlo queda marcado por id de microciclo, así que
 * reaparece solo cuando empieza el siguiente. Un cartel que sale cada día deja
 * de leerse a los dos días.
 *
 * Anatomía tomada de la «ficha forjada» del handoff (panel ink-900, franjas
 * separadas por hairline, eyebrow + display + pill mono, chips numerados y
 * disco de foco). El acento es el rojo Alpha, no el volt del mock: es la
 * decisión de marca de este proyecto.
 */
export function PortadaMicrociclo({ microciclo }: { microciclo: Microciclo }) {
  const [vistas, setVistas] = useState<string[]>(() => leerJSON<string[]>(CLAVE, []))
  if (vistas.includes(microciclo.id)) return null

  const cerrar = () => {
    const nuevas = [...vistas, microciclo.id]
    escribirJSON(CLAVE, nuevas)
    setVistas(nuevas)
  }

  // Los objetivos de la semana no se escriben: se leen del propio microciclo.
  const grupos = cargaPorGrupo(microciclo)
    .slice()
    .sort((a, b) => b.seriesPautadas - a.seriesPautadas)
  const prioritarios = grupos.slice(0, 5)
  const foco = prioritarios[0]
  const sesiones = microciclo.sesiones.length
  // Las series que la persona va a hacer de verdad, no la suma por grupo: desde
  // que el volumen se cuenta fraccionado, un ejercicio alimenta a varios grupos
  // y sumarlos daría un número mayor que el de series de la semana.
  const series = microciclo.sesiones.reduce(
    (total, s) => total + s.ejercicios.reduce((t, e) => t + e.sets, 0),
    0,
  )
  const notas = notasDelMicrociclo(microciclo)
  // La misma toda la semana: si cambiara en cada render sería ruido, no mensaje.
  const frase = fraseDelMicrociclo(microciclo.id)

  return (
    <div className="flex flex-col gap-3">
      <section className="overflow-hidden rounded-[20px] border border-ink-500 bg-ink-900 shadow-lg">
        <header className="flex items-start justify-between gap-3 border-b border-ink-600 bg-gradient-to-b from-white/[.05] to-transparent px-[18px] pb-4 pt-[18px]">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-silver-500">
              Empieza tu microciclo
            </p>
            <h2 className="font-display mt-[7px] text-[25px] font-black leading-[1.04] tracking-[-0.015em] text-silver-100">
              MICROCICLO
              <br />
              {`M${microciclo.numero}`}
            </h2>
          </div>
          <span className="cifras shrink-0 rounded-full border border-accion/40 px-2.5 py-[5px] text-[10.5px] font-bold text-accion">
            {`${sesiones} SESIONES`}
          </span>
        </header>

        {prioritarios.length > 0 && (
          <div className="border-b border-ink-600 px-[18px] py-4">
            <p className="mb-[11px] text-[10px] font-bold uppercase tracking-[0.18em] text-silver-500">
              {`Lo que trabajas esta semana · ${series} series`}
            </p>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-[7px]">
              {prioritarios.map((g, i) => (
                <li
                  key={g.grupo}
                  className="flex items-center gap-[7px] rounded-[10px] border border-ink-500 bg-ink-700 px-[9px] py-2"
                >
                  <span className="cifras text-[10px] font-bold text-accion">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[11.5px] font-semibold text-silver-200">{g.grupo}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {foco && (
          <div className="flex items-center gap-3.5 border-b border-ink-600 px-[18px] py-4">
            <span
              aria-hidden="true"
              className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-accion"
            >
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="#08090a" strokeWidth="2.2">
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="4.5" />
              </svg>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-silver-500">
                Foco de la semana
              </p>
              <p className="font-display text-[18px] font-black uppercase text-accion">{foco.grupo}</p>
              <p className="text-xs text-silver-400">{`${formatearSeries(foco.seriesPautadas)} series programadas`}</p>
            </div>
          </div>
        )}

        {frase && (
          <p className="border-b border-ink-600 px-[18px] py-4 text-[13.5px] font-semibold leading-relaxed text-silver-200">
            {frase}
          </p>
        )}

        <div className="px-[18px] py-4">
          <button type="button" onClick={cerrar} className="press w-full rounded-full bg-accion py-3 text-[13px] font-bold uppercase tracking-wide text-ink-900">
            Empezar la semana
          </button>
        </div>
      </section>

      <NotasDeLaSemana notas={notas} />
    </div>
  )
}
