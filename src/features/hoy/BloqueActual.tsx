import type { Perfil } from '../../domain/types'
import type { PautaDelBloque } from '../../domain/nutricion/pautaDelBloque'

interface Fila {
  etiqueta: string
  valor: string
  /** Sale de la encuesta, no de la prescripción del coach. Se dice en pantalla. */
  estimado?: boolean
}

/**
 * Qué persigue el bloque en el que está la persona.
 *
 * Solo se pinta lo que el coach cargó: fase energética, proteína y pasos son
 * prescripción, no cálculo. Si el perfil no los trae, la tarjeta desaparece en
 * vez de rellenarse con un valor por defecto que nadie recetó.
 */
export function BloqueActual({ perfil, pauta }: { perfil?: Perfil; pauta?: PautaDelBloque }) {
  if (!perfil) return null

  // `pauta` ya resuelve quién manda (el coach) y qué se dedujo de la encuesta.
  // Sin ella se lee el perfil tal cual, que es como funcionaba antes.
  const fase = pauta?.faseEnergetica ?? (perfil.faseEnergetica ? { valor: perfil.faseEnergetica, origen: 'coach' as const } : undefined)
  const prote = pauta?.proteinaGkg ?? (perfil.proteinaGkg !== undefined ? { valor: perfil.proteinaGkg, origen: 'coach' as const } : undefined)
  const pasos = pauta?.pasosObjetivo ?? (perfil.pasosObjetivo !== undefined ? { valor: perfil.pasosObjetivo, origen: 'coach' as const } : undefined)

  const filas: Fila[] = []
  if (fase) filas.push({ etiqueta: 'Fase energética', valor: fase.valor, estimado: fase.origen === 'calculado' })
  if (prote) {
    filas.push({
      etiqueta: 'Proteína',
      valor: `${prote.valor.toString().replace('.', ',')} g/kg`,
      estimado: prote.origen === 'calculado',
    })
  }
  if (pasos) {
    filas.push({
      etiqueta: 'Pasos',
      valor: `${pasos.valor.toLocaleString('es-CO')}/día`,
      estimado: pasos.origen === 'calculado',
    })
  }

  if (filas.length === 0 && !perfil.objetivos) return null

  return (
    <section className="rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
      <h2 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-tenue">
        Tu bloque actual
      </h2>
      {perfil.objetivos && (
        <p className="mt-2 text-sm font-semibold leading-snug text-texto">{perfil.objetivos}</p>
      )}
      {filas.length > 0 && (
        <dl className="mt-3 flex flex-col gap-2">
          {filas.map((f) => (
            <div
              key={f.etiqueta}
              className="flex items-baseline justify-between gap-3 border-b border-linea pb-2 last:border-0 last:pb-0"
            >
              <dt className="text-xs text-tenue">
                {f.etiqueta}
                {f.estimado && (
                  <span className="ml-1.5 text-[9.5px] uppercase tracking-wide text-tenue/70">
                    estimado
                  </span>
                )}
              </dt>
              <dd className="cifras text-sm font-bold text-texto">{f.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
