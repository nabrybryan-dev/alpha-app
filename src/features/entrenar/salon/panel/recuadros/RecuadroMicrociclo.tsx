import { fraseDelMicrociclo } from '../../../../../data/contenido/frasesDelMicrociclo'
import { cargaPorGrupo, formatearSeries } from '../../../../../domain/fatiga'
import type { Microciclo } from '../../../../../domain/types'

/**
 * EL LETRERO DE INICIO DE SEMANA, dicho de forma que no caduque.
 *
 * Esto sustituye al cartel de la Ruta —`PortadaMicrociclo`, que desde que el salón ocupó
 * la pantalla de aterrizaje ya no se monta y sobrevive solo como origen documentado del
 * inventario de mudanza—. Aquel salía UNA VEZ por microciclo y se marcaba como visto al
 * cerrarlo. Esa regla es buena para un cartel —«un cartel que sale cada día deja de
 * leerse a los dos días»— pero lo que el cartel LLEVA no es un aviso:
 * son el número del microciclo, cuántas sesiones tiene, cuántas series se van a hacer,
 * qué grupos se trabajan, cuál es el foco y la frase de la semana. Datos del plan.
 *
 * En una columna con scroll daba igual: el cartel se cerraba y esos datos se
 * reconstruían mirando el calendario de más abajo. En el salón, el panel es el único
 * sitio donde vive lo largo, así que un dato que solo se ve el primer día sería un dato
 * perdido a partir del segundo — y la regla del encargo es que no se pierde ninguno.
 *
 * Por eso este recuadro NO es la portada: es su contenido, permanente. Las cifras salen
 * de las mismas funciones de dominio que usa la portada (`cargaPorGrupo`,
 * `formatearSeries`, `fraseDelMicrociclo`), así que no hay dos cuentas que se puedan
 * separar; lo que no se replica es el «se ve una vez», que era la propiedad del cartel.
 */
export function RecuadroMicrociclo({ microciclo }: { microciclo: Microciclo }) {
  const grupos = cargaPorGrupo(microciclo)
    .slice()
    .sort((a, b) => b.seriesPautadas - a.seriesPautadas)
  const prioritarios = grupos.slice(0, 5)
  const foco = prioritarios[0]
  const sesiones = microciclo.sesiones.length
  // Las series que la persona va a hacer de verdad, no la suma por grupo: el volumen se
  // cuenta fraccionado, un ejercicio alimenta a varios grupos y sumarlos daría un número
  // mayor que el de series de la semana. Es la misma cuenta que hace la portada.
  const series = microciclo.sesiones.reduce(
    (total, s) => total + s.ejercicios.reduce((t, e) => t + e.sets, 0),
    0,
  )
  const frase = fraseDelMicrociclo(microciclo.id)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-[19px] font-black leading-none tracking-[-0.015em] text-silver-100">
          MICROCICLO M{microciclo.numero}
        </p>
        <span className="cifras shrink-0 rounded-full border border-accion/40 px-2.5 py-[5px] text-[10.5px] font-bold text-accion">
          {sesiones} SESIONES
        </span>
      </div>

      <p className="cifras text-[11.5px] text-silver-400">
        {formatearSeries(series)} series programadas · cadencia de {microciclo.cadenciaDias} días
      </p>

      {prioritarios.length > 0 && (
        <div>
          <p className="mb-[9px] text-[10px] font-bold uppercase tracking-[0.18em] text-silver-500">
            Lo que trabajas esta semana
          </p>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-[7px]">
            {prioritarios.map((g, i) => (
              <li
                key={g.grupo}
                className="flex items-center gap-[7px] rounded-[10px] border border-ink-500 bg-ink-700 px-[9px] py-2"
              >
                <span className="cifras text-[10px] font-bold text-accion">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 text-[11.5px] font-semibold text-silver-200">
                  {g.grupo}
                </span>
                <span className="cifras ml-auto text-[10px] text-silver-500">
                  {formatearSeries(g.seriesPautadas)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {foco && (
        <div className="rounded-[10px] border border-ink-500 bg-ink-700 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-silver-500">
            Foco de la semana
          </p>
          <p className="font-display text-[16px] font-black uppercase text-accion">{foco.grupo}</p>
          <p className="cifras text-[11.5px] text-silver-400">
            {formatearSeries(foco.seriesPautadas)} series programadas
          </p>
        </div>
      )}

      {frase && (
        <p className="border-l-[3px] border-l-accion pl-3 text-[13px] font-semibold leading-relaxed text-silver-200">
          {frase}
        </p>
      )}
    </div>
  )
}
