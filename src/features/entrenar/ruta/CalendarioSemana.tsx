import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { DiaRuta, EstadoDiaRuta } from '../../../domain/rutaEntrenamiento'
import { resumenSemana } from '../../../domain/rutaEntrenamiento'

const ETIQUETA: Record<EstadoDiaRuta, string> = {
  completada: 'Completada',
  hoy: 'Hoy',
  programada: 'Programada',
  descanso: 'Descanso',
}

const COLOR_ESTADO: Record<EstadoDiaRuta, string> = {
  completada: 'text-logrado',
  hoy: 'text-accion',
  programada: 'text-silver-500',
  descanso: 'text-silver-500',
}

const COLOR_PUNTO: Record<EstadoDiaRuta, string> = {
  completada: 'bg-accion',
  hoy: 'bg-accion',
  programada: 'bg-silver-500',
  descanso: 'bg-ink-400',
}

function IconoMancuerna() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]" aria-hidden="true">
      <path d="M4 8v8M8 5v14M16 5v14M20 8v8M8 12h8" />
    </svg>
  )
}

function IconoLuna() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px]" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  )
}

function FilaAgenda({ dia, seleccionado }: { dia: DiaRuta; seleccionado: boolean }) {
  const descanso = dia.estado === 'descanso'
  const contenido = (
    <>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] ${
          dia.estado === 'hoy' ? 'text-accion' : 'bg-ink-600 text-silver-300'
        }`}
        style={
          dia.estado === 'hoy'
            ? { background: 'color-mix(in srgb, var(--accion) 18%, var(--ink-700))' }
            : undefined
        }
      >
        {descanso ? <IconoLuna /> : <IconoMancuerna />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13.5px] font-bold ${descanso ? 'text-silver-300' : 'text-silver-100'}`}>
          {dia.titulo}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-silver-400">{dia.detalle}</span>
      </span>
      <span
        className={`shrink-0 whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-[0.1em] ${COLOR_ESTADO[dia.estado]}`}
      >
        {ETIQUETA[dia.estado]}
      </span>
    </>
  )

  const clases = `flex items-center gap-3 rounded-[13px] border px-3.5 py-2.5 ${
    seleccionado ? 'border-accion/30' : 'border-ink-500 bg-ink-800'
  }`
  const fondo = seleccionado
    ? { background: 'color-mix(in srgb, var(--accion) 7%, var(--ink-700))' }
    : undefined

  if (dia.sesionId) {
    return (
      <Link to={`/entrenar/sesion/${dia.sesionId}`} className={`press ${clases}`} style={fondo}>
        {contenido}
      </Link>
    )
  }
  return (
    <div className={clases} style={fondo}>
      {contenido}
    </div>
  )
}

interface Props {
  dias: readonly DiaRuta[]
  /** "Semana 3 · Microciclo 8" */
  titulo: string
}

/** Rejilla de 7 días + la agenda de la semana. El día de hoy viene seleccionado. */
export function CalendarioSemana({ dias, titulo }: Props) {
  const indiceHoy = Math.max(
    0,
    dias.findIndex((d) => d.esHoy),
  )
  const [seleccionado, setSeleccionado] = useState(indiceHoy)
  const resumen = resumenSemana(dias)

  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-silver-500">{titulo}</h3>
        <span className="cifras text-[11.5px] font-bold text-silver-400">
          {resumen.completadas}/{resumen.programadas} sesiones
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {dias.map((dia, i) => {
          const activo = i === seleccionado
          return (
            <button
              key={dia.fechaIso}
              type="button"
              aria-pressed={activo}
              aria-label={`${dia.dia} ${dia.numero}: ${ETIQUETA[dia.estado]}`}
              onClick={() => setSeleccionado(i)}
              // Antes el hundido iba escrito a mano (`transition-transform
              // duration-150 active:scale-95`), y por eso se quedaba fuera de la
              // guarda de movimiento reducido: el bloque de tokens.css apaga
              // `.press`, no un `active:scale-95` suelto. La fila de agenda de
              // justo encima ya usaba `.press`, así que dos elementos que hacen lo
              // mismo se comportaban distinto con la preferencia activa.
              className={`press flex flex-col items-center gap-1.5 rounded-xl border px-0.5 pb-2.5 pt-2.5 ${
                activo ? 'border-accion/45' : 'border-ink-500 bg-ink-800'
              }`}
              style={
                activo
                  ? { background: 'color-mix(in srgb, var(--accion) 14%, var(--ink-700))' }
                  : undefined
              }
            >
              <span
                className={`text-[9.5px] font-bold uppercase tracking-[0.1em] ${activo ? 'text-accion' : 'text-silver-500'}`}
              >
                {dia.abreviatura}
              </span>
              <span
                className={`cifras text-[13px] font-bold ${activo || dia.esHoy ? 'text-silver-100' : 'text-silver-300'}`}
              >
                {dia.numero}
              </span>
              <span className={`h-1.5 w-1.5 rounded-full ${COLOR_PUNTO[dia.estado]}`} aria-hidden="true" />
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {dias.map((dia, i) => (
          <FilaAgenda key={dia.fechaIso} dia={dia} seleccionado={i === seleccionado} />
        ))}
      </div>
    </section>
  )
}
