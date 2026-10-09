import { useState } from 'react'
import type { CadenaCorrida } from '../../../data/consola/cadenaCorridas'
import type { ConclusionDeSemana } from '../../../domain/presentacionAsesorado'
import type { EstadoDato } from '../consola/datoConsola'
import { Esqueleto } from '../consola/piezas'

interface Props {
  corridas: EstadoDato<CadenaCorrida[]>
  /** Ya calculadas por `conclusionesPorMicrociclo` a partir de `corridas`. */
  conclusiones: ConclusionDeSemana[]
}

/** Las más recientes van a la vista; el resto, plegado. En una llamada se habla de lo de ahora. */
const A_LA_VISTA = 3

/**
 * CONCLUSIONES: por semana, lo que la cadena de agentes dejó escrito. Solo texto que ya
 * existe (`resumen` y `avisos` del último paso completado de esa semana); aquí no se redacta
 * ni se reformula nada. Lo más reciente primero.
 */
export function SeccionConclusiones({ corridas, conclusiones }: Props) {
  // Arranca CERRADA. Lo de abajo es el texto interno de la cadena de agentes, sin retocar: puede
  // traer jerga o cosas que no son para decirle así a la persona. Esta pantalla se enseña en una
  // llamada, de modo que quien presenta lo lee antes y decide abrirlo; no aparece solo al bajar.
  const [aLaVista, setALaVista] = useState(false)

  if (corridas.estado === 'cargando') return <Esqueleto lineas={3} />

  if (conclusiones.length === 0) {
    return <p className="text-[15px] text-tenue">Todavía no hay conclusiones escritas para mostrar.</p>
  }

  if (!aLaVista) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-linea bg-surface-2 p-4">
        <p className="text-[14px] leading-snug text-texto">
          Hay notas del equipo de {conclusiones.length} {conclusiones.length === 1 ? 'semana' : 'semanas'}. Son el
          texto interno tal como quedó escrito, sin retocar:{' '}
          <span className="font-bold">léelas tú antes de mostrarlas.</span>
        </p>
        <button
          type="button"
          onClick={() => setALaVista(true)}
          className="press min-h-[44px] self-start rounded-boton border border-linea bg-surface-1 px-4 text-sm font-bold text-texto"
        >
          Mostrar las conclusiones
        </button>
      </div>
    )
  }

  const recientes = conclusiones.slice(0, A_LA_VISTA)
  const anteriores = conclusiones.slice(A_LA_VISTA)

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setALaVista(false)}
        className="press min-h-[44px] self-start rounded-boton border border-linea px-4 text-sm font-bold text-tenue"
      >
        Ocultar las conclusiones
      </button>
      {recientes.map((c, i) => (
        <Conclusion key={c.clave} conclusion={c} demora={i * 90} />
      ))}
      {anteriores.length > 0 && (
        <details className="group">
          <summary className="inline-flex min-h-[44px] cursor-pointer items-center rounded-boton border border-linea px-4 text-sm font-bold text-texto">
            Semanas anteriores ({anteriores.length})
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {anteriores.map((c) => (
              <Conclusion key={c.clave} conclusion={c} demora={0} />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function Conclusion({ conclusion, demora }: { conclusion: ConclusionDeSemana; demora: number }) {
  return (
    <article className="pres-entra rounded-2xl border border-linea bg-surface-2 p-4" style={{ animationDelay: `${demora}ms` }}>
      <h4 className="kicker !text-[12px]">{conclusion.titulo}</h4>
      {conclusion.resumen && <p className="mt-2 whitespace-pre-line text-[15px] leading-snug text-texto">{conclusion.resumen}</p>}
      {conclusion.avisos.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-linea pt-2">
          {conclusion.avisos.map((a) => (
            <li key={a} className="flex gap-2 text-[14px] leading-snug text-texto/90">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-rojo" aria-hidden="true" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
