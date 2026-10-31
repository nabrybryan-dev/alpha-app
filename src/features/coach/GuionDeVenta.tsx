import { useEffect, useState, type ReactNode } from 'react'
import { Card } from '../../components/ui/Card'
import { guionDe, type GuionGuardado, type LecturaFila } from '../../data/consola/guionesLlamada'
import { fechaDeLlamada, horaDeLlamada } from '../../data/consola/notasLlamada'
import { guionTieneContenido, marcasDeSalud, type GuionDeVenta as Guion } from '../../domain/consolaCoach/guionDeVenta'

/**
 * El guion de la llamada de venta (`guion-llamada-v1`, 0151): lo que el agente de la landing preparó
 * para que Manuela llame a una persona nueva. Va arriba en la ficha de la consola, junto a las notas
 * de llamada: primero se lee el guion, después se anota la llamada. Antes de que la persona tenga
 * cuenta, la misma tarjeta (`VistaGuionDeVenta`) se abre desde «Llamadas por hacer».
 *
 * Solo lectura. Lo escribe la Edge Function `guion-llamada`; la puerta de lectura es la de la
 * consola (`es_coach()` o `leer_entrenamiento`), no este componente. Por esa puerta se enseñan
 * aquí el correo y el WhatsApp: Manuela llama a la persona, y nadie más llega a esta pantalla.
 *
 * La salud solo se dice con las dos marcas del esquema («Requiere aval médico», «Menor de edad»):
 * el guion no trae detalle y esta tarjeta no inventa uno.
 *
 * Sin guion no se pinta nada: la mayoría de los asesorados no llegó por la landing y una tarjeta
 * vacía en cada ficha sería ruido. Un FALLO de carga sí se dice (discreto, con reintento), y un guion
 * de una versión que la app no conoce también: no es lo mismo «no hay guion» que «no sé leerlo».
 */

interface Props {
  usuarioId: string
  className?: string
}

const AVISO_DISCRETO = 'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-linea px-3 py-2'

export function GuionDeVenta({ usuarioId, className = '' }: Props) {
  /** `undefined` = cargando. */
  const [lectura, setLectura] = useState<LecturaFila | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    guionDe(usuarioId).then((resultado) => {
      if (!vivo) return
      if (resultado.ok) {
        setLectura(resultado.lectura)
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
      <div className={`${AVISO_DISCRETO} ${className}`}>
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
  if (lectura?.tipo === 'ilegible') {
    return (
      <p role="status" className={`${AVISO_DISCRETO} text-xs text-tenue ${className}`}>
        Hay un guion de llamada en una versión que esta app todavía no sabe leer ({lectura.ilegible.version}).
      </p>
    )
  }
  if (lectura?.tipo !== 'guion' || !guionTieneContenido(lectura.guardado.guion)) return null
  return <VistaGuionDeVenta guardado={lectura.guardado} className={className} />
}

/** «jue 5 nov 2026 · en la tarde · 15:00» — la hora siempre es la de Colombia. */
function preferenciaEnClaro(g: GuionGuardado): string | null {
  const partes = [
    g.diaPreferido ? fechaDeLlamada(g.diaPreferido) : null,
    g.franjaPreferida,
    g.horaPreferida ? horaDeLlamada(g.horaPreferida) : null,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : g.guion.reserva.enClaro
}

const ROTULO = 'text-[11px] font-bold uppercase tracking-[0.14em] text-tenue'

function Seccion({ titulo, children, className = '' }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={titulo} className={`min-w-0 rounded-lg border border-linea bg-surface-2 p-3 ${className}`}>
      <h4 className={ROTULO}>{titulo}</h4>
      <div className="mt-1.5 text-sm leading-snug text-texto">{children}</div>
    </section>
  )
}

function Vinetas({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((t, n) => (
        <li key={n} className="flex gap-2">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-tenue" aria-hidden="true" />
          <span className="min-w-0">{t}</span>
        </li>
      ))}
    </ul>
  )
}

function QueMostrarle({ g }: { g: Guion }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {g.queMostrar.map((p) => (
        <li key={p.titulo} className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-bold">{p.titulo}</span>
            {p.dato && <span className="text-[13px] font-bold text-tenue">{p.dato}</span>}
          </p>
          {p.comoDecirlo && <p className="mt-0.5 border-l-2 border-linea pl-2 text-texto/85">«{p.comoDecirlo}»</p>}
        </li>
      ))}
    </ol>
  )
}

function Objeciones({ g }: { g: Guion }) {
  return (
    <dl className="flex flex-col gap-2.5">
      {g.objeciones.map((o) => (
        <div key={o.objecion}>
          <dt className="font-bold">{o.objecion}</dt>
          {o.respuesta && <dd className="mt-0.5 border-l-2 border-linea pl-2 text-texto/85">{o.respuesta}</dd>}
        </div>
      ))}
    </dl>
  )
}

/** Las secciones en el orden de la llamada; cada una aparece solo si trae algo. */
function CuerpoDelGuion({ g }: { g: Guion }) {
  const dolores = g.dolores.map((d) => (d.conSusPalabras ? <>{d.texto} <span className="text-tenue">(con sus palabras)</span></> : d.texto))
  return (
    <div className="desplegar mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
      {g.apertura && <Seccion titulo="Apertura"><p className="whitespace-pre-wrap">{g.apertura}</p></Seccion>}
      {dolores.length > 0 && <Seccion titulo="Lo que le pesa"><Vinetas items={dolores} /></Seccion>}
      {g.queMostrar.length > 0 && <Seccion titulo="Qué mostrarle"><QueMostrarle g={g} /></Seccion>}
      {g.objeciones.length > 0 && <Seccion titulo="Objeciones probables"><Objeciones g={g} /></Seccion>}
      {g.cierre && <Seccion titulo="Cierre"><p className="whitespace-pre-wrap">{g.cierre}</p></Seccion>}
      {g.avisos.length > 0 && <Seccion titulo="Avisos"><Vinetas items={g.avisos} /></Seccion>}
      {g.recomendaciones.length > 0 && (
        <Seccion titulo="Recomendaciones de PRAXIS" className="md:col-span-2">
          <Vinetas items={g.recomendaciones} />
        </Seccion>
      )}
    </div>
  )
}

function Contacto({ g }: { g: Guion }) {
  const { email, whatsapp } = g.persona
  if (!email && !whatsapp) return null
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-texto/85">
      {whatsapp && <span>WhatsApp <span className="cifras font-bold text-texto">{whatsapp}</span></span>}
      {email && <span className="break-all">{email}</span>}
    </p>
  )
}

function Salud({ g }: { g: Guion }) {
  const marcas = marcasDeSalud(g.alerta)
  if (marcas.length === 0) return null
  return (
    <div role="note" className="mt-2.5 rounded-lg border border-rojo/50 bg-rojo/10 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rojo">Alerta de salud</p>
      <p className="mt-1 text-sm font-bold text-texto">{marcas.join(' · ')}</p>
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
          <Contacto g={g} />
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
      {g.persona.decision && <p className="mt-1 text-[13px] text-tenue">Llegó: {g.persona.decision}</p>}

      <Salud g={g} />

      {abierto && (
        <div id={idCuerpo}>
          <CuerpoDelGuion g={g} />
          <p className="mt-2 text-[11px] text-tenue">
            Lo preparó PRAXIS en la landing{g.origen === 'reglas' ? ', por reglas' : ''}
            {g.generadoEn ? ` · ${fechaDeLlamada(g.generadoEn.slice(0, 10))}` : ''}
          </p>
        </div>
      )}
    </Card>
  )
}
