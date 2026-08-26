import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { COPY } from './copys'
import { huecosPorSalto, rangoConBandas, sigmaDe, tramosDeEje, type FotogramaBrazo } from './medidaDePalancas'

/**
 * El brazo de momento a lo largo de la repetición, en una escena de dos planos.
 *
 * ## Por qué esto es 3D y no una gráfica plana con adornos
 *
 * El brazo de momento **es una proyección**. Se mide en plano sagital porque los
 * detectores de pose dan cinco grados de libertad —dos puntos por segmento, no
 * tres— y por eso **el plano frontal no se puede medir con una sola cámara**.
 *
 * Hasta ahora eso se contaba con una frase en las negativas. Aquí se dibuja: el
 * plano sagital al frente con las curvas medidas y, detrás, el plano frontal
 * **vacío**, en filete punteado y rotulado. La profundidad no es decoración — es
 * la única representación honesta de lo que el método sabe y de lo que no.
 *
 * ## Por qué la órbita está limitada
 *
 * ±25°. No es órbita libre: más allá las curvas se solapan y el dato se pierde.
 * Los valores se leen a 0°, que es la vista canónica; cualquier otra rotación es
 * exploración, y por eso el doble toque devuelve ahí.
 *
 * ## Las bandas de error se extruyen
 *
 * Un ±44 no es una banda más gruesa: es un **volumen mayor**. En `escala_dudosa`
 * ese volumen tapa las líneas al orbitar, y esa oclusión es literalmente el
 * argumento del estado. No se disimula.
 */

const EJES_ORDEN = ['cadera', 'rodilla', 'lumbar'] as const
const TOPE_GRADOS = 25

interface Props {
  fotogramas: FotogramaBrazo[]
  ejeObjetivo: string
  sigmaBrazoMm: number
  /** Sube el peso visual de las bandas: en `escala_dudosa` tapan las líneas. */
  bandasDominantes?: boolean
  alto?: number
}

/* Se lee con `useSyncExternalStore` y no con useState+useEffect a propósito: la
 * regla `react-hooks/set-state-in-effect` está en error en este repo desde que
 * destapó siete casos, y es el mismo patrón que ya usa `useDbVersion`. Además
 * evita el primer pintado con el valor equivocado, que en un media query se ve. */
const MQ_REDUCIDO = '(prefers-reduced-motion: reduce)'

function suscribirAMovimiento(alCambiar: () => void) {
  const mq = window.matchMedia?.(MQ_REDUCIDO)
  mq?.addEventListener?.('change', alCambiar)
  return () => mq?.removeEventListener?.('change', alCambiar)
}

function useMovimientoReducido() {
  return useSyncExternalStore(
    suscribirAMovimiento,
    () => window.matchMedia?.(MQ_REDUCIDO).matches ?? false,
    // En servidor no hay preferencia que leer: se asume movimiento permitido y
    // el cliente corrige en el primer render.
    () => false,
  )
}

