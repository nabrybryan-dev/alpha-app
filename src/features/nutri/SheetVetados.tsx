import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'
import { db, useDbVersion } from '../../data/dbInstance'
import type { Respuestas } from '../../domain/nutricion/encuesta'

/**
 * Donde la nutricionista traduce «soy alérgica a los mariscos» a alimentos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTA PANTALLA TIENE QUE EXISTIR
 * ─────────────────────────────────────────────────────────────────────────────
 * La encuesta recoge alergias, exclusiones y disgustos en TEXTO LIBRE, y este
 * repo se niega a interpretarlo: no hay forma fiable de convertir una frase en
 * una lista de ids —«mariscos» no está en ningún nombre del catálogo, y «leche»
 * casa con «leche de coco»— y equivocarse ahí es proponerle a alguien lo que le
 * hace daño. `importarIntake` lo dice desde que se escribió: las alergias
 * llegan sin interpretar «para que las codifique la nutricionista».
 *
 * Esto es ese sitio. Sin él, lo que ella escribió se queda en un texto que nadie
 * lee y la app le propone cambios sin saber nada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SE ENSEÑA EL TEXTO CRUDO ARRIBA, Y NO ES DECORACIÓN
 * ─────────────────────────────────────────────────────────────────────────────
 * Es contra lo que Manuela traduce. Sin tenerlo a la vista tendría que
 * acordarse de lo que dijo cada una, y lo que se traduce de memoria se traduce
 * mal. Va tal cual lo escribió la asesorada, sin limpiar ni resumir.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTO NO IMPIDE REGISTRAR. NUNCA
 * ─────────────────────────────────────────────────────────────────────────────
 * Regla R6, sin excepciones. Si alguien con alergia al marisco se comió
 * marisco, lo que hace falta es que quede anotado y que el coach lo vea, no que
 * el diario se lo impida y el dato se pierda. Un veto decide qué se PROPONE.
 */

const TOPE_RESULTADOS = 8

/**
 * Lo mínimo para que un motivo sea un motivo y no un punto para salir del paso.
 *
 * Es el mismo umbral que el `check` de la migración 0040. Si cambia uno, cambia
 * el otro: si la pantalla dejara pasar menos de lo que acepta la base, el veto
 * se guardaría en el dispositivo y reventaría al subir —y lo que revienta al
 * subir se encola, y la cola de descartados tiene tope.
 */
const MOTIVO_MINIMO = 3

const motivoSuficiente = (motivo: string) => motivo.trim().length >= MOTIVO_MINIMO

interface SheetVetadosProps {
  /** El asesorado cuyo panel está abierto. `null` cierra la hoja. */
  asesoradoId: string | null
  nombre: string
  onCerrar: () => void
}

/** Lo que ella escribió en texto libre, para traducir mirándolo. */
function loQueEllaEscribio(respuestas: Respuestas): { etiqueta: string; texto: string }[] {
  const comoTexto = (valor: unknown): string =>
    Array.isArray(valor) ? valor.join(', ') : typeof valor === 'string' ? valor : ''

  return [
    { etiqueta: 'Alergias', texto: comoTexto(respuestas.alergias) },
    { etiqueta: 'Condiciones', texto: comoTexto(respuestas.condicionesMedicas) },
    { etiqueta: 'Excluye', texto: comoTexto(respuestas.excluye) },
    { etiqueta: 'No le gustan', texto: comoTexto(respuestas.noLeGustan) },
    { etiqueta: 'Sin acceso', texto: comoTexto(respuestas.sinAcceso) },
  ].filter((fila) => fila.texto.trim() !== '')
}

