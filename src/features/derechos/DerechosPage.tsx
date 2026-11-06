import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { modoNube, supabase } from '../../data/supabase'

const DERECHOS = [
  ['conocer', 'Conocer mis datos'],
  ['actualizar_rectificar', 'Actualizar o rectificar mis datos'],
  ['prueba_autorizacion', 'Pedir prueba de mi autorización'],
  ['revocar', 'Revocar la autorización'],
  ['supresion', 'Pedir supresión de mis datos'],
] as const

function mensajeDe(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message) : String(error)
}

export default function DerechosPage() {
  // 6-nov (Bryan): todo en tú; la app no guarda el trato por persona.
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [derecho, setDerecho] = useState<string>(DERECHOS[0][0])
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [constancia, setConstancia] = useState<{ fecha: string; derecho: string } | null>(null)
  const ocupado = useRef(false)
  const identidad = useRef<string | null>(null)

  useEffect(() => {
    if (!modoNube) return
    let activa = true
    let cambio = false
    const sb = supabase()
    const { data: { subscription } } = sb.auth.onAuthStateChange((_evento, sesion) => {
      cambio = true
      if (!activa) return
      const siguiente = sesion?.user.id ?? null
      if (identidad.current !== siguiente) {
        setConstancia(null)
        setTexto('')
        setError('')
      }
      identidad.current = siguiente
      setPersonaId(siguiente)
    })
    void sb.auth.getSession().then(({ data, error: fallo }) => {
      if (!activa || cambio) return
      if (fallo) setError(fallo.message)
      identidad.current = data.session?.user.id ?? null
      setPersonaId(identidad.current)
    }).catch((fallo: unknown) => { if (activa) setError(mensajeDe(fallo)) })
    return () => { activa = false; subscription.unsubscribe() }
  }, [])

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (ocupado.current || !personaId) return
    if (texto.length > 500) { setError('El texto no puede superar 500 caracteres.'); return }
    ocupado.current = true
    setEnviando(true)
    setError('')
    try {
      const sb = supabase()
      // Se comprueba de nuevo: la sesión puede haber terminado con el formulario abierto.
      const { data: autenticacion, error: falloSesion } = await sb.auth.getSession()
      if (falloSesion) throw falloSesion
      if (!autenticacion.session || autenticacion.session.user.id !== personaId) {
        identidad.current = null
        setPersonaId(null)
        return
      }
      // 0119 existe en la base real; no se modifica el esquema ni se elige un coach por rol.
      const { data: asignacion, error: falloCoach } = await sb.from('asignaciones_coach')
        .select('coach_id').eq('persona_id', personaId).is('asignado_hasta', null).maybeSingle()
      if (identidad.current !== personaId) return
      if (falloCoach) throw falloCoach
      if (!asignacion?.coach_id) throw new Error('No hay un coach asignado. No se envió la solicitud.')
      const etiqueta = DERECHOS.find(([tipo]) => tipo === derecho)?.[1]
      if (!etiqueta) return
      const { data: guardado, error: falloGuardar } = await sb.from('mensajes').insert({
        id: crypto.randomUUID(),
        de_id: personaId,
        para_id: asignacion.coach_id,
        origen: 'humano',
        texto: `[Solicitud de derechos: ${derecho}] ${etiqueta}${texto.trim() ? `\n${texto.trim()}` : ''}`,
      }).select('fecha_iso').single()
      if (identidad.current !== personaId) return
      if (falloGuardar) throw falloGuardar
      if (!guardado?.fecha_iso) throw new Error('La base no devolvió la fecha de la solicitud.')
      setConstancia({ fecha: guardado.fecha_iso, derecho: etiqueta })
      setTexto('')
    } catch (fallo: unknown) {
      if (identidad.current === personaId) setError(mensajeDe(fallo))
    } finally {
      ocupado.current = false
      setEnviando(false)
    }
  }

  if (!personaId) return error ? <p role="alert">{error}</p> : null
  return (
    <section className="flex flex-col gap-4 text-texto" aria-labelledby="derechos-titulo">
      <Link to="/yo" className="text-sm text-accion">← Yo</Link>
      <h2 id="derechos-titulo" className="font-display text-3xl">Tus datos y derechos</h2>
      <p>Puedes conocer, actualizar o rectificar tus datos, pedir prueba de tu autorización, consultar el uso y acceder gratuitamente; también reclamar ante la SIC conforme al procedimiento aplicable.</p>
      <p>Puedes solicitar la revocación o la supresión. Se explicarán las limitaciones legales o contractuales que correspondan; no se promete eliminación inmediata de todo registro. El retiro detiene los usos que procedan; no es renuncia a derechos.</p>
      <p>Nadie de Alpha te pedira tu clave por chat, correo o WhatsApp; si alguien lo hace, no se la des.</p>
      <p>La solicitud se envía al coach asignado. La respuesta se dará por un canal acordado, sin volver a copiar datos sensibles.</p>
      {constancia ? (
        <div role="status" className="glass rounded-2xl p-4">
          <p>Solicitud guardada y enviada al coach asignado: {constancia.derecho}.</p>
          <p>Fecha y hora: <time dateTime={constancia.fecha}>{new Date(constancia.fecha).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'long' })}</time></p>
          <button type="button" className="mt-3 text-accion" onClick={() => setConstancia(null)}>Nueva solicitud</button>
        </div>
      ) : (
        <form onSubmit={enviar} className="glass flex flex-col gap-3 rounded-2xl p-4">
          <label htmlFor="derecho">Derecho que deseas solicitar</label>
          <select id="derecho" value={derecho} onChange={(e) => setDerecho(e.target.value)} disabled={enviando} className="rounded-lg bg-surface-3 p-3 text-texto">
            {DERECHOS.map(([tipo, etiqueta]) => <option key={tipo} value={tipo}>{etiqueta}</option>)}
          </select>
          <label htmlFor="detalle-derecho">Texto opcional</label>
          <p id="detalle-ayuda">No escribas datos de salud ni nombres. Máximo 500 caracteres.</p>
          <textarea id="detalle-derecho" aria-describedby="detalle-ayuda" maxLength={500} value={texto} disabled={enviando} onChange={(e) => setTexto(e.target.value)} className="rounded-lg bg-surface-3 p-3 text-texto" />
          <p className="text-sm text-tenue">{texto.length}/500</p>
          <button type="submit" disabled={enviando} className="rounded-xl bg-accion p-3 font-bold text-bg">{enviando ? 'Enviando…' : 'Enviar solicitud'}</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
