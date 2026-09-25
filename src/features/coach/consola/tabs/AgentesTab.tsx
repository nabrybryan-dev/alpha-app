import { useEffect, useState } from 'react'
import { Badge } from '../../../../components/ui/Badge'
import { Card } from '../../../../components/ui/Card'
import { EmptyState } from '../../../../components/ui/EmptyState'
import {
  corridasDeTodaLaCartera,
  type CadenaCorrida,
  type EstadoCadenaCorrida,
  type PasoCadena,
} from '../../../../data/consola/cadenaCorridas'
import { db, useDbVersion } from '../../../../data/dbInstance'
import {
  bandejaDePreguntas,
  datosAtrasados,
  fechaRecepcionMasReciente,
  filaDeLaPersona,
  type PreguntaPendienteDeLaCartera,
} from '../../../../domain/consolaCoach/tableroAgentes'

/**
 * Módulo 2: el tablero ①②③④ por persona (`cadena_corridas`, migración 0083) y la bandeja
 * de preguntas pendientes de la última semana. SOLO LECTURA: nada de aquí escribe — no hay
 * "responder", "reenviar" ni "detener" todavía (DISENO-CONSOLA-V2.md fase 3 pide primero el
 * tablero, la bandeja llega sin botones de respuesta).
 */

type EstadoCasilla = EstadoCadenaCorrida | 'sin_dato'

const NOMBRE_PASO: Record<PasoCadena, string> = {
  1: '① Valoración',
  2: '② Planificación',
  3: '③ Prescripción',
  4: '④ Ejecución',
}

const ETIQUETA_ESTADO: Record<EstadoCasilla, { texto: string; tono: 'verde' | 'rojo' | 'ambar' | 'azul' | 'neutro' }> = {
  completado: { texto: 'Completado', tono: 'verde' },
  fallido: { texto: 'Fallido', tono: 'rojo' },
  descartado: { texto: 'Descartado', tono: 'ambar' },
  en_curso: { texto: 'En curso', tono: 'azul' },
  sin_dato: { texto: 'Sin dato', tono: 'neutro' },
}

