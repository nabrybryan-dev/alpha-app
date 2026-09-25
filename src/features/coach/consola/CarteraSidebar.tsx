import { Semaforo } from '../../../components/ui/Semaforo'
import type { ResumenAsesorado } from '../resumenAsesorado'

interface CarteraSidebarProps {
  resumenes: readonly ResumenAsesorado[]
  seleccionadoId: string | undefined
  onSeleccionar: (usuarioId: string) => void
}

/**
 * La cartera con chips de estado (el semáforo real, calculado desde datos que
 * SÍ existen hoy) — la lista de la izquierda del diseño v2. Es una lista de
 * selección, no un `tablist`: cambia a QUIÉN miran las seis pestañas
 * restantes, no CUÁL pestaña se ve.
 */
export function CarteraSidebar({ resumenes, seleccionadoId, onSeleccionar }: CarteraSidebarProps) {
  return (
    <nav aria-label="Cartera de asesorados" className="flex flex-col gap-1">
      <p className="kicker px-2 pb-1">Cartera ({resumenes.length})</p>
      <ul className="flex flex-col gap-1 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
        {resumenes.map((r) => (
          <li key={r.usuario.id}>
            <button
              type="button"
              aria-current={seleccionadoId === r.usuario.id ? 'true' : undefined}
              onClick={() => onSeleccionar(r.usuario.id)}
              className={`tecla-3d flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left ${
                seleccionadoId === r.usuario.id
                  ? 'border-rojo bg-rojo/10'
                  : 'border-linea bg-surface-2'
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-texto">{r.usuario.nombre}</span>
                <Semaforo datos={r.semaforo} />
              </span>
              {r.microciclo && (
                <span className="cifras shrink-0 text-[11px] font-bold text-tenue">
                  M{r.microciclo.numero}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
