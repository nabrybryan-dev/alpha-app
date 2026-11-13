import { useDisenoFinal } from '../../../../app/organizacionViva'
import { Cifra3D } from '../../../../components/ui/Cifra3D'
import type { DiaRuta } from '../../../../domain/rutaEntrenamiento'
import { resumenSemana } from '../../../../domain/sesionesDelDia'

interface AnilloDeLaSemanaProps {
  completadas: number
  programadas: number
  /** Hoy hay una sesión programada que aún no se hizo: su arco va en rojo. */
  hoyPendiente: boolean
}

const TAMANO = 128
const R = 52
const TRAZO = 9
const LARGO = 2 * Math.PI * R
/** Hueco entre arcos, en unidades del trazo: el de la maqueta (326,7 − 5 × 56) / 5 ≈ 9,3. */
const HUECO = 9.3

type Tipo = 'hecha' | 'hoy' | 'pendiente'

const COLOR: Record<Tipo, string> = { hecha: 'var(--placa)', hoy: 'var(--rojo)', pendiente: 'var(--linea)' }

function tiposDeLosArcos(completadas: number, programadas: number, hoyPendiente: boolean): Tipo[] {
  const hechas = Math.min(completadas, programadas)
  return Array.from({ length: programadas }, (_, i) => {
    if (i < hechas) return 'hecha'
    return i === hechas && hoyPendiente ? 'hoy' : 'pendiente'
  })
}

/**
 * El anillo de sesiones de la semana en Entrenar (maqueta 6, `.anillo`: 128 px, trazo 9, «3/5 sesiones»), pedido por
 * Bryan el 13-nov-2026. Un arco por sesión programada: plata las hechas, rojo la de hoy si falta, gris el resto. Los
 * números son los mismos de «La semana» (`resumenSemana`): no hay cuenta aparte. Solo con el diseño final.
 */
export function AnilloDeLaSemana({ completadas, programadas, hoyPendiente }: AnilloDeLaSemanaProps) {
  const visible = useDisenoFinal()
  if (!visible || programadas <= 0) return null
  const tipos = tiposDeLosArcos(completadas, programadas, hoyPendiente)
  const paso = LARGO / programadas
  const arco = Math.max(paso - HUECO, 1)
  const etiqueta = `${Math.min(completadas, programadas)} de ${programadas} sesiones hechas esta semana`
  return (
    <div className="mb-3 flex justify-center">
      <div role="img" aria-label={etiqueta} style={{ position: 'relative', width: TAMANO, height: TAMANO }}>
        <svg viewBox="0 0 128 128" aria-hidden="true" style={{ width: '100%', height: '100%' }}>
          {tipos.map((tipo, i) => (
            <circle
              key={i}
              data-trazo={tipo}
              cx={64}
              cy={64}
              r={R}
              fill="none"
              stroke={COLOR[tipo]}
              strokeWidth={TRAZO}
              strokeLinecap="round"
              strokeDasharray={`${arco} ${LARGO - arco}`}
              transform={`rotate(${-90 + ((i * paso + HUECO / 2) / LARGO) * 360} 64 64)`}
            />
          ))}
        </svg>
        <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <Cifra3D valor={Math.min(completadas, programadas)} sufijo={`/${programadas}`} tamano={38} etiqueta={etiqueta} />
          <small style={{ fontSize: 12, color: 'var(--tenue)', fontWeight: 700 }}>sesiones</small>
        </div>
      </div>
    </div>
  )
}

/** El anillo leído de la semana de la hoja: mismos números que el rótulo «La semana» (`resumenSemana`). */
export function AnilloDeLaSemanaDeLaHoja({ semana }: { semana: readonly DiaRuta[] }) {
  const { completadas, programadas } = resumenSemana(semana)
  const hoyPendiente = semana.some((d) => d.esHoy && d.sesionId !== undefined && d.estado !== 'completada')
  return <AnilloDeLaSemana completadas={completadas} programadas={programadas} hoyPendiente={hoyPendiente} />
}
