import { useState, type CSSProperties } from 'react'
import { Sheet } from '../../../components/ui/Sheet'
import { Semaforo } from '../../../components/ui/Semaforo'
import type { ResumenAsesorado } from '../resumenAsesorado'
import { ETIQUETA_SECCION } from './piezas'

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

function ListaDeLaCartera({
  resumenes,
  seleccionadoId,
  onSeleccionar,
  filtro,
}: {
  resumenes: readonly ResumenAsesorado[]
  seleccionadoId: string | undefined
  onSeleccionar: (usuarioId: string) => void
  filtro: string
}) {
  const visibles = filtro.trim()
    ? resumenes.filter((r) => quitarTildes(r.usuario.nombre).includes(quitarTildes(filtro.trim())))
    : resumenes

  return (
    <ul className="flex flex-col gap-1">
      {visibles.map((r, i) => {
        const elegido = seleccionadoId === r.usuario.id
        return (
          <li key={r.usuario.id} className="consola-tarjeta" style={{ '--i': i } as CSSProperties}>
            <button
              type="button"
              aria-current={elegido ? 'true' : undefined}
              onClick={() => onSeleccionar(r.usuario.id)}
              className={`press relative flex min-h-[56px] w-full items-center gap-2.5 overflow-hidden rounded-tarjeta border px-2.5 py-2 text-left ${
                elegido
                  ? 'border-texto bg-surface-2'
                  : 'border-transparent bg-transparent hover:border-linea hover:bg-surface-1'
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
      {visibles.length === 0 && <li className="px-2 py-3 text-xs text-tenue">Nadie coincide con «{filtro}».</li>}
    </ul>
  )
}

/**
 * La cartera con su semáforo real, la semana y la adherencia de cada persona. Es una
 * lista de selección, no un `tablist`: cambia a QUIÉN miran las pestañas, no CUÁL se ve.
 *
 * En escritorio es la columna fija de siempre; en el teléfono (390 px) pasa a una hoja,
 * porque una cartera lateral de 260 px no cabe al lado de siete pestañas. La lista es la
 * misma pieza en los dos sitios: no hay dos carteras que se puedan separar.
 */
export function CarteraSidebar({ resumenes, seleccionadoId, onSeleccionar }: CarteraSidebarProps) {
  const [filtro, setFiltro] = useState('')
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const conteo = {
    rojo: resumenes.filter((r) => r.semaforo.color === 'rojo').length,
    ambar: resumenes.filter((r) => r.semaforo.color === 'ambar').length,
    verde: resumenes.filter((r) => r.semaforo.color === 'verde').length,
  }
  const elegido = resumenes.find((r) => r.usuario.id === seleccionadoId)

  const elegirEnLaHoja = (usuarioId: string) => {
    onSeleccionar(usuarioId)
    setHojaAbierta(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setHojaAbierta(true)}
        aria-haspopup="dialog"
        className="press flex min-h-[56px] items-center justify-between gap-3 rounded-tarjeta border border-linea bg-surface-1 px-4 text-left shadow-sm lg:hidden"
      >
        <span className="flex min-w-0 flex-col">
          <span className={ETIQUETA_SECCION}>Cartera · {resumenes.length}</span>
          <span className="truncate text-sm font-semibold text-texto">
            {elegido ? elegido.usuario.nombre : 'Elige a quién mirar'}
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-tenue">Abrir la cartera ›</span>
      </button>

      <nav className="hidden flex-col gap-2 lg:sticky lg:top-3 lg:flex" aria-label="Cartera de asesorados">
        <div className="flex items-baseline justify-between px-1">
          <p className={ETIQUETA_SECCION}>Cartera ({resumenes.length})</p>
          <p
            className="cifras flex items-center gap-2 text-[11px] font-bold text-tenue"
            aria-label={`${conteo.rojo} en rojo, ${conteo.ambar} en ámbar, ${conteo.verde} en verde`}
          >
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rojo" aria-hidden="true" />
              {conteo.rojo}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-ambar" aria-hidden="true" />
              {conteo.ambar}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-verde" aria-hidden="true" />
              {conteo.verde}
            </span>
          </p>
        </div>
        {resumenes.length > 8 && (
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar persona…"
            aria-label="Buscar en la cartera"
            className="min-h-[44px] rounded-boton border border-linea bg-surface-1 px-3 text-sm text-texto placeholder:text-tenue focus:border-texto focus:outline-none"
          />
        )}
        <div className="max-h-[calc(100dvh-240px)] overflow-y-auto pr-1">
          <ListaDeLaCartera
            resumenes={resumenes}
            seleccionadoId={seleccionadoId}
            onSeleccionar={onSeleccionar}
            filtro={filtro}
          />
        </div>
      </nav>

      <Sheet abierto={hojaAbierta} titulo="Cartera de asesorados" onCerrar={() => setHojaAbierta(false)}>
        <p className="text-sm text-tenue">
          Elige a la persona: todas las pestañas de la consola miran a quien elijas aquí.
        </p>
        {resumenes.length > 8 && (
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar persona…"
            aria-label="Buscar en la cartera desde la hoja"
            className="mt-3 min-h-[44px] w-full rounded-boton border border-linea bg-surface-1 px-3 text-sm text-texto placeholder:text-tenue focus:border-texto focus:outline-none"
          />
        )}
        <div className="mt-3">
          <ListaDeLaCartera
            resumenes={resumenes}
            seleccionadoId={seleccionadoId}
            onSeleccionar={elegirEnLaHoja}
            filtro={filtro}
          />
        </div>
      </Sheet>
    </>
  )
}