export function GraficaBrazo({
  fotogramas,
  ejeObjetivo,
  sigmaBrazoMm,
  bandasDominantes = false,
  alto = 260,
}: Props) {
  const reducido = useMovimientoReducido()
  const [grados, setGrados] = useState(0)
  const arrastre = useRef<{ x: number; desde: number } | null>(null)
  const escenaRef = useRef<HTMLDivElement>(null)

  const presentes = EJES_ORDEN.filter((e) =>
    fotogramas.some((f) => f.ok && f.brazos?.[e] && Number.isFinite(f.brazos[e].mm)),
  )
  const rango = rangoConBandas(fotogramas, presentes as unknown as string[], sigmaBrazoMm)
  const tiempos = fotogramas.filter((f) => f.ok).map((f) => f.t)
  const t0 = tiempos[0] ?? 0
  const t1 = tiempos[tiempos.length - 1] ?? 1

  const W = 1000
  const H = alto
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W
  const y = (mm: number) => ((rango.max - mm) / (rango.max - rango.min || 1)) * H

  // `will-change` solo mientras dura el gesto: una capa promovida de forma
  // permanente reserva memoria de textura en un móvil de gama media.
  const [gestoActivo, setGestoActivo] = useState(false)
  const alSoltar = useCallback(() => {
    arrastre.current = null
    setGestoActivo(false)
  }, [])

  useEffect(() => {
    if (!gestoActivo) return
    const mover = (e: PointerEvent) => {
      if (!arrastre.current) return
      const dx = e.clientX - arrastre.current.x
      const g = arrastre.current.desde + dx * 0.16
      setGrados(Math.max(-TOPE_GRADOS, Math.min(TOPE_GRADOS, g)))
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', alSoltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', alSoltar)
    }
  }, [gestoActivo, alSoltar])

  const camino = (puntos: Array<{ t: number; mm: number }>) =>
    puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p.mm).toFixed(1)}`).join(' ')

  const bandaDe = (puntos: Array<{ t: number; mm: number; sigmaExtraMm: number }>) => {
    const arriba = puntos.map((p) => `${x(p.t).toFixed(1)} ${y(p.mm + sigmaDe(p as never, sigmaBrazoMm)).toFixed(1)}`)
    const abajo = [...puntos]
      .reverse()
      .map((p) => `${x(p.t).toFixed(1)} ${y(p.mm - sigmaDe(p as never, sigmaBrazoMm)).toFixed(1)}`)
    return `M ${arriba.join(' L ')} L ${abajo.join(' L ')} Z`
  }

  return (
    <div className="select-none">
      <div
        ref={escenaRef}
        className="relative touch-pan-y"
        style={{ perspective: '1000px', height: alto + 26 }}
        onPointerDown={(e) => {
          if (reducido) return
          arrastre.current = { x: e.clientX, desde: grados }
          setGestoActivo(true)
        }}
        onDoubleClick={() => setGrados(0)}
      >
        <div
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${reducido ? 0 : grados}deg)`,
            transition: gestoActivo ? 'none' : 'transform 420ms cubic-bezier(.16,1,.3,1)',
            willChange: gestoActivo ? 'transform' : undefined,
          }}
        >
          {/* EL PLANO QUE NO SE MIDIÓ. Está vacío a propósito: con una sola cámara
              el plano frontal no existe como dato, y dibujarlo con algo dentro
              sería inventarlo. Con movimiento reducido se desplaza en X para que
              siga viéndose que está: se pierde la órbita, no el argumento. */}
          <div
            className="absolute inset-0 rounded-panel border border-dashed border-[var(--placa-muerta)]"
            style={{
              transform: `translateZ(-64px)${reducido ? ' translateX(26px)' : ''}`,
              opacity: 0.55,
            }}
          >
            <span className="absolute bottom-1 right-2 text-[10.5px] text-[var(--placa-muerta)]">
              plano frontal · sin medir
            </span>
          </div>

          {/* El plano sagital, con lo que sí se midió. */}
          <div className="absolute inset-0" style={{ transform: 'translateZ(0)' }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: alto }} role="img"
              aria-label={`Brazo de momento de ${presentes.join(', ')} a lo largo de la repetición`}>
              {/* El trazado progresivo va por MÁSCARA y no por stroke-dasharray,
                  porque el dasharray ya está ocupado: el trazo discontinuo 7-5 es
                  una de las tres señales que distinguen un eje estimado de uno
                  visto, y no se puede gastar en una animación de entrada. */}
              {!reducido && (
                <defs>
                  {presentes.map((eje, i) => (
                    <clipPath key={eje} id={`trazo-${eje}`}>
                      <rect x={0} y={0} height={H} width={0}>
                        <animate
                          attributeName="width"
                          from={0}
                          to={W}
                          dur="600ms"
                          begin={`${i * 60}ms`}
                          fill="freeze"
                          calcMode="spline"
                          keySplines=".22 .61 .36 1"
                          keyTimes="0;1"
                          values={`0;${W}`}
                        />
                      </rect>
                    </clipPath>
                  ))}
                </defs>
              )}

              {/* El cero: un brazo negativo significa que la carga pasó al otro
                  lado del eje, y eso tiene que verse. */}
              <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--placa-muerta)" strokeWidth={1.2} />

              {presentes.map((eje) => {
                const esObjetivo = eje === ejeObjetivo
                const derivado = fotogramas.some((f) => f.brazos?.[eje]?.derivado)
                // Depth cueing: lo que está detrás pierde contraste, como la
                // perspectiva aérea. El ojo lo entiende sin leer nada.
                const lejania = 1 - Math.min(1, Math.abs(grados) / TOPE_GRADOS) * (esObjetivo ? 0.1 : 0.4)
                return (
                  <g key={eje} opacity={lejania}>
                    {tramosDeEje(fotogramas, eje).map((tramo, i) =>
                      tramo.length > 1 ? (
                        <path
                          key={`b${i}`}
                          d={bandaDe(tramo)}
                          fill={derivado ? 'none' : 'var(--placa)'}
                          fillOpacity={derivado ? 0 : bandasDominantes ? 0.3 : 0.16}
                          stroke={derivado ? 'var(--placa-muerta)' : 'none'}
                          strokeDasharray={derivado ? '2 3' : undefined}
                          strokeWidth={derivado ? 1 : 0}
                        />
                      ) : null,
                    )}
                    {tramosDeEje(fotogramas, eje).map((tramo, i) =>
                      tramo.length > 1 ? (
                        <path
                          key={`l${i}`}
                          d={camino(tramo)}
                          fill="none"
                          stroke="var(--placa)"
                          strokeWidth={esObjetivo ? 2.6 : 1.8}
                          strokeDasharray={derivado ? '7 5' : undefined}
                          strokeLinecap={derivado ? 'butt' : 'round'}
                          clipPath={reducido ? undefined : `url(#trazo-${eje})`}
                        />
                      ) : null,
                    )}
                    {huecosPorSalto(fotogramas, eje).map((t) => (
                      <g key={`h${t}`}>
                        <line
                          x1={x(t)} x2={x(t)} y1={0} y2={H}
                          stroke="var(--placa-muerta)" strokeWidth={1} strokeDasharray="3 4"
                        />
                        <text x={x(t) + 4} y={12} fontSize={9} fill="var(--tenue)">hueco</text>
                      </g>
                    ))}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] tabular-nums text-tenue">
        <span>{Math.round(rango.min)} mm</span>
        {!reducido && (
          <button
            type="button"
            onClick={() => setGrados(0)}
            className="min-h-11 px-2 text-[11px] text-tenue underline-offset-2 hover:underline"
          >
            {grados === 0 ? 'arrastra para orbitar' : 'Volver a 0°'}
          </button>
        )}
        <span>{Math.round(rango.max)} mm</span>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-tenue">{COPY.palancas_lumbar}</p>
    </div>
  )
}
