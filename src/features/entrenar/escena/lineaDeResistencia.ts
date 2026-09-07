import { V, type Vec3 } from '../../../domain/patrones/algebra'
import type { FormaDeMaquina, ImplementoEnEscena } from './implementos'

/**
 * LA LÍNEA DE RESISTENCIA: hacia dónde empuja el aparato, y si eso se opone al gesto.
 *
 * Lo pidió Bryan el 2026-09-06 con estas palabras: «si yo voy a hacer fuerza hacia arriba,
 * yo requiero que la fuerza de la máquina me impulse hacia abajo». No es una preferencia
 * de dibujo: es la definición de resistencia. Un aparato cuya fuerza va PERPENDICULAR al
 * gesto no resiste nada —el ejercicio sería igual de fácil sin él— y uno cuya fuerza va A
 * FAVOR ayuda, que es el ejercicio contrario.
 *
 * ## La regla, y cómo se mide
 *
 * Se saca el punto por donde la carga entra en el cuerpo (los `agarres` de la escena,
 * resueltos sobre el esqueleto de cada fase), se mide hacia dónde va ese punto en la
 * concéntrica y hacia dónde tira el aparato, y se comparan con un coseno:
 *
 * | coseno | qué significa |
 * | --- | --- |
 * | −1 | oposición perfecta: la fuerza va justo contra el gesto |
 * | 0 | perpendicular: **el aparato no resiste nada** |
 * | +1 | a favor: el aparato **ayuda** |
 *
 * `TOPE_DE_OPOSICION` es dónde se pone la raya. No es −1 porque ninguna máquina real se
 * opone perfectamente: en un jalón al pecho el cable baja desde delante y no desde el
 * techo exacto, y esa inclinación es del ejercicio, no un fallo.
 *
 * ## De qué fase a qué fase
 *
 * De 0 a 1, y eso lo decide el repo, no este archivo: `faseDeTiempo` le da 1,2 s al tramo
 * 0→1 con su punto de atasco y 1,9 s al 1→0 «bajando frenando». O sea que **0→1 es la
 * concéntrica**, y una ficha cuya carga baja de 0 a 1 no solo se anima al revés —cae
 * rápido y se levanta despacio— sino que además saldrá con el coseno en positivo, porque
 * la gravedad va con ella. Un mismo instrumento contesta las dos cosas.
 *
 * ## Y de aquí sale la COLOCACIÓN, no solo el veredicto
 *
 * Ésta es la razón de que el módulo exista en vez de ser solo un test. Hasta hoy la polea
 * se plantaba siempre delante del sujeto y la máquina de placas siempre detrás, con dos
 * números escritos a mano, y el resultado medido era que **13 de los 27 aparatos del
 * catálogo no se oponían al gesto que acompañaban**: el remo tiraba desde atrás, la
 * abducción de cadera empujaba de lado, la extensión de rodilla no empujaba en ninguna
 * dirección útil. `anclajeQueSeOpone` calcula el sitio en vez de recordarlo.
 */

/** Desde dónde llega la fuerza que hay que vencer. */
export type OrigenDeResistencia = 'gravedad' | 'cable' | 'brazo' | 'raíl'

export interface Resistencia {
  /** Unitario: hacia dónde empuja el aparato AL CUERPO. */
  direccion: Vec3
  origen: OrigenDeResistencia
}

/**
 * La raya del aprobado, en coseno.
 *
 * −0,35 deja pasar hasta 70° de desviación entre la fuerza y el gesto. Es generoso a
 * propósito: lo que caza es el aparato colocado en el sitio equivocado —perpendicular o a
 * favor—, no la inclinación normal de un cable. Apretarlo más suspendería ejercicios que
 * en el gimnasio se hacen así.
 */
export const TOPE_DE_OPOSICION = -0.35

const norma = (v: Vec3): number => Math.hypot(v[0], v[1], v[2])

/** Unitario, o `undefined` si el vector no tiene largo con el que decidir dirección. */
export function unitario(v: Vec3, minimo = 1e-6): Vec3 | undefined {
  const n = norma(v)
  return n < minimo ? undefined : V.escalar(v, 1 / n)
}

/**
 * Hacia dónde empuja este implemento al cuerpo, con la carga donde está.
 *
 * `undefined` cuando la pieza no ejerce fuerza sobre el sujeto —un banco no resiste— o
 * cuando el aparato carga con él en vez de contra él, que es el caso de la asistida.
 */
