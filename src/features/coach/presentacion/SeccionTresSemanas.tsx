import { useMemo, useState } from 'react'
import type { PlanEstrategico } from '../../../data/consola/planesEstrategicos'
import { diaDeSesion } from '../../../domain/calendario'
import { tablaDelPlan } from '../../../domain/consolaCoach/perfilCompleto'
import { fechasEnClaro, textoDeLoHecho, textoDeLoPedido } from '../../../domain/lecturaDeSemana'
import { nombreDelMicrociclo } from '../../../domain/palabrasLlanas'
import { mapaDelPlan } from '../../../domain/presentacionAsesorado'
import {
  pieDeLaSemana,
  tresSemanasDeLaPersona,
  type RolDeSemana,
  type SemanaElegida,
  type SituacionDeSemana,
} from '../../../domain/tresSemanas'
import type { BloqueCardio, EjercicioPrescrito, Microciclo, Sesion } from '../../../domain/types'
import type { EstadoDato } from '../consola/datoConsola'

interface Props {
  /** Todos los microciclos que la persona tiene cargados (el historial de la consola). */
  historial: readonly Microciclo[]
  /** Hoy, `AAAA-MM-DD`, tal como lo da la consola. */
  hoy: string
  /** El plan estratégico vigente: de él sale lo que dice de cada semana. */
  plan: EstadoDato<PlanEstrategico | null>
}

const OPCIONES: { rol: RolDeSemana; texto: string }[] = [
  { rol: 'pasada', texto: 'La pasada' },
  { rol: 'esta', texto: 'Esta' },
  { rol: 'siguiente', texto: 'La que viene' },
]

/** Lo que se dice cuando falta una de las tres: una frase honesta, nunca datos inventados. */
const SIN_SEMANA: Record<RolDeSemana, string> = {
  pasada: 'No hay una semana anterior cargada.',
  esta: 'Todavía no hay una semana en curso cargada.',
  siguiente: 'Todavía no hay una semana siguiente cargada.',
}

const TEXTO_SITUACION: Record<SituacionDeSemana, string> = {
  paso: 'ya pasó',
  ahora: 'es la de ahora',
  viene: 'todavía no empieza',
}

/**
 * LA SEMANA PASADA, ESTA Y LA QUE VIENE: un conmutador de tres y, debajo, la semana elegida —
 * fechas, lo que el plan dice de ella y sus sesiones—. Cada sesión es una tarjeta plegable
 * (la primera abierta) y cada ejercicio pone lado a lado lo que se pidió y lo que se hizo.
 *
 * Abre en «Esta». En «La que viene» no se pinta «Hiciste»: todavía no ocurre, y una columna de
 * «sin anotar» sobre algo futuro diría que la persona dejó de hacerlo. El cambio entre
 * semanas es la entrada `pres-entra` con `key` (se vuelve a montar el bloque, y con él las
 * tarjetas vuelven a su estado inicial); se prefirió a `conTransicionDeVista` porque esa
 * fotografía el documento entero, y aquí solo cambia un bloque dentro de un diálogo. Con
 * movimiento reducido `pres-entra` ya no anima (tokens.css).
 */