export function SheetVetados({ asesoradoId, nombre, onCerrar }: SheetVetadosProps) {
  useDbVersion()
  const [consulta, setConsulta] = useState('')
  // Elegir el alimento ya no lo veta: abre el paso del motivo. Son dos pasos a
  // propósito —antes bastaba un toque— porque un veto sin motivo es una decisión
  // clínica que dentro de tres meses nadie sabe explicar.
  const [elegido, setElegido] = useState<{ id: string; nombre: string } | null>(null)
  const [motivo, setMotivo] = useState('')

  if (!asesoradoId) return null

  const vetados = db.vetados.byUsuario(asesoradoId)
  const yaVetados = new Set(vetados.map((v) => v.alimentoId))
  const respuestas = (db.perfilNutricion.byUsuario(asesoradoId)?.respuestas ?? {}) as Respuestas
  const declarado = loQueEllaEscribio(respuestas)

  // Los ya vetados no salen en la búsqueda: volver a marcar lo marcado no hace
  // nada y ocupa el sitio de lo que todavía falta.
  const resultados =
    consulta.trim().length < 2
      ? []
      : catalogoRepo
          .buscar(consulta, undefined, TOPE_RESULTADOS + vetados.length)
          .filter((a) => !yaVetados.has(a.id))
          .slice(0, TOPE_RESULTADOS)

  return (
    <Sheet abierto titulo={`Lo que ${nombre} no debe comer`} onCerrar={onCerrar}>
      {declarado.length > 0 && (
        <div className="rounded-2xl border border-linea bg-surface-2 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
            Lo que ella escribió
          </p>
          <dl className="mt-2 flex flex-col gap-1">
            {declarado.map((fila) => (
              <div key={fila.etiqueta} className="flex gap-2 text-[11px] leading-snug">
                <dt className="shrink-0 text-tenue">{fila.etiqueta}:</dt>
                <dd className="min-w-0 flex-1 text-texto">{fila.texto}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <label htmlFor="buscar-veto" className="mt-4 block text-xs font-semibold text-texto">
        Buscar el alimento en el catálogo
      </label>
      <input
        id="buscar-veto"
        type="search"
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        placeholder="camarón, leche, maní…"
        className="mt-1 w-full rounded-2xl border border-linea bg-surface-2 px-3 py-2 text-sm text-texto"
      />

      {elegido && (
        <div className="mt-2 rounded-2xl border border-accion bg-surface-2 p-3">
          <p className="text-sm font-semibold leading-snug text-texto">{elegido.nombre}</p>

          <label htmlFor="motivo-veto" className="mt-3 block text-xs font-semibold text-texto">
            ¿Por qué no puede comerlo?
          </label>
          <p className="mt-1 text-[11px] leading-snug text-tenue">
            Lo va a leer quien revise esto dentro de tres meses. «Alergia declarada en la
            encuesta» sirve; «no puede» no dice nada.
          </p>
          <input
            id="motivo-veto"
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="alergia, condición médica, indicación del médico…"
            className="mt-2 w-full rounded-2xl border border-linea bg-surface-1 px-3 py-2 text-sm text-texto"
          />

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!motivoSuficiente(motivo)}
              onClick={() => {
                db.vetados.vetar({
                  usuarioId: asesoradoId,
                  alimentoId: elegido.id,
                  motivo: motivo.trim(),
                })
                setElegido(null)
                setMotivo('')
                setConsulta('')
              }}
              className="press flex-1 rounded-2xl bg-accion py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Vetar
            </button>
            <button
              type="button"
              onClick={() => {
                setElegido(null)
                setMotivo('')
              }}
              className="press rounded-2xl border border-linea px-4 py-2 text-xs font-semibold text-tenue"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!elegido && resultados.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {resultados.map((alimento) => (
            <li key={alimento.id}>
              <button
                type="button"
                onClick={() => {
                  setElegido({ id: alimento.id, nombre: alimento.nombre })
                  setMotivo('')
                }}
                className="press flex w-full items-center gap-2 rounded-2xl border border-linea bg-surface-1 p-2 text-left"
              >
                <span className="min-w-0 flex-1 text-sm leading-snug text-texto">
                  {alimento.nombre}
                </span>
                <span className="shrink-0 text-xs font-semibold text-accion">Vetar</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
        Vetados ({vetados.length})
      </p>

      {vetados.length === 0 ? (
        <p className="mt-2 text-[11px] leading-snug text-tenue">
          Todavía ninguno. Mientras esté vacío, la app le propone cambios de su plan sin saber
          qué no puede comer.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {vetados.map((veto) => {
            const alimento = catalogoRepo.porId(veto.alimentoId)
            return (
              <li
                key={veto.alimentoId}
                className="flex items-center gap-2 rounded-2xl border border-linea bg-surface-2 p-2"
              >
                <span className="min-w-0 flex-1 text-sm leading-snug text-texto">
                  {/* Si el alimento ya no está en el catálogo se enseña su id:
                      un veto que no se puede leer tampoco se puede quitar. */}
                  {alimento?.nombre ?? veto.alimentoId}
                </span>
                <button
                  type="button"
                  onClick={() => db.vetados.quitar(asesoradoId, veto.alimentoId)}
                  aria-label={`Quitar el veto de ${alimento?.nombre ?? veto.alimentoId}`}
                  className="press h-7 w-7 shrink-0 rounded-full border border-linea text-sm text-tenue"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 text-[10px] leading-snug text-tenue">
        Esto decide qué se le <b className="text-texto">propone</b>, no qué puede registrar. Si
        se lo comió, tiene que poder anotarlo.
      </p>
    </Sheet>
  )
}
