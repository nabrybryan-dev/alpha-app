import { useState } from 'react'
import {
  MAX_HITOS_SEMANA,
  NOMBRE_INTENSIDAD,
  avanceDeHito,
  cargaSemanal,
  hitosDeLaSemana,
  horasTexto,
  sumarDias,
  tareasDelDia,
  type Dueno,
  type ItemPlan,
} from '../../domain/planOrganizador'
import { Barra, CLASE_BOTON_CHICO, Tarjeta, Vacio } from './comun'
import { diaCorto, fechaLarga } from './formato'

interface Props {
  items: ItemPlan[]
  dueno: Dueno
  /** Lunes de la semana actual. */
  lunesActual: string
  /** Bryan ve, además, la carga de Manuela en solo lectura. */
  verCargaAjena?: Dueno | null
}

function Hitos({ items, dueno, lunes, soloLectura }: { items: ItemPlan[]; dueno: Dueno; lunes: string; soloLectura?: boolean }) {
  const hitos = hitosDeLaSemana(items, dueno, lunes)
  if (hitos.length === 0) {
    return (
      <Vacio>
        {soloLectura ? 'Sin hitos cargados esta semana.' : 'Esta semana no tiene hitos cargados. El lunes se propone la semana y tú la apruebas.'}
      </Vacio>
    )
  }
  return (
    <ul className="flex flex-col gap-3">
      {hitos.map((h) => {
        const a = avanceDeHito(items, h.id)
        return (
          <li key={h.id} className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-texto">
              {h.titulo}
              {h.palanca ? <span className="cifras text-xs text-tenue"> · palanca {h.palanca}</span> : null}
            </span>
            {a.sinTareas ? (
              <span className="text-xs text-tenue">Sin tareas todavía.</span>
            ) : (
              <>
                <Barra pct={a.pct} etiqueta={`Avance de ${h.titulo}`} tono={a.pct === 100 ? 'verde' : 'rojo'} />
                <span className="cifras text-xs text-tenue">
                  {a.hechas} de {a.total} tareas · {a.pct} %
                </span>
              </>
            )}
          </li>
        )
      })}
      {hitos.length > MAX_HITOS_SEMANA && (
        <li role="status" className="text-xs text-ambar">
          Hay {hitos.length} hitos y el tope es {MAX_HITOS_SEMANA}: lo que no cabe se pasa a la semana siguiente.
        </li>
      )}
    </ul>
  )
}

function Carga({ items, dueno, lunes }: { items: ItemPlan[]; dueno: Dueno; lunes: string }) {
  const c = cargaSemanal(items, dueno, lunes)
  const pct = c.planeadoMin === 0 ? 0 : Math.round((c.hechoMin / c.planeadoMin) * 100)
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="cifras text-lg font-bold text-texto">
          {horasTexto(c.hechoMin)} <span className="text-sm font-normal text-tenue">hechas de {horasTexto(c.planeadoMin)} planeadas</span>
        </p>
        <span className="rounded-full border border-linea px-3 py-1 text-xs font-bold uppercase text-texto">Intensidad {NOMBRE_INTENSIDAD[c.intensidad]}</span>
      </div>
      {c.planeadoMin === 0 ? (
        <p className="text-xs text-tenue">No hay tareas con estimado esta semana.</p>
      ) : (
        <Barra pct={pct} etiqueta="Horas hechas sobre planeadas" tono={pct >= 100 ? 'verde' : 'rojo'} />
      )}
      <p className="cifras text-xs text-tenue">
        {c.hechas} de {c.tareas} tareas hechas
      </p>
      <ul aria-label="Tareas por día" className="grid grid-cols-7 gap-1 text-center">
        {dias.map((d) => {
          const n = tareasDelDia(items, dueno, d).vivas.length
          return (
            <li key={d} className="flex flex-col rounded-md border border-linea py-1.5 text-[10px] uppercase text-tenue">
              <span>{diaCorto(d)}</span>
              <span className={`cifras text-sm font-bold ${n > 0 ? 'text-texto' : 'text-tenue'}`}>{n}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Pestaña «Semana»: hitos con avance, horas planeadas contra hechas, intensidad. */
export function SemanaTab({ items, dueno, lunesActual, verCargaAjena }: Props) {
  const [lunes, setLunes] = useState(lunesActual)
  const propios = items.filter((i) => i.dueno === dueno)
  const ajenos = verCargaAjena ? items.filter((i) => i.dueno === verCargaAjena) : []

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={CLASE_BOTON_CHICO} onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior">
          ‹
        </button>
        <p className="cifras text-sm font-bold text-texto">
          Semana del {fechaLarga(lunes)}
          {lunes === lunesActual ? ' · esta' : ''}
        </p>
        <button type="button" className={CLASE_BOTON_CHICO} onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente">
          ›
        </button>
      </div>

      <Tarjeta etiqueta="Hitos de la semana">
        <Hitos items={propios} dueno={dueno} lunes={lunes} />
      </Tarjeta>

      <Tarjeta etiqueta="Carga de la semana">
        <Carga items={propios} dueno={dueno} lunes={lunes} />
      </Tarjeta>

      {verCargaAjena && (
        <Tarjeta etiqueta="Carga de Manuela · solo lectura" etiquetaAria="Carga de Manuela">
          {ajenos.length === 0 ? (
            <Vacio>Manuela todavía no tiene plan cargado. No se ve carga que sumar.</Vacio>
          ) : (
            <div className="flex flex-col gap-4">
              <Carga items={ajenos} dueno={verCargaAjena} lunes={lunes} />
              <Hitos items={ajenos} dueno={verCargaAjena} lunes={lunes} soloLectura />
            </div>
          )}
        </Tarjeta>
      )}
    </div>
  )
}
