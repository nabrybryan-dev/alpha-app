import { useState } from 'react'
import { Chip } from '../../components/ui/Chip'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { borrarClave, escribirJSON, leerJSON } from '../../lib/persistencia'
import type { ResultadoCribado } from '../../data/repos'
import type { Cribado, EstadoCribado } from '../../domain/types'

/**
 * El cribado de salud: las doce preguntas que abren o cierran la puerta clínica.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * «NO» SE MARCA. NO SE DEJA EN BLANCO.
 * ────────────────────────────────────────────────────────────────────────────
 * Las doce son obligatorias porque `ausente` («se le preguntó y no tiene») y
 * `no_declarado` («no se le preguntó») no son lo mismo, y toda la tabla 0058 está
 * construida sobre esa distinción. Un formulario que dejara saltar una pregunta
 * guardaría un hueco donde el coach leería un «no».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * EL BORRADOR, QUE NO ES UN LUJO
 * ────────────────────────────────────────────────────────────────────────────
 * Doce preguntas se contestan en el vestuario, y en el vestuario te llaman. Hasta
 * hoy, contestar diez y cerrar la hoja dejaba cero: había que teclear las diez otra
 * vez, y la segunda vez ya no se hace. Cada toque se guarda en el teléfono con la
 * misma pieza que usa el registro de series, y se borra al enviar.
 *
 * Riesgo 8 de `docs/riesgos/RIESGOS-preguntas-y-cribado.md`.
 */

/** Una pregunta del cribado, en las palabras con las que se le habla a una persona. */
interface PreguntaCribado {
  /** La clave del campo en `Cribado`. Es lo que ata la pantalla a la tabla. */
  clave: string
  enunciado: string
  /** Qué se le pide escribir cuando dice que sí. Vacío = no se le pide nada. */
  detalle?: string
  /** Un «sí» aquí no se puede quedar sin explicar: el coach no puede decidir con un sí a secas. */
  detalleObligatorio?: boolean
}

/** Los nueve de la entrada mínima (I-23). Un «sí» es `presente`; un «no», `ausente`. */
const NUEVE: readonly PreguntaCribado[] = [
  {
    clave: 'sintomasConEsfuerzo',
    enunciado: '¿Has notado dolor o presión en el pecho, o mareo hasta casi perder el conocimiento?',
    detalle: '¿Qué notaste, y haciendo qué?',
    detalleObligatorio: true,
  },
  {
    clave: 'medicacionCronica',
    enunciado: '¿Tomas alguna medicación de forma habitual?',
    detalle: '¿Cuál, y para qué?',
    detalleObligatorio: true,
  },
  {
    clave: 'diagnostico',
    enunciado: '¿Tienes algún diagnóstico médico?',
    detalle: '¿Cuál?',
    detalleObligatorio: true,
  },
  {
    clave: 'queLeHanDichoQueNoHaga',
    enunciado: '¿Un médico o un fisio te ha dicho alguna vez que no hagas algo?',
    detalle: '¿Qué te dijeron que no hicieras?',
    detalleObligatorio: true,
  },
  {
    clave: 'restriccionesExplicitas',
    enunciado: '¿Tienes alguna restricción puesta por escrito?',
    detalle: '¿Cuál?',
    detalleObligatorio: true,
  },
  {
    clave: 'tratamientoActivo',
    enunciado: '¿Estás en tratamiento ahora mismo?',
    detalle: '¿De qué?',
  },
  {
    clave: 'quienLoLleva',
    enunciado: '¿Hay un médico o un fisio que te lleve?',
    detalle: '¿Quién, y cada cuánto lo ves?',
  },
  {
    clave: 'autorizacionSanitaria',
    enunciado: '¿Alguien del ámbito sanitario te ha autorizado a entrenar?',
    detalle: '¿Quién, y cuándo?',
  },
  {
    clave: 'nivelFuncional',
    enunciado: '¿Hay algo del día a día que hoy no puedas hacer?',
    detalle: '¿Qué?',
  },
]

/** Los tres del PAR-Q. Un «sí» es `true`; un «no», `false`. Ausente sería «no se preguntó». */
const PARQ: readonly PreguntaCribado[] = [
  {
    clave: 'parqEnfermedadCardiaca',
    enunciado: '¿Te han dicho alguna vez que tienes algo del corazón?',
    detalle: '¿Qué te dijeron?',
    detalleObligatorio: true,
  },
  {
    clave: 'parqMedicamentoPresion',
    enunciado: '¿Tomas medicación para la tensión?',
    detalle: '¿Cuál?',
  },
  {
    clave: 'parqHuesosArticulaciones',
    enunciado: '¿Tienes algo de huesos o articulaciones que empeore al moverte?',
    detalle: '¿Qué, y dónde?',
    detalleObligatorio: true,
  },
]

