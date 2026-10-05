import {
  NOMBRE_GRUPO_OBJETIVO,
  objetivosConReal,
  type GrupoObjetivo,
  type ObjetivoConReal,
} from '../../../domain/objetivosBola'
import { CLASE_ETIQUETA } from '../../plan/comun'
import { TarjetaPlegable } from './TarjetaPlegable'
import type { TableroAdmin } from './useTableroAdmin'

/**
 * Objetivos de la bola de nieve: meta contra lo real (Estrategias, pedido de Bryan 30-sep). Cada meta
 * cita su fuente; lo real sale de la sección «influencers» del tablero 0102 (fila `bola-<clave>`) y,
 * si no está, dice FALTA en gris: nunca 0 ni una cifra supuesta. Ver `domain/objetivosBola.ts`.
 */

const GRUPOS: readonly GrupoObjetivo[] = ['piloto', 'palancas']

function Fila({ o }: { o: ObjetivoConReal }) {
  const { objetivo, real, fuenteReal } = o
  return (
    <li aria-label={objetivo.nombre} className="flex flex-col gap-1 rounded-tarjeta border border-linea p-3 text-[13px]">
      <span className="font-semibold text-texto">{objetivo.nombre}</span>
      <span className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[12.5px]">
        <span className={CLASE_ETIQUETA}>Meta</span>
        <span className="cifras font-bold text-texto">{objetivo.meta}</span>
        <span className={CLASE_ETIQUETA}>Real</span>
        {real === null ? (
          <span className="font-bold text-tenue">FALTA: nadie ha cargado lo real en el tablero</span>
        ) : (
          <span className="cifras font-bold text-texto">
            {real}
            {fuenteReal ? <span className="font-normal text-tenue"> · {fuenteReal}</span> : null}
          </span>
        )}
      </span>
      {objetivo.nota && <span className="text-xs text-ambar">{objetivo.nota}</span>}
      <span className="text-[11.5px] text-tenue">Fuente de la meta: {objetivo.fuente}</span>
    </li>
  )
}

export function ObjetivosBola({ t }: { t: TableroAdmin }) {
  const seccion = t.estado.tipo === 'ok' ? t.estado.secciones.find((s) => s.seccion === 'influencers') : undefined
  const todos = objetivosConReal(seccion)
  const conReal = todos.filter((o) => o.real !== null).length
  const frase =
    conReal === 0
      ? `${todos.length} metas con su fuente; lo real todavía dice FALTA en todas.`
      : `${todos.length} metas con su fuente; ${conReal} con lo real cargado.`
  return (
    <TarjetaPlegable nombre="Objetivos de la bola de nieve" frase={frase}>
      {t.estado.tipo === 'fallo' && (
        <p role="alert" className="text-sm text-rojo">
          No se pudo leer el tablero ({t.estado.error}): lo real no se puede mostrar, y por eso sale FALTA. Es un fallo, no que no haya datos.
        </p>
      )}
      {GRUPOS.map((g) => (
        <section key={g} aria-label={NOMBRE_GRUPO_OBJETIVO[g]} className="flex flex-col gap-2">
          <h4 className={CLASE_ETIQUETA}>{NOMBRE_GRUPO_OBJETIVO[g]}</h4>
          <ul className="flex flex-col gap-2">
            {todos
              .filter((o) => o.objetivo.grupo === g)
              .map((o) => (
                <Fila key={o.objetivo.clave} o={o} />
              ))}
          </ul>
        </section>
      ))}
    </TarjetaPlegable>
  )
}
