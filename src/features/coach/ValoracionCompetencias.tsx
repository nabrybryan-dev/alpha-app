import { useState } from 'react'
import { Card } from '../../components/ui/Card'
import { db, hoyIso } from '../../data/dbInstance'
import { COMPETENCIAS_DEL_COACH } from '../../domain/rutaEntrenamiento'
import type { ValoracionCompetencia } from '../../domain/types'

interface Props {
  usuarioId: string
  valoraciones: readonly ValoracionCompetencia[] | undefined
}

function Editor({
  usuarioId,
  definicion,
  actual,
}: {
  usuarioId: string
  definicion: (typeof COMPETENCIAS_DEL_COACH)[number]
  actual: ValoracionCompetencia | undefined
}) {
  const [pct, setPct] = useState(actual?.pct ?? 60)
  const [nota, setNota] = useState(actual?.nota ?? '')
  const [guardado, setGuardado] = useState(false)

  const guardar = () => {
    if (!nota.trim()) return
    db.perfiles.guardarValoracion(usuarioId, {
      id: definicion.id,
      pct,
      nota: nota.trim(),
      fecha: hoyIso(),
    })
    setGuardado(true)
    window.setTimeout(() => setGuardado(false), 2000)
  }

  const sinCambios = actual !== undefined && actual.pct === pct && actual.nota === nota.trim()

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <p className="kicker">{definicion.nombre}</p>
        <span className="cifras text-lg font-bold text-rojo">{pct}%</span>
      </div>
      <p className="mt-1.5 text-xs text-tenue">{definicion.ayuda}</p>

      <label className="mt-3 block">
        <span className="sr-only">Puntuación de {definicion.nombre}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          onChange={(e) => setPct(Number(e.target.value))}
          className="w-full accent-rojo"
        />
      </label>

      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-bold text-texto">Qué viste</span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder="Lo que el asesorado va a leer. Concreto y accionable."
          className="w-full rounded-xl border border-linea bg-surface-2 px-3 py-2 text-sm text-texto placeholder:text-tenue focus:border-rojo focus:outline-none"
        />
      </label>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] text-tenue">
          {actual ? `Última valoración: ${actual.fecha}` : 'Sin valorar todavía'}
        </p>
        <button
          type="button"
          onClick={guardar}
          disabled={!nota.trim() || sinCambios}
          className="press shrink-0 rounded-full bg-rojo px-4 py-2 font-display text-xs text-white disabled:opacity-40"
        >
          {guardado ? 'Guardado ✓' : 'Guardar'}
        </button>
      </div>
    </Card>
  )
}

/**
 * Lo único de la Ruta que la app no puede deducir: la técnica se juzga viendo
 * ejecutar. El resto de competencias salen de los registros del asesorado, y
 * pedirle al coach que las teclee sería pedirle que copie lo que ya se sabe.
 *
 * La nota pesa más que el número: el porcentaje pinta una barra, pero lo que
 * el asesorado puede accionar es la frase.
 */
export function ValoracionCompetencias({ usuarioId, valoraciones }: Props) {
  return (
    <section className="flex flex-col gap-2.5">
      <p className="kicker">Valoración del coach</p>
      {COMPETENCIAS_DEL_COACH.map((definicion) => (
        <Editor
          key={definicion.id}
          usuarioId={usuarioId}
          definicion={definicion}
          actual={valoraciones?.find((v) => v.id === definicion.id)}
        />
      ))}
    </section>
  )
}
