import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Chip } from '../../components/ui/Chip'
import { clienteDelEnlace, codigoDelEnlace } from '../../domain/interesados/codigo'
import {
  CASILLAS,
  construirEnvio,
  DECLARACION,
  DIAS,
  ENUNCIADOS,
  EXPECTATIVAS,
  FECHA_VERSION_AUTORIZACION,
  HORARIOS,
  LUGARES,
  MODALIDADES,
  VERSION_AUTORIZACION,
  type Borrador,
  type Opcion,
  type RespuestasEncaje,
} from '../../domain/interesados/formulario'
import { enviarInteresado } from '../../data/interesados/enviarInteresado'

/**
 * El espacio de los interesados que llegan por un creador: `/interesados?codigo=XXXX`.
 *
 * Es PÚBLICO (no hay sesión: quien llega aún no es asesorado), así que `App.tsx` lo monta
 * por fuera de `SessionProvider`. Sigue el patrón del cribado (`CribadoForm`): chips de
 * opción cerrada, «no» se marca y no se deja en blanco, y la validación vive en el
 * dominio (`domain/interesados/formulario.ts`), no aquí.
 *
 * LO QUE ESTA PANTALLA NO TIENE, A PROPÓSITO:
 *   - ningún `<input>` de texto ni `<textarea>`: solo botones (PASO-A-PASO, «Puerta del
 *     campo libre»). Hay un test que lo cuenta.
 *   - ninguna pregunta de salud, marque lo que marque: las casillas A–C autorizan a
 *     preguntar DESPUÉS, fuera de este formulario.
 *   - borrador en el teléfono: el cribado lo guarda porque son doce preguntas; aquí son
 *     cinco toques, y cada copia local es una copia más que habría que borrar.
 */

const VACIO: Borrador = { encaje: {}, casillas: {}, declaracion: false }

/** Lo que falta, dicho como lo lee la persona y no con el nombre de la columna. */
const NOMBRE_DE_LO_QUE_FALTA: Record<string, string> = {
  p1Dias: 'los días (pregunta 1)',
  p1Horarios: 'los horarios (pregunta 1)',
  p2Lugar: 'el lugar (pregunta 2)',
  p2Modalidad: 'la modalidad (pregunta 2)',
  p3Expectativa: 'la pregunta 3',
}

function nuevoEnvioId(): string {
  return crypto.randomUUID()
}

function GrupoOpciones({
  titulo,
  opciones,
  valor,
  onElegir,
}: {
  titulo: string
  opciones: readonly Opcion[]
  valor?: string
  onElegir: (codigo: string) => void
}) {
  return (
    <div role="group" aria-label={titulo} className="flex flex-wrap gap-2">
      {opciones.map((o) => (
        <Chip
          key={o.codigo}
          etiqueta={o.etiqueta}
          seleccionado={valor === o.codigo}
          onSeleccionar={() => onElegir(o.codigo)}
        />
      ))}
    </div>
  )
}

