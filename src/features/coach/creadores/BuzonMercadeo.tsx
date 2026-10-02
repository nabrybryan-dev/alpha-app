import { useId, useState } from 'react'
import { useSesionOpcional } from '../../../app/SessionProvider'
import { usePuestoCoach } from '../consola/usePuestoCoach'
import { FalloDeLectura } from '../../../components/ui/FalloDeLectura'
import { useLectura } from '../../../components/ui/useLectura'
import {
  moverRegla,
  preguntasDeMercadeo,
  responderBuzon,
  type EntradaReferencia,
  type PreguntaMercadeo,
} from '../../../data/consola/mercadeo'
import {
  DIAS_DE_VIGENCIA,
  MAXIMO_REFERENCIAS,
  NOMBRE_ESTADO_REGLA,
  NOMBRE_TIPO_REFERENCIA,
  REFERENCIAS_MINIMAS,
  TIPOS_REFERENCIA,
  contactoEnTexto,
  preguntaVencida,
  referenciasQueCuentan,
  reglaEfectiva,
  urlValida,
  type TipoReferencia,
} from '../../../domain/mercadeoManuela'

/**
 * «Buzón de mercadeo» de Estrategia (maqueta «Espacios de Alpha», 28-sep; migración 0096).
 *
 * Manuela ve las preguntas que Claude le dejó y responde con su texto y las referencias que
 * quiera (enlaces https con una nota de lo que se ve). El coach ve todas, con la respuesta,
 * las referencias y el ESTADO DE LA REGLA, y es el único que la mueve: una regla solo pasa a
 * vigente con 3 referencias distintas de reel, carrusel o historia destacada, firmada por él
 * y con caducidad a 60 días. Cada botón dice qué falta en vez de fallar callado.
 *
 * Estados honestos: cargando, error con «Reintentar» (nunca disfrazado de «sin preguntas»),
 * vacío confirmado. Sin salud, sin nombres, sin contactos: la respuesta y las notas no
 * admiten @ ni teléfonos.
 */

const CLASE_CAMPO =
  'min-h-[44px] w-full rounded-xl border border-linea bg-bg px-3 text-sm text-texto placeholder:text-tenue'

const hoyIso = () => new Date().toLocaleDateString('en-CA')

interface BorradorReferencia {
  clave: number
  tipo: TipoReferencia
  url: string
  nota: string
}

/** Lo que falta para poder enviar la respuesta, o null si está lista. */
function faltaParaEnviar(texto: string, refs: BorradorReferencia[]): string | null {
  if (texto.trim() === '') return 'Escribe tu respuesta.'
  const contacto = contactoEnTexto(texto)
  if (contacto) return `Tu respuesta trae ${contacto}: aquí no van contactos de nadie.`
  for (const [i, r] of refs.entries()) {
    const n = i + 1
    if (!urlValida(r.url.trim())) return `La referencia ${n} necesita un enlace que empiece por https://.`
    if (r.nota.trim().length < 5) return `La referencia ${n} necesita una nota de lo que se ve (mínimo 5 letras).`
    const c = contactoEnTexto(r.nota)
    if (c) return `La nota de la referencia ${n} trae ${c}.`
  }
  return null
}

