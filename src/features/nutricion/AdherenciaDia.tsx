import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { db, hoyIso, useDbVersion } from '../../data/dbInstance'
import { calcularRacha } from '../../domain/gamification'
import type { EstadoAdherencia } from '../../domain/types'

const opciones: { valor: EstadoAdherencia; etiqueta: string; estilo: string }[] = [
  { valor: 'si', etiqueta: 'Sí ✓', estilo: 'border-verde bg-verde/15 text-verde' },
  { valor: 'parcial', etiqueta: 'Parcial', estilo: 'border-ambar bg-ambar/15 text-ambar' },
  { valor: 'no', etiqueta: 'No', estilo: 'border-rojo bg-rojo/15 text-rojo' },
]

export function AdherenciaDia({ usuarioId }: { usuarioId: string }) {
  useDbVersion()
  const hoy = hoyIso()
  const [comentario, setComentario] = useState('')

  const adherencias = db.nutricion.adherenciasByUsuario(usuarioId)
  const deHoy = adherencias.find((a) => a.fecha === hoy)
  const racha = calcularRacha(
    adherencias.filter((a) => a.estado !== 'no').map((a) => a.fecha),
    hoy,
  )

  return (
    <Card destacada>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-texto">¿Cumpliste el plan hoy?</p>
        <p className="text-xs text-tenue">Racha: {racha.actual} 🔥</p>
      </div>
      {deHoy ? (
        <p className="mt-2 text-sm text-verde">
          Registrado: {deHoy.estado === 'si' ? 'cumplido ✓' : deHoy.estado === 'parcial' ? 'parcial' : 'no cumplido'} — mañana se sigue.
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex gap-2">
            {opciones.map((op) => (
              <button
                key={op.valor}
                type="button"
                onClick={() => db.nutricion.marcarAdherencia(usuarioId, hoy, op.valor, comentario || undefined)}
                className={`min-h-11 flex-1 rounded-xl border py-2 text-sm font-bold ${op.estilo}`}
              >
                {op.etiqueta}
              </button>
            ))}
          </div>
          <input
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Comentario opcional (salidas, cambios, antojos…)"
            className="mt-2 w-full rounded-xl border border-linea bg-surface-2 px-3 py-2 text-sm text-texto placeholder:text-tenue focus:border-rojo focus:outline-none"
          />
        </>
      )}
    </Card>
  )
}
