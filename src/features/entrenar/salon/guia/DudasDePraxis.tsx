import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSesionOpcional } from '../../../../app/SessionProvider'
import { proponerRegistro } from '../../../../data/praxis/registrador'
import { sesionDeFunciones } from '../../../../data/supabase'
import { puedeVerPraxis } from '../../../../domain/praxis/acceso'
import type { RespuestaDelRegistrador } from '../../../../domain/praxis/conversacion'
import { dudaAntesDeEnviar, dudaTrasResponder, type ResultadoDeDuda } from '../../../../domain/praxis/dudas/dudaEnEntrenar'
import { LINEAS_DE_AYUDA, type LineaDeAyuda } from '../../../../domain/praxis/riesgo'
import { horaLocalIso, hoyIso } from '../../../../lib/fecha'
import { usePuestoCoach } from '../../../coach/consola/usePuestoCoach'

/**
 * LAS DUDAS LIBRES DE PRAXIS, solo para el equipo (decisión de Bryan, 30-oct-2026). Va aparte de la guía
 * a propósito: la guía no gasta la clave y lo comprueba un test. Esta pieza sí, y por eso tiene puerta.
 * Tras una Quieta, el campo no vuelve hasta mañana en este teléfono. La frase no se guarda aquí.
 */

const MAX_FRASE = 600 // el tope de `praxis-registro`
const CLAVE_DETENIDA = 'praxis-dudas-detenida'

function detenidaHoy(): boolean {
  try {
    return localStorage.getItem(CLAVE_DETENIDA) === hoyIso()
  } catch {
    return false
  }
}

function detener(): void {
  try {
    localStorage.setItem(CLAVE_DETENIDA, hoyIso())
  } catch {
    /* sin almacenamiento, la Quieta dura lo que dure esta pantalla */
  }
}

async function preguntarAlRegistrador(frase: string): Promise<RespuestaDelRegistrador> {
  return proponerRegistro(await sesionDeFunciones(), { frase, mensajeId: `duda-${Date.now()}`, horaLocal: horaLocalIso() })
}

/** Los textos son los de la Quieta de Praxis, pendientes de revisión por un profesional. */
function Quieta({ linea }: { linea: LineaDeAyuda }) {
  const inicio = useRef<HTMLDivElement>(null)
  // En un teléfono, las líneas de ayuda quedarían debajo de lo que se estaba leyendo.
  useEffect(() => {
    inicio.current?.scrollIntoView?.({ block: 'start' })
  }, [])
  return (
    <div ref={inicio} role="alert" className="mt-4 text-sm leading-relaxed text-texto">
      <p>
        Lo que escribiste me importa. Me quedo quieta y no te hago más preguntas. Si estás en peligro o piensas en hacerte daño,
        llama ahora: te contestan personas, a cualquier hora.
      </p>
      <ul className="mt-2">
        {LINEAS_DE_AYUDA[linea].map(([numero, boton, rotulo]) => (
          <li key={numero} className="mt-2">
            <a href={`tel:${numero}`} className="press flex min-h-[44px] items-center font-bold" style={{ color: 'var(--oro)' }}>
              {boton}
            </a>
            <span className="text-xs text-tenue">{rotulo}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-tenue">Desde aquí todavía no se le avisa a nadie: esta versión es de prueba para el equipo. Hoy no hay más preguntas.</p>
    </div>
  )
}

function Cuidado({ alResponder }: { alResponder: (hayRiesgo: boolean) => void }) {
  return (
    <div role="alert" className="mt-4 text-sm text-texto">
      <p>Eso que escribiste me importa. ¿Estás pensando en hacerte daño?</p>
      <div className="mt-1 flex flex-wrap gap-x-5">
        <button type="button" onClick={() => alResponder(true)} className="press min-h-[44px] font-semibold">
          Sí
        </button>
        <button type="button" onClick={() => alResponder(false)} className="press min-h-[44px] font-semibold">
          No
        </button>
        <button type="button" onClick={() => alResponder(true)} className="press min-h-[44px] font-semibold">
          Prefiero no decir
        </button>
      </div>
    </div>
  )
}

export function DudasDePraxis({ preguntar = preguntarAlRegistrador }: { preguntar?: (frase: string) => Promise<RespuestaDelRegistrador> }) {
  const [frase, setFrase] = useState('')
  const [pensando, setPensando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoDeDuda | null>(null)
  const [detenida, setDetenida] = useState(detenidaHoy)
  const turno = useRef(0)
  const lectura = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (resultado) lectura.current?.scrollIntoView?.({ block: 'nearest' })
  }, [resultado])

  const mostrar = (r: ResultadoDeDuda) => {
    if (r.tipo === 'quieta') {
      detener()
      setDetenida(true)
    }
    setResultado(r)
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const limpia = frase.trim()
    if (!limpia || pensando) return
    setFrase('')
    const local = dudaAntesDeEnviar(limpia)
    if (local) {
      mostrar(local)
      return
    }
    const mio = ++turno.current
    setResultado(null)
    setPensando(true)
    const r = await preguntar(limpia).catch((): RespuestaDelRegistrador => ({ ok: false, motivo: 'red' }))
    if (mio !== turno.current) return
    setPensando(false)
    mostrar(dudaTrasResponder(r))
  }

  if (resultado?.tipo === 'quieta') return <Quieta linea={resultado.linea} />
  if (detenida) return <p className="mt-4 text-xs text-tenue">Hoy la conversación se detuvo. Hoy no hay más preguntas.</p>
  return (
    <div className="mt-4 border-t border-linea pt-3" data-testigo="dudas-de-praxis">
      <form onSubmit={(e) => void enviar(e)} className="flex items-center gap-2">
        <input
          value={frase}
          onChange={(e) => setFrase(e.target.value)}
          maxLength={MAX_FRASE}
          enterKeyHint="send"
          aria-label="Escribe tu duda de entreno"
          placeholder="Escribe tu duda de entreno"
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-linea bg-transparent px-3 text-base text-texto"
        />
        <button type="submit" disabled={pensando || !frase.trim()} className="press min-h-[44px] shrink-0 px-1 text-sm font-bold disabled:opacity-40" style={{ color: 'var(--oro)' }}>
          Preguntar
        </button>
      </form>
      <div ref={lectura} aria-live="polite">
        {pensando && <p className="mt-3 text-sm text-tenue">Pensando…</p>}
        {resultado?.tipo === 'cuidado' && (
          <Cuidado alResponder={(hayRiesgo) => (hayRiesgo ? mostrar({ tipo: 'quieta', linea: 'vida' }) : setResultado(null))} />
        )}
        {resultado && resultado.tipo !== 'cuidado' && (
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-texto">{resultado.texto}</p>
        )}
      </div>
      <p className="mt-2 text-[11px] text-tenue">Prueba solo para el equipo. Contesta con fichas del Centro de Respuestas.</p>
    </div>
  )
}

/** Dos llaves, las mismas de la pantalla de Praxis: el rol del equipo o el puesto. Un asesorado no ve el campo. */
export function PuertaDeDudas() {
  const sesion = useSesionOpcional()
  const rol = sesion?.usuario.rol
  const { esCoach: ocupaElPuesto, cargando } = usePuestoCoach(rol)
  if (!rol || (rol === 'asesorado' && cargando)) return null
  if (!puedeVerPraxis(rol, undefined, ocupaElPuesto)) return null
  return <DudasDePraxis />
}
