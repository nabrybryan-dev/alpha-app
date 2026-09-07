import { V, type Vec3 } from '../../../domain/patrones/algebra'
import { modeloDePalanca, planDeMedida } from '../../../domain/biomecanica/palancas'
import { aplicacionDeLaCarga, porQueSeApoya } from '../../../domain/biomecanica/aplicacionDeLaCarga'
import { esUnilateral, implementoDe, IMPLEMENTOS, type Implemento, type PerfilDeImplemento } from '../../../domain/biomecanica/implementos'
import type { Articulacion } from '../../../domain/biomecanica/tipos'
import { apoyoQueSostiene, type ApoyoDelCuerpo } from './banco'
import { patronDeCategoria, type Patron } from '../../../domain/patrones/catalogo'
import { esqueletoEnFase } from '../../../domain/patrones/escena'
import { puntoDeHueso } from '../../../domain/patrones/esqueleto'
import { anclajeQueSeOpone } from './lineaDeResistencia'
import { RADIO_DISCO } from './dibujarImplementos'

/**
 * LOS IMPLEMENTOS: la barra, la mancuerna y la máquina.
 *
 * ## Por qué esto faltaba, y por qué se nota tanto
 *
 * Hasta hoy el sujeto del salón entrenaba con las manos vacías. Un press sin
 * barra no es un press: es alguien empujando el aire, y el ojo lo detecta antes
 * que cualquier otra cosa de la escena. No es un adorno — es el quinto de los
 * cinco elementos que tienen que verse a la vez, y sin él los otros cuatro
 * quedan describiendo un gesto que no está.
 *
 * ## La colocación NO se decide aquí
 *
 * Ésta es la regla que ordena el módulo entero, y conviene leerla antes de
 * tocar nada: **este archivo no sabe de ejercicios**. No hay ninguna tabla que
 * diga «la sentadilla lleva barra a la espalda» ni «la prensa lleva raíl». Eso
 * ya está decidido, y está decidido en un sitio:
 *
 *   - `domain/biomecanica/implementos.ts` — qué implemento declara el NOMBRE del
 *     ejercicio (`implementoDe`), y qué le hace ese implemento a la medida. De
 *     ahí sale la pieza que se dibuja.
 *   - `PerfilDeImplemento.aplicacion` — **dónde entra la carga en el cuerpo**:
 *     manos, hombros, pelvis, pies, tobillo o el cuerpo entero. De ahí sale el
 *     punto de agarre, y por eso una prensa no cuelga de las manos.
 *   - `PerfilDeImplemento.cargas` — una masa o dos. De ahí sale si las dos manos
 *     comparten una pieza rígida (barra) o si cada una lleva la suya
 *     (mancuernas). La tabla ya avisa de que dos masas no son una con el doble
 *     de peso, y aquí eso se ve: dos piezas que pueden ir a distinta altura.
 *   - `ModeloDePalanca.cadena` y `anclaje` — quién está fijo al mundo. Con
 *     cadena cerrada y las manos en una barra fija, la barra **no la lleva el
 *     sujeto**: está clavada al techo y es él quien sube. Dibujarla en las manos
 *     de una dominada contaría el ejercicio contrario.
 *   - `PlanDeMedida.unilateral` — si la carga va a un solo lado. Es ortogonal al
 *     implemento (hay mancuernas, poleas y prensas unilaterales), así que va
 *     aparte, igual que en la tabla.
 *
 * Duplicar cualquiera de esas decisiones aquí sería el fallo de siempre: dos
 * tablas que empiezan iguales y se separan en el primer ajuste, y entonces la
 * pantalla enseña un implemento y la medida usa otro.
 *
 * `src/domain/**` es de solo lectura para este trabajo. Se lee y se obedece.
 *
 * ## Dos pasos, y el primero es puro
 *
 * `implementosDeEscena(categoria, nombre)` no dibuja: devuelve QUÉ piezas van y
 * DÓNDE se enganchan, en huesos y en metros, sin tocar una malla. Se puede
 * examinar, contar y comparar sin pintar un píxel — que es lo que permite
 * comprobar que una sentadilla en barra y una prensa no reciben lo mismo.
 *
 * `construirImplementos(m, escena, esq)` resuelve esos enganches contra el
 * ESQUELETO REAL de la fase que se está dibujando y construye la geometría. Las
 * manos las da `puntoDeHueso`, no una tabla de alturas: si el sujeto baja, la
 * barra baja con él, y no hay dos versiones de dónde está la mano.
 *
 * ## Lo que la escena no puede prometer
 *
 * `avisos` sale de `PlanDeMedida.limites`, tal cual. Si el implemento es un
 * Smith, ahí está escrito que el raíl fija el brazo de momento; si es unilateral,
 * que el momento frontal no se ve de lado. La escena dibuja el objeto; lo que ese
 * objeto le hace a la medida lo sigue diciendo la tabla, con sus palabras.
 *
 * PARTIDO EN DOS el 2026-09-06, al pasar de las 800 líneas: aquí queda LA PARTE PURA —qué
 * piezas van, dónde entra la carga, qué avisa— y en `dibujarImplementos.ts` la que construye
 * la geometría sobre el esqueleto de cada fase (`construirImplementos`, `construirPieza` y
 * las barras, mancuernas y máquinas). Este módulo no importa nada del dibujo salvo una medida
 * (`RADIO_DISCO`); el dibujo solo importa TIPOS de aquí. Así no hay ciclo.
 */

