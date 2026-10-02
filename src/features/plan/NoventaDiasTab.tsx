import { avanceDeObjetivo, objetivosActivos, type Dueno, type ItemPlan } from '../../domain/planOrganizador'
import { Barra, Tarjeta, Vacio } from './comun'
import { fechaLarga } from './formato'

function Objetivos({ items, dueno, soloLectura }: { items: ItemPlan[]; dueno: Dueno; soloLectura?: boolean }) {
  const objetivos = objetivosActivos(items, dueno)
  if (objetivos.length === 0) {
    return (
      <Vacio>
        {soloLectura ? 'Sin objetivos cargados.' : 'Todavía no hay objetivos de 90 días cargados. Salen del plan estratégico cuando apruebas la primera semana.'}
      </Vacio>
    )
  }
  return (
    <ul className="flex flex-col gap-4">
      {objetivos.map((o) => {
        const a = avanceDeObjetivo(items, o.id)
        const hitos = items.filter((i) => i.nivel === 'hito' && i.padreId === o.id && i.estado !== 'descartada').length
        return (
          <li key={o.id} className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-texto">
              {o.titulo}
              {o.palanca ? <span className="cifras text-xs text-tenue"> · palanca {o.palanca}</span> : null}
            </span>
            {a.sinTareas ? (
              <span className="text-xs text-tenue">Sin tareas todavía.</span>
            ) : (
              <Barra pct={a.pct} etiqueta={`Avance de ${o.titulo}`} tono={a.pct === 100 ? 'verde' : 'rojo'} />
            )}
            <span className="cifras text-xs text-tenue">
              {a.sinTareas ? '' : `${a.hechas} de ${a.total} tareas · ${a.pct} % · `}
              {hitos} {hitos === 1 ? 'hito' : 'hitos'}
              {o.fecha ? ` · hasta el ${fechaLarga(o.fecha)}` : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Pestaña «90 días»: los objetivos con su barra (tareas hechas sobre tareas vivas de sus hitos). */
export function NoventaDiasTab({ items, dueno, verObjetivosAjenos }: { items: ItemPlan[]; dueno: Dueno; verObjetivosAjenos?: Dueno | null }) {
  return (
    <div className="flex flex-col gap-3.5">
      <Tarjeta etiqueta="Objetivos de 90 días">
        <Objetivos items={items.filter((i) => i.dueno === dueno)} dueno={dueno} />
      </Tarjeta>
      {verObjetivosAjenos && (
        <Tarjeta etiqueta="Objetivos de Manuela · solo lectura" etiquetaAria="Objetivos de Manuela">
          <Objetivos items={items.filter((i) => i.dueno === verObjetivosAjenos)} dueno={verObjetivosAjenos} soloLectura />
        </Tarjeta>
      )}
    </div>
  )
}
