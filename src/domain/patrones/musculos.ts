/**
 * Geometría de la musculatura.
 *
 * El catálogo anatómico vive en `musculosInferior.ts` y `musculosSuperior.ts`;
 * aquí solo se convierte en malla.
 *
 * Lo que hace que esto enseñe algo y no sea decoración: el vientre se acorta y
 * engorda cuando sus anclajes se acercan, con volumen constante —el radio va
 * con la inversa de la raíz de la longitud—. El asesorado ve QUÉ porción se
 * acorta, que es justo lo que hay que entender de un patrón.
 */

import { limitar, V, type Vec3 } from './algebra'
import {
  activacionDe,
  clavePorcion,
  indexarPorciones,
  type Activacion,
  type Anclaje,
  type Musculo,
  type Porcion,
  type PorcionLocalizada,
} from './anatomia'
import { INDICE_HUESO, LADO, puntoDeHueso, type EsqueletoResuelto, type Lado } from './esqueleto'
import { curva, Malla, tubo, type Color } from './malla'
import { MUSCULOS_INFERIOR } from './musculosInferior'
import { MUSCULOS_SUPERIOR } from './musculosSuperior'

export const COLOR_PASIVO: Color = [0.56, 0.532, 0.5]
export const COLOR_SINERGISTA: Color = [0.745, 0.33, 0.268]
export const COLOR_AGONISTA: Color = [0.69, 0.135, 0.118]

export const MUSCULOS: Musculo[] = [...MUSCULOS_INFERIOR, ...MUSCULOS_SUPERIOR]

export const MUSCULO_POR_ID: Record<string, Musculo> = Object.fromEntries(
  MUSCULOS.map((m) => [m.id, m]),
)

export const PORCIONES: PorcionLocalizada[] = indexarPorciones(MUSCULOS)

export const PORCION_POR_CLAVE: Record<string, PorcionLocalizada> = Object.fromEntries(
  PORCIONES.map((p) => [p.clave, p]),
)

const LADOS: Lado[] = ['D', 'I']

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
  // los pares sí. Se declara 'pelvis' o 'muslo' y aquí se resuelve.
  const nombre = INDICE_HUESO[hueso + lado] ? hueso + lado : hueso
  return puntoDeHueso(esq, nombre, t, [
    k * (desvio[0] + a[0] * u),
    desvio[1] + a[1] * u,
    desvio[2] + a[2] * u,
  ])
}

/** Recorrido de un fascículo concreto de una porción, en espacio mundo. */
export function trazadoDeFasciculo(
  esq: EsqueletoResuelto,
  porcion: Porcion,
  lado: Lado,
  f: number,
): Vec3[] {
  const nf = porcion.fasciculos ?? 1
  const puntos: Vec3[] = [anclaje(esq, porcion.desde, lado, porcion.abanicoDesde, f, nf)]
  for (const v of porcion.via ?? []) puntos.push(anclaje(esq, v, lado, undefined, f, nf))
  puntos.push(anclaje(esq, porcion.hasta, lado, porcion.abanicoHasta, f, nf))
  return puntos
}

export function largoDeTrazado(puntos: Vec3[]): number {
  let l = 0
  for (let i = 1; i < puntos.length; i++) l += V.largo(V.restar(puntos[i], puntos[i - 1]))
  return l
}

/**
 * Longitudes en bipedestación neutra: la línea base contra la que se mide
 * cuánto se ha acortado cada vientre. Se calculan una sola vez.
 */
export function longitudesEnReposo(reposo: EsqueletoResuelto): Record<string, number> {
  const salida: Record<string, number> = {}
  for (const { musculo, porcion } of PORCIONES) {
    for (const lado of LADOS) {
      for (let f = 0; f < (porcion.fasciculos ?? 1); f++) {
        const clave = `${clavePorcion(musculo.id, porcion.id)}${lado}${f}`
        salida[clave] = largoDeTrazado(trazadoDeFasciculo(reposo, porcion, lado, f))
      }
    }
  }
  return salida
}

export function colorDeMusculo(activacion: number): Color {
  if (activacion <= 0) return COLOR_PASIVO
  const a = limitar(activacion, 0, 1)
  const mezclar = (x: Color, y: Color, t: number): Color => [
    x[0] + (y[0] - x[0]) * t,
    x[1] + (y[1] - x[1]) * t,
    x[2] + (y[2] - x[2]) * t,
  ]
  // Dos tramos: primero vira a coral —sinergista— y luego a carmín —agonista.
  return a < 0.5
    ? mezclar(COLOR_PASIVO, COLOR_SINERGISTA, a / 0.5)
    : mezclar(COLOR_SINERGISTA, COLOR_AGONISTA, (a - 0.5) / 0.5)
}

