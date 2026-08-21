import { useSearchParams } from 'react-router-dom'
import type { SerieMedida } from '../../domain/serieMedida'
import { ConMedida } from './ConMedida'
import { SinMedida } from './SinMedida'
import { SERIE_CON_MEDIDA, SERIE_SIN_MEDIDA } from './seriesDeMuestra'

/**
 * La serie, medida.
 *
 * Lo que ve el asesorado después de subir el vídeo de una serie. Dos estados,
 * y el que más trabajo dio es el que falla: cuando la medida no vale, la
 * pantalla lo dice arriba y con cifras concretas que el asesorado puede
 * comprobar en su propio vídeo.
 *
 * **De dónde salen los datos, hoy:** de `seriesDeMuestra.ts`. La tubería de
 * visión todavía no entrega `EntradaSerie`, así que el enganche está preparado
 * y sin conectar. Cuando lo esté, esta pantalla no cambia: recibe el resultado
 * de `interpretarSerie` y lo pinta. Toda la decisión de si la serie se pudo
 * medir vive en `src/domain/serieMedida.ts`, con sus pruebas.
 *
 * Superficie oscura, como Entrenar y Progreso: así lo pide el diseño y las
 * gráficas se leen mejor.
 */
export default function SerieMedidaPage() {
  const [params] = useSearchParams()
  // Mientras no haya medición real, el parámetro deja ver los dos estados sin
  // tener que grabar nada. Cuando llegue la tubería, se cae solo.
  const serie: SerieMedida = params.get('estado') === 'medida'
    ? SERIE_CON_MEDIDA
    : SERIE_SIN_MEDIDA

  return (
    <div className="-mx-4 -mt-4 flex min-h-dvh flex-col gap-3.5 bg-ink-900 px-4 pb-4 pt-3">
      <header className="entrada entrada-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-silver-500">
          Serie
        </p>
        <h1 className="mt-1.5 font-display text-2xl leading-[1.05] text-silver-100">
          La serie, medida
        </h1>
      </header>

      {serie.estado === 'medida' ? (
        <ConMedida serie={serie} />
      ) : (
        <SinMedida serie={serie} />
      )}
    </div>
  )
}