/**
 * Las cuatro formas de máquina que la tabla de implementos distingue, y una quinta que no
 * distingue la MEDIDA sino el sujeto: la de dominada asistida carga con él arrodillado
 * (`maquinaAsistida.ts`). Nace el 2026-09-06 porque Bryan pidió ver la máquina, no solo la
 * barra.
 */
export type FormaDeMaquina = 'placas' | 'rail-vertical' | 'rail-inclinado' | 'polea' | 'asistida'

// ---------------------------------------------------------------------------
// La parte pura: qué implementos y dónde.
// ---------------------------------------------------------------------------

export type Pieza = 'barra' | 'mancuerna' | 'disco' | 'barra-fija' | 'maquina' | 'banco'

/**
 * Un punto del sujeto por el que entra la carga, en coordenadas de hueso.
 *
 * Va en huesos y no en metros a propósito: la mano de una sentadilla en el
 * fondo y la del bloqueo están en sitios distintos, y una altura de tabla
 * pondría la barra en el aire en una de las dos. `t` va de 0 —origen del
 * hueso— a 1 —su extremo distal—, igual que en `puntoDeHueso`.
 */
export interface PuntoDeAgarre {
  hueso: string
  t: number
  desvio: Vec3
}

export interface ImplementoEnEscena {
  pieza: Pieza
  forma?: FormaDeMaquina
  /**
   * Los puntos por los que la carga entra en el cuerpo. Uno cuando es
   * unilateral o cuando la carga es única y centrada; dos en lo demás.
   */
  agarres: readonly PuntoDeAgarre[]
  /**
   * Si los dos agarres son de UNA sola pieza rígida. Sale de `cargas` de la
   * tabla: una barra es una masa que las dos manos comparten, dos mancuernas
   * son dos masas sueltas, una por mano, y no valen dibujadas como una sola.
   */
  rigida: boolean
  radioDisco: number
  /**
   * Dónde se planta la pieza cuando no la lleva el sujeto, con él en el origen.
   *
   * `centro` es dónde APOYA en el suelo y `anclaje` dónde ENTREGA la carga —la polea, o el
   * eje sobre el que gira el brazo—. Hasta el 2026-09-06 eran el mismo punto en vertical, y
   * por eso la colocación no podía obedecer al gesto: una polea que tiene que quedar encima
   * del sujeto exigía plantar la columna dentro de él. Separados, la columna se aparta y el
   * brazo superior la alcanza, que es como está hecha una torre de poleas de verdad.
   */
  enElSuelo?: { centro: Vec3; giroGrados: number; alturaDeCarga: number; anclaje: Vec3 }
  /**
   * Qué parte del cuerpo sostiene, cuando la pieza es un mueble. Va en huesos y no en
   * metros a propósito: un banco se calcula CONTRA EL CUERPO —ver `banco.ts`—, porque la
   * altura a la que el catálogo pone a cada sujeto no es la misma.
   */
  apoyo?: ApoyoDelCuerpo
  /** De dónde salió esta decisión. Es la trazabilidad, no un adorno. */
  porQue: string
}