/**
 * `reutilizar` evita reservar memoria en cada cuadro. La topología es la misma
 * siempre —solo cambian las posiciones—, así que el buffer del cuadro anterior
 * sirve tal cual y basta con poner el cursor a cero.
 */
/**
 * Grosor del músculo a lo largo de su recorrido, de 0 (origen) a 1 (inserción).
 *
 * Dos cosas que se ven y una que no se veía:
 *
 * - **Fusiforme**: fino en los extremos y grueso en el centro. Un músculo no es
 *   un tubo: son dos tendones y un vientre.
 * - **Volumen constante**: al acortarse, el vientre engorda con 1/raíz(L).
 * - **El tendón NO engorda.** Esto faltaba. El ensanche se aplicaba al tubo
 *   entero, así que al contraerse crecía también la parte tendinosa y el
 *   músculo se movía como una goma. Un tendón es colágeno: transmite la fuerza
 *   y no cambia de grosor. Ahora el ensanche se pondera por lo carnoso que sea
 *   cada punto, y en las inserciones —que es justo donde el asesorado mira para
 *   entender de dónde nace y dónde acaba— se queda quieto.
 */
export function radioDePorcion(
  t: number,
  radio: number,
  ensanche: number,
  tono: number,
): number {
  const u = Math.sin(Math.PI * limitar(t, 0, 1))
  // La silueta es ancha: un músculo se ensancha enseguida al salir del tendón.
  const silueta = Math.pow(u, 0.55)
  // Pero la parte que se abulta al contraerse es más estrecha que la silueta:
  // el vientre carnoso ocupa el centro, no todo lo que no es tendón. Con la
  // misma curva de la silueta, a un uno por ciento del origen ya engordaba un
  // 8 %, y ahí lo que hay es tendón.
  const carne = Math.pow(u, 1.6)
  const engorde = 1 + (ensanche - 1) * carne
  return radio * (0.3 + 0.7 * silueta) * engorde * tono
}

export function construirMusculos(
  esq: EsqueletoResuelto,
  activacion: Activacion,
  enReposo: Record<string, number>,
  reutilizar?: Malla,
): Malla {
  const m = reutilizar ?? new Malla(16384)
  m.reiniciar()
  for (const { musculo, porcion, clave } of PORCIONES) {
    for (const lado of LADOS) {
      const a = activacionDe(activacion, musculo.id, porcion.id, lado)
      const color = colorDeMusculo(a)
      const nf = porcion.fasciculos ?? 1
      for (let f = 0; f < nf; f++) {
        const control = trazadoDeFasciculo(esq, porcion, lado, f)
        const largo = largoDeTrazado(control)
        const largo0 = enReposo[`${clave}${lado}${f}`] ?? largo
        // Volumen constante: al acortarse, el vientre engorda con 1/raíz(L).
        const ensanche = limitar(Math.sqrt(largo0 / (largo || 1e-6)), 0.78, 1.55)
        // El que trabaja se marca algo más, como en contracción real. Que el
        // inactivo sea además más fino evita que tape el esqueleto.
        const tono = 0.86 + a * 0.3
        // Resolución según el grosor de la porción. Detallar la anatomía
        // multiplicó las porciones, y darles a todas la malla del glúteo mayor
        // se comía el presupuesto del cuadro sin que se notara en pantalla:
        // el poplíteo o el redondo menor son tubos de un centímetro.
        const grande = porcion.radio >= 0.018
        const anillos = grande ? 12 : porcion.radio >= 0.013 ? 10 : 8
        const lados = grande ? 7 : porcion.radio >= 0.013 ? 6 : 5
        const puntos = curva(control, anillos)
        tubo(
          m,
          puntos,
          (t) => radioDePorcion(t, porcion.radio, ensanche, tono),
          { radial: lados, color, hueso: 0, aplanar: porcion.aplanar ?? 1, tapar: true },
        )
      }
    }
  }
  return m
}

export type { Activacion, Musculo, Porcion, PorcionLocalizada }
export { activacionDe, activacionMaxima, clavePorcion, NOMBRE_DE_GRUPO } from './anatomia'