const TODAS = [...NUEVE, ...PARQ]

interface Borrador {
  respuestas: Record<string, 'si' | 'no'>
  detalle: Record<string, string>
}

const VACIO: Borrador = { respuestas: {}, detalle: {} }

/** Una clave por persona: en un teléfono compartido, el borrador de una no es el de la otra. */
const claveBorrador = (usuarioId: string) => `alpha-cribado-${usuarioId}`

/**
 * ¿Esta persona tiene el cribado empezado y sin terminar?
 *
 * Lo pregunta HoyPage para NO desmontarle el formulario a media pregunta. Hasta hoy la
 * tarjeta se pintaba solo mientras `necesitaCribado` fuera cierto, y esa condición se
 * apaga en cuanto llega de arriba la ficha que volcó el coach: quien estuviera
 * contestando las doce preguntas veía **desaparecer el formulario sin una palabra**, y el
 * aviso escrito para ese caso exacto —«esto ya estaba contestado»— no llegaba a
 * renderizarse nunca, porque hace falta pulsar «Responder» para producirlo.
 */
export function hayBorradorDeCribado(usuarioId: string): boolean {
  const b = leerJSON<Borrador>(claveBorrador(usuarioId), VACIO)
  return Object.keys(b.respuestas).length > 0
}

interface CribadoFormProps {
  usuarioId: string
  /**
   * La ficha ya está arriba: contestar no serviría de nada.
   *
   * No se descubre desde dentro —quien lo sabe es el padre, que es el que consulta
   * `necesitaCribado`—, y hace falta decirlo en vez de desmontar la tarjeta.
   */
  yaNoHaceFalta?: boolean
  /** Se llama solo cuando la respuesta quedó guardada de verdad. */
  onGuardado?: () => void
  contestar: (cribado: Cribado) => ResultadoCribado
  hoyIso: string
}

