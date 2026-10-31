import { useEffect, useRef, type PointerEvent as EventoPuntero } from 'react'
import type { Sesion } from '../../../../domain/types'
import type { CapaDelCuerpo } from '../../sujeto/pintura'
import { NOMBRE_DE_REGION, type IdDeRegion } from '../../sujeto/regiones'
import { seriesPorRegion, type SeriesPorRegion } from '../../sujeto/tinte'
import { BotonDarLaVuelta } from '../cuerpo/BotonDarLaVuelta'
import { cifrasEnUnaLinea } from '../cuerpo/cifrasEnUnaLinea'
import { lecturaDeLaPrescripcion } from '../panel/lecturaDeLaPrescripcion'
import { Opcion } from '../cuerpo/OpcionDeTecla'
import type { RangoDeLectura } from '../cuerpo/PortadaDelCuerpo'
import { FICHA_DE_REGION, ordenDeZonas, trabajoDeRegion, type TrabajoDeRegion } from './zonasDePraxis'
import type { EstadoDeLaGuia } from './useZonaDePraxis'

/**
 * EL PANEL DE LA GUÍA: la mitad baja de la pantalla, con el cuerpo vivo arriba.
 *
 * No es una hoja modal a propósito: sin velo, se puede tocar otro músculo y el panel cambia de zona.
 * Deslizar de lado pasa a la zona vecina, y los dos nombres de abajo hacen lo mismo con un toque, para
 * quien no desliza o usa lector de pantalla. Lo que antes ocupaba los lados del cuerpo vive en «Vista».
 */

const CAPAS: readonly { id: CapaDelCuerpo; nombre: string; detalle: string }[] = [
  { id: 'piel', nombre: 'Piel', detalle: 'la silueta' },
  { id: 'musculo', nombre: 'Músculo', detalle: 'lo trabajado' },
  { id: 'hueso', nombre: 'Hueso', detalle: 'el esqueleto' },
]

const RANGOS: readonly { id: RangoDeLectura; nombre: string; detalle: string }[] = [
  { id: 'hoy', nombre: 'Hoy', detalle: 'series de hoy' },
  { id: 'semana', nombre: 'Semana', detalle: 'series de 7 días' },
]

/** Cuánto hay que deslizar de lado para cambiar de zona, y cuánto más que en vertical. */
const DESLIZ_MINIMO = 60
const MAS_LATERAL_QUE_VERTICAL = 1.5

function cifra(n: number): string {
  const r = Math.round(n * 10) / 10
  return String(r).replace('.', ',')
}

export interface GuiaDePraxisProps {
  estado: Exclude<EstadoDeLaGuia, null>
  sesion?: Sesion
  semana: readonly Sesion[]
  series: SeriesPorRegion
  doloridas: readonly IdDeRegion[]
  porTrabajar: readonly IdDeRegion[]
  capa: CapaDelCuerpo
  rango: RangoDeLectura
  azimut?: number
  alIr: (destino: EstadoDeLaGuia) => void
  alIrAlEjercicio?: (indice: number) => void
  alCambiarCapa: (capa: CapaDelCuerpo) => void
  alCambiarRango: (rango: RangoDeLectura) => void
  alVerMovimiento: () => void
  alDarLaVuelta?: (azimut: number) => void
}

function FilaDeTrabajo({ t, alIr }: { t: TrabajoDeRegion; alIr?: (indice: number) => void }) {
  const cuenta = cifra(t.cuentaPorSerie)
  const intensidad = lecturaDeLaPrescripcion(t.ejercicio).find((l) => l.id === 'rir')
  return (
    <li>
      <button
        type="button"
        onClick={() => alIr?.(t.indice)}
        className="press flex min-h-[44px] w-full flex-col gap-0.5 py-2.5 text-left"
      >
        <span className="flex w-full items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-bold text-texto">{t.ejercicio.nombre}</span>
          <span className="cifras shrink-0 text-xs text-tenue">
            {t.anotadas} de {t.pautadas} anotadas
          </span>
        </span>
        <span className="cifras text-xs text-tenue">{cifrasEnUnaLinea(t.ejercicio)}</span>
        <span className="text-xs text-tenue">
          {t.papel === 'principal' ? 'Trabajo principal' : 'Trabajo de apoyo'}: cada serie cuenta {cuenta} aquí.
        </span>
        {intensidad && <span className="text-xs text-tenue">{intensidad.que}</span>}
      </button>
    </li>
  )
}

