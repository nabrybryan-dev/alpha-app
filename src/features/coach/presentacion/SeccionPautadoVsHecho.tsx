import { useMemo, useState } from 'react'
import { Cifra3D } from '../../../components/ui/Cifra3D'
import { nombreDelMicrociclo } from '../../../domain/palabrasLlanas'
import { motivoSinBarras, numeroExacto, type MagnitudPautado, type PautadoVsHechoMicrociclo } from '../../../domain/pautadoVsHecho'
import { NOMBRE_MAGNITUD } from './magnitudes'
import { RespaldoSiFalla } from './RespaldoSiFalla'
import { VistaSvgPautado } from './VistaSvgPautado'
import { VistaWebGLPautado } from './VistaWebGLPautado'
import { useModoDeEscena } from './webgl'

interface Props {
  filas: readonly PautadoVsHechoMicrociclo[]
}

/**
 * PAUTADO CONTRA HECHO: lo que se le pidió a la persona contra lo que hizo, semana a semana,
 * en un escenario WebGL que se gira con el dedo o el ratón (y con botones, para quien no
 * arrastra). Dos vistas, nunca mezcladas en una escala: series o volumen (kg·rep).
 *
 * Qué escena se enseña (`elegirRespaldo`): la WebGL, cargada a demanda; o la escena SVG de
 * siempre si no hay WebGL, si la persona pidió menos movimiento o si la 3D falla (un
 * `RespaldoSiFalla` la recoge). Los números están siempre: sobre cada pareja, en la tarjeta
 * de detalle y en la tabla «Ver los números».
 */
export function SeccionPautadoVsHecho({ filas }: Props) {
  const [magnitud, setMagnitud] = useState<MagnitudPautado>('series')
  const { modo, avisarFallo } = useModoDeEscena()

  // Por omisión se resalta el último microciclo con datos: lo que se comenta primero.
  const porOmision = useMemo(() => [...filas].reverse().find((f) => f.situacion === 'con-datos') ?? filas.at(-1), [filas])
  const [elegidoId, setElegidoId] = useState<string | undefined>(undefined)
  const elegido = filas.find((f) => f.id === elegidoId) ?? porOmision

  if (filas.length === 0) {
    return <p className="text-[15px] text-tenue">Todavía no hay semanas cargadas para comparar.</p>
  }

  const respaldo = (
    <VistaSvgPautado
      filas={filas}
      magnitud={magnitud}
      onMagnitud={setMagnitud}
      seleccionadoId={elegido?.id}
      onSeleccionar={setElegidoId}
    />
  )

  return (
    <div className="flex flex-col gap-3">
      {modo === '3d' ? (
        <RespaldoSiFalla respaldo={respaldo} alFallar={avisarFallo}>
          <VistaWebGLPautado
            filas={filas}
            magnitud={magnitud}
            onMagnitud={setMagnitud}
            seleccionadoId={elegido?.id}
            onSeleccionar={setElegidoId}
            onFallo={avisarFallo}
          />
        </RespaldoSiFalla>
      ) : (
        respaldo
      )}

      {elegido && <Detalle fila={elegido} />}

      <details className="rounded-2xl border border-linea">
        <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-bold text-texto">Ver los números</summary>
        <TablaDeNumeros filas={filas} />
      </details>
      <p className="text-xs text-tenue">
        El volumen es kilos × repeticiones. Los ejercicios que no llevan kilos pautados (peso corporal, tiempo) cuentan en
        las series pero no en el volumen. Ninguna cifra de aquí está inventada: lo que no se registró, se dice.
      </p>
    </div>
  )
}