export function direccionDeResistencia(
  pieza: ImplementoEnEscena,
  punto: Vec3,
): Resistencia | undefined {
  switch (pieza.pieza) {
    case 'barra':
    case 'mancuerna':
    case 'disco':
      // Peso libre: la gravedad y nada más. No hay dónde colocarlo mal —y por eso los
      // fallos de peso libre son siempre de la FICHA, que anima la repetición al revés.
      return { direccion: [0, -1, 0], origen: 'gravedad' }
    case 'maquina':
      break
    default:
      return undefined
  }
  if (pieza.forma === 'rail-vertical') return { direccion: [0, -1, 0], origen: 'gravedad' }
  if (pieza.forma === 'rail-inclinado') {
    // El carro corre por un raíl a 45° y empuja HACIA ABAJO del raíl, contra los pies.
    const s = Math.SQRT1_2
    return { direccion: [0, -s, -s], origen: 'raíl' }
  }
  if (pieza.forma !== 'polea' && pieza.forma !== 'placas') return undefined
  const anclaje = pieza.enElSuelo?.anclaje
  if (!anclaje) return undefined
  if (pieza.forma === 'polea') {
    // El cable tira de la mano HACIA la polea. Es la única línea del catálogo que no la
    // pone la gravedad, y por eso la tabla exige que el anclaje entre en el encuadre.
    const d = unitario(V.restar(anclaje, punto))
    return d && { direccion: d, origen: 'cable' }
  }
  // Máquina de placas, y aquí hay DOS mecánicas distintas bajo el mismo nombre.
  //
  // Con `guia: 'giro'` el almohadillado va en la punta de un brazo que gira sobre su eje,
  // así que la fuerza es PERPENDICULAR al brazo, no a lo largo de él. Cuál de las dos
  // perpendiculares lo decide el gesto, y eso lo resuelve `oposicion` con el signo.
  //
  // Con `guia: 'recta'` no hay brazo que gire: la carga sube por una guía y empuja A LO
  // LARGO de ella, como las hombreras de una elevación de talones de pie. Ahí la fuerza va
  // del punto de carga hacia el anclaje, igual que un cable, y se juzga igual.
  if (pieza.enElSuelo?.guia === 'recta') {
    const recta = unitario(V.restar(anclaje, punto))
    return recta && { direccion: recta, origen: 'raíl' }
  }
  const brazo = unitario(V.restar(punto, anclaje))
  return brazo && { direccion: brazo, origen: 'brazo' }
}

/**
 * El coseno entre la fuerza del aparato y el gesto. −1 se opone, 0 no resiste, +1 ayuda.
 *
 * El brazo de una máquina de placas se juzga distinto y aquí está la razón: su fuerza es
 * perpendicular al brazo, así que lo que hay que exigirle NO es que el brazo apunte contra
 * el gesto sino que el brazo sea perpendicular a él —o sea, que el punto de carga gire
 * alrededor del eje en vez de acercarse y alejarse—. Un brazo que se estira no es un
 * brazo: es una goma, y el aparato dibujado sería imposible.
 */
export function oposicion(resistencia: Resistencia, gesto: Vec3): number {
  const u = unitario(gesto)
  if (!u) return 0
  const c =
    resistencia.direccion[0] * u[0] + resistencia.direccion[1] * u[1] + resistencia.direccion[2] * u[2]
  // Con brazo rígido el coseno vale 0 —perpendicular— y eso es lo correcto, no un fallo.
  // Se devuelve como −1 + |c| para que la misma raya de aprobado valga para los dos: un
  // brazo perpendicular saca −1, y uno que se estira sube hacia 0 igual que un cable mal
  // puesto.
  return resistencia.origen === 'brazo' ? -1 + Math.abs(c) : c
}

/**
 * DÓNDE HAY QUE PLANTAR EL ANCLAJE para que la resistencia se oponga al gesto.
 *
 * `camino` son los puntos por los que pasa la carga a lo largo de la concéntrica, en
 * metros de mundo y con el sujeto en el origen. De ahí salen las dos respuestas:
 *
 * - **Cable**: el anclaje va en la prolongación del gesto HACIA ATRÁS. Si la mano sube, la
 *   polea queda arriba; si la mano se abre hacia la derecha, la polea queda a la
 *   izquierda. Es literalmente la frase de Bryan puesta en un vector.
 * - **Brazo de máquina**: el eje va en el CENTRO DEL ARCO que traza la carga, que es el
 *   eje de la articulación que trabaja. Es la misma regla que dice el monitor del gimnasio
 *   cuando pide alinear la rodilla con el punto rojo de la máquina, y la que hace que el
 *   brazo dibujado sea rígido en vez de estirarse.
 */
