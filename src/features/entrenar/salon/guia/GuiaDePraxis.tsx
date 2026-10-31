import { useEffect, useRef, type PointerEvent as EventoPuntero, type ReactNode } from 'react'
import type { Microciclo, Sesion } from '../../../../domain/types'
import type { CapaDelCuerpo } from '../../sujeto/pintura'
import { NOMBRE_DE_REGION, type IdDeRegion } from '../../sujeto/regiones'
import { seriesPorRegion, type SeriesPorRegion } from '../../sujeto/tinte'
import { BotonDarLaVuelta } from '../cuerpo/BotonDarLaVuelta'
import { cifrasEnUnaLinea } from '../cuerpo/cifrasEnUnaLinea'
import { lecturaDeLaPrescripcion } from '../panel/lecturaDeLaPrescripcion'
import { Opcion } from '../cuerpo/OpcionDeTecla'
import type { RangoDeLectura } from '../cuerpo/PortadaDelCuerpo'
import { guionDelDia, type PasoDelGuion } from './guionDelDia'
import { PasoDePraxis } from './PasoDePraxis'
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
  previo?: Microciclo
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
  /** Lo que se puede escribirle a Praxis: lo pone quien monta la guía, con su puerta. Sin esto, la guía es solo lectura. */
  dudas?: ReactNode
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

/** LA MARCA DE PRAXIS: un punto de luz. Es lo que dice «esto te lo cuenta Praxis», aquí y sobre el cuerpo. */
export function OrbeDePraxis() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full motion-safe:animate-pulse"
      style={{ background: 'radial-gradient(circle at 35% 30%, #fff, var(--oro) 55%)', boxShadow: '0 0 12px 2px rgb(var(--oro-rgb) / 0.75)' }}
    />
  )
}

/** Seguir o volver: va fuera de lo que se desplaza, para que las dudas abiertas no lo escondan. */
function PasarDePaso({ p, guion, lugar }: { p: GuiaDePraxisProps; guion: readonly PasoDelGuion[]; lugar: number }) {
  const ir = (i: number) => p.alIr({ paso: i, zona: guion[i]!.zona })
  const alFinal = lugar === guion.length - 1
  return (
      <nav aria-label="Lo que cuenta Praxis" className="flex items-center justify-between gap-2 border-t border-linea px-5">
        {lugar > 0 ? (
          <button type="button" onClick={() => ir(lugar - 1)} className="press min-h-[44px] pr-3 text-sm font-semibold text-tenue">
            ‹ Atrás
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => (alFinal ? p.alIr(null) : ir(lugar + 1))}
          className="press min-h-[44px] pl-3 text-sm font-bold"
          style={{ color: 'var(--oro)' }}
        >
          {alFinal ? 'Listo' : 'Seguir ›'}
        </button>
      </nav>
  )
}

/** Lo demás que se puede hacer desde un paso: texto discreto, al final de lo que se lee. */
function OtrasSalidas({ p, paso }: { p: GuiaDePraxisProps; paso: PasoDelGuion }) {
  return (
      <div className="mt-3 flex flex-wrap items-center gap-x-4 text-xs font-semibold text-tenue">
        {paso.indice !== undefined && (
          <button type="button" onClick={() => p.alIrAlEjercicio?.(paso.indice!)} className="press min-h-[44px]">
            Anotar este ejercicio
          </button>
        )}
        <button type="button" onClick={p.alVerMovimiento} className="press min-h-[44px]" aria-label="Ver el movimiento">
          Ver el movimiento
        </button>
        <button type="button" onClick={() => p.alIr('indice')} className="press min-h-[44px]">
          Todas las zonas
        </button>
      </div>
  )
}

export function GuiaDePraxis(p: GuiaDePraxisProps) {
  const pasoAbierto = typeof p.estado === 'object' ? p.estado : null
  const zona = !pasoAbierto && p.estado !== 'indice' ? (p.estado as IdDeRegion) : null
  const inicio = useRef<{ x: number; y: number } | null>(null)
  const cuerpo = useRef<HTMLDivElement>(null)
  const guion = guionDelDia(p.sesion, p.previo)
  const lugar = pasoAbierto ? Math.min(pasoAbierto.paso, guion.length - 1) : 0
  const pasoEnPantalla = pasoAbierto?.paso
  const enIndice = p.estado === 'indice'
  // Cada paso se lee desde arriba: sin esto, heredaría el desplazamiento del anterior.
  useEffect(() => {
    cuerpo.current?.scrollTo?.({ top: 0 })
  }, [zona, pasoEnPantalla, enIndice])

  const alSoltar = (e: EventoPuntero<HTMLDivElement>) => {
    const g = inicio.current
    inicio.current = null
    if (!g || (!zona && !pasoAbierto)) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) < DESLIZ_MINIMO || Math.abs(dx) < Math.abs(dy) * MAS_LATERAL_QUE_VERTICAL) return
    const paso = dx < 0 ? 1 : -1
    if (pasoAbierto) {
      const siguiente = guion[lugar + paso]
      if (siguiente) p.alIr({ paso: lugar + paso, zona: siguiente.zona })
      return
    }
    const orden = ordenDeZonas(p.sesion)
    p.alIr(orden[(orden.indexOf(zona!) + paso + orden.length) % orden.length]!)
  }

  const titulo = pasoAbierto ? guion[lugar]!.titulo : zona ? NOMBRE_DE_REGION[zona] : 'Tus zonas'
  return (
    <section
      data-no-orbita
      data-theme="dark"
      data-testigo="guia-de-praxis"
      aria-label={pasoAbierto ? `Praxis cuenta: ${titulo}` : `Praxis: ${zona ? titulo : 'zonas'}`}
      className="pointer-events-auto absolute inset-x-0 flex flex-col rounded-t-3xl"
      style={{
        bottom: 0,
        height: 'calc(50dvh + var(--tope-nav))',
        paddingBottom: 'var(--tope-nav)',
        zIndex: 'var(--z-superpuesto)',
        touchAction: 'pan-y',
        background: 'var(--surface-1)', // el del tema oscuro de esta misma sección; la tinta se invierte en claro
        borderTop: '1px solid rgb(var(--oro-rgb) / 0.55)',
        boxShadow: '0 -12px 40px rgb(var(--oro-rgb) / 0.14)',
      }}
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
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-tenue">
            <OrbeDePraxis />
            {pasoAbierto ? `Praxis · ${lugar + 1} de ${guion.length}` : 'Praxis'}
          </p>
          <h2 className="mt-1 truncate font-display text-lg text-texto">{titulo}</h2>
        </div>
        {!pasoAbierto && (
          <button type="button" onClick={() => p.alIr(zona ? 'indice' : { paso: 0, zona: null })} className="press min-h-[44px] shrink-0 px-2 text-sm font-semibold text-texto">
            {zona ? 'Todas' : 'Lo de hoy'}
          </button>
        )}
        <button type="button" onClick={() => p.alIr(null)} aria-label="Cerrar Praxis" className="h-11 w-11 shrink-0 rounded-full text-tenue">
          ✕
        </button>
      </header>
      <div ref={cuerpo} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-2">
        {pasoAbierto ? (
          <>
            <PasoDePraxis paso={guion[lugar]!} />
            <OtrasSalidas p={p} paso={guion[lugar]!} />
            {p.dudas}
          </>
        ) : zona ? (
          <>
            <Zona id={zona} p={p} />
            {p.dudas}
          </>
        ) : (
          <Indice p={p} />
        )}
      </div>
      {pasoAbierto && <PasarDePaso p={p} guion={guion} lugar={lugar} />}
    </section>
  )
}
