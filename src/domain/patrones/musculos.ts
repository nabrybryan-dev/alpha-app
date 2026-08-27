/**
 * Musculatura del visor.
 *
 * Cada músculo es un haz de fascículos que van de origen a inserción pasando
 * por puntos de vía, y se regenera en cada cambio de pose.
 *
 * Lo que hace que esto enseñe algo y no sea decoración: el vientre se acorta y
 * engorda cuando los anclajes se acercan, con volumen constante —el radio va
 * con la inversa de la raíz de la longitud—. El asesorado ve QUÉ músculo se
 * acorta, que es justo lo que hay que entender de un patrón.
 *
 * Ojo con los ejes: fémur, tibia, húmero y antebrazo llevan un reposo de 180°
 * en X, así que en ESOS huesos el +Z local apunta hacia ATRÁS del cuerpo y los
 * desplazamientos posteriores en ellos son positivos en Z.
 */

import { limitar, V, type Vec3 } from './algebra'
import {
  INDICE_HUESO,
  LADO,
  puntoDeHueso,
  type EsqueletoResuelto,
  type Lado,
} from './esqueleto'
import { curva, Malla, tubo, type Color } from './malla'

export const COLOR_PASIVO: Color = [0.56, 0.532, 0.5]
export const COLOR_SINERGISTA: Color = [0.745, 0.33, 0.268]
export const COLOR_AGONISTA: Color = [0.69, 0.135, 0.118]

/** `[hueso, t a lo largo del hueso, desplazamiento local]`. */
type Anclaje = [string, number, Vec3]

export interface Musculo {
  id: string
  nombre: string
  radio: number
  fasciculos: number
  aplanar: number
  origen: Anclaje
  insercion: Anclaje
  /** Dispersión del origen y de la inserción entre fascículos: el abanico. */
  abanicoOrigen?: Vec3
  abanicoInsercion?: Vec3
  via?: Anclaje[]
}

/**
 * La X del desplazamiento se multiplica por el lado, de modo que cada músculo
 * se declara una sola vez y sirve para los dos.
 */
