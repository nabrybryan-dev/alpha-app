import { useState, type CSSProperties } from 'react'
import { Semaforo } from '../../../components/ui/Semaforo'
import type { ResumenAsesorado } from '../resumenAsesorado'

interface CarteraSidebarProps {
  resumenes: readonly ResumenAsesorado[]
  seleccionadoId: string | undefined
  onSeleccionar: (usuarioId: string) => void
}

const ANILLO: Record<ResumenAsesorado['semaforo']['color'], string> = {
  rojo: 'ring-rojo/70',
  ambar: 'ring-ambar/70',
  verde: 'ring-verde/60',
}

function quitarTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * La cartera con su semáforo real, la semana y la adherencia de cada persona. Es una
 * lista de selección, no un `tablist`: cambia a QUIÉN miran las pestañas, no CUÁL se ve.
 * Con más de ocho personas aparece un buscador (sin tildes: «maria» encuentra «María»).
 */
export function CarteraSidebar({ resumenes, seleccionadoId, onSeleccionar }: CarteraSidebarProps) {
  const [filtro, setFiltro] = useState('')
  const visibles = filtro.trim()
    ? resumenes.filter((r) => quitarTildes(r.usuario.nombre).includes(quitarTildes(filtro.trim())))
    : resumenes
  const conteo = {
    rojo: resumenes.filter((r) => r.semaforo.color === 'rojo').length,
    ambar: resumenes.filter((r) => r.semaforo.color === 'ambar').length,
    verde: resumenes.filter((r) => r.semaforo.color === 'verde').length,
  }

  return (
    <nav aria-label="Cartera de asesorados" className="flex flex-col gap-2 lg:sticky lg:top-3">
      <div className="flex items-baseline justify-between px-1">
        <p className="kicker">Cartera ({resumenes.length})</p>
        <p className="cifras flex gap-2 text-[11px] font-bold" aria-label={`${conteo.rojo} en rojo, ${conteo.ambar} en ámbar, ${conteo.verde} en verde`}>
          <span className="text-rojo">{conteo.rojo}</span>
          <span className="text-ambar">{conteo.ambar}</span>
          <span className="text-verde">{conteo.verde}</span>
        </p>
      </div>
      {resumenes.length > 8 && (
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Buscar persona…"
          aria-label="Buscar en la cartera"
          className="rounded-boton border border-linea bg-surface-1 px-3 py-1.5 text-sm text-texto placeholder:text-tenue focus:border-rojo/60 focus:outline-none"
        />
      )}
      <ul className="flex flex-col gap-1 lg:max-h-[calc(100dvh-200px)] lg:overflow-y-auto lg:pr-1">
        {visibles.map((r, i) => {
          const elegido = seleccionadoId === r.usuario.id
          return (
            <li key={r.usuario.id} className="consola-tarjeta" style={{ '--i': i } as CSSProperties}>
              <button
                type="button"
                aria-current={elegido ? 'true' : undefined}
                onClick={() => onSeleccionar(r.usuario.id)}
                className={`tecla-3d group relative flex w-full items-center gap-2.5 overflow-hidden rounded-tarjeta border px-2.5 py-2 text-left ${
                  elegido ? 'border-rojo/70 bg-rojo/10' : 'border-linea bg-surface-2 hover:border-hairline-fuerte'
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-bold text-texto ring-2 ${ANILLO[r.semaforo.color]}`}
                  aria-hidden="true"
                >
                  {r.usuario.avatarIniciales}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-texto">{r.usuario.nombre}</span>
                  <Semaforo datos={r.semaforo} />
                </span>
                {r.microciclo && (
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="cifras text-[11px] font-bold text-tenue">M{r.microciclo.numero}</span>
                    <span className="h-1 w-9 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                      <span className="block h-full rounded-full bg-texto/60" style={{ width: `${r.pctRegistrado}%` }} />
                    </span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
        {visibles.length === 0 && <li className="px-2 text-xs text-tenue">Nadie coincide con «{filtro}».</li>}
      </ul>
    </nav>
  )
}
