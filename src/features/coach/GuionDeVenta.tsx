import { useEffect, useState, type ReactNode } from 'react'
import { Card } from '../../components/ui/Card'
import { guionDe, type GuionGuardado } from '../../data/consola/guionesLlamada'
import { fechaDeLlamada, horaDeLlamada } from '../../data/consola/notasLlamada'
import { guionTieneContenido } from '../../domain/consolaCoach/guionDeVenta'

/**
 * El guion de la llamada de venta (0151): lo que el agente de la landing preparó para que Manuela
 * llame a una persona nueva. Va arriba en la ficha de la consola, junto a las notas de llamada:
 * primero se lee el guion, después se anota la llamada.
 *
 * Solo lectura. Lo escribe la Edge Function `guion-llamada`; la puerta de lectura es la de la
 * consola (`es_coach()` o `leer_entrenamiento`), no este componente.
 *
 * Sin guion no se pinta nada: la mayoría de los asesorados no llegó por la landing y una tarjeta
 * vacía en cada ficha sería ruido. Un FALLO de carga sí se dice (discreto, con reintento): no es
 * lo mismo «no hay guion» que «no sé si hay».
 *
 * La alerta de salud y la preferencia de llamada quedan siempre a la vista; el resto se pliega.
 */

interface Props {
  usuarioId: string
  className?: string
}

export function GuionDeVenta({ usuarioId, className = '' }: Props) {
  /** `undefined` = cargando; `null` = no hay guion. */
  const [guardado, setGuardado] = useState<GuionGuardado | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    guionDe(usuarioId).then((resultado) => {
      if (!vivo) return
      if (resultado.ok) {
        setGuardado(resultado.guion)
        setError(null)
      } else {
        setError(resultado.error)
      }
    })
    return () => {
      vivo = false
    }
  }, [usuarioId, intento])

  if (error) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linea px-3 py-2 ${className}`}>
        <p role="alert" className="text-xs text-tenue">
          {error}
        </p>
        <button
          type="button"
          className="press min-h-[44px] rounded-lg border border-linea bg-surface-2 px-3 text-xs font-bold text-texto"
          onClick={() => {
            setError(null)
            setIntento((n) => n + 1)
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }
  if (!guardado || !guionTieneContenido(guardado.guion)) return null
  return <VistaGuionDeVenta guardado={guardado} className={className} />
}

/** «jue 5 nov 2026 · en la tarde · 15:00» — la hora siempre es la de Colombia. */
function preferenciaEnClaro(g: GuionGuardado): string | null {
  const partes = [
    g.diaPreferido ? fechaDeLlamada(g.diaPreferido) : null,
    g.franjaPreferida,
    g.horaPreferida ? horaDeLlamada(g.horaPreferida) : null,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : (g.guion.preferencia.enClaro ?? null)
}

const ROTULO = 'text-[11px] font-bold uppercase tracking-[0.14em] text-tenue'

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="min-w-0 rounded-lg border border-linea bg-surface-2 p-3">
      <h4 className={ROTULO}>{titulo}</h4>
      <div className="mt-1.5 text-sm leading-snug text-texto">{children}</div>
    </section>
  )
}

function Lista({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-tenue" aria-hidden="true" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

function CuerpoDelGuion({ g }: { g: GuionGuardado['guion'] }) {
  return (
    <div className="desplegar mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
      {g.apertura && (
        <Seccion titulo="Apertura">
          <p className="whitespace-pre-wrap">{g.apertura}</p>
        </Seccion>
      )}
      {g.dolores.length > 0 && (
        <Seccion titulo="Lo que le pesa">
          <Lista items={g.dolores} />
        </Seccion>
      )}
      {g.queMostrar.length > 0 && (
        <Seccion titulo="Qué mostrarle">
          <Lista items={g.queMostrar} />
        </Seccion>
      )}
      {g.objeciones.length > 0 && (
        <Seccion titulo="Objeciones probables">
          <dl className="flex flex-col gap-2">
            {g.objeciones.map((o) => (
              <div key={o.objecion}>
                <dt className="font-bold">«{o.objecion}»</dt>
                {o.respuesta && <dd className="mt-0.5 border-l-2 border-linea pl-2 text-texto/85">{o.respuesta}</dd>}
              </div>
            ))}
          </dl>
        </Seccion>
      )}
      {g.cierre && (
        <Seccion titulo="Cierre">
          <p className="whitespace-pre-wrap">{g.cierre}</p>
        </Seccion>
      )}
      {g.avisos.length > 0 && (
        <Seccion titulo="Avisos">
          <Lista items={g.avisos} />
        </Seccion>
      )}
    </div>
  )
}

export function VistaGuionDeVenta({ guardado, className = '' }: { guardado: GuionGuardado; className?: string }) {
  const [abierto, setAbierto] = useState(true)
  const g = guardado.guion
  const preferencia = preferenciaEnClaro(guardado)
  const persona = [g.persona.nombre, g.persona.edadTramo, g.persona.objetivo].filter(Boolean).join(' · ')
  const idCuerpo = `guion-cuerpo-${guardado.id}`

  return (
    <Card className={`min-w-0 ${className}`} role="region" aria-label="Guion de la llamada">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="kicker">Guion de la llamada</p>
          {persona && <p className="mt-1 text-[15px] font-bold leading-snug text-texto">{persona}</p>}
        </div>
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idCuerpo}
          className="tecla-3d min-h-[44px] rounded-lg border border-linea bg-surface-2 px-3 text-xs font-bold text-texto"
          onClick={() => setAbierto((a) => !a)}
        >
          {abierto ? 'Plegar el guion' : 'Ver el guion'}
        </button>
      </div>

      <p className="mt-2 text-[13px] text-texto">
        <span className={`${ROTULO} mr-2`}>Prefiere que le llamen</span>
        {preferencia ? (
          <>
            <span className="font-bold">{preferencia}</span>
            <span className="text-tenue"> · hora de Colombia</span>
          </>
        ) : (
          <span className="text-tenue">no dijo cuándo</span>
        )}
      </p>

      {g.alertaSalud && (
        <div role="note" className="mt-2.5 rounded-lg border border-rojo/50 bg-rojo/10 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rojo">Alerta de salud</p>
          <p className="mt-1 text-sm font-bold text-texto">{g.alertaSalud}</p>
          <p className="mt-1 text-xs text-texto/85">Antes de su plan, el aval de su médico.</p>
        </div>
      )}

      {abierto && (
        <div id={idCuerpo}>
          <CuerpoDelGuion g={g} />
          <p className="mt-2 text-[11px] text-tenue">
            Versión {guardado.version} · lo preparó el agente de la landing
          </p>
        </div>
      )}
    </Card>
  )
}