export const MUSCULOS: Musculo[] = [
  // ---------------------------- Tren inferior -----------------------------
  { id: 'gluteo_mayor', nombre: 'Glúteo mayor', radio: 0.03, fasciculos: 3, aplanar: 0.72,
    origen: ['pelvis', 0, [0.052, 0.048, -0.052]], abanicoOrigen: [0.02, -0.06, 0.01],
    insercion: ['muslo', 0.26, [0.018, 0, 0.03]], abanicoInsercion: [0.004, -0.055, 0.004],
    via: [['muslo', 0.06, [0.038, 0, 0.042]]] },

  { id: 'gluteo_medio', nombre: 'Glúteo medio', radio: 0.023, fasciculos: 2, aplanar: 0.7,
    origen: ['pelvis', 0, [0.082, 0.078, -0.014]], abanicoOrigen: [0.006, -0.014, 0.052],
    insercion: ['muslo', 0.06, [0.032, 0, 0.004]], abanicoInsercion: [0.002, 0.01, 0.004] },

  { id: 'tfl', nombre: 'Tensor fascia lata', radio: 0.013, fasciculos: 1, aplanar: 0.55,
    origen: ['pelvis', 0, [0.076, 0.074, 0.028]],
    insercion: ['tibia', 0.06, [0.03, 0, -0.002]],
    via: [['muslo', 0.55, [0.046, 0, 0.002]]] },

  { id: 'isquios', nombre: 'Isquiotibiales', radio: 0.024, fasciculos: 2, aplanar: 0.8,
    origen: ['pelvis', 0, [0.056, -0.064, -0.018]], abanicoOrigen: [0.016, 0, 0.006],
    insercion: ['tibia', 0.08, [0.018, 0, 0.026]], abanicoInsercion: [-0.04, 0, 0.002],
    via: [['muslo', 0.55, [0.014, 0, 0.04]]] },

  { id: 'cuadriceps', nombre: 'Cuádriceps', radio: 0.027, fasciculos: 3, aplanar: 0.82,
    origen: ['muslo', 0.1, [0.016, 0, -0.026]], abanicoOrigen: [0.04, 0.03, 0.006],
    insercion: ['tibia', 0.07, [0, 0, -0.033]], abanicoInsercion: [0.01, 0, 0],
    via: [['muslo', 0.62, [0.01, 0, -0.04]]] },

  { id: 'aductores', nombre: 'Aductores', radio: 0.021, fasciculos: 2, aplanar: 0.72,
    origen: ['pelvis', 0, [0.024, -0.056, 0.016]], abanicoOrigen: [0.014, 0.008, -0.028],
    insercion: ['muslo', 0.58, [0.02, 0, 0.012]], abanicoInsercion: [0.002, -0.13, 0.004] },

  { id: 'gastrocnemio', nombre: 'Gastrocnemio', radio: 0.021, fasciculos: 2, aplanar: 0.85,
    origen: ['muslo', 0.96, [0.018, 0, 0.032]], abanicoOrigen: [-0.036, 0, 0],
    insercion: ['pie', 0, [0, -0.022, -0.034]],
    via: [['tibia', 0.42, [0.01, 0, 0.04]], ['tibia', 0.86, [0.004, 0, 0.026]]] },

  { id: 'soleo', nombre: 'Sóleo', radio: 0.019, fasciculos: 1, aplanar: 0.88,
    origen: ['tibia', 0.22, [0.006, 0, 0.032]],
    insercion: ['pie', 0, [0, -0.02, -0.032]],
    via: [['tibia', 0.62, [0.006, 0, 0.036]]] },

  { id: 'tibial_ant', nombre: 'Tibial anterior', radio: 0.013, fasciculos: 1, aplanar: 0.7,
    origen: ['tibia', 0.24, [0.02, 0, -0.022]],
    insercion: ['pie', 0.36, [0.01, 0, -0.008]] },

  // -------------------------------- Tronco --------------------------------
  { id: 'erectores', nombre: 'Erectores espinales', radio: 0.019, fasciculos: 2, aplanar: 0.75,
    origen: ['pelvis', 0, [0.022, 0.02, -0.048]], abanicoOrigen: [0.018, 0, 0],
    insercion: ['torax', 0.88, [0.018, 0, -0.036]], abanicoInsercion: [0.006, -0.18, 0],
    via: [['lumbar', 0.5, [0.026, 0, -0.038]], ['torax', 0.45, [0.024, 0, -0.04]]] },

  { id: 'recto_abdominal', nombre: 'Recto abdominal', radio: 0.018, fasciculos: 1, aplanar: 0.62,
    origen: ['pelvis', 0, [0.02, -0.032, 0.046]],
    insercion: ['torax', 0.24, [0.022, 0, 0.101]],
    via: [['lumbar', 0.55, [0.021, 0, 0.078]]] },

  { id: 'oblicuos', nombre: 'Oblicuos', radio: 0.02, fasciculos: 2, aplanar: 0.55,
    origen: ['pelvis', 0, [0.07, 0.036, 0.014]], abanicoOrigen: [-0.012, 0.006, -0.04],
    insercion: ['torax', 0.44, [0.052, 0, 0.046]], abanicoInsercion: [0.008, 0.06, -0.052] },

  { id: 'dorsal_ancho', nombre: 'Dorsal ancho', radio: 0.024, fasciculos: 4, aplanar: 0.42,
    origen: ['pelvis', 0, [0.036, 0.06, -0.05]], abanicoOrigen: [0.026, 0.3, 0.006],
    insercion: ['brazo', 0.14, [0.008, 0, 0.018]], abanicoInsercion: [0.002, 0.01, 0.002],
    via: [['torax', 0.34, [0.096, 0, -0.01]]] },

  { id: 'trapecio_sup', nombre: 'Trapecio superior', radio: 0.017, fasciculos: 2, aplanar: 0.5,
    origen: ['cuello', 0.55, [0.006, 0, -0.026]], abanicoOrigen: [0.004, 0.048, -0.006],
    insercion: ['clavicula', 0.82, [0.002, 0, -0.014]], abanicoInsercion: [0.004, 0.03, 0] },

  { id: 'trapecio_med', nombre: 'Trapecio medio', radio: 0.018, fasciculos: 2, aplanar: 0.4,
    origen: ['torax', 0.8, [0.01, 0, -0.034]], abanicoOrigen: [0.002, -0.07, 0],
    insercion: ['escapula', 0.42, [-0.024, 0, -0.016]], abanicoInsercion: [0.006, -0.06, 0] },

  { id: 'trapecio_inf', nombre: 'Trapecio inferior', radio: 0.016, fasciculos: 2, aplanar: 0.4,
    origen: ['torax', 0.34, [0.01, 0, -0.036]], abanicoOrigen: [0.002, 0.09, 0],
    insercion: ['escapula', 0.16, [-0.01, 0, -0.014]], abanicoInsercion: [0.006, 0.03, 0] },

  { id: 'romboides', nombre: 'Romboides', radio: 0.015, fasciculos: 2, aplanar: 0.42,
    origen: ['torax', 0.7, [0.01, 0, -0.032]], abanicoOrigen: [0.002, -0.07, 0],
    insercion: ['escapula', 0.52, [0.004, 0, -0.012]], abanicoInsercion: [0.004, -0.06, 0] },

  { id: 'serrato', nombre: 'Serrato anterior', radio: 0.012, fasciculos: 3, aplanar: 0.55,
    origen: ['torax', 0.36, [0.088, 0, 0.03]], abanicoOrigen: [0.008, 0.09, -0.014],
    insercion: ['escapula', 0.55, [0.012, 0, 0.002]], abanicoInsercion: [0.002, -0.1, 0] },

  { id: 'pectoral_est', nombre: 'Pectoral mayor', radio: 0.021, fasciculos: 3, aplanar: 0.45,
    origen: ['torax', 0.3, [0.018, 0, 0.078]], abanicoOrigen: [0.006, 0.13, -0.008],
    insercion: ['brazo', 0.15, [0.008, 0, -0.02]], abanicoInsercion: [0.002, 0.012, 0.002] },

  { id: 'pectoral_clav', nombre: 'Pectoral clavicular', radio: 0.016, fasciculos: 2, aplanar: 0.48,
    origen: ['clavicula', 0.42, [0.002, 0, 0.014]], abanicoOrigen: [0.004, 0.07, -0.002],
    insercion: ['brazo', 0.12, [0.01, 0, -0.022]], abanicoInsercion: [0.002, 0.01, 0] },

  // ---------------------------- Hombro y brazo ----------------------------
  { id: 'deltoides_ant', nombre: 'Deltoides anterior', radio: 0.017, fasciculos: 2, aplanar: 0.62,
    origen: ['clavicula', 0.8, [0.004, 0, 0.016]], abanicoOrigen: [0.004, 0.03, -0.006],
    insercion: ['brazo', 0.44, [0.016, 0, -0.01]], abanicoInsercion: [0.002, 0.02, 0.002],
    via: [['brazo', 0.12, [0.03, 0, -0.022]]] },

  { id: 'deltoides_med', nombre: 'Deltoides medio', radio: 0.019, fasciculos: 2, aplanar: 0.66,
    origen: ['escapula', 0.86, [0.018, 0, -0.008]], abanicoOrigen: [0.006, 0.02, 0.014],
    insercion: ['brazo', 0.46, [0.026, 0, 0]], abanicoInsercion: [0.002, 0.022, 0.002],
    via: [['brazo', 0.14, [0.04, 0, 0]]] },

  { id: 'deltoides_post', nombre: 'Deltoides posterior', radio: 0.016, fasciculos: 2, aplanar: 0.6,
    origen: ['escapula', 0.58, [0.01, 0, -0.022]], abanicoOrigen: [0.006, -0.036, -0.004],
    insercion: ['brazo', 0.44, [0.014, 0, 0.014]], abanicoInsercion: [0.002, 0.02, 0.002],
    via: [['brazo', 0.13, [0.03, 0, 0.026]]] },

  { id: 'redondo_mayor', nombre: 'Redondo mayor', radio: 0.013, fasciculos: 1, aplanar: 0.6,
    origen: ['escapula', 0.12, [0.016, 0, -0.006]],
    insercion: ['brazo', 0.15, [0.006, 0, 0.018]] },

  { id: 'infraespinoso', nombre: 'Infraespinoso', radio: 0.013, fasciculos: 2, aplanar: 0.45,
    origen: ['escapula', 0.38, [0.02, 0, -0.014]], abanicoOrigen: [0.004, -0.05, 0],
    insercion: ['brazo', 0.07, [0.022, 0, 0.01]], abanicoInsercion: [0.002, 0.012, 0] },

  { id: 'supraespinoso', nombre: 'Supraespinoso', radio: 0.011, fasciculos: 1, aplanar: 0.5,
    origen: ['escapula', 0.56, [-0.004, 0, -0.02]],
    insercion: ['brazo', 0.04, [0.024, 0, -0.002]],
    via: [['escapula', 0.84, [0.014, 0, -0.012]]] },

  { id: 'biceps', nombre: 'Bíceps braquial', radio: 0.016, fasciculos: 2, aplanar: 0.85,
    origen: ['escapula', 0.74, [0.004, 0, 0.008]], abanicoOrigen: [0.014, 0.01, -0.01],
    insercion: ['antebrazo', 0.16, [0.012, 0, -0.014]], abanicoInsercion: [0.004, 0, 0],
    via: [['brazo', 0.52, [0.006, 0, -0.026]]] },

  { id: 'braquial', nombre: 'Braquial', radio: 0.012, fasciculos: 1, aplanar: 0.8,
    origen: ['brazo', 0.5, [0.004, 0, -0.02]],
    insercion: ['antebrazo', 0.11, [-0.008, 0, -0.013]] },

  { id: 'triceps', nombre: 'Tríceps braquial', radio: 0.018, fasciculos: 3, aplanar: 0.82,
    origen: ['escapula', 0.14, [0.01, 0, -0.01]], abanicoOrigen: [0.02, 0.1, 0.03],
    insercion: ['antebrazo', 0.03, [0, 0, 0.022]], abanicoInsercion: [0.006, 0, 0],
    via: [['brazo', 0.6, [0.006, 0, 0.026]]] },

  { id: 'braquiorradial', nombre: 'Braquiorradial', radio: 0.012, fasciculos: 1, aplanar: 0.7,
    origen: ['brazo', 0.84, [0.02, 0, -0.012]],
    insercion: ['antebrazo', 0.86, [0.014, 0, -0.008]],
    via: [['antebrazo', 0.3, [0.024, 0, -0.016]]] },
]

