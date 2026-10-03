import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useSesionOpcional } from '../../../app/SessionProvider'
import { Badge } from '../../../components/ui/Badge'
import { avisosAtendidos, avisosPendientes, marcarAvisoAtendido, type AvisoPraxis } from '../../../data/consola/avisosPraxis'
import { db } from '../../../data/dbInstance'
import { ETIQUETA_NIVEL, ETIQUETA_ORIGEN, horaDelAviso, type NivelAviso } from '../../../domain/praxis/aviso'
import { Esqueleto, Tarjeta } from './piezas'
import { usePuestoCoach } from './usePuestoCoach'

/**
 * «Avisos de Praxis» (migración 0108, encargo de Bryan del 3-oct-2026): cuando Praxis detecta una
 * señal de riesgo en una persona, el aviso aparece AQUÍ, arriba de la consola, con la hora y el tipo
 * de señal, y queda a la vista hasta que el coach lo marca «Atendido».
 *
 * SIN la frase. El aviso solo trae quién, cuándo, por dónde llegó y el tipo; lo que la persona escribió
 * no se guarda en ningún sitio (su retención la está revisando un abogado).
 *
 * Lo ve quien ocupa el puesto de coach (el rol, o la cuenta personal de Bryan con `puesto_de_coach`) y la
 * nutricionista (Manuela; decisión de Bryan del 2-oct): ella también lo lee y lo marca atendido. Para cualquier
 * otra sesión no se pinta nada y NO se consulta nada. La base lo vuelve a comprobar con su RLS.
 *
 * Sin la migración aplicada la tabla no existe y el módulo dice una sola línea: «Avisos de Praxis:
 * falta aplicar la migración 0108». La consola no se rompe.
 */

/** Los tipos que son una persona en peligro llevan el rojo; los demás, el ámbar. */
const TONO_NIVEL: Record<NivelAviso, 'rojo' | 'ambar'> = {
  vida: 'rojo', pareja: 'rojo', nino: 'rojo', cuidado: 'ambar', salud: 'ambar',
}

const MS_RELOJ = 60_000

interface Props {
  /** Abrir la ficha de la persona (la consola ya sabe hacerlo). */
  onVerPersona?: (usuarioId: string) => void
}

type Fallo = { error: string; sinTabla: boolean }