function Zona({ id, p }: { id: IdDeRegion; p: GuiaDePraxisProps }) {
  const ficha = FICHA_DE_REGION[id]
  const trabajo = trabajoDeRegion(id, p.sesion)
  const enLaSemana = seriesPorRegion(p.semana)[id] ?? 0
  const orden = ordenDeZonas(p.sesion)
  const lugar = orden.indexOf(id)
  const anterior = orden[(lugar - 1 + orden.length) % orden.length]!
  const siguiente = orden[(lugar + 1) % orden.length]!
  return (
    <>
      <p className="text-sm font-semibold text-texto">{ficha.queHace}</p>
      <p className="mt-1 text-xs text-tenue">{ficha.partes}</p>
      {p.doloridas.includes(id) && (
        <p className="mt-2 text-xs font-bold" style={{ color: 'var(--rojo)' }}>
          Hoy marcaste dolor aquí en tu chequeo.
        </p>
      )}
      <h3 className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-tenue">Lo que hoy la trabaja</h3>
      {trabajo.length > 0 ? (
        <ul className="divide-y divide-linea">
          {trabajo.map((t) => (
            <FilaDeTrabajo key={t.indice} t={t} alIr={p.alIrAlEjercicio} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-tenue">Ningún ejercicio de este día.</p>
      )}
      <p className="mt-3 text-xs text-tenue">
        Esta semana: {cifra(enLaSemana)} {enLaSemana === 1 ? 'serie anotada' : 'series anotadas'}. Cuenta lo anotado, no el
        estímulo.
      </p>
      <nav aria-label="Otras zonas" className="mt-3 flex items-center justify-between gap-2">
        <button type="button" onClick={() => p.alIr(anterior)} className="press min-h-[44px] text-left text-sm font-semibold text-texto">
          ‹ {NOMBRE_DE_REGION[anterior]}
        </button>
        <button type="button" onClick={() => p.alIr(siguiente)} className="press min-h-[44px] text-right text-sm font-semibold text-texto">
          {NOMBRE_DE_REGION[siguiente]} ›
        </button>
      </nav>
    </>
  )
}

function Indice({ p }: { p: GuiaDePraxisProps }) {
  return (
    <>
      <ul className="divide-y divide-linea">
        {ordenDeZonas(p.sesion).map((id) => {
          const duele = p.doloridas.includes(id)
          const falta = p.porTrabajar.includes(id)
          return (
            <li key={id}>
              <button type="button" onClick={() => p.alIr(id)} className="press flex min-h-[44px] w-full items-center justify-between gap-3 text-left text-sm">
                <span className="text-texto">{NOMBRE_DE_REGION[id]}</span>
                <span className="cifras text-tenue">
                  {(duele || falta) && (
                    <span className="mr-2 font-bold" style={{ color: 'var(--rojo)' }}>
                      {duele ? 'Te duele' : 'Por trabajar'}
                    </span>
                  )}
                  {cifra(p.series[id] ?? 0)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-tenue">
        {p.rango === 'hoy' ? 'Series de hoy' : 'Series de la semana'}: cuenta lo anotado, no el estímulo.
      </p>
      <h3 className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-tenue">Vista</h3>
      <div role="radiogroup" aria-label="Capas del cuerpo" className="mt-2 flex gap-2">
        {CAPAS.map((c) => (
          <Opcion key={c.id} activa={c.id === p.capa} etiqueta={c.nombre} detalle={c.detalle} onClick={() => p.alCambiarCapa(c.id)}>
            {c.nombre}
          </Opcion>
        ))}
      </div>
      <div role="radiogroup" aria-label="Qué series se cuentan" className="mt-2 flex gap-2">
        {RANGOS.map((r) => (
          <Opcion key={r.id} activa={p.rango === r.id} etiqueta={r.nombre} detalle={r.detalle} onClick={() => p.alCambiarRango(r.id)}>
            {r.nombre}
          </Opcion>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Opcion radio={false} activa={false} etiqueta="Ver el movimiento" detalle="el ejercicio" onClick={p.alVerMovimiento}>
          Movimiento
        </Opcion>
        <BotonDarLaVuelta azimut={p.azimut} alDarLaVuelta={p.alDarLaVuelta} />
      </div>
    </>
  )
}

export function GuiaDePraxis(p: GuiaDePraxisProps) {
  const zona = p.estado === 'indice' ? null : p.estado
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const cuerpo = useRef<HTMLDivElement>(null)
  // Cada zona se lee desde arriba: sin esto, pasar de zona heredaría el desplazamiento de la anterior.
  useEffect(() => {
    cuerpo.current?.scrollTo?.({ top: 0 })
  }, [p.estado])

  const alSoltar = (e: EventoPuntero<HTMLDivElement>) => {
    const g = inicio.current
    inicio.current = null
    if (!g || !zona) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) < DESLIZ_MINIMO || Math.abs(dx) < Math.abs(dy) * MAS_LATERAL_QUE_VERTICAL) return
    const orden = ordenDeZonas(p.sesion)
    const paso = dx < 0 ? 1 : -1
    p.alIr(orden[(orden.indexOf(zona) + paso + orden.length) % orden.length]!)
  }

  return (
    <section
      data-no-orbita
      data-testigo="guia-de-praxis"
      aria-label={zona ? `Praxis: ${NOMBRE_DE_REGION[zona]}` : 'Praxis: zonas'}
      className="pointer-events-auto absolute inset-x-0 flex flex-col rounded-t-3xl border-t border-linea bg-surface-1"
      style={{ bottom: 0, height: 'calc(50dvh + var(--tope-nav))', paddingBottom: 'var(--tope-nav)', zIndex: 'var(--z-superpuesto)', touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        inicio.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={alSoltar}
      onPointerCancel={() => {
        inicio.current = null
      }}
    >
      <header className="flex items-center gap-2 px-5 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tenue">Praxis</p>
          <h2 className="truncate font-display text-lg text-texto">{zona ? NOMBRE_DE_REGION[zona] : 'Tus zonas'}</h2>
        </div>
        {zona && (
          <button type="button" onClick={() => p.alIr('indice')} className="press min-h-[44px] shrink-0 px-2 text-sm font-semibold text-texto">
            Todas
          </button>
        )}
        <button
          type="button"
          onClick={() => p.alIr(null)}
          aria-label="Cerrar Praxis"
          className="h-11 w-11 shrink-0 rounded-full border border-linea bg-surface-2 text-tenue"
        >
          ✕
        </button>
      </header>
      <div ref={cuerpo} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-2">
        {zona ? <Zona id={zona} p={p} /> : <Indice p={p} />}
      </div>
    </section>
  )
}