export interface EscenaDeImplementos {
  piezas: readonly ImplementoEnEscena[]
  /**
   * Lo que con este implemento NO se puede prometer, tal cual lo dice
   * `PlanDeMedida.limites`. La escena dibuja el objeto; lo que ese objeto le
   * hace a la medida lo sigue diciendo la tabla, con sus palabras.
   */
  avisos: readonly string[]
  /**
   * `true` cuando el nombre del ejercicio no declara implemento y la escena ha
   * tenido que suponer peso libre. No es lo mismo que saberlo, y quien pinte
   * esto tiene derecho a distinguirlo.
   */
  supuesto: boolean
}

/**
 * Lo que se dice cuando el nombre del ejercicio no declara con qué se hace.
 *
 * No es una disculpa: es el dato. La prescripción de esta casa vive en el nombre, así que
 * un nombre que no lo dice es una prescripción incompleta, y el sitio donde se arregla es
 * el nombre —no la escena inventándose una barra—.
 */
export const AVISO_SIN_IMPLEMENTO =
  'el nombre del ejercicio no dice con qué se hace, así que no se dibuja ningún implemento: ' +
  'suponer una barra contradiría a la prescripción'

/** Las dos manos, a media palma. Es donde se cierra el agarre. */
const MANOS: readonly PuntoDeAgarre[] = [
  { hueso: 'manoD', t: 0.45, desvio: [0, 0, 0] },
  { hueso: 'manoI', t: 0.45, desvio: [0, 0, 0] },
]

/**
 * Dónde entra la carga, por `aplicacion` de la tabla de implementos.
 *
 * Cada entrada traduce una palabra de la tabla —manos, hombros, pelvis, pies,
 * tobillo, cuerpo— al hueso donde eso cae. La palabra la decide la tabla; aquí
 * solo se sabe qué hueso es cada parte, que es geometría y no biomecánica.
 */
const AGARRE_POR_APLICACION: Record<string, readonly PuntoDeAgarre[]> = {
  manos: MANOS,
  // Sobre el trapecio, por detrás del cuello: es donde se apoya una barra en
  // una sentadilla trasera, y el desvío en −Z es lo que la pone detrás.
  hombros: [{ hueso: 'torax', t: 0.86, desvio: [0, 0, -0.075] }],
  // Sobre el pliegue de la cadera, por delante: el hip thrust y la bisagra con
  // cinturón. La tabla ya avisa de que ahí el reparto entre dos apoyos no sale
  // de la distancia horizontal.
  pelvis: [{ hueso: 'pelvis', t: 0.55, desvio: [0, 0, 0.115] }],
  pies: [
    { hueso: 'pieD', t: 0.55, desvio: [0, 0, 0] },
    { hueso: 'pieI', t: 0.55, desvio: [0, 0, 0] },
  ],
  // El extremo distal de la tibia es el tobillo. La tabla lo pide por su
  // nombre en `marcasExtra`, porque el cable tira de ahí y no de la mano.
  tobillo: [
    { hueso: 'tibiaD', t: 1, desvio: [0, 0, 0] },
    { hueso: 'tibiaI', t: 1, desvio: [0, 0, 0] },
  ],
  // Sobre la espalda, entre las escápulas: el disco de una plancha con carga. El desvío en
  // −Z es el dorso, el mismo lado por el que se apoya la barra de la sentadilla.
  espalda: [{ hueso: 'torax', t: 0.45, desvio: [0, 0, -0.09] }],
  cuerpo: [],
}

/**
 * Qué pieza dibuja cada implemento de la tabla.
 *
 * `guiado-vertical` sale dos veces —la máquina y la barra— y no es un descuido:
 * un Smith es un raíl Y una barra, y quitarle cualquiera de los dos deja una
 * escena que miente. Es la misma razón por la que la tabla lo separa de `barra`:
 * lo que cambia es quién decide el brazo, no que deje de haber barra.
 */
