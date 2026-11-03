import { useEffect, useState } from 'react'
import { Badge } from '../../../components/ui/Badge'
import {
  aprobarParametrosPlan,
  leerParametrosAprobados,
  type ParametrosAprobadosFila,
} from '../../../data/consola/parametrosAprobados'
import {
  estadoDeAprobacionDeParametros,
  parametrosDeContenido,
  traeLosDiezParametros,
  type EstadoAprobacionParametros,
} from '../../../domain/consolaCoach/parametrosAprobados'
import type { DiferenciaParametros } from '../../../domain/consolaCoach/planRenovado'

/** Lo que la sección necesita saber de la fila del plan para ofrecer «Aprobar parámetros». */
export interface ContextoAprobacionParametros {
  /** `aprobaciones_plan_estrategico.id`: la fila de la bandeja. */
  planRenovadoId: string
  /** El plan sigue pendiente (propuesto o esperando a Bryan). */
  pendiente: boolean
  /** Quien mira es la coach (rol coach): la RPC `aprobar_parametros_plan` exige `es_coach()`. */
  permiso: boolean
}

const ETIQUETA_PARAMETRO = {
  nuevo: { texto: 'Nuevo', clase: 'text-verde' },
  cambia: { texto: 'Cambia', clase: 'text-ambar' },
  igual: { texto: 'Igual', clase: 'text-tenue' },
  quitado: { texto: 'Quitado', clase: 'text-rojo' },
} as const

const TEXTO_ESTADO: Record<EstadoAprobacionParametros, string> = {
  sin_aprobar: 'Sin aprobar',
  vigente: 'Aprobados',
  vencida: 'Vencida: cambió un valor, vuelve a aprobar',
}

type Lectura = { estado: 'cargando' } | { estado: 'error'; error: string } | { estado: 'listo'; fila: ParametrosAprobadosFila | null }

/**
 * PENDIENTE DE BRYAN: la insignia existente «Aprobados» / «Pendientes de aprobar» de la sección sale del
 * campo `aprobacion` que escribe el agente, no de esta aprobación; los textos se parecen. No se renombra
 * hasta que Bryan decida.
 *
 * «Aprobar parámetros» (0158): botón propio, separado del de aprobar el plan. Aprobar uno no
 * aprueba el otro. Pide confirmación en sitio, como el botón del plan, para que un toque
 * accidental no firme nada. La base vuelve a comprobar que los valores sean los del plan.
 */