export function SeccionTresSemanas({ historial, hoy, plan }: Props) {
  const [rol, setRol] = useState<RolDeSemana>('esta')
  const semanas = useMemo(() => tresSemanasDeLaPersona(historial, hoy), [historial, hoy])
  const elegida = semanas[rol]

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Qué semana mirar" className="flex gap-1.5 rounded-boton border border-linea p-0.5">
        {OPCIONES.map((o) => (
          <button
            key={o.rol}
            type="button"
            aria-pressed={rol === o.rol}
            onClick={() => setRol(o.rol)}
            className={`min-h-[44px] flex-1 rounded-[8px] px-2 text-sm font-bold ${
              rol !== o.rol ? 'text-tenue' : o.rol === 'esta' ? 'bg-rojo text-white' : 'bg-surface-3 text-texto'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {elegida ? (
          <SemanaDesplegada key={elegida.microciclo.id} semana={elegida} rol={rol} plan={plan} />
        ) : (
          <p key={rol} className="pres-entra text-[15px] text-tenue">
            {SIN_SEMANA[rol]}
          </p>
        )}
      </div>
    </div>
  )
}

function SemanaDesplegada({ semana, rol, plan }: { semana: SemanaElegida; rol: RolDeSemana; plan: Props['plan'] }) {
  const { microciclo, situacion, propuesta } = semana
  const sesiones = useMemo(() => [...microciclo.sesiones].sort((a, b) => a.orden - b.orden), [microciclo])
  const pie = useMemo(() => pieDeLaSemana(microciclo), [microciclo])
  // Lo de ahora va en rojo; el pasado y el futuro, en neutro.
  const etiqueta = propuesta ? `${TEXTO_SITUACION[situacion]} · propuesta, sin aprobar` : TEXTO_SITUACION[situacion]

  return (
    <div className="pres-entra flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h4 className="font-display text-[20px] leading-tight text-texto">{nombreDelMicrociclo(microciclo.numero, true)}</h4>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              situacion === 'ahora' ? 'border-rojo bg-rojo text-white' : 'border-linea text-tenue'
            }`}
          >
            {etiqueta}
          </span>
        </div>
        <p className="text-[14px] leading-snug text-tenue">{fechasEnClaro(microciclo)}</p>
      </header>

      <LoQueDiceElPlan plan={plan} numero={microciclo.numero} />

      {sesiones.length === 0 ? (
        <p className="text-[15px] text-tenue">Esta semana no trae sesiones cargadas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sesiones.map((s, i) => (
            <li key={s.id}>
              <TarjetaDeSesion sesion={s} abierta={i === 0} conHecho={rol !== 'siguiente'} />
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-linea pt-3 text-[13px] leading-snug text-tenue">
        {rol === 'siguiente' ? (
          <>
            {plural(pie.sesionesTotales, 'sesión', 'sesiones')}
            {pie.seriesPedidas > 0 && ` · ${plural(pie.seriesPedidas, 'serie pedida', 'series pedidas')}`}
          </>
        ) : (
          <>
            Con algo anotado: {pie.sesionesConAlgoAnotado} de {plural(pie.sesionesTotales, 'sesión', 'sesiones')}
            {pie.seriesPedidas > 0 && ` · ${pie.seriesAnotadas} de ${plural(pie.seriesPedidas, 'serie pedida', 'series pedidas')}`}
          </>
        )}
      </p>
    </div>
  )
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`
}

/**
 * Lo que el plan estratégico vigente dice de esta semana. Es la misma lectura que usa el mapa
 * del plan (`tablaDelPlan` + `mapaDelPlan`), no otra: si el plan no trae fila para este número,
 * no se pinta nada, ni un «sin plan» que parezca un fallo.
 */
function LoQueDiceElPlan({ plan, numero }: { plan: Props['plan']; numero: number }) {
  const contenido = plan.estado === 'listo' ? plan.valor?.contenido : undefined
  const detalle = useMemo(() => {
    if (contenido === undefined) return []
    const casillas = mapaDelPlan(tablaDelPlan(contenido, numero), numero, undefined)
    return casillas.find((c) => c.numero === numero)?.detalle ?? []
  }, [contenido, numero])

  if (detalle.length === 0) return null
  return (
    <div className="rounded-2xl border border-linea bg-surface-2 p-3">
      <p className="kicker !text-[12px]">Lo que dice el plan</p>
      <dl className="mt-2 flex flex-col gap-2">
        {detalle.map((d) => (
          <div key={d.titulo}>
            <dt className="text-xs font-bold uppercase tracking-wide text-tenue">{d.titulo}</dt>
            <dd className="text-[15px] leading-snug text-texto">{d.texto}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function TarjetaDeSesion({ sesion, abierta, conHecho }: { sesion: Sesion; abierta: boolean; conHecho: boolean }) {
  const dia = diaDeSesion(sesion)
  const bloques = sesion.bloquesCardio ?? []
  return (
    <details open={abierta} className="rounded-2xl border border-linea bg-surface-2">
      <summary className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 px-4 py-2">
        <span className="text-[15px] font-bold leading-snug text-texto">{sesion.nombre}</span>
        {dia && <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-tenue">{dia.toLowerCase()}</span>}
      </summary>
      <div className="flex flex-col gap-3 border-t border-linea px-4 py-3">
        {sesion.ejercicios.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {sesion.ejercicios.map((e) => (
              <li key={e.id}>
                <Ejercicio ejercicio={e} conHecho={conHecho} />
              </li>
            ))}
          </ul>
        ) : bloques.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {bloques.map((b) => (
              <li key={b.id}>
                <BloqueDeCardio bloque={b} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tenue">Esta sesión no trae ejercicios cargados.</p>
        )}
      </div>
    </details>
  )
}

function Ejercicio({ ejercicio, conHecho }: { ejercicio: EjercicioPrescrito; conHecho: boolean }) {
  const hecho = textoDeLoHecho(ejercicio)
  return (
    <div>
      <p className="text-[15px] font-bold leading-snug text-texto">{ejercicio.nombre}</p>
      {/* Dos columnas que en pantalla estrecha se apilan: sin desplazamiento horizontal en iPhone. */}
      <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-2 min-[480px]:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-tenue">Te pedimos</p>
          <p className="text-[14px] leading-snug text-texto">{textoDeLoPedido(ejercicio)}</p>
        </div>
        {conHecho && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-tenue">Hiciste</p>
            <p className={`text-[14px] leading-snug ${hecho ? 'text-texto' : 'text-tenue'}`}>{hecho ?? 'sin anotar'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function BloqueDeCardio({ bloque }: { bloque: BloqueCardio }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <p className="text-[15px] leading-snug text-texto">
        {bloque.titulo}
        {typeof bloque.duracionMin === 'number' && <span className="text-tenue"> · {bloque.duracionMin} min</span>}
      </p>
      {bloque.hechoEn && <span className="text-xs font-bold uppercase tracking-wide text-texto">hecho</span>}
    </div>
  )
}
