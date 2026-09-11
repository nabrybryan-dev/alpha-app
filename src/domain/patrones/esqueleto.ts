/**
 * Esqueleto articulado del visor de patrones.
 *
 * Proporciones de un sujeto de ~1,70 m con el suelo en Y=0. Desde el 2026-09-06 las
 * proporciones por defecto son las de un varón real (`juegoDeHuesos.ts`); la definición
 * original vive en `huesosNeutros.ts`. El sujeto mira
 * hacia +Z y su lado DERECHO anatómico cae en −X: es lo que ve el asesorado si
 * se mira al espejo, que es la referencia con la que corrige su técnica.
 *
 * Cada hueso apunta a lo largo de su +Y local. `reposo` es la rotación que lo
 * coloca en bipedestación neutra, y la pose se aplica DESPUÉS, de modo que
 * todos los ángulos de los patrones valen 0 en posición anatómica.
 */

import { grados, M4, V, type Mat4, type Vec3 } from './algebra'
import type { Color } from './malla'
import { ESQUELETO, PLANTA_NEUTRA, type DefinicionHueso } from './huesosNeutros'
import { HUESOS_POR_DEFECTO } from './juegoDeHuesos'

// Se re-exportan para que quien los importaba de aquí siga encontrándolos: el dato se
// mudó a `huesosNeutros.ts` para romper un ciclo de imports, no para cambiar de sitio.
export { ESQUELETO }
export type { DefinicionHueso }

export const COLOR_HUESO: Color = [0.855, 0.835, 0.783]
export const COLOR_HUESO_OSCURO: Color = [0.7, 0.685, 0.64]


/** Índice del hueso en el array de matrices. El 0 queda para la identidad. */
export const INDICE_HUESO: Record<string, number> = {}
ESQUELETO.forEach((h, i) => {
  INDICE_HUESO[h.nombre] = i + 1
})

/**
 * EL HUECO DE LA RAÍZ: la matriz que coloca al sujeto entero —desplazamiento, giro y la
 * corrección de apoyo— sin ningún hueso encima. Es el hueco que sigue a los huesos.
 *
 * Existe para lo que se pega al sujeto pero no a un hueso: el atlas anatómico. Clavado al
 * mundo (hueco 0), el atlas se quedaba en el suelo mientras el sujeto de una demostración
 * flota 0,95 m más arriba, y de la piel solo asomaba la coronilla bajo sus pies. Colgado de
 * la raíz va donde vaya el sujeto, también tumbado en un press de banca.
 */
export const INDICE_RAIZ = ESQUELETO.length + 1

/** Multiplicador del eje X según el lado. La derecha del sujeto cae en −X. */
export const LADO: Record<'D' | 'I', number> = { D: -1, I: 1 }
export type Lado = 'D' | 'I'

/** Pose en canales anatómicos, en grados. */
export type Pose = Record<string, number>

export interface EsqueletoResuelto {
  mundo: Record<string, Mat4>
  matrices: Mat4[]
  largo: Record<string, number>
  /** La matriz raíz sola, para lo que sigue al sujeto entero: ver `INDICE_RAIZ`. */
  raiz: Mat4
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
   * UNA BISAGRA COLGADA DE SU HUESO PADRE: el codo gira sobre el eje del húmero, la rodilla
   * sobre el del fémur. Es un `Rx` a secas en el marco del padre, y `ry` es el giro dentro
   * de ese mismo plano (la desviación de la muñeca).
   *
   * ## Qué había antes, y qué costaba
   *
   * Hasta el 2026-09-07 esto deshacía la abducción del padre, flexionaba en el plano sagital
   * del CUERPO y la volvía a poner: `Rz(-abd)·Rx(-flexión)·Rz(abd)`. Nació para que los dos
   * codos no se doblaran «hacia lados distintos» con el hombro abducido —pero es que un
   * cuerpo ES simétrico: el codo derecho y el izquierdo se doblan en espejo—.
   *
   * Lo que costaba se puede escribir en una línea. Encadenando las matrices, el ángulo que
   * de verdad formaban húmero y antebrazo NO era el escrito:
   *
   *     cos(codo real) = sin²(abducción) + cos²(abducción) · cos(codo escrito)
   *
   * Con el hombro pegado al costado no pasaba nada. Con el hombro a 90° —cualquier press,
   * cualquier apertura— daba `cos = 1`: **el codo desaparecía**, el antebrazo se alineaba
   * con el húmero por muy doblado que dijera la ficha. Medido sobre el catálogo entero el
   * 2026-09-07: el press de banca escribía el codo a 100° y enseñaba 60°; el jalón al pecho
   * escribía 130 y enseñaba 90; la apertura de pecho escribía 30 —«el codo mantiene su
   * ángulo», dice su propia clave— y enseñaba 3, un brazo recto. Seis patrones perdían más
   * de 15°. Es el «hacen acciones en el codo que no puede hacer» de Bryan.
   *
   * Ahora el ángulo del codo ES el que escribe la ficha, en cualquier postura del hombro, y
   * hacia dónde apunta el antebrazo lo decide la rotación del húmero, que es de donde sale
   * en un cuerpo de verdad. La rodilla iba igual de mal por la abducción de cadera, pero ahí
   * los ángulos son pequeños y solo la sentadilla perdía 10°.
   */
  const sagital = (rx: number, _giroPadre: number, ry = 0): Mat4 => M4.euler(rx, ry, 0)

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

