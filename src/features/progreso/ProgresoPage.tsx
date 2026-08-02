import { useSesion } from '../../app/SessionProvider'
import { useDbVersion } from '../../data/dbInstance'
import { ProgresoEvolucion } from '../logros/ProgresoEvolucion'

/**
 * Pestaña Progreso: evolución de peso y carga, volumen por grupo y desviación
 * de medidas del bloque.
 *
 * El contenido ya existía dentro de Logros. Aquí tiene pantalla propia y allí
 * se quitó, para que los mismos gráficos no vivan en dos sitios.
 */
export default function ProgresoPage() {
  const { usuario } = useSesion()
  useDbVersion()

  return (
    // Superficie oscura, como Entrenar: los gráficos se leen mejor y así lo
    // pide el diseño.
    <div className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-3.5 bg-ink-900 px-4 pb-4 pt-3">
      <header className="entrada entrada-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-silver-500">
          Cómo vas
        </p>
        <h2 className="mt-1.5 font-display text-2xl leading-[1.05] text-silver-100">Tu progreso</h2>
      </header>

      <div className="entrada entrada-2">
        <ProgresoEvolucion usuarioId={usuario.id} />
      </div>
    </div>
  )
}