export const MUSCULO_POR_ID: Record<string, Musculo> = Object.fromEntries(
  MUSCULOS.map((m) => [m.id, m]),
)

/** Activación por músculo, de 0 a 1. El sufijo `:D` / `:I` lo hace unilateral. */
export type Activacion = Record<string, number>

function anclaje(
  esq: EsqueletoResuelto,
  spec: Anclaje,
  lado: Lado,
  abanico: Vec3 | undefined,
  f: number,
  nf: number,
): Vec3 {
  const [hueso, t, desvio] = spec
  const k = LADO[lado]
  // El fascículo se separa del eje del haz: así el dorsal o el pectoral se leen
  // como abanico de fibras y no como un cable.
  const u = nf > 1 ? f / (nf - 1) - 0.5 : 0
  const a = abanico ?? [0, 0, 0]
  // Los huesos del eje —pelvis, columna, cráneo— son únicos y no llevan sufijo;
  // los pares sí. Se declara "pelvis" o "muslo" y aquí se resuelve.
  const nombre = INDICE_HUESO[hueso + lado] ? hueso + lado : hueso
  return puntoDeHueso(esq, nombre, t, [
    k * (desvio[0] + a[0] * u),
    desvio[1] + a[1] * u,
    desvio[2] + a[2] * u,
  ])
}