    // LA PRONACIÓN ES UN GIRO SOBRE EL PROPIO ANTEBRAZO, y hasta el 2026-09-07 no lo era.
    // Iba como tercer argumento de `sagital`, que lo mete en `M4.euler(rx, ry, 0)`, y ese
    // euler es Ry·Rx·Rz: la Y se aplica ANTES de la flexión, en el marco del padre. Con el
    // codo a 90° eso no rueda el antebrazo: lo hace girar alrededor del codo como una
    // manecilla, y la mano sigue flexionando en el mismo plano del mundo. Medido: con 0°,
    // 90° y 180° la punta de la mano subía y bajaba exactamente lo mismo. Por eso los dos
    // patrones de muñeca compartían silueta —un curl inverso es un curl con la palma abajo,
    // y no había palma abajo—. Ahora rueda sobre su propio eje Y, después de flexionar, y
    // la mano lo hereda.
    //
    // Y SIN GIRO, LOS MISMOS BYTES DE ANTES. `juegoDeHuesos.test.ts` guarda las matrices
    // byte a byte, y aquí se cuela algo que no es un redondeo: el código viejo metía
    // `-k * 0` en el euler, que para un lado es **−0**, y −0 y +0 valen lo mismo pero no
    // son el mismo byte. Medido: con el giro a cero, la huella de la sentadilla cambiaba
    // solo por eso. Así que cuando no hay pronación se le pasa al euler exactamente el cero
    // con signo de siempre, y la vuelta sobre el propio eje solo se multiplica cuando hay
    // algo que multiplicar.
    const pronacion = -k * g('antebrazoRot' + s, g('antebrazoRot'))
    const antebrazo = sagital(-g('codoFlex' + s, g('codoFlex')), abdHombro, pronacion === 0 ? pronacion : 0)
    e['antebrazo' + s] = pronacion === 0 ? antebrazo : M4.multiplicar(antebrazo, M4.girarY(pronacion))
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
export function resolver(
  pose: Pose,
  desplazamiento: Vec3,
  giroRaiz: Vec3,
  /**
   * Con qué huesos: los de siempre si no se dice. Un juego por sexo —ver
   * `juegoDeHuesos.ts`— trae los mismos veintiún huesos, en el mismo orden y con los
   * mismos padres, y solo cambia `desde` y `largo`; por eso `INDICE_HUESO` vale para
   * todos y las matrices salen en el mismo hueco.
   */
  huesos: readonly DefinicionHueso[] = HUESOS_POR_DEFECTO,
): EsqueletoResuelto {
  const eul = poseAEuler(pose)
  const mundo: Record<string, Mat4> = {}
  const matrices: Mat4[] = [M4.identidad()]
  // La raíz lleva su propia rotación para poder tumbar al sujeto entero: supino
  // en el press de banca, prono en la plancha o en el curl femoral.
  const raiz = M4.multiplicar(
    M4.trasladar(desplazamiento[0], desplazamiento[1], desplazamiento[2]),
    M4.euler(grados(giroRaiz[0]), grados(giroRaiz[1]), grados(giroRaiz[2])),
  )
  for (const h of huesos) {
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
    largo: Object.fromEntries(huesos.map((h) => [h.nombre, h.largo])),
    raiz,
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
export function apoyarPies(
  pose: Pose,
  desplazamiento: Vec3,
  giroRaiz: Vec3,
  lados: Lado[],
  huesos: readonly DefinicionHueso[] = HUESOS_POR_DEFECTO,
): Pose {
  const esq = resolver(pose, desplazamiento, giroRaiz, huesos)
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

/**
 * A QUÉ ALTURA DEL SUELO ESTÁ EL TOBILLO, en metros.
 *
 * El pie de este esqueleto es un hueso horizontal que sale del tobillo, sin suela. Para
 * apoyarlo hay que sondear más abajo del hueso —donde estaría la planta— y ese «más abajo»
 * tiene un número: la articulación del tobillo queda a 7–8 cm de la planta en un adulto,
 * y es exactamente lo que la cadena de huesos ya deja entre el tobillo y Y = 0 con la
 * pelvis a 0,95 (0,95 + 0,005 − 0,45 − 0,43 = 0,075). Con esta sonda el solver deja el
 * tobillo donde la cadena lo pone y el sujeto mide lo que dice medir.
 *
 * EL SIGNO ES HACIA +Z LOCAL, y esto costó una medida el 2026-09-04. El pie lleva un reposo
 * de −90° sobre X, así que su −Z local apunta hacia ARRIBA en el mundo. La sonda estaba
 * escrita como `−0,03` creyendo que bajaba: subía 3 cm por encima del tobillo, el solver
 * pisaba ESE punto contra el suelo, y el cuerpo entero se hundía 10,6 cm — el tobillo a
 * 3 cm bajo la placa, la pelvis a 0,844 y la coronilla a 1,584 en TODOS los patrones. Se
 * veía «casi bien», que es como se ven los errores de signo. Lo cazó `escena/carta.test.ts`
 * contrastando el esqueleto resuelto con las medidas que él mismo declara.
 */
export const ALTURA_DEL_TOBILLO = PLANTA_NEUTRA

/** Del tobillo a la planta con ESTOS huesos: la del pie del juego, o la neutra. */
export function plantaDe(huesos: readonly DefinicionHueso[]): number {
  return huesos.find((h) => h.nombre === 'pieD')?.planta ?? PLANTA_NEUTRA
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
  huesos: readonly DefinicionHueso[] = HUESOS_POR_DEFECTO,
): EsqueletoResuelto {
  const conPies = pies.length ? apoyarPies(pose, desplazamiento, giroRaiz, pies, huesos) : pose
  const esq = resolver(conPies, desplazamiento, giroRaiz, huesos)
  if (apoyo === 'ninguno') {
    return sobreElSuelo(esq, conPies, desplazamiento, giroRaiz, huesos, altura ?? 0)
  }
  const sondas = SONDAS[apoyo]
  if (!sondas) return esq

  let y = apoyo === 'manos' ? -Infinity : Infinity
  for (const h of sondas) {
    // Se muestrea a lo largo del hueso porque en flexión plantar el punto más
    // bajo del pie deja de ser el talón y pasa a ser la cabeza del metatarso.
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const p = puntoDeHueso(esq, h, t, [0, 0, h.startsWith('pie') ? plantaDe(huesos) : 0])
      y = apoyo === 'manos' ? Math.max(y, p[1]) : Math.min(y, p[1])
    }
  }
  const objetivo = altura ?? 0

  // Y el ancla HORIZONTAL, que faltaba. La corrección de altura evita que el
  // sujeto se hunda o flote, pero nadie impedía que los pies PATINARAN: en una
  // sentadilla la base se iba medio metro hacia adelante entre el arranque y el
  // fondo, así que el sujeto entero derrapaba por el suelo en vez de moverse
  // sobre sus apoyos. Un pie plantado es un ancla en las tres dimensiones, no
  // solo en la vertical: el punto medio de los apoyos se lleva siempre al mismo
  // sitio, y es el cuerpo el que se desplaza alrededor de ellos — que es
  // exactamente lo que significa cadena cerrada.
  let cx = 0
  let cz = 0
  let n = 0
  for (const h of sondas) {
    for (const t of [0, 1]) {
      const p = puntoDeHueso(esq, h, t)
      cx += p[0]
      cz += p[2]
      n++
    }
  }
  cx /= n
  cz /= n
  return resolver(
    conPies,
    [desplazamiento[0] - cx, desplazamiento[1] + (objetivo - y), desplazamiento[2] - cz],
    giroRaiz,
    huesos,
  )
}

/**
 * NADA POR DEBAJO DEL SUELO, cuando no hay ningún apoyo que anclar.
 *
 * `apoyo: 'ninguno'` —sentado, tumbado, en una máquina— no corregía la altura: la ponía a
 * mano `raizInicio`, y el sujeto quedaba donde ese número lo dejara. Medido el 2026-09-06
 * sobre el catálogo entero con `scripts/medir-resistencia.mjs`, **nueve patrones tenían los
 * pies entre 2,5 y 6 cm bajo la goma del suelo**: los dos de muñeca, la rotación de cadera,
 * la extensión de rodilla, el jalón, la plancha, el press inclinado, el crunch y la
 * movilidad torácica. No se veía como un fallo de altura sino como un suelo mal dibujado.
 *
 * Solo SUBE, nunca baja, y esa asimetría es deliberada:
 *
 * - Subir arregla un pie hundido y no rompe nada, porque los muebles de estos patrones se
 *   construyen CONTRA EL CUERPO (`banco.ts`): al subir el sujeto, su banco sube con él.
 * - Bajar sería otra cosa. Alguien tumbado con los pies a 15 cm del suelo no está mal
 *   dibujado: está en un banco alto. Bajarlo hasta tocar el suelo metería el banco dentro.
 *
 * Y no se aplica con `suelo` ni con `manos` a propósito: ahí SÍ hay un punto anclado, y
 * subir el cuerpo entero para salvar una rodilla despegaría el pie que estaba plantado.
 * Cuando algo se hunde en un patrón de pie, lo que está mal es la pose —fue el caso de la
 * búlgara, cuya rodilla trasera llegaba a 7,5 cm bajo el suelo— y se arregla en la ficha.
 */
function sobreElSuelo(
  esq: EsqueletoResuelto,
  pose: Pose,
  desplazamiento: Vec3,
  giroRaiz: Vec3,
  huesos: readonly DefinicionHueso[],
  objetivo: number,
): EsqueletoResuelto {
  const planta = plantaDe(huesos)
  let masBajo = Infinity
  for (const hueso of huesos) {
    const esPie = hueso.nombre.startsWith('pie')
    for (const t of [0, 0.5, 1]) {
      masBajo = Math.min(masBajo, puntoDeHueso(esq, hueso.nombre, t)[1])
      // EL PIE SE MIDE DOS VECES, y esto no es redundancia. La planta está 7,5 cm por el
      // +Z LOCAL del hueso, que apunta hacia abajo solo mientras el pie esté horizontal;
      // en flexión plantar —una plancha de puntillas, una elevación de talones— apunta
      // hacia atrás, y entonces el punto de contacto ya no es la planta sino la punta del
      // propio hueso. Se toma el menor de los dos y se acabó el caso especial.
      if (esPie) {
        masBajo = Math.min(masBajo, puntoDeHueso(esq, hueso.nombre, t, [0, 0, planta])[1])
      }
    }
  }
  // Medio milímetro de margen: por debajo de eso es ruido de coma flotante, y volver a
  // resolver el esqueleto entero por medio milímetro cuesta más de lo que arregla.
  if (!(masBajo < objetivo - 0.0005)) return esq
  return resolver(
    pose,
    [desplazamiento[0], desplazamiento[1] + (objetivo - masBajo), desplazamiento[2]],
    giroRaiz,
    huesos,
  )
}

export function mezclarVec(a: Vec3 | undefined, b: Vec3 | undefined, t: number): Vec3 {
  const A = a ?? [0, 0, 0]
  const B = b ?? [0, 0, 0]
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]
}

