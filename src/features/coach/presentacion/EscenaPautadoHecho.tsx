import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import {
  cajaProyectada,
  ejeDesdeCero,
  proyectar,
  type CajaProyectada,
  type NombreCara,
  type VistaEscena,
} from '../../../domain/escenaGirable'
import { motivoSinBarras, numeroExacto, type MagnitudPautado, type PautadoVsHechoMicrociclo } from '../../../domain/pautadoVsHecho'
import { nombreDelMicrociclo } from '../../../domain/palabrasLlanas'

/**
 * La escena 3D del pautado contra el hecho: SVG con una proyección hecha a mano
 * (`domain/escenaGirable.ts`), una caja de tres polígonos por barra.
 *
 * Cómo se lee, y por qué no engaña:
 *  - El eje EMPIEZA SIEMPRE EN CERO y su tope es un número redondo que cubre el máximo.
 *  - Cada barra lleva su número exacto escrito encima, siempre; la tabla de debajo trae los
 *    mismos. Los números van de pie (no giran con la escena) para poder leerse.
 *  - La proyección es ortogonal: dos barras del mismo valor miden lo mismo vengan de donde
 *    vengan. Y existe la vista plana, de frente, para leer sin profundidad.
 *  - El pautado es un «fantasma» translúcido DETRÁS del hecho (estilo gráfico bala): donde
 *    el fantasma asoma por encima, faltó; donde el hecho lo pasa, sobró.
 *  - Un microciclo sin datos no dibuja una barra en cero: dice «sin registros».
 *
 * MOVIMIENTO: las barras crecen desde la base, escalonadas (`.barra-sube`, la misma
 * animación de las gráficas de la consola, que ya se apaga con movimiento reducido).
 */

const MARGEN_IZQ = 60
const MARGEN_DER = 12
const ALTURA_TOPE = 140
const ESPACIO_ARRIBA = 60
/** Cuánto sube y baja la fila entera al girarla: el extremo que se acerca baja, el que se aleja sube. */
const HOLGURA = 44
const ESPACIO_ABAJO = 40
const ALTO_ESCENA = ESPACIO_ARRIBA + ALTURA_TOPE + 2 * HOLGURA + ESPACIO_ABAJO
const Y_SUELO = ESPACIO_ARRIBA + ALTURA_TOPE + HOLGURA
const MAX_ANCHO_CASILLA = 64

type Pieza = 'pautado' | 'hecho'

const RELLENO: Record<Pieza, Record<NombreCara, string>> = {
  pautado: {
    frente: 'fill-silver-500/25',
    derecha: 'fill-silver-500/15',
    izquierda: 'fill-silver-500/15',
    arriba: 'fill-silver-500/40',
  },
  hecho: {
    frente: 'fill-rojo',
    derecha: 'fill-rojo-osc',
    izquierda: 'fill-rojo-osc',
    arriba: 'fill-[#ff6b6b]',
  },
}

function puntos(c: CajaProyectada['caras'][number], origenX: number): string {
  return c.puntos.map((p) => `${(origenX + p.x).toFixed(1)},${(Y_SUELO + p.y).toFixed(1)}`).join(' ')
}

interface Props {
  /** Solo los microciclos de la ventana que se está mirando. */
  filas: readonly PautadoVsHechoMicrociclo[]
  magnitud: MagnitudPautado
  vista: VistaEscena
  /** El ancho real en píxeles: 1 unidad del SVG = 1 px, así el texto mide lo que dice. */
  ancho: number
  seleccionado: string | undefined
  onSeleccionar: (id: string) => void
  /** El arrastre de lado: la escena avisa del gesto y quien la contiene decide el ángulo. */
  onArrastre: (inicio: VistaEscena, dx: number, terminado: boolean, velocidad: number) => void
  vistaActual: () => VistaEscena
}