function FormularioRespuesta({ pregunta, onListo }: { pregunta: PreguntaMercadeo; onListo: () => void }) {
  const id = useId()
  const [texto, setTexto] = useState('')
  const [refs, setRefs] = useState<BorradorReferencia[]>([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [siguiente, setSiguiente] = useState(1)

  const cambiar = (clave: number, parcial: Partial<BorradorReferencia>) =>
    setRefs((rs) => rs.map((r) => (r.clave === clave ? { ...r, ...parcial } : r)))

  const enviar = async () => {
    const falta = faltaParaEnviar(texto, refs)
    if (falta) {
      setError(falta)
      return
    }
    setEnviando(true)
    setError(null)
    const entradas: EntradaReferencia[] = refs.map((r) => ({ tipo: r.tipo, url: r.url.trim(), nota: r.nota.trim() }))
    const r = await responderBuzon(pregunta.id, texto.trim(), entradas)
    setEnviando(false)
    if (!r.ok) {
      // Lo escrito se conserva: no hay que volver a redactarlo.
      setError(r.error)
      return
    }
    onListo()
  }

  return (
    <form
      aria-label={`Responder ${pregunta.codigo}`}
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        void enviar()
      }}
    >
      <label htmlFor={`${id}-r`} className="flex flex-col gap-1 text-xs text-tenue">
        Tu respuesta
        <textarea id={`${id}-r`} rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} className={`${CLASE_CAMPO} py-2`} />
      </label>

      {refs.map((r, i) => (
        <fieldset key={r.clave} className="flex flex-col gap-2 rounded-xl border border-linea p-2.5">
          <legend className="px-1 text-xs text-tenue">Referencia {i + 1}</legend>
          <select aria-label={`Tipo de la referencia ${i + 1}`} className={CLASE_CAMPO} value={r.tipo} onChange={(e) => cambiar(r.clave, { tipo: e.target.value as TipoReferencia })}>
            {TIPOS_REFERENCIA.map((t) => (
              <option key={t} value={t}>{NOMBRE_TIPO_REFERENCIA[t]}</option>
            ))}
          </select>
          <input aria-label={`Enlace de la referencia ${i + 1}`} inputMode="url" className={CLASE_CAMPO} value={r.url} onChange={(e) => cambiar(r.clave, { url: e.target.value })} placeholder="https://" autoComplete="off" />
          <input aria-label={`Nota de la referencia ${i + 1}`} className={CLASE_CAMPO} value={r.nota} maxLength={280} onChange={(e) => cambiar(r.clave, { nota: e.target.value })} placeholder="Lo que se ve: segundo 1, texto en pantalla…" />
          <button type="button" onClick={() => setRefs((rs) => rs.filter((x) => x.clave !== r.clave))} className="press min-h-[44px] self-start text-xs text-tenue underline">
            Quitar esta referencia
          </button>
        </fieldset>
      ))}

      {refs.length < MAXIMO_REFERENCIAS && (
        <button
          type="button"
          onClick={() => {
            setRefs((rs) => [...rs, { clave: siguiente, tipo: 'reel', url: '', nota: '' }])
            setSiguiente((n) => n + 1)
          }}
          className="press min-h-[48px] rounded-boton border border-dashed border-tenue text-sm font-semibold text-texto"
        >
          + Añadir una referencia (enlace a un reel, artículo o curso)
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold text-rojo">
          {error}
        </p>
      )}
      <button type="submit" disabled={enviando} className="press min-h-[48px] rounded-boton bg-texto font-display text-[13px] uppercase text-bg disabled:opacity-50">
        {enviando ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  )
}