function AprobarParametros({ contexto, contenido }: { contexto: ContextoAprobacionParametros; contenido: unknown }) {
  const { planRenovadoId, pendiente, permiso } = contexto
  const vigentes = parametrosDeContenido(contenido)
  const [lectura, setLectura] = useState<Lectura>({ estado: 'cargando' })
  const [abierta, setAbierta] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    leerParametrosAprobados(planRenovadoId).then((r) => {
      if (!vivo) return
      setLectura(r.ok ? { estado: 'listo', fila: r.aprobacion } : { estado: 'error', error: r.error })
    })
    return () => {
      vivo = false
    }
  }, [planRenovadoId])

  const fecha =
    lectura.estado === 'listo' && lectura.fila
      ? new Date(lectura.fila.aprobadoEn).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
      : undefined
  const estado = estadoDeAprobacionDeParametros(lectura.estado === 'listo' ? lectura.fila?.parametros : null, vigentes)

  const motivoNo = !permiso
    ? 'Solo la coach puede aprobar parámetros'
    : !pendiente
      ? 'El plan ya está decidido.'
      : !vigentes
        ? 'El plan no trae parámetros para aprobar.'
        : !traeLosDiezParametros(vigentes)
          ? 'El plan no trae los diez parámetros'
          : lectura.estado !== 'listo'
          ? undefined
          : estado === 'vigente'
            ? 'Estos parámetros ya están aprobados.'
            : undefined
  const deshabilitado = lectura.estado !== 'listo' || motivoNo !== undefined

  const confirmar = async () => {
    if (!vigentes) return
    setEnviando(true)
    setError(null)
    const r = await aprobarParametrosPlan(planRenovadoId, vigentes)
    setEnviando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    setLectura({ estado: 'listo', fila: r.aprobacion })
    setAbierta(false)
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5" data-testid="aprobar-parametros">
      <p aria-live="polite" className="text-[12.5px] font-bold text-texto" data-testid="estado-aprobacion-parametros">
        {lectura.estado === 'cargando' ? 'Mirando la aprobación…' : lectura.estado === 'error' ? lectura.error : (estado === 'vigente' && fecha ? `Aprobados el ${fecha}` : TEXTO_ESTADO[estado])}
      </p>
      {!abierta && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="tecla-3d min-h-[44px] min-w-[44px] rounded-lg bg-verde px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={deshabilitado}
            onClick={() => {
              setError(null)
              setAbierta(true)
            }}
          >
            Aprobar parámetros
          </button>
          {motivoNo && <span className="text-[11px] text-tenue">— {motivoNo}</span>}
        </div>
      )}
      {abierta && (
        <div className="consola-confirmacion rounded-lg border border-dashed border-linea bg-surface-1 p-2.5">
          <p className="text-[12.5px] text-texto">
            ¿Aprobar estos parámetros tal como los ves? Aprobarlos NO aprueba el plan: el plan se decide aparte. Si cambia
            cualquier valor, esta aprobación vence.
          </p>
          {error && (
            <p role="alert" className="mt-1 text-xs text-rojo">
              {error}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="tecla-3d min-h-[44px] min-w-[44px] rounded-lg bg-verde px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              disabled={enviando}
              onClick={() => void confirmar()}
            >
              {enviando ? 'Enviando…' : 'Confirmar parámetros'}
            </button>
            <button
              type="button"
              className="min-h-[44px] min-w-[44px] rounded-lg border border-linea px-4 py-2 text-xs font-bold text-tenue"
              disabled={enviando}
              onClick={() => setAbierta(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  p: DiferenciaParametros
  /** El `contenido` del borrador: de ahí salen los valores que se aprueban. */
  contenido: unknown
  contexto: ContextoAprobacionParametros
}

/** La sección «Parámetros para decidir» del borrador, su diferencia con el vigente y su aprobación. */
export function SeccionParametros({ p, contenido, contexto }: Props) {
  if (!p.hay) return null
  const ap = p.aprobacion
  const aprobada = ap?.estado === 'aprobada'
  return (
    <section aria-label="Parámetros para decidir" data-testid="parametros-para-decidir">
      <h4 className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-tenue">
        Parámetros para decidir
        {ap && <Badge tono={aprobada ? 'verde' : 'ambar'}>{aprobada ? 'Aprobados' : 'Pendientes de aprobar'}</Badge>}
      </h4>
      {!p.enBorrador && (
        <p className="mt-1 text-[12px] text-rojo">El vigente traía esta sección y el borrador la quita.</p>
      )}
      {ap && (
        <p className="mt-1 text-[12px] text-tenue">
          Aprobación: {ap.estado}
          {ap.por ? ` · por ${ap.por}` : ''}
          {ap.fecha ? ` · ${ap.fecha}` : ''}
          {ap.estadoAntes !== undefined && ap.estadoAntes !== ap.estado ? ` (antes: ${ap.estadoAntes})` : ''}
        </p>
      )}
      {!p.cambia && <p className="mt-1 text-[12px] text-tenue">Los parámetros son iguales a los del vigente.</p>}
      <ul className="mt-1 flex flex-col gap-1.5 text-[12.5px]">
        {p.campos.map((c) => {
          const et = ETIQUETA_PARAMETRO[c.estado]
          return (
            <li key={c.campo} className="flex flex-col gap-0.5">
              <span className="flex gap-2">
                <span className="font-bold text-texto">{c.campo.replace(/_/g, ' ')}</span>
                <span className={`text-[10.5px] font-bold uppercase ${et.clase}`}>{et.texto}</span>
              </span>
              {c.estado === 'cambia' && c.antes !== undefined && (
                <span className="break-words text-tenue line-through">{c.antes || '—'}</span>
              )}
              <span className={`break-words ${c.estado === 'quitado' ? 'text-tenue line-through' : 'text-texto/90'}`}>
                {(c.estado === 'quitado' ? c.antes : c.valor) || '—'}
              </span>
            </li>
          )
        })}
      </ul>
      {p.enBorrador && <AprobarParametros contexto={contexto} contenido={contenido} />}
    </section>
  )
}
