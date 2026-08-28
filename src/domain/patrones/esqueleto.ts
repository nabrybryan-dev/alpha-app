/**
 * Esqueleto articulado del visor de patrones.
 *
 * Proporciones de un sujeto de ~1,70 m con el suelo en Y=0. El sujeto mira
 * hacia +Z y su lado DERECHO anatómico cae en −X: es lo que ve el asesorado si
 * se mira al espejo, que es la referencia con la que corrige su técnica.
 *
 * Cada hueso apunta a lo largo de su +Y local. `reposo` es la rotación que lo
 * coloca en bipedestación neutra, y la pose se aplica DESPUÉS, de modo que
 * todos los ángulos de los patrones valen 0 en posición anatómica.
 */

import { grados, M4, V, type Mat4, type Vec3 } from './algebra'
import type { Color } from './malla'

export const COLOR_HUESO: Color = [0.855, 0.835, 0.783]
export const COLOR_HUESO_OSCURO: Color = [0.7, 0.685, 0.64]

export interface DefinicionHueso {
  nombre: string
  padre: string | null
  /** Desplazamiento desde el origen del padre. */
  desde: Vec3
  largo: number
  reposo: Vec3
}

const d = grados

export const ESQUELETO: DefinicionHueso[] = [
  { nombre: 'pelvis', padre: null, desde: [0, 0.95, 0], largo: 0.1, reposo: [0, 0, 0] },
  { nombre: 'lumbar', padre: 'pelvis', desde: [0, 0.06, -0.005], largo: 0.17, reposo: [0, 0, 0] },
  { nombre: 'torax', padre: 'lumbar', desde: [0, 0.17, 0], largo: 0.28, reposo: [0, 0, 0] },
  { nombre: 'cuello', padre: 'torax', desde: [0, 0.27, -0.015], largo: 0.08, reposo: [0, 0, 0] },
  { nombre: 'craneo', padre: 'cuello', desde: [0, 0.08, 0], largo: 0.16, reposo: [0, 0, 0] },

  { nombre: 'claviculaD', padre: 'torax', desde: [-0.02, 0.245, 0.035], largo: 0.155, reposo: [0, 0, d(72)] },
  { nombre: 'claviculaI', padre: 'torax', desde: [0.02, 0.245, 0.035], largo: 0.155, reposo: [0, 0, d(-72)] },
  { nombre: 'escapulaD', padre: 'torax', desde: [-0.055, 0.235, -0.045], largo: 0.15, reposo: [0, 0, d(160)] },
  { nombre: 'escapulaI', padre: 'torax', desde: [0.055, 0.235, -0.045], largo: 0.15, reposo: [0, 0, d(-160)] },

  // El brazo cuelga del TÓRAX, no de la clavícula. La clavícula lleva un reposo
  // de 72° en Z, así que el húmero heredaba un eje X casi vertical: rotar sobre
  // él no era flexión de hombro sino rotación axial, y la pose salía torcida.
  { nombre: 'brazoD', padre: 'torax', desde: [-0.168, 0.232, 0.008], largo: 0.31, reposo: [d(180), 0, 0] },
  { nombre: 'brazoI', padre: 'torax', desde: [0.168, 0.232, 0.008], largo: 0.31, reposo: [d(180), 0, 0] },
  { nombre: 'antebrazoD', padre: 'brazoD', desde: [0, 0.31, 0], largo: 0.26, reposo: [0, 0, 0] },
  { nombre: 'antebrazoI', padre: 'brazoI', desde: [0, 0.31, 0], largo: 0.26, reposo: [0, 0, 0] },
  { nombre: 'manoD', padre: 'antebrazoD', desde: [0, 0.26, 0], largo: 0.18, reposo: [0, 0, 0] },
  { nombre: 'manoI', padre: 'antebrazoI', desde: [0, 0.26, 0], largo: 0.18, reposo: [0, 0, 0] },

  { nombre: 'musloD', padre: 'pelvis', desde: [-0.088, 0.005, 0], largo: 0.45, reposo: [d(180), 0, 0] },
  { nombre: 'musloI', padre: 'pelvis', desde: [0.088, 0.005, 0], largo: 0.45, reposo: [d(180), 0, 0] },
  { nombre: 'tibiaD', padre: 'musloD', desde: [0, 0.45, 0], largo: 0.43, reposo: [0, 0, 0] },
  { nombre: 'tibiaI', padre: 'musloI', desde: [0, 0.45, 0], largo: 0.43, reposo: [0, 0, 0] },
  { nombre: 'pieD', padre: 'tibiaD', desde: [0, 0.43, 0], largo: 0.22, reposo: [d(-90), 0, 0] },
  { nombre: 'pieI', padre: 'tibiaI', desde: [0, 0.43, 0], largo: 0.22, reposo: [d(-90), 0, 0] },
]

