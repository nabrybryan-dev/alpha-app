import { useState } from 'react'
import { useDisenoFinal } from '../../../app/organizacionViva'
import { Sheet } from '../../../components/ui/Sheet'
import { db } from '../../../data/dbInstance'
import { checkinCompleto } from '../../../domain/checkinCompleto'
import { ChequeoDeHoy } from './ChequeoDeHoy'

interface ChequeoDeHoyConPielProps {
  usuarioId: string
  hoy: string
  /** El Hoy del staff queda como en main. */
  clasico?: boolean
  /** Solo para pruebas: manda sobre la cuenta con sesión. */
  disenoFinal?: boolean
}

/**
 * El check-in de Hoy según la cuenta: con el diseño final, la fila delgada de «Alpha · Rediseño» (maqueta 7, `card slim`:
 * título, línea y botón que abre el formulario en una hoja); para todas las demás, el formulario en línea de siempre. La
 * hoja lleva el MISMO `ChequeoDeHoy` (mismo formulario, misma regla de peso, mismo guardado): no hay lógica aparte.
 */
export function ChequeoDeHoyConPiel({ usuarioId, hoy, clasico = false, disenoFinal }: ChequeoDeHoyConPielProps) {
  const final = useDisenoFinal(disenoFinal)
  if (!final || clasico) return <ChequeoDeHoy usuarioId={usuarioId} hoy={hoy} clasico={clasico} />
  return <ChequeoEnFila usuarioId={usuarioId} hoy={hoy} />
}

function lineaDelChequeo(usuarioId: string, hoy: string): { hecho: boolean; linea: string } {
  const fila = db.bienestar.byUsuario(usuarioId).find((c) => c.fecha === hoy)
  if (!fila || !checkinCompleto(fila)) return { hecho: false, linea: 'Pendiente · 1 minuto · dolor, sueño y cómo te sientes' }
  const partes = [
    fila.horasSueno !== undefined ? `${fila.horasSueno} h de sueño` : null,
    fila.dolor !== undefined ? `dolor ${fila.dolor}/10` : null,
  ].filter((p): p is string => p !== null)
  return { hecho: true, linea: ['Registrado', ...partes].join(' · ') }
}

function ChequeoEnFila({ usuarioId, hoy }: { usuarioId: string; hoy: string }) {
  const [abierta, setAbierta] = useState(false)
  const { hecho, linea } = lineaDelChequeo(usuarioId, hoy)
  return (
    <>
      <section aria-label="Check-in de hoy" className="entrada entrada-4 hoy-tarjeta flex items-center justify-between gap-3 !py-3">
        <div className="min-w-0">
          <p className="hoy-fila-titulo">Check-in de hoy</p>
          <small className="text-xs text-tenue">{linea}</small>
        </div>
        <button type="button" onClick={() => setAbierta(true)} className="press tecla-2 shrink-0 text-sm font-semibold text-texto">
          {hecho ? 'Ver' : 'Hacerlo'}
        </button>
      </section>
      <Sheet abierto={abierta} titulo="Check-in de hoy" onCerrar={() => setAbierta(false)}>
        <ChequeoDeHoy usuarioId={usuarioId} hoy={hoy} />
      </Sheet>
    </>
  )
}
