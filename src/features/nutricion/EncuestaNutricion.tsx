import { useState } from 'react'
import {
  camposAPreguntar,
  revisarRespuestas,
  tieneValor,
  type CampoEncuesta,
  type ClaveCampo,
  type Respuestas,
} from '../../domain/nutricion/encuesta'

/**
 * La encuesta que abre el apartado de Nutrición.
 *
 * SOLO PREGUNTA LO QUE FALTA. Quien llegó con la encuesta de captación
 * respondida ve una pregunta; quien lleva meses y nunca la respondió las ve
 * todas. El formulario es el mismo y el criterio no está escrito a mano.
 *
 * SE PUEDE DEJAR A MEDIAS. Cada respuesta se guarda al salir del campo, no al
 * final. Alguien que abandone en la pregunta doce no pierde las once
 * anteriores: la encuesta es la puerta de entrada a Nutrición y perder el
 * avance ahí es perder a la persona.
 */

interface EncuestaNutricionProps {
  /** Lo que ya sabemos de esta persona. Esos campos no se preguntan. */
  yaSabidos: Respuestas
  /** Lo que lleva respondido de antes, si dejó la encuesta a medias. */
  enCurso?: Respuestas
  onGuardarAvance: (respuestas: Respuestas) => void
  onTerminar: (respuestas: Respuestas) => void
}