export function EscenaPautadoHecho({
  filas,
  magnitud,
  vista,
  ancho,
  seleccionado,
  onSeleccionar,
  onArrastre,
  vistaActual,
}: Props) {
  const arrastre = useRef<{
    id: number
    x0: number
    ultimoX: number
    ultimoT: number
    /** px por milisegundo, suavizada: lo que decide cuánto sigue girando al soltar. */
    vel: number
    inicio: VistaEscena
    moviendo: boolean
  } | null>(null)

  const n = Math.max(1, filas.length)
  const util = ancho - MARGEN_IZQ - MARGEN_DER
  const casilla = Math.min(MAX_ANCHO_CASILLA, util / n)
  const total = casilla * n
  const centroX = MARGEN_IZQ + util / 2
  const x0Mundo = -total / 2

  const valores = filas.flatMap((f) =>
    motivoSinBarras(f, magnitud) ? [] : [f[magnitud].pautado, f[magnitud].hecho],
  )
  const eje = ejeDesdeCero(Math.max(0, ...valores))
  const alto = (v: number) => (v / eje.tope) * ALTURA_TOPE

  // Medidas en profundidad: el hecho delante, su fantasma detrás, con un respiro entre los dos.
  const zHecho = { z0: -0.58 * casilla, z1: -0.03 * casilla }
  const zPauta = { z0: 0.03 * casilla, z1: 0.58 * casilla }
  const fondo = 0.7 * casilla

  const P = (x: number, y: number, z: number) => {
    const p = proyectar({ x, y, z }, vista)
    return { x: centroX + p.x, y: Y_SUELO + p.y }
  }

  const suelo = [P(x0Mundo, 0, -fondo), P(x0Mundo + total, 0, -fondo), P(x0Mundo + total, 0, fondo), P(x0Mundo, 0, fondo)]

  const unidad = magnitud === 'series' ? 'series' : 'kg·rep'

  const casillas = filas.map((fila, i) => {
    const cx = x0Mundo + (i + 0.5) * casilla
    const motivo = motivoSinBarras(fila, magnitud)
    const ancho2 = casilla * 0.36
    const caja = (z: { z0: number; z1: number }, altoCaja: number) =>
      cajaProyectada({ x0: cx - ancho2, x1: cx + ancho2, z0: z.z0, z1: z.z1, alto: altoCaja }, vista)
    const pauta = motivo ? undefined : caja(zPauta, alto(fila[magnitud].pautado))
    const hecho = motivo ? undefined : caja(zHecho, alto(fila[magnitud].hecho))
    return { fila, cx, motivo, pauta, hecho, profundidad: proyectar({ x: cx, y: 0, z: 0 }, vista).profundidad }
  })

  // De atrás hacia delante: el extremo que se aleja se pinta antes.
  const ordenadas = [...casillas].sort((a, b) => b.profundidad - a.profundidad)

  const alPulsar = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    arrastre.current = {
      id: e.pointerId,
      x0: e.clientX,
      ultimoX: e.clientX,
      ultimoT: e.timeStamp,
      vel: 0,
      inicio: vistaActual(),
      moviendo: false,
    }
  }

  const alMover = (e: PointerEvent<SVGSVGElement>) => {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId) return
    const dx = e.clientX - a.x0
    if (!a.moviendo) {
      // Hasta 5 px es un toque, no un arrastre: así tocar una barra no la gira.
      if (Math.abs(dx) < 5) return
      a.moviendo = true
      // Con captura, el gesto sigue aunque el dedo salga de la escena; sin ella, no.
      e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    const dt = e.timeStamp - a.ultimoT
    if (dt > 0) a.vel = 0.7 * a.vel + 0.3 * ((e.clientX - a.ultimoX) / dt)
    a.ultimoX = e.clientX
    a.ultimoT = e.timeStamp
    onArrastre(a.inicio, dx, false, a.vel)
  }

  const alSoltar = (e: PointerEvent<SVGSVGElement>) => {
    const a = arrastre.current
    if (!a || a.id !== e.pointerId) return
    arrastre.current = null
    if (a.moviendo) onArrastre(a.inicio, e.clientX - a.x0, true, a.vel)
  }

  const alTeclear = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSeleccionar(id)
    }
  }

  return (
    <svg
      viewBox={`0 0 ${ancho} ${ALTO_ESCENA}`}
      className="escena-giro block h-auto w-full"
      role="group"
      aria-label={`Escena en tres dimensiones de ${unidad} por semana. Cada barra es una semana; toca una para ver sus números.`}
      data-testid="escena-giro"
      data-giro={Math.round(vista.giro)}
      data-inclinacion={Math.round(vista.inclinacion)}
      onPointerDown={alPulsar}
      onPointerMove={alMover}
      onPointerUp={alSoltar}
      onPointerCancel={alSoltar}
    >
      {/* El suelo y la pared del fondo: el cero y las marcas del eje. */}
      <polygon points={suelo.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} className="fill-surface-2/60 stroke-linea" />
      {eje.marcas.map((m) => {
        const y = alto(m)
        const a = P(x0Mundo, y, fondo)
        const b = P(x0Mundo + total, y, fondo)
        const izq = P(x0Mundo, y, -fondo)
        return (
          <g key={m}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={m === 0 ? 'stroke-tenue' : 'stroke-linea'} strokeDasharray={m === 0 ? undefined : '3 5'} />
            {Math.hypot(izq.x - a.x, izq.y - a.y) > 0.5 && (
              <line x1={izq.x} y1={izq.y} x2={a.x} y2={a.y} className="stroke-linea" strokeDasharray="3 5" />
            )}
            <text x={a.x - 6} y={a.y + 4} textAnchor="end" className="cifras fill-tenue" fontSize={12}>
              {numeroExacto(m)}
            </text>
          </g>
        )
      })}
      <text x={6} y={ESPACIO_ARRIBA - 24} className="fill-tenue" fontSize={12}>
        {unidad}
      </text>

      {ordenadas.map(({ fila, cx, motivo, pauta, hecho }, orden) => {
        const activa = seleccionado === fila.id
        const pie = P(cx, 0, -fondo)
        const centroSuelo = P(cx, 0, 0)
        const anchoToque = Math.max(34, casilla * Math.cos((vista.giro * Math.PI) / 180))
        const etiqueta = motivo
          ? `${nombreDelMicrociclo(fila.numero, true)}: ${motivo}.`
          : `${nombreDelMicrociclo(fila.numero, true)}: te pedimos ${numeroExacto(fila[magnitud].pautado)} ${unidad}, hiciste ${numeroExacto(fila[magnitud].hecho)}.`
        const pct = motivo ? undefined : fila[magnitud].cumplimientoPct
        return (
          <g
            key={`${magnitud}-${fila.id}`}
            role="button"
            tabIndex={0}
            aria-pressed={activa}
            aria-label={etiqueta}
            data-microciclo={fila.numero}
            onClick={() => onSeleccionar(fila.id)}
            onKeyDown={(e) => alTeclear(e, fila.id)}
            className="cursor-pointer outline-none [&:focus-visible>rect.foco]:stroke-rojo"
          >
            <rect x={centroSuelo.x - anchoToque / 2} y={0} width={anchoToque} height={ALTO_ESCENA} fill="transparent" />
            <rect className="foco" x={centroSuelo.x - anchoToque / 2} y={2} width={anchoToque} height={ALTO_ESCENA - 4} rx={6} fill="none" strokeWidth={2} stroke="transparent" />

            {motivo ? (
              <text
                transform={`translate(${(centroSuelo.x + 4).toFixed(1)} ${(centroSuelo.y - 8).toFixed(1)}) rotate(-90)`}
                className="escena-texto fill-tenue"
                fontSize={12}
              >
                {motivo}
              </text>
            ) : (
              <>
                <g className="escena-barra barra-sube" style={{ animationDelay: `${orden * 45}ms` }}>
                  {pauta?.caras.map((c) => (
                    <polygon
                      key={c.nombre}
                      points={puntos(c, centroX)}
                      className={`${RELLENO.pautado[c.nombre]} ${activa ? 'stroke-texto' : 'stroke-silver-500/80'}`}
                      strokeWidth={activa ? 1.5 : 1}
                      strokeDasharray={activa ? undefined : '3 3'}
                    />
                  ))}
                </g>
                <g className="escena-barra barra-sube" style={{ animationDelay: `${orden * 45 + 120}ms` }}>
                  {hecho?.caras.map((c) => (
                    <polygon
                      key={c.nombre}
                      points={puntos(c, centroX)}
                      className={`${RELLENO.hecho[c.nombre]} ${activa ? 'stroke-texto' : 'stroke-transparent'}`}
                      strokeWidth={activa ? 2 : 1}
                    />
                  ))}
                </g>
                {/* Los números van de pie y aparecen cuando la barra ya llegó. */}
                {pauta && (
                  <text
                    transform={`translate(${(centroX + pauta.cima.x - 4).toFixed(1)} ${(Y_SUELO + pauta.cima.y - 6).toFixed(1)}) rotate(-90)`}
                    className="escena-texto cifras grafica-punto fill-tenue"
                    fontSize={12}
                    style={{ animationDelay: `${orden * 45 + 600}ms` }}
                    data-barra="pautado"
                  >
                    {numeroExacto(fila[magnitud].pautado)}
                  </text>
                )}
                {hecho && (
                  <text
                    transform={`translate(${(centroX + hecho.cima.x + 12).toFixed(1)} ${(Y_SUELO + hecho.cima.y - 6).toFixed(1)}) rotate(-90)`}
                    className={`escena-texto cifras grafica-punto ${activa ? 'fill-texto' : 'fill-texto/90'}`}
                    fontSize={12}
                    fontWeight={700}
                    style={{ animationDelay: `${orden * 45 + 700}ms` }}
                    data-barra="hecho"
                  >
                    {numeroExacto(fila[magnitud].hecho)}
                  </text>
                )}
              </>
            )}

            <text x={pie.x} y={pie.y + 18} textAnchor="middle" className={`cifras ${activa ? 'fill-rojo' : 'fill-texto'}`} fontSize={12} fontWeight={700}>
              {fila.numero}
            </text>
            <text x={pie.x} y={pie.y + 33} textAnchor="middle" className="cifras fill-tenue" fontSize={12}>
              {pct === undefined ? '' : `${pct}%`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
