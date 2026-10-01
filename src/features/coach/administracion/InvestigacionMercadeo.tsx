import { useId, useState } from 'react'
import {
  NOMBRE_ESTADO_HALLAZGO,
  TEMA_INVESTIGACION,
  tarjetasDeInvestigacion,
  type Hallazgo,
  type TarjetaInvestigacion,
} from '../../../domain/investigacionMercadeo'
import { TEXTO_PENDIENTE_0102 } from '../../../domain/adminTablero'
import { CLASE_ETIQUETA } from '../../plan/comun'
import { TarjetaPlegable } from './TarjetaPlegable'
import type { TableroAdmin } from './useTableroAdmin'

/**
 * Lo que investiga el agente sobre mercadeo, de lo macro a lo concreto (pedido de Bryan, 30-sep):
 * tendencias, videos, ganchos y diseños visuales. Cuatro tarjetas plegables con los datos de la
 * sección «mercadeo» del tablero (ver `domain/investigacionMercadeo.ts`). Cada hallazgo dice una
 * frase, la fuente, la fecha y el estado. Sin dato, la tarjeta sale gris con FALTA y quién lo trae.
 *
 * Manuela lo comenta en la tarjeta «Investigación del agente» (hallazgos con hilo, migración 0103).
 */

const FRASE_COMENTAR =
  'Para comentar un hallazgo y que el agente responda, abre la tarjeta «Investigación del agente» (más abajo).'

function FilaHallazgo({ h }: { h: Hallazgo }) {
  const [abierta, setAbierta] = useState(false)
  const id = useId()
  return (
    <li className="rounded-md border border-linea bg-surface-2">
      <button
        type="button"
        aria-expanded={abierta}
        aria-controls={id}
        onClick={() => setAbierta((a) => !a)}
        className="press flex min-h-[48px] w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="text-[13.5px] font-semibold text-texto">{h.frase}</span>
        <span aria-hidden="true" className="shrink-0 text-tenue">{abierta ? '▾' : '▸'}</span>
      </button>
      {abierta && (
        <div id={id} className="flex flex-col gap-1.5 border-t border-linea px-3 py-2.5 text-[13px]">
          <p className="text-[12.5px] text-tenue">
            <span className={CLASE_ETIQUETA}>Fuente</span>{' '}
            {h.fuente ?? 'FALTA: la fila no dice qué archivo lo escribió.'} · <span className="text-tenue">{h.dueno}</span>
          </p>
          <p className="text-[12.5px] text-tenue">
            <span className={CLASE_ETIQUETA}>Fecha</span> {h.fecha ?? 'FALTA'}
          </p>
          <p className={`text-[12.5px] ${h.estado ? 'text-texto' : 'text-tenue'}`}>
            {h.estado
              ? `Estado: ${NOMBRE_ESTADO_HALLAZGO[h.estado]}`
              : 'Estado: FALTA (el resumen de mercadeo todavía no lo trae).'}
          </p>
        </div>
      )}
    </li>
  )
}

/** Tarjeta gris: sin dato, sin permiso o sin tabla. Sin cifra, sin verde, sin cero. */
function TarjetaGris({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <section aria-label={nombre} className="entrada rounded-tarjeta border border-dashed border-linea bg-surface-1 shadow-sm">
      <div className="flex min-h-[64px] flex-col gap-1 p-4">
        <span className={CLASE_ETIQUETA}>{nombre}</span>
        {children}
      </div>
    </section>
  )
}

function Tarjeta({ t }: { t: TarjetaInvestigacion }) {
  const { nombre, frase } = TEMA_INVESTIGACION[t.tema]
  switch (t.estado) {
    case 'pendiente_de_activar':
      return (
        <TarjetaGris nombre={nombre}>
          <span className="text-sm font-bold text-tenue">{TEXTO_PENDIENTE_0102}</span>
        </TarjetaGris>
      )
    case 'fallo_de_lectura':
      return (
        <TarjetaGris nombre={nombre}>
          <span role="alert" className="text-sm text-rojo">
            No se pudo leer esta tarjeta ({t.error}). Es un fallo, no que falten datos: reintenta arriba.
          </span>
        </TarjetaGris>
      )
    case 'dato_no_valido':
      return (
        <TarjetaGris nombre={nombre}>
          <span role="alert" className="text-sm text-rojo">
            Los datos llegaron en un formato que la app no entiende ({t.motivo}). No se muestran a medias.
          </span>
        </TarjetaGris>
      )
    case 'falta':
      return (
        <TarjetaGris nombre={nombre}>
          <span className="text-sm font-bold text-tenue">FALTA: {t.quien}.</span>
        </TarjetaGris>
      )
    case 'con_datos':
      return (
        <TarjetaPlegable nombre={nombre} frase={frase}>
          <ul className="flex flex-col gap-2">
            {t.hallazgos.map((h) => (
              <FilaHallazgo key={h.id} h={h} />
            ))}
          </ul>
          <p className="text-[12px] text-tenue">{FRASE_COMENTAR}</p>
        </TarjetaPlegable>
      )
  }
}

export function InvestigacionMercadeo({ t }: { t: TableroAdmin }) {
  if (t.estado.tipo === 'cargando') return null
  const lectura =
    t.estado.tipo === 'pendiente'
      ? ('pendiente' as const)
      : t.estado.tipo === 'fallo'
        ? { error: t.estado.error }
        : { seccion: t.estado.secciones.find((s) => s.seccion === 'mercadeo') }
  return (
    <div className="flex flex-col gap-3.5">
      {tarjetasDeInvestigacion(lectura).map((c) => (
        <Tarjeta key={c.tema} t={c} />
      ))}
    </div>
  )
}
