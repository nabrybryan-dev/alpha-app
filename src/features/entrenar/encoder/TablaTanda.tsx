import { COPY } from './copys'
import { SelloCalidad } from './SelloCalidad'
import { seOcultanLasCifras } from './cifras'
import type { Medicion } from './tanda'

/**
 * La tanda de validación, fila a fila.
 *
 * ## La columna que importa es R/D
 *
 * `repsReales` **las cuenta la persona**, `repsDetectadas` las cuenta el
 * instrumento, y su desacuerdo es el modo de fallo dominante de las apps de
 * cámara: repeticiones fantasma y repeticiones perdidas. No aparece mirando los
 * m/s —una serie con una rep inventada da velocidades perfectamente razonables—,
 * así que si esta columna no está, el fallo no se ve en ningún sitio.
 *
 * El énfasis cuando no coinciden **no usa color**: la celda pasa de `--tenue` a
 * `--texto`. Es el único énfasis de la tabla, y sigue la misma regla que el resto
 * del encoder — el color no dice calidad.
 *
 * ## Y por qué la tabla es densa
 *
 * Se lee sentado, en frío, comparando filas entre sí. Es la única pantalla del
 * encoder que no se usa en el gimnasio, y aquí el aire de sobra estorba: lo que
 * hace falta es tener seis tomas a la vista a la vez.
 */

interface Props {
  filas: Medicion[]
}

const NADA = '—'

function hora(fecha: string): string {
  const d = new Date(fecha)
  return Number.isNaN(d.getTime())
    ? NADA
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function TablaTanda({ filas }: Props) {
  if (filas.length === 0) {
    // Los umbrales ya están escritos y se ven aunque no haya nada medido: es el
    // punto entero de escribirlos antes. La lista vive en la tarjeta de
    // criterios, así que aquí basta con no fingir una tabla vacía.
    return <p className="py-3 text-[12.5px] leading-snug text-tenue">{COPY.tanda_vacia}</p>
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-left font-mono text-[11.5px] tabular-nums">
        <thead className="text-tenue">
          <tr className="border-b border-hairline">
            <th className="py-1.5 pr-2 font-normal">hora</th>
            <th className="py-1.5 pr-2 font-normal">ejercicio</th>
            <th className="py-1.5 pr-2 font-normal" title="reales / detectadas">
              R/D
            </th>
            <th className="py-1.5 pr-2 font-normal">v₁</th>
            <th className="py-1.5 pr-2 font-normal">%PV</th>
            <th className="py-1.5 pr-2 font-normal">fps</th>
            <th className="py-1.5 font-normal">
              <span className="sr-only">calidad</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => {
            const cuadra = f.repsReales == null || f.repsReales === f.repsDetectadas
            const ocultas = seOcultanLasCifras(f.calidad)
            return (
              // Sin modificador de opacidad. `--hairline` ya es un `rgba()` con su
              // propia alfa, así que no admite uno: Tailwind descartaba la clase, no
              // generaba ninguna regla, y el borde caía al color por defecto de
              // Tailwind —`#e5e7eb`— pintando una línea GRIS CLARA cruzando una tabla
              // oscura. No era un fallo invisible: se veía.
              <tr key={`${f.fecha}-${i}`} className="border-b border-hairline">
                <td className="py-1.5 pr-2 text-tenue">{hora(f.fecha)}</td>
                <td className="max-w-[9rem] truncate py-1.5 pr-2 font-sans text-texto" title={f.ejercicio}>
                  {f.ejercicio}
                </td>
                {/* El único énfasis de la tabla, y no es de color. */}
                <td className={`py-1.5 pr-2 ${cuadra ? 'text-tenue' : 'font-bold text-texto'}`}>
                  {f.repsReales ?? NADA}/{f.repsDetectadas}
                </td>
                {/* Una toma descartada no enseña cifras tampoco aquí: en una
                    tabla un número falso es todavía más fácil de apuntar, porque
                    está alineado con los que sí valen. */}
                <td className="py-1.5 pr-2 text-tenue">
                  {ocultas || f.vPrimera == null ? NADA : f.vPrimera.toFixed(3)}
                </td>
                <td className="py-1.5 pr-2 text-tenue">
                  {ocultas || f.pvPct == null ? NADA : f.pvPct.toFixed(1)}
                </td>
                <td className="py-1.5 pr-2 text-tenue">
                  {f.fpsReal == null ? NADA : f.fpsReal.toFixed(0)}
                </td>
                <td className="py-1.5">
                  <SelloCalidad nivel={f.calidad} tamano="inline" />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