function ControlesDeRegla({ pregunta, onCambio }: { pregunta: PreguntaMercadeo; onCambio: () => void }) {
  const id = useId()
  const [enunciado, setEnunciado] = useState(pregunta.reglaEnunciado ?? '')
  const [trabajando, setTrabajando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const cuentan = referenciasQueCuentan(pregunta.referencias.map((r) => ({ tipo: r.tipo, urlNormalizada: r.urlNormalizada })))
  const faltan = Math.max(0, REFERENCIAS_MINIMAS - cuentan)
  const hoy = hoyIso()
  const efectiva = reglaEfectiva(pregunta.reglaEstado, pregunta.reglaRevisarAntesDe, hoy)
  const cerrada = pregunta.reglaEstado === 'retirada' || pregunta.reglaEstado === 'rechazada'
  const enunciadoOk = enunciado.trim().length >= 5 && !enunciado.includes('@')

  const mover = async (estado: 'propuesta' | 'vigente' | 'suspendida' | 'retirada' | 'rechazada') => {
    setTrabajando(true)
    setFallo(null)
    const r = await moverRegla(pregunta.id, estado, enunciado.trim() || undefined)
    setTrabajando(false)
    if (r.ok) onCambio()
    else setFallo(r.error)
  }

  if (pregunta.uso === 'solo_contexto') {
    return <p className="text-xs text-tenue">Pregunta de solo contexto: explica, no genera regla.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-tenue">
        Regla:{' '}
        <span className={efectiva === 'vigente' ? 'font-bold text-texto' : efectiva === 'caducada' ? 'font-bold text-rojo' : ''}>
          {NOMBRE_ESTADO_REGLA[efectiva]}
        </span>
        {pregunta.reglaCodigo ? ` · ${pregunta.reglaCodigo}` : ''}
        {pregunta.reglaEstado === 'vigente' && pregunta.reglaRevisarAntesDe ? ` · se revisa antes del ${pregunta.reglaRevisarAntesDe}` : ''}
      </p>
      {!cerrada && (
        <>
          <label htmlFor={`${id}-e`} className="flex flex-col gap-1 text-xs text-tenue">
            Enunciado de la regla (una frase, sin @)
            <input id={`${id}-e`} className={CLASE_CAMPO} value={enunciado} maxLength={240} onChange={(e) => setEnunciado(e.target.value)} />
          </label>
          <p className="text-xs text-tenue">
            Una regla pasa a vigente solo con {REFERENCIAS_MINIMAS} referencias distintas de reel, carrusel o historia
            (hay {cuentan}) y caduca a los {DIAS_DE_VIGENCIA} días.
            {faltan > 0 ? ` Faltan ${faltan}.` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {pregunta.reglaEstado === 'sin_regla' && (
              <button type="button" disabled={trabajando || !enunciadoOk} onClick={() => void mover('propuesta')} className="press min-h-[44px] rounded-boton border border-linea px-4 text-sm text-texto disabled:opacity-50">
                Proponer regla
              </button>
            )}
            <button type="button" disabled={trabajando || faltan > 0 || !enunciadoOk} onClick={() => void mover('vigente')} className="press min-h-[44px] rounded-boton bg-texto px-4 text-sm font-bold text-bg disabled:opacity-50">
              Aprobar como vigente
            </button>
            {pregunta.reglaEstado === 'vigente' && (
              <button type="button" disabled={trabajando} onClick={() => void mover('suspendida')} className="press min-h-[44px] rounded-boton border border-linea px-4 text-sm text-texto">
                Suspender
              </button>
            )}
            <button type="button" disabled={trabajando || !enunciadoOk} onClick={() => void mover(pregunta.reglaEstado === 'sin_regla' ? 'rechazada' : 'retirada')} className="press min-h-[44px] rounded-boton border border-rojo px-4 text-sm text-rojo disabled:opacity-50">
              {pregunta.reglaEstado === 'sin_regla' ? 'Rechazar' : 'Retirar'}
            </button>
          </div>
        </>
      )}
      {fallo && (
        <p role="alert" className="text-xs text-rojo">
          {fallo}
        </p>
      )}
    </div>
  )
}

function TarjetaPregunta({ p, esCoach, onCambio }: { p: PreguntaMercadeo; esCoach: boolean; onCambio: () => void }) {
  const hoy = hoyIso()
  const vencida = preguntaVencida(p.estado, p.venceEn, hoy)
  return (
    <li className="flex flex-col gap-2 border-t border-linea pt-3">
      <p className="text-sm font-semibold text-texto">
        <span className="mr-1.5 font-mono text-[11px] text-tenue">{p.codigo}</span>
        {p.texto}
      </p>
      {p.estado === 'pendiente' && !vencida && !esCoach && <FormularioRespuesta pregunta={p} onListo={onCambio} />}
      {p.estado === 'pendiente' && !vencida && esCoach && (
        <p className="text-xs text-tenue">Esperando la respuesta de Manuela · vence el {p.venceEn}.</p>
      )}
      {vencida && <p className="text-xs text-rojo">Esta pregunta venció el {p.venceEn} sin respuesta.</p>}
      {p.estado === 'descartada' && <p className="text-xs text-tenue">Pregunta descartada.</p>}
      {p.estado === 'respondida' && (
        <>
          <p className="whitespace-pre-line text-sm text-texto">{p.respuesta}</p>
          {p.referencias.length > 0 && (
            <ul aria-label={`Referencias de ${p.codigo}`} className="flex flex-col gap-1">
              {p.referencias.map((r) => (
                <li key={r.id} className="text-xs text-tenue">
                  {NOMBRE_TIPO_REFERENCIA[r.tipo]} ·{' '}
                  <a href={r.url} target="_blank" rel="noreferrer noopener" className="break-all underline">
                    {r.urlNormalizada.replace('https://', '')}
                  </a>{' '}
                  · {r.nota}
                </li>
              ))}
            </ul>
          )}
          {esCoach ? (
            <ControlesDeRegla pregunta={p} onCambio={onCambio} />
          ) : (
            <p className="text-xs text-tenue">
              Respondida. {p.uso === 'regla' ? `Regla: ${NOMBRE_ESTADO_REGLA[reglaEfectiva(p.reglaEstado, p.reglaRevisarAntesDe, hoy)]}.` : 'Solo contexto.'}
            </p>
          )}
        </>
      )}
    </li>
  )
}

export function BuzonMercadeo() {
  const yo = useSesionOpcional()?.usuario
  const { esCoach } = usePuestoCoach(yo?.rol)
  const { lectura, reintentar } = useLectura(preguntasDeMercadeo)
  if (!yo) return null

  return (
    <section
      aria-label="Buzón de mercadeo"
      className="flex flex-col gap-3 rounded-tarjeta border border-rojo bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-rojo">
          {esCoach ? 'Buzón de mercadeo · Manuela' : 'Tu buzón de mercadeo'}
        </h2>
        <p className="text-xs leading-snug text-tenue">
          {esCoach
            ? 'Las preguntas de Claude a Manuela, sus respuestas y referencias, y el estado de cada regla.'
            : 'Claude te pregunta; tus respuestas y referencias mejoran los cortes, los ganchos y las recomendaciones.'}{' '}
          Una respuesta pasa a regla solo con {REFERENCIAS_MINIMAS} referencias y fecha de caducidad.
        </p>
      </div>
      {lectura === null ? (
        <p className="text-sm text-tenue" aria-busy="true">Cargando el buzón…</p>
      ) : !lectura.ok ? (
        <FalloDeLectura texto={`No se pudo leer el buzón de mercadeo (${lectura.error}).`} onReintentar={reintentar} />
      ) : lectura.datos.length === 0 ? (
        <p className="text-sm text-tenue">
          {esCoach ? 'Todavía no hay preguntas en el buzón.' : 'No tienes preguntas por responder.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lectura.datos.map((p) => (
            <TarjetaPregunta key={p.id} p={p} esCoach={esCoach} onCambio={reintentar} />
          ))}
        </ul>
      )}
    </section>
  )
}