export function AvisosPraxis({ onVerPersona }: Props) {
  const sesion = useSesionOpcional()
  const { esCoach: ocupaPuesto } = usePuestoCoach(sesion?.usuario.rol)
  // Bryan (coach, o su cuenta personal con `puesto_de_coach`) y Manuela (nutricionista): decisión de Bryan, 2-oct.
  const esCoach = ocupaPuesto || sesion?.usuario.rol === 'nutricionista'
  const actorId = sesion?.usuario.id

  const [pendientes, setPendientes] = useState<AvisoPraxis[] | null>(null)
  const [fallo, setFallo] = useState<Fallo | null>(null)
  const [atendidos, setAtendidos] = useState<AvisoPraxis[] | null>(null)
  const [verAtendidos, setVerAtendidos] = useState(false)
  const [falloAtendidos, setFalloAtendidos] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    if (!esCoach) return
    let vivo = true
    avisosPendientes().then((lectura) => {
      if (!vivo) return
      if (lectura.ok) {
        setPendientes(lectura.datos)
        setFallo(null)
      } else {
        setPendientes(null)
        setFallo({ error: lectura.error, sinTabla: lectura.sinTabla })
      }
    })
    const reloj = setInterval(() => setAhora(Date.now()), MS_RELOJ)
    return () => {
      vivo = false
      clearInterval(reloj)
    }
  }, [esCoach, intento])

  const alternarAtendidos = useCallback(() => {
    const abrir = !verAtendidos
    setVerAtendidos(abrir)
    if (!abrir || atendidos !== null) return
    setFalloAtendidos(null)
    avisosAtendidos().then((lectura) => {
      if (lectura.ok) setAtendidos(lectura.datos)
      else setFalloAtendidos(lectura.error)
    })
  }, [verAtendidos, atendidos])

  if (!esCoach) return null

  const reintentar = () => {
    setFallo(null)
    setIntento((n) => n + 1)
  }

  const alAtender = (atendido: AvisoPraxis) => {
    setPendientes((previos) => (previos ?? []).filter((a) => a.id !== atendido.id))
    setAtendidos((previos) => (previos === null ? previos : [atendido, ...previos]))
  }

  // La migración sin aplicar: una línea y nada más.
  if (fallo?.sinTabla) {
    return (
      <p className="mb-4 rounded-lg border border-dashed border-linea px-3 py-2 text-[12.5px] text-tenue">
        Avisos de Praxis: falta aplicar la migración 0108
      </p>
    )
  }

  const enlaceAtendidos = (
    <button
      type="button"
      aria-expanded={verAtendidos}
      onClick={alternarAtendidos}
      className="press min-h-[32px] text-[12px] font-bold text-tenue underline underline-offset-2 hover:text-texto"
    >
      {verAtendidos ? 'ocultar atendidos' : 'ver atendidos'}
    </button>
  )

  const listaAtendidos = verAtendidos && (
    <div className="mt-2 border-t border-linea/70 pt-2">
      {falloAtendidos !== null ? (
        <p role="alert" className="text-[12.5px] text-rojo">No se pudieron leer los atendidos ({falloAtendidos}).</p>
      ) : atendidos === null ? (
        <Esqueleto lineas={1} />
      ) : atendidos.length === 0 ? (
        <p className="text-[12.5px] text-tenue">Todavía no hay avisos atendidos.</p>
      ) : (
        <ul className="flex flex-col gap-1.5" aria-label="Avisos atendidos">
          {atendidos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-tenue">
              <span className="font-bold text-texto/80">{db.usuarios.byId(a.usuarioId)?.nombre ?? 'Persona sin nombre'}</span>
              <span>{ETIQUETA_NIVEL[a.nivel]}</span>
              <span className="cifras">{horaDelAviso(a.creadoEn, ahora)}</span>
              {a.atendidoEn && <span>· atendido {horaDelAviso(a.atendidoEn, ahora)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  if (fallo !== null) {
    return (
      <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rojo px-3 py-2.5 text-[12.5px]">
        <p className="min-w-0 text-texto">
          No se pudieron leer los avisos de Praxis ({fallo.error}). Puede haber avisos esperando.
        </p>
        <button type="button" onClick={reintentar} className="press min-h-[36px] rounded-full border border-linea px-3 text-xs font-bold text-texto">
          Reintentar
        </button>
      </div>
    )
  }

  if (pendientes === null) return <div className="mb-4"><Esqueleto lineas={1} /></div>

  // Sin pendientes: una línea discreta, no una tarjeta.
  if (pendientes.length === 0) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-linea px-3 py-1.5 text-[12.5px] text-tenue">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>Sin avisos de Praxis</p>
          {enlaceAtendidos}
        </div>
        {listaAtendidos}
      </div>
    )
  }

  return (
    <Tarjeta
      titulo="Avisos de Praxis"
      className="mb-4"
      destacada
      extra={<span className="cifras text-lg font-bold text-rojo" aria-label={`${pendientes.length} sin atender`}>{pendientes.length}</span>}
    >
      <p className="mb-2.5 text-[12.5px] text-tenue">
        Praxis detectó una señal en estas personas. Aquí no está lo que escribieron: solo el tipo de señal y la hora.
        Cada aviso se queda hasta que lo marques atendido.
      </p>
      <ul className="flex flex-col gap-2">
        {pendientes.map((aviso, i) => (
          <FilaAviso
            key={aviso.id}
            i={i}
            aviso={aviso}
            ahora={ahora}
            actorId={actorId}
            onVerPersona={onVerPersona}
            onAtendido={alAtender}
          />
        ))}
      </ul>
      <div className="mt-2 flex justify-end">{enlaceAtendidos}</div>
      {listaAtendidos}
    </Tarjeta>
  )
}

interface FilaProps {
  i: number
  aviso: AvisoPraxis
  ahora: number
  actorId: string | undefined
  onVerPersona?: (usuarioId: string) => void
  onAtendido: (aviso: AvisoPraxis) => void
}

function FilaAviso({ i, aviso, ahora, actorId, onVerPersona, onAtendido }: FilaProps) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nombre = db.usuarios.byId(aviso.usuarioId)?.nombre ?? 'Persona sin nombre'
  const tono = TONO_NIVEL[aviso.nivel]

  const atender = async () => {
    if (!actorId) {
      setError('no se sabe quién atiende: vuelve a entrar')
      return
    }
    setEnviando(true)
    setError(null)
    const r = await marcarAvisoAtendido(aviso.id, actorId)
    setEnviando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    onAtendido({ ...aviso, atendidoEn: new Date().toISOString(), atendidoPor: actorId })
  }

  return (
    <li
      className={`consola-tarjeta rounded-tarjeta border bg-surface-2/70 p-3 ${tono === 'rojo' ? 'border-rojo/60' : 'border-linea'}`}
      style={{ '--i': i } as CSSProperties}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tono === 'rojo' ? 'bg-rojo' : 'bg-ambar'}`} aria-hidden="true" />
        <span className="text-sm font-bold text-texto">{nombre}</span>
        <Badge tono={tono}>{ETIQUETA_NIVEL[aviso.nivel]}</Badge>
        <span className="cifras ml-auto text-[12px] font-bold text-tenue">{horaDelAviso(aviso.creadoEn, ahora)}</span>
      </div>
      <p className="mt-1.5 text-[12px] text-tenue">{ETIQUETA_ORIGEN[aviso.origen]}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={enviando}
          aria-label={`Marcar atendido el aviso de ${nombre}`}
          className="tecla-3d rounded-lg border border-verde/50 bg-verde/15 px-3 py-1.5 text-xs font-bold text-verde disabled:cursor-not-allowed disabled:opacity-40"
          onClick={atender}
        >
          {enviando ? 'Marcando…' : 'Atendido'}
        </button>
        {onVerPersona && (
          <button
            type="button"
            className="tecla-3d rounded-lg border border-linea bg-surface-2 px-3 py-1.5 text-xs font-bold text-texto"
            onClick={() => onVerPersona(aviso.usuarioId)}
          >
            Ver ficha
          </button>
        )}
        {error && <span role="alert" className="text-[12px] text-rojo">No se pudo marcar: {error}</span>}
      </div>
    </li>
  )
}
