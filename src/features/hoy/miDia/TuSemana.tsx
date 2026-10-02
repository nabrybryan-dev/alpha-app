import { Link } from 'react-router-dom'
import { Cifra3D } from '../../../components/ui/Cifra3D'

interface TuSemanaProps {
  sesionesHechas: number
  sesionesPautadas: number
  /** Horas de sueño medias de los últimos siete días; sin noches apuntadas, nada. */
  suenoH: number | undefined
  /** Adherencia nutricional, la misma que va debajo del vídeo de la revisión. */
  adherenciaPct: number | undefined
}

/** El mismo corte que usa la lista de nutrición del equipo para pintar en rojo. */
const ADHERENCIA_QUE_PIDE_ATENCION = 50

/**
 * «Tu semana»: las tres cifras de arriba de Mi día (maqueta «Espacios de Alpha»).
 *
 * Son los MISMOS números de la tarjeta de la revisión semanal (`resumenSemanal`), no una
 * segunda cuenta: si esta tarjeta y la del vídeo discreparan, la persona no sabría a cuál
 * creer. Lo único que añade es el sueño medio, que la revisión da como regularidad.
 */
export function TuSemana({ sesionesHechas, sesionesPautadas, suenoH, adherenciaPct }: TuSemanaProps) {
  const adherenciaRoja = adherenciaPct !== undefined && adherenciaPct < ADHERENCIA_QUE_PIDE_ATENCION
  return (
    <section
      aria-label="Resumen de la semana"
      className="entrada entrada-1 flex flex-col gap-3 rounded-tarjeta border border-linea bg-surface-1 p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-tenue">Tu semana</p>
        <Link
          to="/progreso"
          className="press inline-flex min-h-[44px] items-center text-xs font-semibold text-texto underline underline-offset-2"
        >
          Mi progreso
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          {sesionesPautadas > 0 ? (
            <Cifra3D
              valor={sesionesHechas}
              sufijo={`/${sesionesPautadas}`}
              etiqueta={`${sesionesHechas} de ${sesionesPautadas} sesiones hechas`}
            />
          ) : (
            <Cifra3D valor={undefined} etiqueta="Sin sesiones programadas" />
          )}
          <span className="text-xs text-tenue">sesiones</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Cifra3D
            valor={suenoH}
            decimales={1}
            etiqueta={suenoH === undefined ? 'Sin horas de sueño apuntadas' : `${suenoH} horas de sueño de media`}
          />
          <span className="text-xs text-tenue">h de sueño</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Cifra3D
            valor={adherenciaPct}
            sufijo="%"
            rojo={adherenciaRoja}
            etiqueta={adherenciaPct === undefined ? 'Sin adherencia registrada' : `${adherenciaPct} % de adherencia`}
          />
          <span className="text-xs text-tenue">adherencia</span>
        </div>
      </div>
    </section>
  )
}
