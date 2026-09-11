/**
 * EL GESTO, DIBUJADO: los huesos de un patrón proyectados con la cámara del salón.
 *
 * Sale un JSON con los segmentos en 2D de cada fase, para pintarlos como SVG y MIRARLOS. No
 * sustituye a la app —aquí no hay músculo, ni piel, ni aparato— pero enseña lo único que se
 * discute cuando algo «se ve antinatural»: dónde está cada hueso y hacia dónde apunta.
 *
 * La cámara es la misma que usa el salón (`camaraDelSalon`), así que lo que se ve aquí es el
 * ángulo desde el que el asesorado va a ver el ejercicio.
 *
 *     npx vite-node scripts/dibujar-gesto.mjs empuje_vertical abduccion_hombro > gestos.json
 */
import { PATRON_POR_ID } from '../src/domain/patrones/catalogo.ts'
import { esqueletoEnFase } from '../src/domain/patrones/escena.ts'
import { puntoDeHueso } from '../src/domain/patrones/esqueleto.ts'
import { camaraDelSalon, proyectar, ANCHO, ALTO } from '../src/features/entrenar/escena/encuadreDelSalon.ts'
import { brazoDe } from './medir-hombro.mjs'

/** Los huesos que se dibujan, y de qué grupo son para darles color. */
const TRAZOS = [
  ['pelvis', 'tronco'], ['lumbar', 'tronco'], ['torax', 'tronco'], ['cuello', 'tronco'], ['craneo', 'cabeza'],
  ['claviculaD', 'tronco'], ['claviculaI', 'tronco'],
  ['brazoD', 'brazo'], ['antebrazoD', 'antebrazo'], ['manoD', 'mano'],
  ['brazoI', 'brazo'], ['antebrazoI', 'antebrazo'], ['manoI', 'mano'],
  ['musloD', 'pierna'], ['tibiaD', 'pierna'], ['pieD', 'pierna'],
  ['musloI', 'pierna'], ['tibiaI', 'pierna'], ['pieI', 'pierna'],
]

const FASES = [0, 0.25, 0.5, 0.75, 1]
const r1 = (x) => Math.round(x * 10) / 10

const salida = {}
for (const id of process.argv.slice(2)) {
  const patron = PATRON_POR_ID[id]
  if (!patron) throw new Error(`no existe el patrón ${id}`)
  const { vista, proy } = camaraDelSalon(patron)
  salida[id] = {
    titulo: patron.titulo,
    ejemplo: patron.ejemplos.split('·')[0].trim(),
    claves: patron.claves,
    ancho: ANCHO,
    alto: ALTO,
    fases: FASES.map((f) => {
      const esq = esqueletoEnFase(patron, f)
      const segmentos = []
      for (const [hueso, grupo] of TRAZOS) {
        const a = proyectar(vista, proy, puntoDeHueso(esq, hueso, 0))
        const b = proyectar(vista, proy, puntoDeHueso(esq, hueso, 1))
        if (a && b) segmentos.push({ grupo, x1: r1(a.x), y1: r1(a.y), x2: r1(b.x), y2: r1(b.y), z: r1((a.z + b.z) / 2) })
      }
      const b = brazoDe(esq, 'D')
      return {
        fase: f,
        segmentos,
        medidas: {
          elevacion: Math.round(b.elevacion),
          plano: b.plano === null ? null : Math.round(b.plano),
          codo: Math.round(180 - b.codo),
        },
      }
    }),
  }
}
console.log(JSON.stringify(salida))
