import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FalloDeLectura } from '../../../components/ui/FalloDeLectura'
import { useLectura } from '../../../components/ui/useLectura'
import { planItems, reabrirTarea, terminarTarea } from '../../../data/consola/planItems'
import { jornadaDe, puedeTachar, type FilaJornada } from '../../../domain/jornadaLaboral'
import { isoLocal, type Dueno, type ItemPlan } from '../../../domain/planOrganizador'
import { Cargando, CLASE_BOTON_CHICO, CLASE_ETIQUETA, Vacio } from '../../plan/comun'
import { useDuenoDelPlan, rutaMiPlan } from '../../plan/dueno'
import { fechaLarga } from '../../plan/formato'

/**
 * «Jornada laboral» (Administración; decisión de Bryan, 30-sep): las tareas de hoy y de la
 * semana de quien mira, con su botón de tachar, el objetivo al que aportan (corto plazo: la
 * semana; mediano: los 90 días) y el entregable. Usa el modelo y las acciones de «Mi plan»
 * (`plan_items`, `terminarTarea`, `reabrirTarea`); no crea nada nuevo en la base.
 *
 * OR-03: tachar es solo del dueño. Bryan ve la jornada de Manuela en solo lectura, sin botones.
 * Lo que el plan no trae (entregable, fecha del objetivo, hito) se dice «FALTA»; no se inventa.
 */

function Detalle({ f }: { f: FilaJornada }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs text-tenue">
      <span>
        {f.hito ? `Hito (corto plazo): ${f.hito.titulo}${f.plazoCorto ? ` · semana del ${fechaLarga(f.plazoCorto)}` : ''}` : 'Hito: FALTA (la tarea no cuelga de un hito)'}
      </span>
      <span>
        {f.objetivo
          ? `Objetivo: ${f.objetivo.titulo}`
          : 'Objetivo: FALTA (la tarea no llega a un objetivo de 90 días)'}
      </span>
      {f.objetivo && (
        <span>{f.plazoMediano ? `Mediano plazo: ${fechaLarga(f.plazoMediano)}` : 'Mediano plazo: FALTA la fecha del objetivo'}</span>
      )}
      <span>{f.tarea.fecha ? `Plazo de la tarea: ${fechaLarga(f.tarea.fecha)}` : 'Plazo de la tarea: FALTA'}</span>
      <span>Entregable: FALTA (el plan todavía no tiene dónde cargar entregables)</span>
    </div>
  )
}

