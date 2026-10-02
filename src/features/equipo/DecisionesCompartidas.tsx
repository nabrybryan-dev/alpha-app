import { useCallback, useState } from 'react'
import { useSesionOpcional } from '../../app/SessionProvider'
import { FalloDeLectura } from '../../components/ui/FalloDeLectura'
import { useLectura } from '../../components/ui/useLectura'
import {
  anotarDecision,
  companerosDeDecision,
  decisionesCompartidas,
  firmarDecision,
  type Decision,
} from '../../data/consola/decisiones'
import { NOMBRE_AREA, NOMBRE_ESTADO, fraseDeDecision } from '../../domain/decisionesCompartidas'
import { FormularioDecision, borradorVacio, entradaDeBorrador, type BorradorDecision } from './FormularioDecision'

/**
 * Tarjeta «Decisiones compartidas» de Equipo (maqueta «Espacios de Alpha», 28-sep): lo que
 * decide Bryan y lo que decide Manuela en un solo lugar, para no cruzarse. Cada decisión dice
 * quién la tomó, qué palanca mueve y hacia dónde, a quién le toca, y la firma del otro con su
 * estado. Respaldada por la migración 0094; nunca datos de salud.
 *
 * Estados honestos: cargando, error con «Reintentar» (un error NUNCA se pinta como «no hay
 * decisiones»), vacío confirmado. Si anotar falla, dice «NO ANOTADA» y conserva lo escrito
 * en el dispositivo para reintentar: nunca muestra como anotada una decisión que no llegó.
 */

const CLAVE_BORRADOR = 'alpha.decisiones.borrador'
const VISIBLES = 5

function leerBorrador(): BorradorDecision | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_BORRADOR)
    return crudo ? (JSON.parse(crudo) as BorradorDecision) : null
  } catch {
    return null
  }
}
function guardarBorrador(b: BorradorDecision | null) {
  try {
    if (b) window.localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b))
    else window.localStorage.removeItem(CLAVE_BORRADOR)
  } catch {
    /* sin almacenamiento: el borrador vive solo en pantalla */
  }
}

const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).toUpperCase()

