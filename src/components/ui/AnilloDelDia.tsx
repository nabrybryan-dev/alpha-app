import { Cifra3D } from './Cifra3D'

interface AnilloDelDiaProps {
  /** Lo ya hecho antes de hoy, de 0 a 1 (trazo plata). `undefined` = sin dato: se pinta una raya, no un cero. */
  hecho: number | undefined
  /** Lo que se suma hoy, de 0 a 1 (trazo rojo, sigue al plata). Opcional. */
  hoy?: number
  /** Texto pequeño bajo la cifra («del día»). */
  subtitulo?: string
  /** Como lo dice un lector de pantalla, entero: «70 % del día». */
  etiqueta: string
  /** Lado en px. 128 en la maqueta. */
  tamano?: number
}

const TRAZO = 9

function acotar(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

/**
 * El anillo del día (maqueta `.anillo`, `1-css.css:247-252`): pista gris, arco plata con
 * lo hecho y arco rojo con lo de hoy, trazo 9, extremos redondos. Solo presentacional.
 *
 * - 0 %: solo la pista, y la cifra dice «0 %». Un cero medido es un dato.
 * - 100 %: el anillo cierra completo (los arcos suman como mucho 1).
 * - Sin dato (`hecho` undefined): solo la pista y la cifra pinta «—» (la raya de
 *   `Cifra3D`); no se dibuja ningún arco. No medido no es cero.
 * - El dibujo va `aria-hidden`; el lector oye `etiqueta` (la da `Cifra3D`).
 */
export function AnilloDelDia({ hecho, hoy = 0, subtitulo, etiqueta, tamano = 128 }: AnilloDelDiaProps) {
  const sinDato = hecho === undefined
  const h = sinDato ? 0 : acotar(hecho)
  const t = sinDato ? 0 : Math.min(acotar(hoy), 1 - h)
  const total = h + t

  const r = 50 - TRAZO / 2 // viewBox 100: el trazo cabe entero
  const largo = 2 * Math.PI * r
  const arco = (fraccion: number) => `${fraccion * largo} ${largo}`

  const comun = { cx: 50, cy: 50, r, fill: 'none', strokeWidth: TRAZO, strokeLinecap: 'round' as const }

  return (
    <div style={{ position: 'relative', width: tamano, height: tamano, flex: 'none' }}>
      <svg viewBox="0 0 100 100" aria-hidden="true" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle {...comun} stroke="var(--linea)" data-trazo="pista" />
        {h > 0 && (
          <circle {...comun} stroke="var(--placa)" strokeDasharray={arco(h)} data-trazo="hecho" />
        )}
        {t > 0 && (
          <circle
            {...comun}
            stroke="var(--rojo)"
            strokeDasharray={arco(t)}
            strokeDashoffset={-h * largo}
            data-trazo="hoy"
          />
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <Cifra3D
          valor={sinDato ? undefined : Math.round(total * 100)}
          sufijo="%"
          tamano={Math.round(tamano * 0.3)}
          etiqueta={etiqueta}
        />
        {subtitulo && (
          <small aria-hidden="true" style={{ fontSize: 12, color: 'var(--tenue)', fontWeight: 700 }}>
            {subtitulo}
          </small>
        )}
      </div>
    </div>
  )
}