const PIEZAS_POR_IMPLEMENTO: Record<string, readonly { pieza: Pieza; forma?: FormaDeMaquina }[]> = {
  barra: [{ pieza: 'barra' }],
  disco: [{ pieza: 'disco' }],
  mancuernas: [{ pieza: 'mancuerna' }],
  'guiado-vertical': [{ pieza: 'maquina', forma: 'rail-vertical' }, { pieza: 'barra' }],
  'guiado-inclinado': [{ pieza: 'maquina', forma: 'rail-inclinado' }],
  polea: [{ pieza: 'maquina', forma: 'polea' }],
  'polea-tobillera': [{ pieza: 'maquina', forma: 'polea' }],
  maquina: [{ pieza: 'maquina', forma: 'placas' }],
  'peso-corporal': [],
}

/**
 * A qué altura entrega la carga una polea.
 *
 * Alta cuando el eje que manda es el hombro o la escápula tirando hacia abajo
 * —un jalón, un pullover, una extensión de tríceps en polea alta—; baja en lo
 * demás, que incluye las tobilleras y los curls. Es una regla gruesa y se dice
 * gruesa: lo que la afinaría es que el modelo declarase el anclaje del cable,
 * y hoy la tabla no lo lleva. Mientras no lo lleve, esto acierta el caso normal
 * y se equivoca de forma visible, que es preferible a acertar por casualidad.
 */
function poleaAlta(articulacion: Articulacion | undefined, accion: string | undefined): boolean {
  if (articulacion !== 'hombro' && articulacion !== 'escapula') return false
  return accion === 'aduccion' || accion === 'extension' || accion === 'retraccion'
}

/**
 * Lo que se dice cuando la categoría no llega al modelo de palancas.
 *
 * La taxonomía antigua —«DOMINANTE DE CADERA», «AISLAMIENTO», «CORE»— es ambigua por
 * construcción y `categoriaCanonica` la deja en blanco a propósito: no hay patrón que medir.
 * Pero el implemento no sale del patrón, sale del NOMBRE, y un hip thrust con barra lleva
 * barra diga lo que diga su categoría. Medido el 2026-09-06: 16 de los 25 ejercicios del
 * seed están en esta situación y salían con las manos vacías.
 */
export const AVISO_SIN_MODELO =
  'la categoría no llega al modelo de palancas: se dibuja el implemento que declara el ' +
  'nombre, pero no hay medida que prometer'

/**
 * Qué implementos van en la escena de este ejercicio y dónde se enganchan.
 *
 * Pura: no toca una malla ni necesita un esqueleto. Cuanto decide sale de
 * `planDeMedida` y `modeloDePalanca`, que son la tabla, y lo único que este
 * módulo aporta es saber qué hueso es cada parte del cuerpo.
 */
export function implementosDeEscena(categoria: string, nombreEjercicio = ''): EscenaDeImplementos {
  const escena = piezasQueSeLlevan(categoria, nombreEjercicio)

  // Y ENCIMA, EL MUEBLE QUE LO SOSTIENE. Va aquí y no dentro de `piezasQueSeLlevan` porque
  // no es un implemento: nadie levanta un banco. Es lo que hace que el sujeto no flote.
  //
  // Se pregunta DESPUÉS de armar las piezas porque la respuesta depende de ellas: donde ya
  // hay máquina no va banco, que la máquina trae su asiento y su respaldo y se
  // atravesarían. Ver `banco.ts`.
  const hayMaquina = escena.piezas.some((p) => p.pieza === 'maquina')
  const apoyo = apoyoQueSostiene(
    patronDeCategoria(categoria, nombreEjercicio),
    modeloDePalanca(categoria, nombreEjercicio),
    hayMaquina,
  )
  if (!apoyo) return escena
  return {
    ...escena,
    piezas: [
      ...escena.piezas,
      { pieza: 'banco', agarres: [], rigida: false, radioDisco: 0, apoyo, porQue: apoyo.porQue },
    ],
  }
}