export function CribadoForm({
  usuarioId,
  onGuardado,
  contestar,
  hoyIso,
  yaNoHaceFalta,
}: CribadoFormProps) {
  const [borrador, setBorrador] = useState<Borrador>(() =>
    leerJSON<Borrador>(claveBorrador(usuarioId), VACIO),
  )
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<'ya_estaba' | 'error' | undefined>()
  const [intento, setIntento] = useState(false)

  const guardar = (siguiente: Borrador) => {
    setBorrador(siguiente)
    escribirJSON(claveBorrador(usuarioId), siguiente)
  }

  const responder = (clave: string, valor: 'si' | 'no') =>
    guardar({
      respuestas: { ...borrador.respuestas, [clave]: valor },
      // Un «no» se lleva por delante lo que se hubiera escrito antes: si ya no
      // aplica, ese texto no puede viajar a la base pegado a un «no».
      detalle:
        valor === 'no'
          ? Object.fromEntries(Object.entries(borrador.detalle).filter(([k]) => k !== clave))
          : borrador.detalle,
    })

  const escribirDetalle = (clave: string, texto: string) =>
    guardar({ respuestas: borrador.respuestas, detalle: { ...borrador.detalle, [clave]: texto } })

  const contestadas = TODAS.filter((p) => borrador.respuestas[p.clave]).length
  const detallesQueFaltan = TODAS.filter(
    (p) =>
      p.detalleObligatorio &&
      borrador.respuestas[p.clave] === 'si' &&
      !borrador.detalle[p.clave]?.trim(),
  )
  const completo = contestadas === TODAS.length && detallesQueFaltan.length === 0

  const enviar = () => {
    if (!completo) {
      setIntento(true)
      return
    }
    setEnviando(true)
    setAviso(undefined)
    try {
      const estados = Object.fromEntries(
        NUEVE.map((p) => [
          p.clave,
          (borrador.respuestas[p.clave] === 'si' ? 'presente' : 'ausente') as EstadoCribado,
        ]),
      )
      const parq = Object.fromEntries(
        PARQ.map((p) => [p.clave, borrador.respuestas[p.clave] === 'si']),
      )
      const detalle = Object.fromEntries(
        Object.entries(borrador.detalle)
          .filter(([clave, texto]) => borrador.respuestas[clave] === 'si' && texto.trim())
          .map(([clave, texto]) => [clave, texto.trim()]),
      )
      const resultado = contestar({
        usuarioId,
        fecha: hoyIso,
        fuente: 'app',
        ...estados,
        ...parq,
        detalle,
      } as Cribado)

      // El borrador se limpia en los dos casos que terminan: si se guardó, ya está
      // en la base; si ya estaba, no va a entrar nunca y guardarlo solo deja datos
      // de salud en el teléfono.
      borrarClave(claveBorrador(usuarioId))
      if (resultado === 'ya_estaba') setAviso('ya_estaba')
      else onGuardado?.()
    } catch {
      // No se limpia el borrador: es justo el caso en el que hay que conservarlo.
      setAviso('error')
    } finally {
      setEnviando(false)
    }
  }

  if (aviso === 'ya_estaba' || yaNoHaceFalta) {
    return (
      <div role="status" className="rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
        <p className="font-display text-base text-texto">Esto ya estaba contestado</p>
        <p className="mt-1 text-sm text-tenue">
          Tu coach ya tiene tus respuestas, así que no hemos guardado estas. Si algo ha cambiado
          en tu salud, escríbeselo por el chat: cambiarlo lo hace él.
        </p>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
      <header>
        <h2 className="font-display text-lg text-texto">Antes de seguir, tu salud</h2>
        <p className="mt-1 text-sm text-tenue">
          Doce preguntas, una sola vez. A casi todo el mundo le salen «no», y ese «no» hay que
          marcarlo igual: dejarlo en blanco no es lo mismo que decir que no.
        </p>
      </header>

      <div>
        <ProgressBar pct={(contestadas / TODAS.length) * 100} etiqueta="Progreso del cribado" />
        <p className="mt-1 text-xs text-tenue">
          {contestadas} de {TODAS.length} contestadas
        </p>
      </div>

      {TODAS.map((pregunta, indice) => {
        const valor = borrador.respuestas[pregunta.clave]
        const faltaDetalle = intento && detallesQueFaltan.some((p) => p.clave === pregunta.clave)
        return (
          <fieldset key={pregunta.clave}>
            <legend className="mb-2 text-sm font-bold text-texto">
              {indice + 1}. {pregunta.enunciado}
            </legend>
            <div className="flex gap-2">
              <Chip
                etiqueta="Sí"
                seleccionado={valor === 'si'}
                onSeleccionar={() => responder(pregunta.clave, 'si')}
              />
              <Chip
                etiqueta="No"
                seleccionado={valor === 'no'}
                onSeleccionar={() => responder(pregunta.clave, 'no')}
              />
            </div>

            {valor === 'si' && pregunta.detalle && (
              <label className="mt-2 block">
                <span className="text-xs text-tenue">{pregunta.detalle}</span>
                <input
                  value={borrador.detalle[pregunta.clave] ?? ''}
                  onChange={(e) => escribirDetalle(pregunta.clave, e.target.value)}
                  className={`mt-1 w-full rounded-xl border bg-surface-2 px-3 py-2.5 text-sm text-texto placeholder:text-tenue focus:outline-none ${
                    faltaDetalle ? 'border-rojo' : 'border-linea focus:border-rojo'
                  }`}
                  placeholder="En una línea"
                />
                {faltaDetalle && (
                  <span className="mt-1 block text-xs font-bold text-rojo">
                    Con un «sí» a secas no puedo decidir nada. Dime qué es.
                  </span>
                )}
              </label>
            )}
          </fieldset>
        )
      })}

      {aviso === 'error' && (
        <p role="alert" className="text-sm font-bold text-rojo">
          No se pudo guardar. Lo que llevas escrito sigue aquí: inténtalo otra vez.
        </p>
      )}

      {intento && !completo && aviso !== 'error' && (
        <p role="alert" className="text-center text-xs font-bold text-rojo">
          {contestadas < TODAS.length
            ? `Te faltan ${TODAS.length - contestadas} por contestar`
            : `Te falta explicar ${detallesQueFaltan.length}`}
        </p>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="press rounded-boton bg-accion py-3.5 font-display text-base uppercase tracking-wide text-white disabled:opacity-40"
      >
        {enviando ? 'Guardando…' : 'Enviar'}
      </button>
    </section>
  )
}