export interface AnclajeResuelto {
  /** Dónde entrega la carga: la polea, o el eje sobre el que gira el brazo. */
  anclaje: Vec3
  /** Dónde se apoya en el suelo la columna o el bastidor. */
  centro: Vec3
  alturaDeCarga: number
  /**
   * CÓMO entrega la carga: girando alrededor de un eje, o empujando por una recta.
   *
   * No es un detalle de dibujo, decide la DIRECCIÓN de la fuerza. En una máquina de brazo la
   * fuerza sale perpendicular al brazo; en una de guía recta, a lo largo de la guía.
   * Confundir las dos es lo que hacía que una elevación de talones de pie —donde las
   * hombreras suben rectas— se midiera como si el acolchado girase alrededor de algo.
   */
  guia: 'giro' | 'recta'
  porQue: string
}

/** Lo lejos que se planta una polea del recorrido al que se opone. */
const DISTANCIA_DE_POLEA = 1.3
/** Ni a ras de suelo ni contra el techo: la sala mide 3,8 m. */
const POLEA_MINIMA = 0.26
const POLEA_MAXIMA = 2.35
/** Una columna dentro del sujeto no es una columna. */
const RADIO_LIBRE = 0.78

/**
 * El centro del arco que traza una serie de puntos, por mínimos cuadrados.
 *
 * Tres puntos definen una circunferencia y once la sobredeterminan, así que se resuelve el
 * sistema normal de la formulación algebraica: para cada punto, |p − c|² = r², que restando
 * el primero se vuelve lineal en `c`. Se hace en el plano del arco —el que definen el
 * primero, el de en medio y el último—, porque un arco de 40 cm en 3D con ruido numérico
 * fuera de plano da un centro que se va a tomar viento.
 *
 * `undefined` cuando los puntos son casi rectos: un gesto en línea recta no gira alrededor
 * de nada, y ahí una máquina de brazo no es el aparato correcto.
 */
export function centroDelArco(camino: readonly Vec3[]): Vec3 | undefined {
  if (camino.length < 3) return undefined
  const a = camino[0]
  const b = camino[Math.floor(camino.length / 2)]
  const c = camino[camino.length - 1]
  const u = V.restar(b, a)
  const v = V.restar(c, a)
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]] as Vec3
  const normal = unitario(n, 1e-9)
  if (!normal) return undefined
  // Base ortonormal del plano del arco.
  const e1 = unitario(u)
  if (!e1) return undefined
  const e2: Vec3 = [
    normal[1] * e1[2] - normal[2] * e1[1],
    normal[2] * e1[0] - normal[0] * e1[2],
    normal[0] * e1[1] - normal[1] * e1[0],
  ]
  const plano = camino.map((p) => {
    const d = V.restar(p, a)
    return [d[0] * e1[0] + d[1] * e1[1] + d[2] * e1[2], d[0] * e2[0] + d[1] * e2[1] + d[2] * e2[2]]
  })
  // Ajuste algebraico: x² + y² + D x + E y + F = 0, resuelto por mínimos cuadrados.
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sz = 0, szx = 0, szy = 0
  const m = plano.length
  for (const [x, y] of plano) {
    const z = x * x + y * y
    sxx += x * x
    sxy += x * y
    syy += y * y
    sx += x
    sy += y
    sz += z
    szx += z * x
    szy += z * y
  }
  // Sistema normal 3×3 para (D, E, F), resuelto con la regla de Cramer.
  const A = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, m],
  ]
  const rhs = [-szx, -szy, -sz]
  const det = (M: number[][]) =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  const base = det(A)
  if (Math.abs(base) < 1e-12) return undefined
  const conColumna = (i: number) => det(A.map((fila, f) => fila.map((val, c) => (c === i ? rhs[f] : val))))
  const D = conColumna(0) / base
  const E = conColumna(1) / base
  const cx = -D / 2
  const cy = -E / 2
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return undefined
  const radio = Math.hypot(cx, cy)
  // UN RADIO DE BRAZO DE MÁQUINA, o no hay brazo. Por arriba: el segmento más largo que
  // gira alrededor de una articulación humana es la pierna entera, 88 cm, así que por
  // encima de 1,2 m lo que se ha ajustado no es un arco sino una recta con una
  // circunferencia enorme por detrás. Se midió el 2026-09-06: la apertura inversa sacaba un
  // radio de 2,13 m, o sea un brazo de máquina de dos metros que salía del sujeto y se iba
  // a plantar la columna a 2,30 m por delante de él. Por abajo, menos de 15 cm no es un
  // brazo que gira: es una carga que sube recta —el acolchado de una elevación de talones
  // de pie— y ésa la mueve la gravedad por un raíl, no una leva.
  if (!(radio > 0.15) || radio > 1.2) return undefined
  return V.sumar(a, V.sumar(V.escalar(e1, cx), V.escalar(e2, cy)))
}