export default function InteresadosPage() {
  const [parametros] = useSearchParams()
  const codigo = useMemo(() => codigoDelEnlace(parametros.get('codigo')), [parametros])
  const clienteId = useMemo(() => clienteDelEnlace(parametros.get('cliente')), [parametros])
  // Uno por visita: si el guardado se corta a medias, el reintento usa el MISMO id y la
  // base no duplica la respuesta (ver `enviarInteresado`).
  const [envioId] = useState(nuevoEnvioId)
  const [borrador, setBorrador] = useState<Borrador>(VACIO)
  const [estado, setEstado] = useState<'editando' | 'enviando' | 'guardado' | 'error'>('editando')
  const [faltan, setFaltan] = useState<string[]>([])

  const responder = (clave: keyof RespuestasEncaje, codigoOpcion: string) =>
    setBorrador((b) => ({ ...b, encaje: { ...b.encaje, [clave]: codigoOpcion } }))
  const marcar = (letra: string, valor: 'si' | 'no') =>
    setBorrador((b) => ({ ...b, casillas: { ...b.casillas, [letra]: valor } }))

  const enviar = async () => {
    const resultado = construirEnvio(borrador, { envioId, codigo, clienteId })
    if (!resultado.ok) {
      setFaltan([...resultado.faltan, ...resultado.rechazadas])
      return
    }
    setFaltan([])
    setEstado('enviando')
    try {
      await enviarInteresado(resultado.envio)
      setEstado('guardado')
    } catch {
      setEstado('error')
    }
  }

  if (estado === 'guardado') {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-4">
        <div role="status" className="max-w-md rounded-tarjeta border border-linea bg-surface-1 p-5 shadow-sm">
          <p className="font-display text-lg text-texto">¡Listo, gracias!</p>
          <p className="mt-2 text-sm text-tenue">
            Recibimos tus respuestas. Te escribimos por WhatsApp para seguir.
          </p>
        </div>
      </main>
    )
  }

  const e = borrador.encaje
  return (
    <main className="min-h-dvh bg-bg px-4 py-6">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <header>
          <p className="kicker">Alpha Athletics</p>
          <h1 className="font-display text-2xl text-texto">Antes de empezar</h1>
          <p className="mt-1 text-sm text-tenue">
            Tres preguntas para ver si lo que hacemos te sirve, y tu decisión sobre tus datos.
          </p>
          {codigo && (
            <p className="mt-2 text-xs text-tenue">
              Código: <span className="font-bold text-texto">{codigo}</span>
            </p>
          )}
        </header>

        <section className="flex flex-col gap-4 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-texto">{ENUNCIADOS.p1}</legend>
            <GrupoOpciones titulo="Días" opciones={DIAS} valor={e.p1Dias} onElegir={(c) => responder('p1Dias', c)} />
            <GrupoOpciones titulo="Horarios" opciones={HORARIOS} valor={e.p1Horarios} onElegir={(c) => responder('p1Horarios', c)} />
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-bold text-texto">{ENUNCIADOS.p2}</legend>
            <GrupoOpciones titulo="Lugar" opciones={LUGARES} valor={e.p2Lugar} onElegir={(c) => responder('p2Lugar', c)} />
            <GrupoOpciones titulo="Modalidad" opciones={MODALIDADES} valor={e.p2Modalidad} onElegir={(c) => responder('p2Modalidad', c)} />
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-texto">{ENUNCIADOS.p3}</legend>
            <GrupoOpciones titulo="Qué esperas" opciones={EXPECTATIVAS} valor={e.p3Expectativa} onElegir={(c) => responder('p3Expectativa', c)} />
          </fieldset>
          <p className="text-xs text-tenue">{ENUNCIADOS.sinSalud}</p>
        </section>

        <section className="flex flex-col gap-4 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm">
          <header>
            <h2 className="font-display text-lg text-texto">Tu decisión sobre tus datos</h2>
            <p className="mt-1 text-sm text-tenue">
              Una casilla por finalidad. Nada viene marcado: marca «Sí» o «No» en cada una.
              Responder sobre datos de salud es voluntario.
            </p>
          </header>
          {CASILLAS.map((c) => (
            <fieldset key={c.letra}>
              <legend className="mb-2 text-sm text-texto">
                <span className="font-bold">{c.letra}.</span> {c.texto}
              </legend>
              {c.alcance && <p className="mb-2 text-xs text-tenue">{c.alcance}</p>}
              <div role="group" aria-label={`Casilla ${c.letra}`} className="flex gap-2">
                <Chip etiqueta="Sí" seleccionado={borrador.casillas[c.letra] === 'si'} onSeleccionar={() => marcar(c.letra, 'si')} />
                <Chip etiqueta="No" seleccionado={borrador.casillas[c.letra] === 'no'} onSeleccionar={() => marcar(c.letra, 'no')} />
              </div>
            </fieldset>
          ))}
          <div role="group" aria-label="Declaración">
            <Chip
              etiqueta="Acepto la declaración"
              seleccionado={borrador.declaracion}
              onSeleccionar={() => setBorrador((b) => ({ ...b, declaracion: !b.declaracion }))}
            />
            <p className="mt-2 text-xs text-tenue">{DECLARACION}</p>
          </div>
          <p className="text-xs text-tenue">
            Versión del texto: {VERSION_AUTORIZACION} ({FECHA_VERSION_AUTORIZACION}) · Canal: formulario
          </p>
        </section>

        {faltan.length > 0 && (
          <p role="alert" className="text-center text-xs font-bold text-rojo">
            Te falta: {faltan.map((f) => NOMBRE_DE_LO_QUE_FALTA[f] ?? f).join(', ')}
          </p>
        )}
        {estado === 'error' && (
          <p role="alert" className="text-sm font-bold text-rojo">
            No se pudo guardar. Tus respuestas siguen aquí: inténtalo otra vez.
          </p>
        )}

        <button
          type="button"
          onClick={() => void enviar()}
          disabled={estado === 'enviando'}
          className="press rounded-boton bg-accion py-3.5 font-display text-base uppercase tracking-wide text-white disabled:opacity-40"
        >
          {estado === 'enviando' ? 'Guardando…' : 'Enviar'}
        </button>
      </div>
    </main>
  )
}
