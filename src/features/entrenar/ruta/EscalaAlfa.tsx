import type { EstadoNivelAlfa, NivelAlfa, NivelMetodo } from '../../../domain/rutaEntrenamiento'

const ETIQUETA_METODO: Record<NivelMetodo, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

const ETIQUETA: Record<EstadoNivelAlfa, string> = {
  superado: 'Superado',
  actual: 'Nivel actual',
  bloqueado: 'Bloqueado',
  elite: 'Reservado · Élite',
}

const COLOR_ETIQUETA: Record<EstadoNivelAlfa, string> = {
  superado: 'text-silver-500',
  actual: 'text-accion',
  bloqueado: 'text-silver-500',
  elite: 'text-oro',
}

const COLOR_TITULO: Record<EstadoNivelAlfa, string> = {
  superado: 'text-silver-100',
  actual: 'text-silver-100',
  bloqueado: 'text-silver-300',
  elite: 'text-oro',
}

function claseNodo(estado: EstadoNivelAlfa): string {
  if (estado === 'superado') return 'border-accion bg-accion text-white'
  if (estado === 'actual') return 'border-accion text-accion'
  if (estado === 'elite') return 'border-oro/60 bg-ink-800 text-oro'
  return 'border-ink-400 bg-ink-800 text-silver-500'
}

function estiloTarjeta(estado: EstadoNivelAlfa): React.CSSProperties | undefined {
  if (estado === 'actual') {
    return { background: 'color-mix(in srgb, var(--accion) 6%, var(--ink-700))' }
  }
  return undefined
}

function claseTarjeta(estado: EstadoNivelAlfa): string {
  if (estado === 'actual') return 'border-accion/30'
  if (estado === 'elite') return 'border-oro/30 bg-ink-800'
  return 'border-ink-500 bg-ink-800'
}

/**
 * Los 5 niveles de la Escala Alfa como línea de tiempo vertical.
 * El criterio no es la disciplina (eso es Logros) sino la edad de entrenamiento,
 * el dominio técnico y el volumen que la persona tolera.
 */
export function EscalaAlfa({ niveles }: { niveles: readonly NivelAlfa[] }) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-silver-500">
        Escala Alfa
      </h3>
      <ol className="flex flex-col">
        {niveles.map((nivel, i) => (
          <li key={nivel.numero} className="escena-prof flex items-stretch gap-3.5">
            <div className="flex w-[34px] shrink-0 flex-col items-center">
              <span
                className={`cifras grid h-[34px] w-[34px] place-items-center rounded-full border-[1.5px] text-[12.5px] font-bold ${claseNodo(nivel.estado)}`}
                style={
                  nivel.estado === 'actual'
                    ? { background: 'color-mix(in srgb, var(--accion) 18%, var(--ink-700))' }
                    : undefined
                }
              >
                {nivel.numero}
              </span>
              {i < niveles.length - 1 && (
                <span
                  aria-hidden="true"
                  // El riel se va al fondo. `--prof-fondo` está definido con esta
                  // palabra exacta —«otro plano, detrás de la superficie: rieles,
                  // colas, lo que espera»— y esto es un riel literal: no es
                  // contenido, es lo que une dos peldaños. Detrás, los nodos y las
                  // tarjetas quedan delante y la línea de tiempo gana su eje.
                  className={`min-h-3.5 w-0.5 flex-1 ${nivel.estado === 'superado' ? 'bg-accion' : 'bg-ink-500'}`}
                  style={{ transform: 'translateZ(var(--prof-fondo))' }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-3.5">
              <article
                className={`rounded-[13px] border px-3.5 py-3 ${claseTarjeta(nivel.estado)}`}
                style={estiloTarjeta(nivel.estado)}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className={`font-display text-sm ${COLOR_TITULO[nivel.estado]}`}>{nivel.nombre}</h4>
                  {/* El método clasifica en tres niveles, no en cinco ni por años
                      entrenados: cada peldaño declara al suyo. Se calla cuando
                      diría lo mismo que el nombre ("AVANZADO · Avanzado"). */}
                  {ETIQUETA_METODO[nivel.nivelMetodo].toUpperCase() !== nivel.nombre && (
                    <span className="shrink-0 whitespace-nowrap text-[10.5px] uppercase tracking-[0.1em] text-silver-500">
                      {ETIQUETA_METODO[nivel.nivelMetodo]}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-silver-400">{nivel.descripcion}</p>
                <p
                  className={`mt-2 text-[10.5px] font-bold uppercase tracking-[0.12em] ${COLOR_ETIQUETA[nivel.estado]}`}
                >
                  {ETIQUETA[nivel.estado]}
                </p>
              </article>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