/**
 * De dos ejes candidatos, el que deja el brazo MÁS RÍGIDO contra el recorrido real.
 *
 * Con la carga entrando por dos puntos hay dos respuestas defendibles y no se puede elegir a
 * priori: el eje de la articulación de un lado —la cadera de una abducción, donde el
 * almohadillado va en cada muslo— o ese mismo eje llevado al plano sagital —la columna
 * central de una apertura inversa, donde los dos brazos giran sobre el mismo pivote—. Se
 * mide cuál de los dos mantiene constante la distancia al punto de carga, que es lo que hace
 * que el brazo dibujado sea una pieza de acero y no una goma.
 */
function masRigido(candidatos: readonly Vec3[], camino: readonly Vec3[]): Vec3 {
  let mejor = candidatos[0]
  let menorHorquilla = Infinity
  for (const c of candidatos) {
    const largos = camino.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]))
    const horquilla = Math.max(...largos) - Math.min(...largos)
    if (horquilla < menorHorquilla) {
      menorHorquilla = horquilla
      mejor = c
    }
  }
  return mejor
}

/** Aparta del sujeto lo que se apoya en el suelo, sin mover el punto de entrega. */
function baseLibre(anclaje: Vec3, camino: readonly Vec3[]): Vec3 {
  // El bastidor no puede caer encima del sujeto ni encima del recorrido de la carga.
  const horizontal: Vec3 = [anclaje[0], 0, anclaje[2]]
  const d = Math.hypot(horizontal[0], horizontal[2])
  if (d >= RADIO_LIBRE) return horizontal
  // Se aparta en la dirección en la que ya estaba; si estaba justo encima, hacia atrás,
  // que es donde menos estorba a la cámara —la estación mira desde −X.
  const fuera = unitario([horizontal[0], 0, horizontal[2]], 1e-3) ?? ([0, 0, -1] as Vec3)
  const lejos = Math.max(RADIO_LIBRE, ...camino.map((p) => Math.hypot(p[0], p[2]) + 0.32))
  return V.escalar(fuera, lejos)
}

export function anclajeQueSeOpone(
  camino: readonly Vec3[],
  forma: FormaDeMaquina,
  /**
   * EL RECORRIDO DE UN SOLO LADO, cuando la carga entra por dos puntos.
   *
   * El arco hay que ajustarlo aquí y no en `camino`, y esto costó una medida: con los dos
   * lados promediados, **dos brazos que se abren en simétrico dan un punto medio que va en
   * línea recta**, porque lo que uno se lleva a la derecha el otro se lo lleva a la
   * izquierda. La apertura inversa salía así con un radio de 2,13 m —o sea, sin arco— y su
   * máquina se plantaba a 2,30 m del sujeto con un brazo de dos metros que le cruzaba el
   * pecho. Medido de un lado, el arco es el del hombro y sale a 40 cm.
   *
   * El eje resultante se lleva al plano sagital, que es donde está la columna de una
   * máquina bilateral: los dos lados giran sobre el mismo eje central.
   */
  caminoDeUnLado?: readonly Vec3[],
): AnclajeResuelto | undefined {
  if (camino.length < 2) return undefined
  const gesto = unitario(V.restar(camino[camino.length - 1], camino[0]))
  if (!gesto) return undefined

  if (forma === 'placas') {
    // TRES CANDIDATOS A EJE, y gana el que se mida mejor. El de un lado, ese mismo llevado
    // al plano sagital —la columna central de una máquina bilateral— y el del recorrido
    // promediado, que es el que se usaba antes. Ninguno de los tres es el correcto siempre:
    // en una apertura inversa el promedio no tiene arco (los dos brazos se abren en
    // simétrico y su punto medio va en línea recta) y en una aducción de cadera el de un
    // lado deja el brazo estirándose 18 cm. Así que se prueban y se mide, en vez de elegir.
    const deUnLado = caminoDeUnLado && caminoDeUnLado.length >= 3 ? caminoDeUnLado : undefined
    const candidatos: Vec3[] = []
    const lado = deUnLado && centroDelArco(deUnLado)
    if (lado) candidatos.push(lado, [0, lado[1], lado[2]])
    const promedio = centroDelArco(camino)
    if (promedio) candidatos.push(promedio)
    const eje = candidatos.length > 0 ? masRigido(candidatos, camino) : undefined
    if (eje) {
      const conBrazo = seOpone(
        {
          anclaje: eje,
          centro: baseLibre(eje, camino),
          alturaDeCarga: Math.max(0.12, eje[1]),
          guia: 'giro',
          porQue:
            'el eje del brazo va en el centro del arco que traza la carga, que es el eje de la ' +
            'articulación que trabaja: así el brazo es rígido y su fuerza sale perpendicular al gesto',
        },
        camino,
        gesto,
        forma,
      )
      if (conBrazo) return conBrazo
    }
    // SIN ARCO NO HAY BRAZO, y eso no es un fallo: hay máquinas que no giran. Cuando la
    // carga va casi recta —las hombreras de una elevación de talones de pie, el acolchado
    // de una apertura inversa— lo que hay es una guía, y una guía se coloca igual que una
    // polea: en la prolongación del gesto hacia atrás.
    return enLaProlongacion(camino, gesto, forma, 'recta', 0.95)
  }

  if (forma !== 'polea') return undefined
  return enLaProlongacion(camino, gesto, forma, 'giro', DISTANCIA_DE_POLEA)
}