/** Índice del hueso en el array de matrices. El 0 queda para la identidad. */
export const INDICE_HUESO: Record<string, number> = {}
ESQUELETO.forEach((h, i) => {
  INDICE_HUESO[h.nombre] = i + 1
})

/** Multiplicador del eje X según el lado. La derecha del sujeto cae en −X. */
export const LADO: Record<'D' | 'I', number> = { D: -1, I: 1 }
export type Lado = 'D' | 'I'

/** Pose en canales anatómicos, en grados. */
export type Pose = Record<string, number>

export interface EsqueletoResuelto {
  mundo: Record<string, Mat4>
  matrices: Mat4[]
  largo: Record<string, number>
}

/**
 * Traduce los canales anatómicos a rotaciones.
 *
 * Un canal describe el movimiento como lo nombra un preparador —flexión,
 * abducción, rotación— y aquí se resuelve el signo que le toca a cada lado y a
 * cada articulación. Escribir los patrones directamente en ángulos de Euler se
 * descartó: es donde se cuelan los errores de signo que dejan una rodilla
 * doblada al revés sin que nada dé error.
 */
export function poseAEuler(pose: Pose): Record<string, Mat4> {
  const e: Record<string, Mat4> = {}
  const fijar = (h: string, rx: number, ry: number, rz: number) => {
    e[h] = M4.euler(rx || 0, ry || 0, rz || 0)
  }
  const g = (clave: string, porDefecto = 0): number =>
    pose[clave] !== undefined ? grados(pose[clave]) : porDefecto

  /**
   * Flexión en el plano sagital del CUERPO, no en el eje ya girado del hueso
   * padre. Sin esto, con el hombro abducido —un press de banca— cada codo se
   * doblaba hacia un lado distinto: la abducción lleva signo opuesto por lado y
   * arrastraba consigo el eje sobre el que después gira el codo.
   */
  const sagital = (rx: number, giroPadre: number, ry = 0): Mat4 =>
    M4.multiplicar(
      M4.girarZ(-giroPadre),
      M4.multiplicar(M4.euler(rx, ry, 0), M4.girarZ(giroPadre)),
    )

  // Tronco. Flexión positiva es hacia delante; el signo negativo lo echaba
  // hacia atrás, que es el error que hacía leer una bisagra como sentadilla.
  fijar('lumbar', g('lumbarFlex'), -g('lumbarRot'), g('lumbarLat'))
  fijar('torax', g('toraxFlex'), -g('toraxRot'), g('toraxLat'))
  // El cuello gira y se inclina, no solo flexiona. El giro va en Y y la
  // inclinación en Z, igual que en el resto de la columna.
  fijar('cuello', g('cuelloFlex'), g('cuelloRot'), g('cuelloIncl'))
  fijar('craneo', g('craneoFlex'), 0, 0)
  fijar('pelvis', -g('pelvisBascula'), -g('pelvisRot'), g('pelvisLat'))

  for (const s of ['D', 'I'] as Lado[]) {
    const k = LADO[s]

    // Cadera: flexión lleva la rodilla al frente, abducción separa de la línea
    // media. Los 2,5° de base son la apertura natural en bipedestación.
    const abdCadera = -k * (g('caderaAbd' + s, g('caderaAbd')) + grados(2.5))
    fijar('muslo' + s, -g('caderaFlex' + s, g('caderaFlex')), -k * g('caderaRot' + s, g('caderaRot')), abdCadera)

    // Rodilla y tobillo van por el plano sagital del cuerpo.
    e['tibia' + s] = sagital(g('rodillaFlex' + s, g('rodillaFlex')), abdCadera)
    e['pie' + s] = sagital(g('tobilloPlantar' + s, g('tobilloPlantar')), abdCadera)

    // Escápula: protracción la separa de la columna, elevación la sube.
    // La escápula gira sobre el tórax; el rig no la traslada, así que la
    // elevación se expresa como rotación. Con 15 cm de hueso, 25° suben su
    // extremo unos seis centímetros, que es el recorrido real de un encogimiento.
    // La rotación ascendente es la que sube el extremo externo de la escápula
    // y lleva la glenoides hacia arriba: sin ella el brazo no pasa de la
    // horizontal sin pinzar. Va en el mismo eje frontal que la elevación, con
    // más recorrido, y por eso pesa más que ella.
    fijar(
      'escapula' + s,
      0,
      0,
      k *
        (g('escapulaProt' + s, g('escapulaProt')) * 0.55 -
          g('escapulaElev' + s, g('escapulaElev')) * 0.8 -
          g('escapulaRotAsc' + s, g('escapulaRotAsc')) * 0.9),
    )
    fijar('clavicula' + s, 0, k * g('escapulaProt' + s, g('escapulaProt')) * 0.5, -k * g('escapulaElev' + s, g('escapulaElev')) * 0.6)

    // Hombro: flexión eleva por delante, abducción por el lateral.
    const abdHombro = -k * (g('hombroAbd' + s, g('hombroAbd')) + grados(7))
    fijar('brazo' + s, -g('hombroFlex' + s, g('hombroFlex')), -k * g('hombroRot' + s, g('hombroRot')), abdHombro)

    e['antebrazo' + s] = sagital(
      -g('codoFlex' + s, g('codoFlex')),
      abdHombro,
      -k * g('antebrazoRot' + s, g('antebrazoRot')),
    )
    // La desviación comparte hueso con la flexión, así que entra en la misma
    // composición sagital: el tercer argumento es el giro dentro del plano.
    e['mano' + s] = sagital(
      -g('muneca' + s, g('muneca')),
      abdHombro,
      k * g('munecaDesv' + s, g('munecaDesv')) * 0.9,
    )
  }
  return e
}