function formatoFechaHora(iso: string): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return '—'
  return fecha.toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function CasillaPaso({
  paso,
  evento,
  abierta,
  onAlternar,
}: {
  paso: PasoCadena
  evento: CadenaCorrida | undefined
  abierta: boolean
  onAlternar: () => void
}) {
  const estado: EstadoCasilla = evento?.estado ?? 'sin_dato'
  const etiqueta = ETIQUETA_ESTADO[estado]
  return (
    <td className="align-top">
      <button
        type="button"
        className="relieve flex w-full min-w-[128px] flex-col gap-1 rounded-lg border border-linea bg-surface-2 px-2.5 py-2 text-left"
        aria-expanded={abierta}
        onClick={onAlternar}
        disabled={!evento}
      >
        <span className="text-[10px] font-bold uppercase tracking-wide text-tenue">{NOMBRE_PASO[paso]}</span>
        <Badge tono={etiqueta.tono}>{etiqueta.texto}</Badge>
        <span className="text-[10.5px] text-tenue">{evento ? formatoFechaHora(evento.fechaDato) : '—'}</span>
      </button>
      {abierta && evento && (
        <div className="mt-1.5 rounded-lg border border-linea bg-surface-1 p-2 text-xs">
          <p className="text-texto/90">{evento.resumen ?? 'Sin resumen para este paso.'}</p>
          {evento.avisos.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-1 border-t border-linea pt-1.5 text-[11px] text-tenue">
              {evento.avisos.map((aviso, i) => (
                <li key={i}>{typeof aviso === 'string' ? aviso : JSON.stringify(aviso)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </td>
  )
}

function FilaPersonaAgentes({
  nombre,
  usuarioId,
  todasLasCorridas,
  abiertas,
  onAlternar,
}: {
  nombre: string
  usuarioId: string
  todasLasCorridas: CadenaCorrida[]
  abiertas: Set<string>
  onAlternar: (clave: string) => void
}) {
  const fila = filaDeLaPersona(usuarioId, todasLasCorridas)
  return (
    <tr className="border-t border-linea">
      <td className="py-2 pr-3 align-top">
        <p className="font-bold text-texto">{nombre}</p>
        <p className="text-[11px] text-tenue">{fila.semanaInicio ? `Semana del ${fila.semanaInicio}` : 'Sin corrida todavía'}</p>
      </td>
      {([1, 2, 3, 4] as const).map((paso) => {
        const clave = `${usuarioId}-${paso}`
        return (
          <CasillaPaso
            key={paso}
            paso={paso}
            evento={fila.pasos[paso]}
            abierta={abiertas.has(clave)}
            onAlternar={() => onAlternar(clave)}
          />
        )
      })}
    </tr>
  )
}

function PreguntaItem({ pregunta, nombre }: { pregunta: PreguntaPendienteDeLaCartera; nombre: string }) {
  const contenido =
    typeof pregunta.pregunta === 'string' ? pregunta.pregunta : JSON.stringify(pregunta.pregunta, null, 2)
  return (
    <li className="rounded-lg border border-linea bg-surface-2 p-2.5 text-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-tenue">
        {nombre} · {NOMBRE_PASO[pregunta.paso]}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-texto/90">{contenido}</p>
    </li>
  )
}

export function AgentesTab() {
  useDbVersion()
  const [todasLasCorridas, setTodasLasCorridas] = useState<CadenaCorrida[]>([])
  const [cargando, setCargando] = useState(true)
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())

  useEffect(() => {
    let vivo = true
    corridasDeTodaLaCartera().then((corridas) => {
      if (!vivo) return
      setTodasLasCorridas(corridas)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [])

  const alternar = (clave: string) => {
    setAbiertas((previas) => {
      const siguientes = new Set(previas)
      if (siguientes.has(clave)) siguientes.delete(clave)
      else siguientes.add(clave)
      return siguientes
    })
  }

  const cartera = db.usuarios.entrenan()

  if (cargando) {
    return <EmptyState titulo="Cargando el tablero de la cadena" detalle="Trayendo cadena_corridas de la cartera." />
  }

  if (todasLasCorridas.length === 0) {
    return (
      <EmptyState
        titulo="La cadena todavía no ha sincronizado nada"
        detalle="No hay ninguna fila en cadena_corridas todavía. Llega con la próxima sincronización del importador."
      />
    )
  }

  const fechaRecepcion = fechaRecepcionMasReciente(todasLasCorridas)
  const atrasado = fechaRecepcion ? datosAtrasados(fechaRecepcion) : false

  const filas = cartera.map((u) => filaDeLaPersona(u.id, todasLasCorridas))
  const bandeja = bandejaDePreguntas(filas)

  return (
    <div className="flex flex-col gap-3">
      <Card destacada className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto">
          Datos de la cadena del <span className="font-bold">{fechaRecepcion ? formatoFechaHora(fechaRecepcion) : 'sin dato'}</span>
        </p>
        {atrasado && <Badge tono="rojo">Datos atrasados</Badge>}
      </Card>

      <Card>
        <p className="kicker">Tablero de la cadena · toda la cartera</p>
        <p className="mt-1 text-sm text-tenue">Un paso por persona: ① Valoración · ② Planificación · ③ Prescripción · ④ Ejecución</p>
        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-tenue">
                <th className="pb-1.5 pr-3 font-bold">Asesorado</th>
                <th className="pb-1.5 font-bold">① Valoración</th>
                <th className="pb-1.5 font-bold">② Planificación</th>
                <th className="pb-1.5 font-bold">③ Prescripción</th>
                <th className="pb-1.5 font-bold">④ Ejecución</th>
              </tr>
            </thead>
            <tbody>
              {cartera.map((u) => (
                <FilaPersonaAgentes
                  key={u.id}
                  nombre={u.nombre}
                  usuarioId={u.id}
                  todasLasCorridas={todasLasCorridas}
                  abiertas={abiertas}
                  onAlternar={alternar}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <p className="kicker">Preguntas pendientes</p>
        <p className="mt-1 text-sm text-tenue">Lo que un agente preguntó y todavía no tiene respuesta.</p>
        {bandeja.length === 0 ? (
          <p className="mt-2.5 text-sm text-tenue">No hay preguntas pendientes.</p>
        ) : (
          <ul className="mt-2.5 flex flex-col gap-2">
            {bandeja.map((pregunta, i) => (
              <PreguntaItem
                key={i}
                pregunta={pregunta}
                nombre={cartera.find((u) => u.id === pregunta.usuarioId)?.nombre ?? pregunta.usuarioId}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