export function trazadoDeFasciculo(
  esq: EsqueletoResuelto,
  mus: Musculo,
  lado: Lado,
  f: number,
): Vec3[] {
  const nf = mus.fasciculos
  const puntos: Vec3[] = [anclaje(esq, mus.origen, lado, mus.abanicoOrigen, f, nf)]
  for (const v of mus.via ?? []) puntos.push(anclaje(esq, v, lado, undefined, f, nf))
  puntos.push(anclaje(esq, mus.insercion, lado, mus.abanicoInsercion, f, nf))
  return puntos
}

function largoDeTrazado(puntos: Vec3[]): number {
  let l = 0
  for (let i = 1; i < puntos.length; i++) l += V.largo(V.restar(puntos[i], puntos[i - 1]))
  return l
}

/**
 * Longitudes en bipedestación neutra. Son la línea base contra la que se mide
 * cuánto se ha acortado cada vientre, así que se calculan una sola vez.
 */
export function longitudesEnReposo(reposo: EsqueletoResuelto): Record<string, number> {
  const salida: Record<string, number> = {}
  for (const mus of MUSCULOS) {
    for (const lado of ['D', 'I'] as Lado[]) {
      for (let f = 0; f < mus.fasciculos; f++) {
        salida[mus.id + lado + f] = largoDeTrazado(trazadoDeFasciculo(reposo, mus, lado, f))
      }
    }
  }
  return salida
}