/**
 * Cinemática directa: recorre el esqueleto en orden —los padres van antes que
 * los hijos por construcción— y acumula matrices de mundo.
 */
export function resolver(pose: Pose, desplazamiento: Vec3, giroRaiz: Vec3): EsqueletoResuelto {
  const eul = poseAEuler(pose)
  const mundo: Record<string, Mat4> = {}
  const matrices: Mat4[] = [M4.identidad()]
  // La raíz lleva su propia rotación para poder tumbar al sujeto entero: supino
  // en el press de banca, prono en la plancha o en el curl femoral.
  const raiz = M4.multiplicar(
    M4.trasladar(desplazamiento[0], desplazamiento[1], desplazamiento[2]),
    M4.euler(grados(giroRaiz[0]), grados(giroRaiz[1]), grados(giroRaiz[2])),
  )
  for (const h of ESQUELETO) {
    const e = eul[h.nombre] ?? M4.identidad()
    const local = M4.multiplicar(
      M4.trasladar(h.desde[0], h.desde[1], h.desde[2]),
      M4.multiplicar(M4.euler(h.reposo[0], h.reposo[1], h.reposo[2]), e),
    )
    mundo[h.nombre] = M4.multiplicar(h.padre ? mundo[h.padre] : raiz, local)
    matrices.push(mundo[h.nombre])
  }
  return {
    mundo,
    matrices,
    largo: Object.fromEntries(ESQUELETO.map((h) => [h.nombre, h.largo])),
  }
}