function FilaDecision({ d, yoId, onCambio }: { d: Decision; yoId: string; onCambio: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [rechazando, setRechazando] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const meToca = d.firmaDe === yoId && d.firmaEstado === 'pendiente' && d.estado !== 'vencida'
  const alerta = meToca || d.estado === 'incompleta' || d.estado === 'vencida'

  const responder = async (veredicto: 'firmada' | 'rechazada' | 'visto') => {
    setTrabajando(true)
    setFallo(null)
    const r = await firmarDecision(d.id, veredicto, veredicto === 'rechazada' ? motivo : undefined)
    setTrabajando(false)
    if (r.ok) onCambio()
    else setFallo(r.error)
  }

  const leToca =
    d.leTocaA === null
      ? null
      : `le toca a ${d.leTocaA === 'bryan' ? 'Bryan' : 'Manuela'}${d.leTocaQue ? `: ${d.leTocaQue}` : ''}${d.leTocaVence ? ` · antes del ${fechaCorta(d.leTocaVence)}` : ''}`

  return (
    <li className={`flex flex-col gap-1 border-l-[3px] px-3 py-0.5 ${alerta ? 'border-rojo' : 'border-texto'}`}>
      <span className="font-mono text-[11px] font-bold uppercase text-tenue">
        {d.decididoPor === yoId ? 'Tú' : (d.decididoPorNombre ?? 'Alguien')} · {fechaCorta(d.decididoEn)} · {NOMBRE_AREA[d.area]}
      </span>
      <span className="text-sm font-semibold text-texto">{fraseDeDecision(d)}</span>
      {d.montoCop !== null && (
        <span className="cifras text-xs text-tenue">
          {d.montoCop.toLocaleString('es-CO')} COP{d.periodicidad ? ` · ${d.periodicidad === 'unica' ? 'única' : d.periodicidad}` : ''}
        </span>
      )}
      {leToca && <span className="text-xs text-tenue">{leToca}</span>}
      <span className={`text-xs font-bold ${alerta ? 'text-rojo' : 'text-tenue'}`}>
        {NOMBRE_ESTADO[d.estado]}
        {d.firmaDe !== null && d.firmaEstado !== null && (
          <span className="font-normal text-tenue">
            {' · '}
            {d.firmaNivel === 'aviso' ? 'aviso a' : 'firma de'} {d.firmaDe === yoId ? 'ti' : (d.firmaDeNombre ?? 'el otro')}:{' '}
            {d.firmaEstado === 'pendiente' && d.estado === 'vencida' ? 'venció' : d.firmaEstado}
            {d.firmaEstado === 'pendiente' && d.firmaVenceEn ? ` (vence ${fechaCorta(d.firmaVenceEn)})` : ''}
          </span>
        )}
      </span>
      {d.faltan.length > 0 && <span className="text-xs text-rojo">{d.faltan.join(' · ')}</span>}
      {d.firmaEstado === 'rechazada' && d.firmaMotivo && <span className="text-xs text-tenue">Motivo: {d.firmaMotivo}</span>}

      {meToca && (
        <div className="mt-1 flex flex-col gap-2">
          {rechazando ? (
            <>
              <input
                aria-label="Motivo del rechazo"
                className="min-h-[44px] w-full rounded-xl border border-linea bg-bg px-3 text-sm text-texto"
                value={motivo}
                maxLength={280}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Por qué no (obligatorio)"
              />
              <div className="flex gap-2">
                <button type="button" disabled={trabajando || motivo.trim() === ''} onClick={() => void responder('rechazada')} className="press min-h-[44px] flex-1 rounded-boton border border-rojo text-sm font-bold text-rojo disabled:opacity-50">
                  Rechazar
                </button>
                <button type="button" onClick={() => setRechazando(false)} className="press min-h-[44px] rounded-boton border border-linea px-4 text-sm text-texto">
                  Volver
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              {d.firmaNivel === 'aviso' ? (
                <button type="button" disabled={trabajando} onClick={() => void responder('visto')} className="press min-h-[44px] flex-1 rounded-boton bg-texto text-sm font-bold text-bg disabled:opacity-50">
                  Visto
                </button>
              ) : (
                <>
                  <button type="button" disabled={trabajando} onClick={() => void responder('firmada')} className="press min-h-[44px] flex-1 rounded-boton bg-texto text-sm font-bold text-bg disabled:opacity-50">
                    Firmar
                  </button>
                  <button type="button" disabled={trabajando} onClick={() => setRechazando(true)} className="press min-h-[44px] flex-1 rounded-boton border border-linea text-sm text-texto">
                    No firmar
                  </button>
                </>
              )}
            </div>
          )}
          {fallo && <p role="alert" className="text-xs text-rojo">{fallo}</p>}
        </div>
      )}
    </li>
  )
}

export function DecisionesCompartidas({ puedeAnotar }: { puedeAnotar: boolean }) {
  const yo = useSesionOpcional()?.usuario
  const { lectura, reintentar } = useLectura(decisionesCompartidas)
  const leerCompaneros = useCallback(() => companerosDeDecision(), [])
  const { lectura: companeros } = useLectura(leerCompaneros)
  // Si quedó una decisión sin anotar de la vez anterior, la tarjeta abre con ella para retomarla.
  const [borradorGuardado] = useState(() => leerBorrador())
  const [abierto, setAbierto] = useState(borradorGuardado !== null)
  const [borrador, setBorrador] = useState<BorradorDecision>(() => borradorGuardado ?? borradorVacio())
  const [enviando, setEnviando] = useState(false)
  const [errorAnotar, setErrorAnotar] = useState<string | null>(null)
  const [verTodas, setVerTodas] = useState(false)

  if (!yo) return null
  const esCoach = yo.rol === 'coach'

  const cambiarBorrador = (b: BorradorDecision) => {
    setBorrador(b)
    setErrorAnotar(null)
  }

  const enviar = async () => {
    const revision = entradaDeBorrador(borrador)
    if (!revision.ok) {
      setErrorAnotar(revision.error)
      return
    }
    setEnviando(true)
    setErrorAnotar(null)
    // Se guarda ANTES de mandar: si la red se cae a mitad, no se pierde lo escrito.
    guardarBorrador(borrador)
    const r = await anotarDecision(revision.entrada)
    setEnviando(false)
    if (!r.ok) {
      setErrorAnotar(r.error)
      return
    }
    guardarBorrador(null)
    setBorrador(borradorVacio())
    setAbierto(false)
    reintentar()
  }

  const decisiones = lectura?.ok ? lectura.datos : []
  const visibles = verTodas ? decisiones : decisiones.slice(0, VISIBLES)
  const pidenAlgo = decisiones.filter((d) => (d.firmaDe === yo.id && d.firmaEstado === 'pendiente' && d.estado !== 'vencida') || d.estado === 'incompleta').length

  return (
    <section
      aria-label="Decisiones compartidas"
      className="entrada entrada-3 flex flex-col gap-3 rounded-tarjeta border border-rojo bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-rojo">
          Decisiones compartidas{pidenAlgo > 0 ? ` · ${pidenAlgo} ${pidenAlgo === 1 ? 'pide' : 'piden'} algo de ti` : ''}
        </span>
        <span className="text-xs leading-snug text-tenue">
          Lo que decide Bryan y lo que decides tú, en un solo lugar, para no cruzarse. Sin datos de salud.
        </span>
      </div>

      {lectura === null ? (
        <p className="text-sm text-tenue" aria-busy="true">Cargando las decisiones…</p>
      ) : !lectura.ok ? (
        <FalloDeLectura texto={`No se pudieron leer las decisiones (${lectura.error}).`} onReintentar={reintentar} />
      ) : decisiones.length === 0 ? (
        <p className="text-sm text-tenue">Todavía no hay decisiones anotadas.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {visibles.map((d) => (
              <FilaDecision key={d.id} d={d} yoId={yo.id} onCambio={reintentar} />
            ))}
          </ul>
          {decisiones.length > VISIBLES && (
            <button type="button" aria-expanded={verTodas} onClick={() => setVerTodas((v) => !v)} className="press min-h-[44px] text-left text-xs text-tenue underline">
              {verTodas ? 'Ver menos' : `Ver las ${decisiones.length}`}
            </button>
          )}
        </>
      )}

      {!puedeAnotar ? (
        <p className="text-xs text-tenue">Anotar decisiones pide el permiso de decisiones compartidas. Pídeselo al coach.</p>
      ) : abierto ? (
        <FormularioDecision
          esCoach={esCoach}
          companeros={companeros?.ok ? companeros.datos : []}
          borrador={borrador}
          onCambio={cambiarBorrador}
          enviando={enviando}
          error={errorAnotar}
          onEnviar={() => void enviar()}
          onCancelar={() => {
            guardarBorrador(null)
            setBorrador(borradorVacio())
            setErrorAnotar(null)
            setAbierto(false)
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="press min-h-[48px] rounded-boton border border-dashed border-tenue text-sm font-semibold text-texto"
        >
          + Anotar mi decisión
        </button>
      )}
      {companeros !== null && !companeros.ok && abierto && (
        <p role="status" className="text-xs text-tenue">
          No se pudo leer a quién pedirle la firma ({companeros.error}); la decisión se puede anotar sin firma.
        </p>
      )}
    </section>
  )
}