export function colorDeMusculo(activacion: number): Color {
  if (activacion <= 0) return COLOR_PASIVO
  const a = limitar(activacion, 0, 1)
  // Dos tramos: primero vira a coral —sinergista— y luego a carmín —agonista.
  const mezclar = (x: Color, y: Color, t: number): Color => [
    x[0] + (y[0] - x[0]) * t,
    x[1] + (y[1] - x[1]) * t,
    x[2] + (y[2] - x[2]) * t,
  ]
  return a < 0.5
    ? mezclar(COLOR_PASIVO, COLOR_SINERGISTA, a / 0.5)
    : mezclar(COLOR_SINERGISTA, COLOR_AGONISTA, (a - 0.5) / 0.5)
}

export function construirMusculos(
  esq: EsqueletoResuelto,
  activacion: Activacion,
  enReposo: Record<string, number>,
): Malla {
  const m = new Malla()
  for (const mus of MUSCULOS) {
    for (const lado of ['D', 'I'] as Lado[]) {
      const a = activacion[mus.id + ':' + lado] ?? activacion[mus.id] ?? 0
      const color = colorDeMusculo(a)
      for (let f = 0; f < mus.fasciculos; f++) {
        const control = trazadoDeFasciculo(esq, mus, lado, f)
        const largo = largoDeTrazado(control)
        const largo0 = enReposo[mus.id + lado + f] ?? largo
        // Volumen constante: al acortarse, el vientre engorda con 1/raíz(L).
        const ensanche = limitar(Math.sqrt(largo0 / (largo || 1e-6)), 0.78, 1.55)
        // Y el que trabaja se marca algo más, como en contracción real. Que el
        // inactivo sea además más fino evita que tape el esqueleto.
        const tono = 0.86 + a * 0.3
        // Doce anillos de siete lados: con más resolución la malla se veía
        // igual y el cuadro no cabía en los 16 ms que hay a 60 fps.
        const puntos = curva(control, 12)
        tubo(
          m,
          puntos,
          (t) => {
            // Perfil fusiforme: tendón fino en los extremos, vientre al centro.
            const vientre = Math.pow(Math.sin(Math.PI * limitar(t, 0, 1)), 0.55)
            return mus.radio * (0.3 + 0.7 * vientre) * ensanche * tono
          },
          { radial: 7, color, hueso: 0, aplanar: mus.aplanar, tapar: true },
        )
      }
    }
  }
  return m
}