/**
 * Punto en espacio mundo a partir de coordenadas locales de un hueso.
 * `t` va de 0 —origen del hueso— a 1 —su extremo distal.
 */
export function puntoDeHueso(
  esq: EsqueletoResuelto,
  nombre: string,
  t: number,
  desvio: Vec3 = [0, 0, 0],
): Vec3 {
  const largo = esq.largo[nombre]
  return M4.transformarPunto(esq.mundo[nombre], [desvio[0], t * largo + desvio[1], desvio[2]])
}

/**
 * Apoyo plantar automático.
 *
 * La planta tiene que quedar horizontal en todo patrón de pie, y calcular a
 * mano el ángulo de tobillo de cada fase en dieciocho patrones es garantía de
 * pies clavados en el suelo o flotando. Se mide la inclinación real del pie y
 * se corrige el tobillo, que es hoja del árbol y no arrastra a nadie.
 */
export function apoyarPies(pose: Pose, desplazamiento: Vec3, giroRaiz: Vec3, lados: Lado[]): Pose {
  const esq = resolver(pose, desplazamiento, giroRaiz)
  const salida: Pose = { ...pose }
  for (const s of lados) {
    const m = esq.mundo['pie' + s]
    const dir = V.normalizar([m[4], m[5], m[6]]) // eje +Y del hueso, hacia la punta
    // 90° es planta horizontal mirando al frente.
    const a = (Math.atan2(dir[2], dir[1]) * 180) / Math.PI
    const clave = 'tobilloPlantar' + s
    const base = pose[clave] !== undefined ? pose[clave] : (pose.tobilloPlantar ?? 0)
    salida[clave] = base + (90 - a)
  }
  return salida
}

export type Apoyo = 'suelo' | 'manos' | 'ninguno'

const SONDAS: Record<string, string[]> = {
  suelo: ['pieD', 'pieI'],
  manos: ['manoD', 'manoI'],
}

/**
 * Resuelve y corrige la altura para que el sujeto no se hunda en el suelo ni
 * flote. El esqueleto es cinemática directa desde la pelvis, así que sin esto
 * una sentadilla hundiría los pies. En vez de ajustar a mano la altura de la
 * pelvis en cada patrón —dieciocho números mágicos que se rompen al tocar
 * cualquier ángulo— se resuelve, se mide y se corrige.
 */
export function resolverConApoyo(
  pose: Pose,
  desplazamiento: Vec3,
  giroRaiz: Vec3,
  apoyo: Apoyo,
  altura: number | undefined,
  pies: Lado[],
): EsqueletoResuelto {
  const conPies = pies.length ? apoyarPies(pose, desplazamiento, giroRaiz, pies) : pose
  const esq = resolver(conPies, desplazamiento, giroRaiz)
  if (apoyo === 'ninguno') return esq
  const huesos = SONDAS[apoyo]
  if (!huesos) return esq

  let y = apoyo === 'manos' ? -Infinity : Infinity
  for (const h of huesos) {
    // Se muestrea a lo largo del hueso porque en flexión plantar el punto más
    // bajo del pie deja de ser el talón y pasa a ser la cabeza del metatarso.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const p = puntoDeHueso(esq, h, t, [0, 0, h.startsWith('pie') ? -0.03 : 0])
      y = apoyo === 'manos' ? Math.max(y, p[1]) : Math.min(y, p[1])
    }
  }
  const objetivo = altura ?? 0
  return resolver(conPies, [desplazamiento[0], desplazamiento[1] + (objetivo - y), desplazamiento[2]], giroRaiz)
}

export function mezclarVec(a: Vec3 | undefined, b: Vec3 | undefined, t: number): Vec3 {
  const A = a ?? [0, 0, 0]
  const B = b ?? [0, 0, 0]
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]
}

