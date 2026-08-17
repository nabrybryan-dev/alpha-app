import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { db, hoyIso } from '../../data/dbInstance'
import { sumarDias } from '../../domain/activacion'
import { inicioProximaSemana } from '../../domain/calendario'
import type { Microciclo } from '../../domain/types'
import { microcicloPropuesto, proponerMicrociclo, type PropuestaMicrociclo } from './propuestaMicrociclo'
import { datosRutaDe } from '../../data/ruta/datosRuta'
import { peldanoAlcanzado, peldanoTrasMicrociclo } from '../../domain/nivelesAlfa'

interface GenerarMicrocicloSheetProps {
  abierto: boolean
  nombreAsesorado: string
  /** Microciclo del que se parte. Sin él no hay nada de donde ondular. */
  microciclo?: Microciclo
  onCerrar: () => void
}

const FLECHA = { subir: '▲', bajar: '▼', estable: '=', 'sin-datos': '·' } as const

/** Cuándo arranca lo que se está programando. */
type Arranque = 'a-continuacion' | 'proxima-semana'

export function GenerarMicrocicloSheet({
  abierto,
  nombreAsesorado,
  microciclo,
  onCerrar,
}: GenerarMicrocicloSheetProps) {
  const propuesta = microciclo ? proponerMicrociclo(microciclo) : undefined
  const [guardada, setGuardada] = useState(false)
  const [arranque, setArranque] = useState<Arranque>('a-continuacion')

  const hoy = hoyIso()
  /**
   * La fecha que va a llevar el microciclo. Se calcula aquí y se enseña porque
   * programar a ciegas es como nacía el bug de la propuesta vencida: el coach no
   * veía qué fecha le estaba poniendo a la semana de alguien.
   */
  const finActual = microciclo
    ? sumarDias(microciclo.fechaInicio, microciclo.cadenciaDias)
    : undefined
  const fechaInicio =
    arranque === 'proxima-semana'
      ? inicioProximaSemana(hoy)
      : finActual && finActual > hoy
        ? finActual
        : hoy

  const guardar = () => {
    if (!microciclo) return
    // `hoy` evita que la propuesta nazca con la fecha del microciclo de origen, es
    // decir vencida. Ver el encabezado de `microcicloPropuesto`.
    db.microciclos.guardarPropuesta(
      microcicloPropuesto(microciclo, {
        hoy,
        ...(arranque === 'proxima-semana' ? { fechaInicio } : {}),
      }),
    )
    recalcularNivel(microciclo)
    setGuardada(true)
  }

  /**
   * El nivel se recalcula AQUÍ, al cerrar un microciclo, y no en el teléfono del
   * asesorado. Dos razones, y las dos importan:
   *
   * 1. **Permisos.** El trigger `proteger_perfil` (migración 0008) impide que el
   *    asesorado escriba en su propio perfil nada que no sean sus medidas. Esa
   *    migración existe porque una política mal escrita dejó que alguien se
   *    auto-promoviera a coach; no se ensancha por comodidad.
   * 2. **Que no oscile.** El cálculo mira la consistencia del microciclo, que al
   *    empezar la semana es 0%. Calculado al vuelo en cada render, todo el mundo
   *    caería al nivel 01 cada lunes y volvería a subir al registrar sesiones. Un
   *    nivel que sube y baja cada semana no mide dominio, mide qué día es hoy.
   *
   * Aquí el microciclo ya está cerrado: sus datos están completos.
   */
  const recalcularNivel = (cerrado: typeof microciclo) => {
    if (!cerrado) return
    const perfil = db.perfiles.byUsuario(cerrado.usuarioId)
    const actual = perfil?.peldanoAlfa ?? peldanoAlcanzado(datosRutaDe(cerrado.usuarioId, cerrado))
    const siguiente = peldanoTrasMicrociclo(actual, datosRutaDe(cerrado.usuarioId, cerrado))
    if (siguiente === perfil?.peldanoAlfa) return
    db.perfiles.guardarPeldano(cerrado.usuarioId, siguiente, hoyIso())
  }

  return (
    <Sheet abierto={abierto} titulo="Propuesta del siguiente microciclo" onCerrar={onCerrar}>
      {!propuesta || propuesta.filas.length === 0 ? (
        <p className="text-sm text-tenue">
          {nombreAsesorado} todavía no tiene un microciclo con ejercicios de fuerza del que partir.
        </p>
      ) : (
        <div className="flex flex-col gap-3 text-sm text-texto/90">
          <p>
            Propuesta de <strong>M{propuesta.numero}</strong> para {nombreAsesorado}, calculada con
            el motor Heracles sobre lo que registró de verdad.{' '}
            {propuesta.reparto.suben} suben · {propuesta.reparto.sostienen} sostienen ·{' '}
            {propuesta.reparto.bajan} bajan.
            {propuesta.prs !== undefined && (
              <>
                {' '}
                Último PRS: <strong>{propuesta.prs}</strong>.
              </>
            )}
          </p>

          <fieldset className="rounded-xl border border-linea bg-surface-2 p-3">
            <legend className="kicker px-1">Cuándo empieza</legend>
            <div className="mt-1 flex gap-2">
              {(
                [
                  ['a-continuacion', 'A continuación'],
                  ['proxima-semana', 'Próxima semana'],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={arranque === valor}
                  onClick={() => setArranque(valor)}
                  className={`flex-1 rounded-boton border px-3 py-2 text-xs font-bold ${
                    arranque === valor
                      ? 'border-accion bg-accion text-white'
                      : 'border-linea bg-surface-1 text-tenue'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            <p className="cifras mt-2 text-xs text-tenue">
              Arranca el <strong className="text-texto">{fechaInicio}</strong>
              {arranque === 'a-continuacion' && finActual
                ? ', cuando termina el que está haciendo.'
                : '.'}
            </p>
          </fieldset>

          {/* El aviso dice si el motor se fiaría del DATO, no si esto se va a
              activar: una vez guardada se activa igual, porque guardarla es la
              revisión. Decía «no se activaría sola» y desde que la preparada manda
              eso era falso justo cuando más importa. */}
          {propuesta.revision.auto ? (
            <p className="rounded-xl border border-logrado/40 bg-logrado/10 p-3 text-xs text-logrado">
              <strong>Dato fiable.</strong> Cumple las cinco señales: el motor se fiaría de ella sin
              que la miraras.
            </p>
          ) : (
            <div className="rounded-xl border border-ambar/40 bg-ambar/10 p-3 text-xs text-ambar">
              <p>
                <strong>Esta hay que mirarla antes de guardar.</strong> El motor no se fiaría del
                dato de partida porque:
              </p>
              <ul className="mt-1 list-disc pl-4">
                {propuesta.revision.motivos.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-1.5">
                Si la guardas, se activa tal cual cuando venza el actual: guardarla cuenta como que
                la revisaste.
              </p>
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {propuesta.filas.map((f, i) => (
              <li
                key={`${f.sesionId}-${f.ejercicio}-${i}`}
                className="rounded-tarjeta border border-linea bg-surface-2 p-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
                  {f.sesionNombre} · {f.categoria}
                </p>
                <p className="mt-0.5 text-sm font-bold text-texto">
                  <span aria-hidden="true" className="mr-1.5 text-rojo">
                    {FLECHA[f.direccion]}
                  </span>
                  {f.ejercicio}
                </p>
                <p className="cifras mt-1.5 text-[12.5px] font-semibold leading-relaxed text-texto">
                  {f.prescripcion || 'Sin datos suficientes para proponer carga.'}
                </p>
                <p className="mt-1 text-xs leading-snug text-tenue">{f.motivo}</p>
              </li>
            ))}
          </ul>

          {propuesta.sinDatos > 0 && (
            <p className="rounded-xl border border-linea bg-surface-2 p-3 text-xs text-tenue">
              {propuesta.sinDatos} ejercicio(s) sin series registradas ni carga pautada: el motor no
              tiene de dónde partir y los deja como están.
            </p>
          )}

          <Desalineados desalineados={propuesta.desalineados} />
          <VolumenPorGrupo volumen={propuesta.volumen} />

          <p className="rounded-xl border border-ambar/40 bg-ambar/10 p-3 text-xs text-ambar">
            No aplica descarga automática: su disparador (semana 4 de cada mesociclo) no coincide
            con lo que muestran tus plantillas.
          </p>

          {guardada ? (
            <p className="rounded-xl border border-logrado/40 bg-logrado/10 p-3 text-xs text-logrado">
              Preparada para el <strong>{fechaInicio}</strong>. {nombreAsesorado} todavía no la ve:
              sigue con el microciclo que está entrenando. Se activa sola —esta, no una
              recalculada— cuando el actual termine y abras el panel de asesorados.
            </p>
          ) : (
            <button
              type="button"
              onClick={guardar}
              className="press w-full rounded-boton bg-accion py-3.5 font-display text-sm uppercase tracking-wide text-white"
            >
              Guardar como propuesta
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

/**
 * Los ejercicios cuya frase contradice a sus campos.
 *
 * Es lo que el coach NO puede ver de otra forma: el asesorado lee la frase antes
 * de cargar la barra y el motor opera con los campos, así que cuando divergen
 * cada uno va a lo suyo y nadie se entera. Pasó el 2026-08-12 con 128 ejercicios
 * de 13 asesorados y se descubrió por casualidad.
 *
 * Va arriba del volumen a propósito: esto es un error que corregir, lo otro es
 * una recomendación que valorar.
 */
function Desalineados({
  desalineados,
}: {
  desalineados: PropuestaMicrociclo['desalineados']
}) {
  if (desalineados.length === 0) return null

  return (
    <div className="rounded-xl border border-rojo/40 bg-rojo/10 p-3 text-xs text-rojo">
      <p>
        <strong>{desalineados.length} ejercicio(s) dicen dos cosas distintas.</strong> La frase que
        lee el asesorado no coincide con los campos con los que opera la app:
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {desalineados.map((d) => (
          <li key={d.id}>
            <span className="font-bold">{d.nombre}</span>
            {d.desajustes.map((x) => (
              <span key={x.campo} className="cifras ml-1.5 block">
                {x.campo}: la frase dice <b>{x.enLaFrase}</b> y el campo{' '}
                <b>{x.enElCampo ?? '—'}</b>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Cuántas series le tocan a cada grupo la semana que viene.
 *
 * Solo se listan los grupos que CAMBIAN. Enseñar los quince con «igual» al lado
 * convierte una recomendación en una pared de texto que nadie lee, y lo que hay
 * que decidir son los que se mueven.
 *
 * Es una recomendación: la app no la escribe en ningún sitio. El coach mira y
 * decide, que es como funciona el resto de esta hoja.
 */
function VolumenPorGrupo({ volumen }: { volumen: PropuestaMicrociclo['volumen'] }) {
  const cambian = volumen.filter((v) => v.delta !== 0)
  if (cambian.length === 0) return null

  return (
    <div className="rounded-xl border border-linea bg-surface-2 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">
        Volumen sugerido · {cambian.length} de {volumen.length} grupos se mueven
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {cambian.map((v) => (
          <li key={v.grupo} className="text-xs leading-snug">
            <span className="font-bold text-texto">{v.grupo}</span>
            <span className="cifras ml-1.5 text-tenue">
              {v.seriesActuales} →{' '}
              <b className={v.delta > 0 ? 'text-logrado' : 'text-ambar'}>{v.seriesPropuestas}</b>{' '}
              series · {v.landmarkActual}
              {v.landmarkPropuesto !== v.landmarkActual && ` → ${v.landmarkPropuesto}`}
            </span>
            <span className="mt-0.5 block text-[11px] text-tenue">{v.motivo}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-snug text-tenue">
        Es una sugerencia: no se escribe en ningún sitio. La decides tú.
      </p>
    </div>
  )
}