/** Lo que el sujeto lleva encima o tiene delante: la parte de siempre de este módulo. */
function piezasQueSeLlevan(categoria: string, nombreEjercicio: string): EscenaDeImplementos {
  const plan = planDeMedida(categoria, nombreEjercicio)
  const modelo = modeloDePalanca(categoria, nombreEjercicio)

  // LA DOMINADA ASISTIDA ES UNA MÁQUINA QUE CARGA CON EL SUJETO. Lo decide la ficha del
  // patrón y no el nombre a secas, para que «Dominadas asistidas» bajo TRACCIÓN VERTICAL y
  // la ficha abierta desde el catálogo (categoría DOMINADA ASISTIDA, sin nombre) den lo
  // mismo. Hasta el 2026-09-06 salía la barra fija de una dominada a secas, con el sujeto
  // sentado en el aire; Bryan pidió la máquina. Ver `maquinaAsistida.ts`.
  if (patronDeCategoria(categoria, nombreEjercicio)?.id === 'dominada_asistida') {
    return {
      piezas: [
        {
          pieza: 'maquina',
          forma: 'asistida',
          agarres: MANOS,
          rigida: true,
          radioDisco: 0,
          // La asistida se construye contra el cuerpo —su rodillera sube con él—, así que
          // no entrega la carga en ningún punto fijo del suelo: el anclaje es el origen.
          enElSuelo: { centro: [0, 0, 0], giroGrados: 0, alturaDeCarga: 0, anclaje: [0, 0, 0] },
          porQue:
            'dominada asistida: las manos fijas en la barra y las rodillas en la rodillera de la ' +
            'máquina, que sube y baja con el cuerpo',
        },
      ],
      avisos: plan?.limites ?? [AVISO_SIN_MODELO],
      supuesto: false,
    }
  }

  // SIN MODELO, EL IMPLEMENTO SIGUE SALIENDO DEL NOMBRE. Antes esto devolvía la escena
  // vacía y dieciséis de veinticinco ejercicios entrenaban con las manos vacías sin que
  // nada lo dijera. Lo que no hay es medida, y eso sí se dice.
  if (!plan || !modelo) {
    const implemento = implementoDe(nombreEjercicio)
    if (implemento === undefined) {
      return { piezas: [], avisos: [AVISO_SIN_MODELO, AVISO_SIN_IMPLEMENTO], supuesto: true }
    }
    return armar(categoria, nombreEjercicio, implemento, IMPLEMENTOS[implemento], esUnilateral(nombreEjercicio), poleaAltaPorNombre(nombreEjercicio), [AVISO_SIN_MODELO])
  }

  // Cadena cerrada con las manos en algo fijo: la barra NO la lleva el sujeto,
  // está clavada al mundo y es él quien sube. Dibujarla en las manos de una
  // dominada contaría el ejercicio contrario, que es justo lo que la tabla
  // separa por variante.
  const manosAlMundo = modelo.cadena === 'cerrada' && /barra fija|barra|paralelas/i.test(modelo.anclaje)
  if (manosAlMundo && plan.linea.origen === 'centro-de-masas') {
    return {
      piezas: [
        {
          pieza: 'barra-fija',
          agarres: MANOS,
          rigida: true,
          radioDisco: 0,
          porQue:
            'cadena cerrada con el anclaje en ' +
            modelo.anclaje +
            ': la barra está fija al mundo y el que gira es el cuerpo',
        },
      ],
      avisos: plan.limites,
      supuesto: false,
    }
  }

  // SIN IMPLEMENTO DECLARADO NO SE DIBUJA NADA.
  //
  // Hasta el 2026-09-05 aquí se suponía barra, con su comentario diciendo que suponer es
  // malo. El efecto: un curl femoral sentado, unas dominadas asistidas y una plancha con
  // carga salían con una barra olímpica en las manos. Medido con
  // `scripts/medir-implementos.mjs`: 6 de los 27 ejercicios del seed, el 22 %.
  //
  // Dibujar el implemento equivocado es peor que no dibujar ninguno: contradice a la
  // prescripción que el asesorado está leyendo. Sin nombre que lo declare, la escena
  // calla y lo dice en un aviso.
  if (plan.implemento === undefined) {
    return { piezas: [], avisos: [...plan.limites, AVISO_SIN_IMPLEMENTO], supuesto: true }
  }
  const principal = plan.ejes[0]
  return armar(
    categoria,
    nombreEjercicio,
    plan.implemento,
    plan.perfilDeImplemento,
    plan.unilateral,
    poleaAlta(principal?.articulacion, principal?.accion),
    plan.limites,
  )
}