export function EncuestaNutricion({
  yaSabidos,
  enCurso = {},
  onGuardarAvance,
  onTerminar,
}: EncuestaNutricionProps) {
  const [respuestas, setRespuestas] = useState<Respuestas>(enCurso)
  const [intentado, setIntentado] = useState(false)

  // Se recalcula en cada render: al marcar "Mujer", la cadera y el ciclo
  // aparecen sin recargar nada.
  const campos = camposAPreguntar(yaSabidos, respuestas)
  const errores = revisarRespuestas(campos, respuestas)
  const errorDe = (clave: ClaveCampo) => errores.find((e) => e.clave === clave)?.mensaje

  const responder = (clave: ClaveCampo, valor: string | number | string[]) => {
    const siguiente = { ...respuestas, [clave]: valor }
    setRespuestas(siguiente)
    // Se guarda al vuelo, no al final: quien abandone a la mitad no empieza de cero.
    onGuardarAvance(siguiente)
  }

  const respondidas = campos.filter((c) => tieneValor(respuestas[c.clave])).length

  return (
    <div className="flex flex-col gap-5 pb-6">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
          Antes de empezar
        </p>
        <h1 className="font-display text-xl leading-tight text-texto">
          {campos.length === 1
            ? 'Nos falta un dato tuyo'
            : `Cuéntanos ${campos.length} cosas sobre ti`}
        </h1>
        <p className="mt-2 text-sm leading-snug text-tenue">
          Con esto calculamos tu composición corporal y cuánto necesitas comer. Se responde una
          sola vez.
        </p>
      </header>

      {campos.length > 3 && (
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-accion transition-all"
              style={{ width: `${(respondidas / campos.length) * 100}%` }}
            />
          </div>
          <span className="cifras shrink-0 text-[11px] text-tenue">
            {respondidas} de {campos.length}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {campos.map((campo) => (
          <Campo
            key={campo.clave}
            campo={campo}
            valor={respuestas[campo.clave]}
            error={intentado ? errorDe(campo.clave) : undefined}
            onResponder={(valor) => responder(campo.clave, valor)}
          />
        ))}
      </div>

      {intentado && errores.length > 0 && (
        <p role="alert" className="text-xs leading-snug text-accion">
          Faltan {errores.length} {errores.length === 1 ? 'respuesta' : 'respuestas'} por revisar.
        </p>
      )}

      <button
        type="button"
        onClick={() => {
          setIntentado(true)
          if (errores.length === 0) onTerminar(respuestas)
        }}
        className="press w-full rounded-2xl bg-accion py-4 font-display text-sm uppercase tracking-wide text-white"
      >
        Listo
      </button>
    </div>
  )
}

interface CampoProps {
  campo: CampoEncuesta
  valor: string | number | string[] | undefined
  error?: string
  onResponder: (valor: string | number | string[]) => void
}

function Campo({ campo, valor, error, onResponder }: CampoProps) {
  const idCampo = `campo-${campo.clave}`

  return (
    <div className="rounded-2xl border border-linea bg-surface-1 p-4">
      <label htmlFor={idCampo} className="block text-sm font-semibold leading-snug text-texto">
        {campo.etiqueta}
        {!campo.obligatorio && <span className="font-normal text-tenue"> · opcional</span>}
      </label>

      {/* El porqué se enseña siempre, no detrás de un icono: nadie contesta
          bien lo que no entiende, y una pregunta sin motivo se responde por
          salir del paso. */}
      {campo.porQue && (
        <p className="mt-1 text-[11px] leading-snug text-tenue">{campo.porQue}</p>
      )}

      <div className="mt-3">
        {campo.tipo === 'numero' && (
          <div className="flex items-baseline gap-2">
            <input
              id={idCampo}
              type="number"
              inputMode="numeric"
              value={valor === undefined ? '' : String(valor)}
              onChange={(e) => onResponder(e.target.value === '' ? '' : Number(e.target.value))}
              className="cifras w-32 rounded-xl border border-linea bg-surface-2 px-3 py-2 text-lg font-bold text-texto focus:border-accion focus:outline-none"
            />
            {campo.sufijo && <span className="text-xs text-tenue">{campo.sufijo}</span>}
          </div>
        )}

        {campo.tipo === 'fecha' && (
          <input
            id={idCampo}
            type="date"
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onResponder(e.target.value)}
            className="cifras rounded-xl border border-linea bg-surface-2 px-3 py-2 text-base text-texto focus:border-accion focus:outline-none"
          />
        )}

        {campo.tipo === 'texto' && (
          <input
            id={idCampo}
            type="text"
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onResponder(e.target.value)}
            className="w-full rounded-xl border border-linea bg-surface-2 px-3 py-2 text-sm text-texto focus:border-accion focus:outline-none"
          />
        )}

        {campo.tipo === 'opcion' && campo.opciones && (
          <div className="flex flex-wrap gap-2">
            {campo.opciones.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                aria-pressed={valor === opcion.valor}
                onClick={() => onResponder(opcion.valor)}
                className={`press rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                  valor === opcion.valor
                    ? 'border-accion bg-accion/15 text-texto'
                    : 'border-linea bg-surface-2 text-tenue'
                }`}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>
        )}

        {campo.tipo === 'multiple' && campo.opciones && (
          <div className="flex flex-wrap gap-2">
            {campo.opciones.map((opcion) => {
              const marcadas = Array.isArray(valor) ? valor : []
              const activa = marcadas.includes(opcion.valor)
              return (
                <button
                  key={opcion.valor}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => {
                    // "Ninguna" y el resto se excluyen: marcar las dos cosas
                    // deja una respuesta que se contradice a sí misma.
                    const esNinguna = opcion.valor === 'ninguna' || opcion.valor === 'nada'
                    if (esNinguna) return onResponder([opcion.valor])
                    const sinNinguna = marcadas.filter((v) => v !== 'ninguna' && v !== 'nada')
                    onResponder(
                      activa
                        ? sinNinguna.filter((v) => v !== opcion.valor)
                        : [...sinNinguna, opcion.valor],
                    )
                  }}
                  className={`press rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                    activa
                      ? 'border-accion bg-accion/15 text-texto'
                      : 'border-linea bg-surface-2 text-tenue'
                  }`}
                >
                  {opcion.etiqueta}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-[11px] font-semibold text-accion">{error}</p>
      )}
    </div>
  )
}
