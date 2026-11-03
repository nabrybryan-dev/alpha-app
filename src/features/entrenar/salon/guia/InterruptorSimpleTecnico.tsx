import type { ModoDeLaGuia } from './modoDeLaGuia'

const OPCIONES: readonly { id: ModoDeLaGuia; texto: string }[] = [
  { id: 'simple', texto: 'Simple' },
  { id: 'tecnico', texto: 'Técnico' },
]

/** Dos botones de al menos 44 px; el estado se dice con texto («Se ve así») y con aria-pressed, no solo con el aro. */
export function InterruptorSimpleTecnico({ modo, alElegir }: { modo: ModoDeLaGuia; alElegir: (m: ModoDeLaGuia) => void }) {
  return (
    <div role="group" aria-label="Cómo leer esta zona" className="mb-3 flex items-center gap-2">
      {OPCIONES.map((o) => {
        const activa = modo === o.id
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={activa}
            onClick={() => alElegir(o.id)}
            className="press min-h-[44px] min-w-[44px] rounded-xl border border-linea px-3 text-sm font-semibold"
            style={{
              color: activa ? 'var(--texto)' : 'var(--tenue)',
              boxShadow: activa ? 'inset 0 0 0 1.5px var(--texto)' : undefined,
            }}
          >
            {o.texto}
          </button>
        )
      })}
      <span className="text-[11px] text-tenue">{modo === 'simple' ? 'Palabras de todos los días' : 'Con nombres técnicos'}</span>
    </div>
  )
}