/**
 * Sin modelo no hay eje que diga si la polea es alta, así que lo dice el nombre: jalones,
 * pullovers y extensiones de tríceps tiran desde arriba; lo demás, desde abajo. Es la misma
 * regla gruesa que `poleaAlta`, y se equivoca de la misma forma visible.
 */
function poleaAltaPorNombre(nombre: string): boolean {
  return /JAL[OÓ]N|PULLOVER|TR[IÍ]CEPS|POLEA ALTA|FACE PULL|BRAZO RECTO/i.test(nombre)
}

/** La escena a partir de lo decidido: qué implemento, dónde entra, cuántas masas. */
function armar(
  categoria: string,
  nombreEjercicio: string,
  implemento: Implemento,
  perfil: PerfilDeImplemento | undefined,
  unilateral: boolean,
  alto: boolean,
  avisos: readonly string[],
): EscenaDeImplementos {
  const piezas = PIEZAS_POR_IMPLEMENTO[implemento] ?? []
  if (piezas.length === 0) return { piezas: [], avisos, supuesto: false }

  // DÓNDE ENTRA LA CARGA lo decide el ejercicio, no solo el implemento: la misma barra va
  // en las manos en un press, sobre el trapecio en una sentadilla y sobre la pelvis en un
  // empuje de cadera. Ver `domain/biomecanica/aplicacionDeLaCarga.ts`.
  const aplicacion = aplicacionDeLaCarga(categoria, implemento, perfil, nombreEjercicio)
  let agarres = AGARRE_POR_APLICACION[aplicacion] ?? MANOS
  // La lateralidad es ortogonal al implemento, igual que en la tabla: con la
  // carga a un lado hay UN agarre, sea mancuerna, polea o prensa.
  if (unilateral && agarres.length === 2) agarres = [agarres[0]]

  const salida: ImplementoEnEscena[] = piezas.map(({ pieza, forma }) => {
    // Una masa (`cargas: 1`) es una pieza rígida que las dos manos comparten;
    // dos masas son dos piezas que pueden ir a distinta altura, y eso es
    // exactamente lo que la tabla avisa que desde el lateral no se ve.
    const rigida = pieza !== 'mancuerna' && (perfil?.cargas ?? 1) === 1
    const base: ImplementoEnEscena = {
      pieza,
      forma,
      agarres,
      rigida,
      radioDisco: pieza === 'barra' || pieza === 'disco' ? RADIO_DISCO : 0,
      porQue:
        `implemento «${perfil?.nombre ?? implemento}»` +
        `, carga aplicada en ${aplicacion}` +
        (porQueSeApoya(categoria, implemento, nombreEjercicio) ? ' (se apoya en el cuerpo)' : '') +
        `, ${perfil?.cargas ?? 1} masa(s)` +
        (unilateral ? ', a un solo lado' : ''),
    }
    if (pieza !== 'maquina') return base
    return {
      ...base,
      radioDisco: 0,
      enElSuelo: sueloDeMaquina(forma, alto, categoria, nombreEjercicio, agarres),
    }
  })

  // `supuesto` es siempre falso a partir de aquí: sin implemento declarado se salió
  // arriba sin dibujar nada. El campo se queda porque quien lo lee distingue «no hay
  // implemento porque no se sabe» de «no hay implemento porque este ejercicio no lleva».
  return { piezas: salida, avisos, supuesto: false }
}

/**
 * POR DÓNDE PASA LA CARGA a lo largo de la concéntrica, en metros de mundo.
 *
 * Es lo que permite colocar el aparato contra el gesto en vez de en un sitio fijo. Se
 * resuelve con el esqueleto NEUTRO y no con el del asesorado: la máquina de un gimnasio no
 * se muda de sitio porque entre alguien más alto, y meter aquí el juego de huesos obligaría
 * a rehacer la escena de implementos cada vez que cambia de persona, que es justo lo que la
 * caché del visor evita.
 */
