import type { CSSProperties, ReactNode } from 'react'
import { Cifra3D } from '../../../components/ui/Cifra3D'

/**
 * Las piezas con las que se arma cada pestaña de la consola: tarjeta plana con entrada
 * escalonada, cifra KPI que cuenta hasta su valor, esqueleto de carga y el estado vacío
 * que dice QUÉ falta y CÓMO se consigue (nunca «sin datos» a secas).
 *
 * El lenguaje es el de Equipo y Empresa (zona 4): superficie plana con hairline, rótulo
 * en plata y el rojo solo para lo que pide atención. Nada de cristal: el cristal es de la
 * cabecera y de las hojas, no de una lista de trabajo.
 */

/** El rótulo de sección del rediseño: plata, no rojo (el rojo es de las alarmas). */
export const ETIQUETA_SECCION = 'text-[11px] font-bold uppercase tracking-[0.14em] text-tenue'

interface TarjetaProps {
  titulo: string
  /** Orden de entrada (0, 1, 2…): escalona la aparición. */
  i?: number
  className?: string
  /** Algo a la derecha del título: una insignia, una cifra, un filtro. */
  extra?: ReactNode
  children: ReactNode
  /** Solo para lo que espera una firma o una decisión: borde rojo, no relleno. */
  destacada?: boolean
}

export function Tarjeta({ titulo, i = 0, className = '', extra, children, destacada = false }: TarjetaProps) {
  return (
    <section
      className={`consola-tarjeta flex min-w-0 flex-col rounded-tarjeta border bg-surface-1 p-4 shadow-sm ${
        destacada ? 'border-rojo/50' : 'border-linea'
      } ${className}`}
      style={{ '--i': i } as CSSProperties}
      aria-label={titulo}
    >
      <header className="mb-2.5 flex items-start justify-between gap-2">
        <h3 className={`${ETIQUETA_SECCION} leading-tight`}>{titulo}</h3>
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

const PUNTO_KPI: Record<NonNullable<KpiProps['tono']>, string> = {
  rojo: 'bg-rojo',
  ambar: 'bg-ambar',
  verde: 'bg-verde',
  azul: 'bg-azul',
  neutro: 'bg-linea',
}

/** Una cifra grande con su etiqueta: lo primero que se lee de la persona. */
export function Kpi({ etiqueta, valor, decimales = 0, sufijo, detalle, sinDato, tono = 'neutro', i = 0 }: KpiProps) {
  return (
    <div className="consola-tarjeta min-w-0" style={{ '--i': i } as CSSProperties}>
      <div className="relieve relative flex h-full min-w-0 flex-col overflow-hidden rounded-tarjeta border border-linea bg-surface-1 px-3.5 py-3">
        <p className={`${ETIQUETA_SECCION} flex items-center gap-1.5 truncate`}>
          {tono !== 'neutro' && <span className={`h-2 w-2 shrink-0 rounded-full ${PUNTO_KPI[tono]}`} aria-hidden="true" />}
          {etiqueta}
        </p>
        <p className="mt-1.5 text-texto">
          {valor === undefined ? (
            <span className="cifras text-[26px] font-bold leading-none text-tenue">—</span>
          ) : (
            <Cifra3D
              valor={valor}
              decimales={decimales}
              sufijo={sufijo ?? ''}
              rojo={tono === 'rojo'}
              tamano={28}
              etiqueta={`${etiqueta}: ${valor}${sufijo ?? ''}`}
            />
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

/**
 * Una bandeja que no se pudo leer (APP-F01 de la revisión final de Codex, 28-sep): se dice
 * que falló y que PUEDE haber algo esperando, con un botón para volver a leer. Nunca un
 * «no hay nada» ni un 0.
 */
export function FalloBandeja({ error, onReintentar }: { error: string; onReintentar: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rojo px-3 py-2.5 text-[12.5px]">
      <p className="min-w-0 text-texto">
        No se pudo leer esta bandeja ({error}). Puede haber planes esperando.
      </p>
      <button type="button" onClick={onReintentar} className="press min-h-[36px] rounded-full border border-linea px-3 text-xs font-bold text-texto">
        Reintentar
      </button>
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