/**
 * El anclaje puesto en la prolongación del gesto hacia atrás, a `lejos` metros.
 *
 * Es literalmente la frase de Bryan en un vector: si la carga sube, el anclaje queda abajo;
 * si la mano se abre hacia la derecha, queda a la izquierda. Lo comparten la polea y la
 * máquina de guía recta porque su mecánica, para esto, es la misma: la fuerza va por la
 * línea que une la carga con el anclaje.
 */
function enLaProlongacion(
  camino: readonly Vec3[],
  gesto: Vec3,
  forma: FormaDeMaquina,
  guia: 'giro' | 'recta',
  lejos: number,
): AnclajeResuelto | undefined {
  const medio = camino[Math.floor(camino.length / 2)]
  const crudo = V.restar(medio, V.escalar(gesto, lejos))
  const anclaje: Vec3 = [crudo[0], Math.min(POLEA_MAXIMA, Math.max(POLEA_MINIMA, crudo[1])), crudo[2]]
  return seOpone(
    {
      anclaje,
      centro: baseLibre(anclaje, camino),
      alturaDeCarga: anclaje[1],
      guia,
      porQue:
        'se planta en la prolongación del gesto hacia atrás, para que la fuerza vaya justo en ' +
        'contra de la dirección en la que se hace fuerza',
    },
    camino,
    gesto,
    forma,
  )
}

/**
 * LA COLOCACIÓN SE COMPRUEBA A SÍ MISMA antes de devolverse.
 *
 * No es adorno: las dos reglas de arriba tienen topes —la polea se recorta entre 26 cm y
 * 2,35 m de altura y su columna se aparta del sujeto, el eje del brazo sale de un ajuste por
 * mínimos cuadrados sobre un gesto que no es un arco perfecto— y un tope puede echar a
 * perder justo la propiedad por la que se colocó ahí. Cuando eso pasa, es mejor devolver
 * `undefined` y caer a la colocación de siempre, que es peor pero conocida, que entregar un
 * aparato que dice oponerse y no se opone.
 *
 * Mide con el mismo instrumento que el guardián del catálogo, y a propósito: si esta
 * comprobación y `pruebas/la-resistencia-se-opone.test.ts` usaran dos definiciones distintas
 * de «oponerse», acabarían discrepando y ganaría la que nadie mira.
 */
function seOpone(
  resuelto: AnclajeResuelto,
  camino: readonly Vec3[],
  gesto: Vec3,
  forma: FormaDeMaquina,
): AnclajeResuelto | undefined {
  const medio = camino[Math.floor(camino.length / 2)]
  const r = direccionDeResistencia(
    {
      pieza: 'maquina',
      forma,
      agarres: [],
      rigida: true,
      radioDisco: 0,
      porQue: '',
      enElSuelo: {
        centro: resuelto.centro,
        giroGrados: 0,
        alturaDeCarga: resuelto.alturaDeCarga,
        anclaje: resuelto.anclaje,
        guia: resuelto.guia,
      },
    },
    medio,
  )
  if (!r) return undefined
  return oposicion(r, gesto) <= TOPE_DE_OPOSICION ? resuelto : undefined
}