function caminoDeLaCarga(
  patron: Patron | undefined,
  agarres: readonly PuntoDeAgarre[],
): Vec3[] {
  if (!patron || agarres.length === 0) return []
  const N = 9
  const camino: Vec3[] = []
  for (let i = 0; i < N; i++) {
    const esq = esqueletoEnFase(patron, i / (N - 1))
    let suma: Vec3 = [0, 0, 0]
    for (const a of agarres) suma = V.sumar(suma, puntoDeHueso(esq, a.hueso, a.t, a.desvio))
    camino.push(V.escalar(suma, 1 / agarres.length))
  }
  return camino
}

/**
 * Dónde se planta cada máquina, con el sujeto en el origen y mirando a +Z.
 *
 * ## Las dos que se calculan, y por qué dejaron de ser una tabla
 *
 * La polea y la máquina de placas **se colocan contra el gesto**, no en un sitio de
 * memoria. Lo pidió Bryan el 2026-09-06 y el motivo es que un aparato que no se opone al
 * movimiento no es un aparato: medido con `scripts/medir-resistencia.mjs` sobre el catálogo
 * entero, con los números a mano de antes **13 de 27 no se oponían** —el remo tiraba desde
 * detrás del que rema, la extensión de rodilla empujaba de canto, la abducción de cadera
 * casi de lado—. Ver `lineaDeResistencia.ts`, que es donde está la regla y su medida.
 *
 * Si el recorrido no da para decidir —una carga que no se mueve, un arco que en realidad es
 * una recta— se cae a la colocación de siempre. Es peor, pero es la de antes, y se ve.
 *
 * ## Las dos que no
 *
 * El Smith envuelve al sujeto y la prensa se apoya donde apoyan los pies: ahí la geometría
 * de la máquina fija la colocación y no hay nada que resolver.
 *
 * Ninguna se planta en −X. Ése es el sitio del trípode —`SALA.estacion` lo pone a 180°,
 * perpendicular al plano sagital— y es el único plano desde el que una cámara puede medir.
 * Una máquina ahí taparía la toma, que es el fallo que la escena existe para evitar.
 */
function sueloDeMaquina(
  forma: FormaDeMaquina | undefined,
  alto: boolean,
  categoria: string,
  nombreEjercicio: string,
  agarres: readonly PuntoDeAgarre[],
): { centro: Vec3; giroGrados: number; alturaDeCarga: number; anclaje: Vec3 } {
  if (forma === 'polea' || forma === 'placas') {
    const camino = caminoDeLaCarga(patronDeCategoria(categoria, nombreEjercicio), agarres)
    const resuelto = anclajeQueSeOpone(camino, forma)
    if (resuelto) {
      return {
        centro: resuelto.centro,
        giroGrados: giroHacia(resuelto.centro),
        alturaDeCarga: resuelto.alturaDeCarga,
        anclaje: resuelto.anclaje,
      }
    }
  }
  switch (forma) {
    case 'rail-vertical':
      // El Smith envuelve al sujeto: su centro es el suyo.
      return { centro: [0, 0, 0], giroGrados: 0, alturaDeCarga: 1.35, anclaje: [0, 1.35, 0] }
    case 'rail-inclinado':
      // La prensa se apoya donde apoyan los pies: delante, en +Z.
      return { centro: [0, 0, 0.55], giroGrados: 0, alturaDeCarga: 0.6, anclaje: [0, 0.6, 0.55] }
    case 'polea':
      // La columna, delante y a la vista: la tabla exige que el anclaje entre
      // en el encuadre, porque sin él no hay dirección de cable ni brazo.
      return {
        centro: [0, 0, 1.15],
        giroGrados: 180,
        alturaDeCarga: alto ? 2.2 : 0.32,
        anclaje: [0, alto ? 2.2 : 0.32, 1.15],
      }
    default:
      // La de placas, detrás: el cuerpo va apoyado en ella.
      return { centro: [0, 0, -0.72], giroGrados: 0, alturaDeCarga: 1.15, anclaje: [0, 1.15, -0.72] }
  }
}

/** Que el bastidor mire al sujeto: es lo que hace que la pila quede por fuera y no en medio. */
function giroHacia(centro: Vec3): number {
  return (Math.atan2(-centro[0], -centro[2]) * 180) / Math.PI
}