/** Lo que se toca: los números exactos de la semana elegida y su cumplimiento, con la cifra grande. */
function Detalle({ fila }: { fila: PautadoVsHechoMicrociclo }) {
  const titulo = `${nombreDelMicrociclo(fila.numero, true)}${fila.estado === 'activo' ? ' · la de ahora' : ''}`
  const sinDatos = fila.situacion !== 'con-datos'
  return (
    <div className="rounded-2xl border border-linea bg-surface-2 p-4" aria-live="polite">
      <p className="kicker !text-[12px]">{titulo}</p>
      {sinDatos ? (
        <p className="mt-2 text-[15px] text-texto">
          {motivoSinBarras(fila, 'series') === 'sin pauta'
            ? 'Esta semana no trae series pautadas.'
            : 'Esta semana no tiene series registradas todavía.'}
        </p>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3">
          {(['series', 'volumen'] as const).map((m) => {
            const c = fila[m]
            const sinKilos = m === 'volumen' && motivoSinBarras(fila, 'volumen') !== undefined
            return (
              <div key={m} className="flex flex-col gap-1">
                <p className="text-xs font-bold uppercase tracking-wide text-tenue">{NOMBRE_MAGNITUD[m].corto}</p>
                {sinKilos ? (
                  <p className="text-sm text-tenue">Sin kilos pautados esta semana.</p>
                ) : (
                  <>
                    <Cifra3D
                      valor={c.cumplimientoPct}
                      sufijo="%"
                      rojo={c.cumplimientoPct !== undefined && c.cumplimientoPct < 70}
                      tamano={30}
                      etiqueta={`${c.cumplimientoPct ?? 0} % de ${m === 'series' ? 'las series' : 'el volumen'} que te pedimos`}
                    />
                    <p className="cifras text-[13px] text-texto/90">
                      te pedimos {numeroExacto(c.pautado)} · hiciste {numeroExacto(c.hecho)}
                      <span className="text-tenue"> {NOMBRE_MAGNITUD[m].unidad}</span>
                    </p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
      {fila.ejerciciosSinCarga > 0 && !sinDatos && (
        <p className="mt-2 text-xs text-tenue">
          {fila.ejerciciosSinCarga} {fila.ejerciciosSinCarga === 1 ? 'ejercicio no cuenta' : 'ejercicios no cuentan'} en el
          volumen porque no {fila.ejerciciosSinCarga === 1 ? 'lleva' : 'llevan'} kilos pautados.
        </p>
      )}
    </div>
  )
}

/** Los mismos números que las barras, para leerlos sin la escena (y para un lector de pantalla). */
function TablaDeNumeros({ filas }: { filas: readonly PautadoVsHechoMicrociclo[] }) {
  return (
    <div className="overflow-x-auto px-2 pb-3">
      <table className="w-full min-w-[460px] border-collapse text-left text-[13px]">
        <caption className="sr-only">Lo que te pedimos y lo que hiciste, semana a semana</caption>
        <thead>
          <tr className="text-xs uppercase tracking-wide text-tenue">
            <th scope="col" className="px-2 py-2 font-bold">Semana</th>
            <th scope="col" className="px-2 py-2 font-bold">Series pedidas</th>
            <th scope="col" className="px-2 py-2 font-bold">Series hechas</th>
            <th scope="col" className="px-2 py-2 font-bold">Volumen pedido (kg·rep)</th>
            <th scope="col" className="px-2 py-2 font-bold">Volumen hecho (kg·rep)</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const series = motivoSinBarras(f, 'series')
            const volumen = motivoSinBarras(f, 'volumen')
            return (
              <tr key={f.id} className="border-t border-linea align-top">
                <th scope="row" className="cifras px-2 py-2 font-bold text-texto">
                  {f.numero}
                </th>
                {series ? (
                  <td colSpan={2} className="px-2 py-2 text-tenue">{series}</td>
                ) : (
                  <>
                    <td className="cifras px-2 py-2 text-texto/90">{numeroExacto(f.series.pautado)}</td>
                    <td className="cifras px-2 py-2 text-texto">{numeroExacto(f.series.hecho)}</td>
                  </>
                )}
                {volumen ? (
                  <td colSpan={2} className="px-2 py-2 text-tenue">{volumen}</td>
                ) : (
                  <>
                    <td className="cifras px-2 py-2 text-texto/90">{numeroExacto(f.volumen.pautado)}</td>
                    <td className="cifras px-2 py-2 text-texto">{numeroExacto(f.volumen.hecho)}</td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
