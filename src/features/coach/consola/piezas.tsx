import type { CSSProperties, ReactNode } from 'react'
import { useContadorAnimado } from '../../../components/ui/useContadorAnimado'

/**
 * Las piezas con las que se arma cada pestaña de la consola: tarjeta con entrada
 * escalonada, cifra KPI que cuenta hasta su valor, esqueleto de carga y el estado vacío
 * que dice QUÉ falta y CÓMO se consigue (nunca «sin datos» a secas).
 */

interface TarjetaProps {
  titulo: string
  /** Orden de entrada (0, 1, 2…): escalona la aparición. */
  i?: number
  className?: string
  /** Algo a la derecha del título: una insignia, una cifra, un filtro. */
  extra?: ReactNode
  children: ReactNode
  destacada?: boolean
}

export function Tarjeta({ titulo, i = 0, className = '', extra, children, destacada = false }: TarjetaProps) {
  return (
    <section
      className={`consola-tarjeta glass flex min-w-0 flex-col rounded-bloque p-4 ${destacada ? 'glass-destacada' : ''} ${className}`}
      style={{ '--i': i } as CSSProperties}
      aria-label={titulo}
    >
      <header className="mb-2.5 flex items-start justify-between gap-2">
        <h3 className="kicker leading-tight">{titulo}</h3>
        {extra}
      </header>
      {children}
    </section>
  )
}

interface KpiProps {
  etiqueta: string
  /** `undefined` = no hay dato: se pinta «—» y `sinDato` explica por qué. */
  valor: number | undefined
  decimales?: number
  sufijo?: string
  detalle?: ReactNode
  sinDato?: string
  tono?: 'rojo' | 'ambar' | 'verde' | 'azul' | 'neutro'
  i?: number
}

const TONO_KPI: Record<NonNullable<KpiProps['tono']>, string> = {
  rojo: 'bg-rojo',
  ambar: 'bg-ambar',
  verde: 'bg-verde',
  azul: 'bg-azul',
  neutro: 'bg-linea',
}

function CifraKpi({ valor, decimales }: { valor: number; decimales: number }) {
  const animado = useContadorAnimado(valor, 900)
  return <>{animado.toFixed(decimales)}</>
}

/** Una cifra grande con su etiqueta: lo primero que se lee de la persona. */
export function Kpi({ etiqueta, valor, decimales = 0, sufijo, detalle, sinDato, tono = 'neutro', i = 0 }: KpiProps) {
  return (
    // Dos capas a propósito: la entrada (animación sobre `transform`) y el relieve al pasar
    // el puntero (transición sobre `transform`) no pueden vivir en el mismo elemento — la
    // animación gana en la cascada y el relieve saltaría sin transición.
    <div className="consola-tarjeta min-w-0" style={{ '--i': i } as CSSProperties}>
    <div className="relieve relative h-full min-w-0 overflow-hidden rounded-tarjeta border border-hairline bg-surface-2/70 px-3.5 py-3">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${TONO_KPI[tono]}`} aria-hidden="true" />
      <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-tenue">{etiqueta}</p>
      <p className="cifras mt-1 text-[26px] font-bold leading-none text-texto">
        {valor === undefined ? (
          <span className="text-tenue">—</span>
        ) : (
          <>
            <CifraKpi valor={valor} decimales={decimales} />
            {sufijo && <span className="ml-0.5 text-sm font-bold text-tenue">{sufijo}</span>}
          </>
        )}
      </p>
      <div className="mt-1.5 min-h-[16px] text-[11px] leading-snug text-tenue">
        {valor === undefined ? sinDato : detalle}
      </div>
    </div>
    </div>
  )
}

/** Esqueleto de carga: ocupa el sitio del contenido para que nada salte al llegar. */
export function Esqueleto({ lineas = 3, alto }: { lineas?: number; alto?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando">
      {alto ? (
        <div className="brillo-carga rounded-lg bg-surface-3" style={{ height: alto }} />
      ) : (
        Array.from({ length: lineas }, (_, i) => (
          <div
            key={i}
            className="brillo-carga h-3.5 rounded bg-surface-3"
            style={{ width: `${92 - i * 17}%` }}
          />
        ))
      )}
    </div>
  )
}

/**
 * El vacío honesto: QUÉ falta y CÓMO se consigue. Nunca inventa el dato ni lo rellena
 * con un cero.
 */
export function Falta({ que, como }: { que: string; como: string }) {
  return (
    <div className="rounded-lg border border-dashed border-linea px-3 py-2.5 text-[12.5px]">
      <p className="font-bold text-texto/90">{que}</p>
      <p className="mt-0.5 text-tenue">{como}</p>
    </div>
  )
}

/** Pares etiqueta → valor en rejilla (perfil, alimentación). */
export function ListaDatos({ datos }: { datos: readonly { etiqueta: string; valor: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
      {datos.map((d) => (
        <div key={d.etiqueta} className="min-w-0 border-t border-linea/70 pt-1.5">
          <dt className="text-[10.5px] font-bold uppercase tracking-wide text-tenue">{d.etiqueta}</dt>
          <dd className="m-0 mt-0.5 break-words text-texto/90">{d.valor}</dd>
        </div>
      ))}
    </dl>
  )
}
