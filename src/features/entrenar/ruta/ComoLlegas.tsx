import type { Recuperacion } from '../../../domain/readiness'

function tono(indice: number): { texto: string; clase: string; barra: string } {
  if (indice >= 70) return { texto: 'Recuperado', clase: 'text-accion', barra: 'bg-accion' }
  if (indice >= 50) return { texto: 'En trabajo', clase: 'text-silver-200', barra: 'bg-silver-200' }
  return { texto: 'Fatiga acumulada', clase: 'text-ambar', barra: 'bg-ambar' }
}

/**
 * Cómo llega la persona esta semana, según el índice de Hooper adaptado de sus
 * check-ins.
 *
 * Va aparte de las competencias a propósito: las competencias dicen qué sabe
 * hacer y esto dice cómo amaneció. Metido entre ellas, una mala semana se leería
 * como si hubiera perdido nivel, que es justo lo contrario de lo que pasa.
 */
export function ComoLlegas({ recuperacion }: { recuperacion: Recuperacion }) {
  const { indice, dias } = recuperacion
  if (indice === undefined) return null

  const t = tono(indice)

  return (
    <section className="rounded-tarjeta border border-ink-500 bg-ink-800 px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2.5">
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-silver-500">
          Cómo llegas esta semana
        </h3>
        <span className={`cifras text-[13px] font-bold ${t.clase}`}>{indice}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={indice}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Índice de recuperación"
        className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-ink-500"
      >
        {/* Ver TarjetaProgresoNivel: `scaleX` en vez de `width`, y 240 ms en vez
            de 700. Son las tres barras de la Ruta con el mismo defecto. */}
        <span
          className={`block h-full w-full rounded-full origin-left transition-transform duration-[240ms] ease-salida ${t.barra}`}
          style={{ transform: `scaleX(${indice / 100})` }}
        />
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-silver-400">
        <span className={`font-bold ${t.clase}`}>{t.texto}</span> · sueño, cansancio, estrés y ánimo
        de tus últimos {dias} check-in{dias === 1 ? '' : 's'}. No es una nota: es el contexto con el
        que tu coach ajusta la carga.
      </p>
    </section>
  )
}