function Fila({ f, quienMira, ocupado, onTachar, onDeshacer }: {
  f: FilaJornada
  quienMira: Dueno
  ocupado: boolean
  onTachar: (t: ItemPlan) => void
  onDeshacer: (t: ItemPlan) => void
}) {
  const t = f.tarea
  const hecha = t.estado === 'hecha'
  return (
    <li aria-label={t.titulo} className="flex flex-col gap-2 rounded-tarjeta border border-linea p-3">
      <span className={`text-sm font-semibold ${hecha ? 'text-tenue line-through' : 'text-texto'}`}>{t.titulo}</span>
      <Detalle f={f} />
      {puedeTachar(t, quienMira) && (
        <div>
          {hecha ? (
            <button type="button" disabled={ocupado} onClick={() => onDeshacer(t)} aria-label={`Deshacer: ${t.titulo}`} className={CLASE_BOTON_CHICO}>
              Deshacer
            </button>
          ) : (
            <button type="button" disabled={ocupado} onClick={() => onTachar(t)} aria-label={`Tachar: ${t.titulo}`} className={`${CLASE_BOTON_CHICO} border-texto`}>
              Tachar
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function Lista({ titulo, filas, quienMira, ocupado, onTachar, onDeshacer, vacio }: {
  titulo: string
  filas: FilaJornada[]
  quienMira: Dueno
  ocupado: boolean
  onTachar: (t: ItemPlan) => void
  onDeshacer: (t: ItemPlan) => void
  vacio?: string
}) {
  if (filas.length === 0 && !vacio) return null
  return (
    <div className="flex flex-col gap-2">
      <h4 className={CLASE_ETIQUETA}>{titulo}</h4>
      {filas.length === 0 ? (
        <Vacio>{vacio}</Vacio>
      ) : (
        <ul className="flex flex-col gap-2">
          {filas.map((f) => (
            <Fila key={f.tarea.id} f={f} quienMira={quienMira} ocupado={ocupado} onTachar={onTachar} onDeshacer={onDeshacer} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function JornadaLaboral() {
  const dueno = useDuenoDelPlan()
  const { lectura, reintentar } = useLectura(planItems)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [ultimo, setUltimo] = useState<ItemPlan[] | null>(null)

  if (lectura?.ok && lectura.datos !== ultimo) setUltimo(lectura.datos)
  const items = lectura?.ok ? lectura.datos : ultimo

  if (dueno === null) return <Vacio>La jornada laboral es de Bryan y de Manuela.</Vacio>
  if (items === null) {
    return lectura !== null && !lectura.ok ? (
      <FalloDeLectura texto={`No se pudo leer la jornada: ${lectura.error}`} onReintentar={reintentar} />
    ) : (
      <Cargando texto="Cargando la jornada…" />
    )
  }

  const hoy = isoLocal(new Date())
  const propia = jornadaDe(items, dueno, hoy)
  const otro: Dueno = dueno === 'bryan' ? 'manuela' : 'bryan'
  const ajena = dueno === 'bryan' ? jornadaDe(items, otro, hoy) : null

  const escribir = async (f: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setOcupado(true)
    setFallo(null)
    const r = await f()
    setOcupado(false)
    if (r.ok) reintentar()
    else setFallo(r.error)
  }
  const onTachar = (t: ItemPlan) => void escribir(() => terminarTarea(t.id))
  const onDeshacer = (t: ItemPlan) => void escribir(() => reabrirTarea(t.id))
  const comunes = { quienMira: dueno, ocupado, onTachar, onDeshacer }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] text-tenue">
        Las tareas que se te asignan cada día; las tachas tú. Cada una dice a qué objetivo aporta: corto plazo, la semana;
        mediano plazo, los 90 días. Largo plazo: sin horizonte cargado; no se inventa una duración.
      </p>
      {lectura !== null && !lectura.ok && (
        <FalloDeLectura texto={`No se pudo actualizar la jornada: ${lectura.error}`} onReintentar={reintentar} />
      )}
      <Lista titulo="Hoy" filas={propia.hoy} vacio="No hay tareas para hoy. Cuando se cargue la semana o agregues una en Mi plan, aparece aquí." {...comunes} />
      <Lista titulo="Resto de la semana" filas={propia.semana} {...comunes} />
      <Lista titulo="Sin día asignado" filas={propia.sinDia} {...comunes} />
      {fallo && (
        <p role="alert" className="text-sm text-rojo">
          No se guardó: {fallo}
        </p>
      )}
      {ajena && (
        <section aria-label="Jornada de Manuela · solo lectura" className="flex flex-col gap-3 rounded-tarjeta border border-dashed border-linea p-3">
          <p className={CLASE_ETIQUETA}>Jornada de Manuela · solo lectura</p>
          <p className="text-xs text-tenue">La tacha y la aprueba ella; tú no puedes tachar su semana.</p>
          <Lista titulo="Hoy" filas={ajena.hoy} vacio="Manuela no tiene tareas cargadas para hoy." {...comunes} />
          <Lista titulo="Resto de la semana" filas={ajena.semana} {...comunes} />
        </section>
      )}
      <Link to={rutaMiPlan(dueno)} className="text-xs underline">
        Agregar o mover tareas y ver los 90 días: Mi plan
      </Link>
    </div>
  )
}

