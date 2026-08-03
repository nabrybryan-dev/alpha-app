import type { Perfil } from '../../domain/types'

interface Fila {
  etiqueta: string
  valor: string
}

/**
 * Qué persigue el bloque en el que está la persona.
 *
 * Solo se pinta lo que el coach cargó: fase energética, proteína y pasos son
 * prescripción, no cálculo. Si el perfil no los trae, la tarjeta desaparece en
 * vez de rellenarse con un valor por defecto que nadie recetó.
 */
export function BloqueActual({ perfil }: { perfil?: Perfil }) {
  if (!perfil) return null

  const filas: Fila[] = []
  if (perfil.faseEnergetica) filas.push({ etiqueta: 'Fase energética', valor: perfil.faseEnergetica })
  if (perfil.proteinaGkg !== undefined) {
    filas.push({ etiqueta: 'Proteína', valor: `${perfil.proteinaGkg.toString().replace('.', ',')} g/kg` })
  }
  if (perfil.pasosObjetivo !== undefined) {
    filas.push({ etiqueta: 'Pasos', valor: `${perfil.pasosObjetivo.toLocaleString('es-CO')}/día` })
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
              <dt className="text-xs text-tenue">{f.etiqueta}</dt>
              <dd className="cifras text-sm font-bold text-texto">{f.valor}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
