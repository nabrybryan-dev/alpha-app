import { describe, expect, it } from 'vitest'
import { implementoDe } from '../src/domain/biomecanica/implementos'
import { modeloDePalanca, planDeMedida } from '../src/domain/biomecanica/palancas'
import { PATRONES, patronDeCategoria } from '../src/domain/patrones/catalogo'
import { CATEGORIAS } from '../src/domain/taxonomia'
import type { EjercicioPrescrito } from '../src/domain/types'
import { tienePatronDeMovimiento } from '../src/features/entrenar/salon/sinPatron/SalonSinSujeto'
import {
  barrido,
  categoriasDelRepo,
  ejerciciosDeProduccion,
  ejerciciosDelSeed,
  informeDelBarrido,
  repartir,
  type Caso,
} from './cobertura-de-patrones'

/**
 * ¿Funciona para todos los ejercicios? — el punto 8, contado.
 *
 * El informe de verificación daba este punto por bueno «para el repo» y dejaba el catálogo
 * real fuera de la medida. No hacía falta: el reparto se puede contar sin salir de aquí. La
 * regla vive entera en `patronDeCategoria()`, y el vocabulario de categorías y las familias
 * de nombre que el coach escribe de verdad están en seis archivos de este repositorio.
 * `cobertura-de-patrones.ts` los junta; aquí se recorren y se fijan los números.
 *
 * ## Por qué los números van clavados y no como «al menos»
 *
 * Porque el que importa no es el porcentaje sino QUIÉN se queda fuera. Un `toBeGreaterThan`
 * dejaría añadir una ficha —o perderla— sin que nadie se enterase, y el informe quedaría
 * mintiendo con un número viejo. Clavados, cualquier movimiento del catálogo pone este
 * archivo en rojo y obliga a volver al informe y corregir la cifra. Es el mismo trato que
 * el inventario de `/entrenar`.
 *
 * ## Lo que estos tests NO dicen
 *
 * Cuántas prescripciones hay detrás de cada familia. Aquí cada ejercicio distinto pesa uno;
 * en la app pesan las veces que se prescribe. La ponderación necesita un `count(*)` contra
 * la base y está escrita como consulta en `informes/verificacion-iphone.md`.
 */

function ejercicio(caso: Caso): EjercicioPrescrito {
  return {
    id: `e-${caso.categoria}-${caso.nombre ?? ''}`,
    categoria: caso.categoria,
    nombre: caso.nombre ?? '',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets: 3,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
  }
}

describe('el barrido de categorías', () => {
  it('recorre 72 categorías y le salen 69 con patrón y 3 sin sujeto', () => {
    // 2026-09-06: eran 54 con patrón y 8 sin. Las cinco que entraron ese día son las cinco
    // fichas nuevas —`flexion_hombro`, `rotacion_cadera`, `extension_lumbar`,
    // `flexion_muneca`, `extension_muneca`—, y las tres que quedan NO son un hueco
    // del catálogo: son las tres categorías que no nombran un gesto sino un para
    // qué, y ahí decide el nombre del ejercicio a propósito.
    //
    // La 61 es PRENSA, esa misma noche. No cubre nada que estuviera descubierto —una prensa
    // ya caía en SENTADILLA— sino que deja de enseñar el gesto equivocado: la ficha de la
    // sentadilla dibuja a alguien DE PIE, y con la prensa por primer ejemplo le salía la
    // máquina alrededor, con los pies sin moverse ni tres milímetros.
    // La 62 es APERTURA INVERSA EN MÁQUINA (2026-09-07): la apertura inversa se hace sentado
    // de frente al aparato, y la ficha de pie con el tronco doblado dejaba el brazo de la
    // máquina cruzando el tronco. Como con la prensa: no cubre nada que estuviera descubierto,
    // deja de enseñar el gesto equivocado.
    // La 63 es FLEXIÓN DE RODILLA SENTADO (2026-09-07, tarde): «Curl femoral sentado» caía en
    // la ficha tumbada. Como la prensa y la apertura inversa: deja de enseñar el gesto
    // equivocado, no cubre nada que estuviera descubierto.
    const reparto = repartir(categoriasDelRepo())
    // Y la 64 es FACE PULL (2026-09-07, tarde): de pie, cuerda desde arriba, con la flexión
    // de codo integrada en la rotación externa y la abducción horizontal, que Bryan pidió.
    // Y de la 65 a la 69, el cardio (2026-09-07, tarde): caminata, carrera, escaladora,
    // bicicleta y elíptica, que Bryan pidió con sujeto. Cambio de decisión, no deriva.
    expect(reparto.casos).toHaveLength(72)
    expect(reparto.conPatron).toHaveLength(69)
    expect(reparto.sinPatron.map((c) => c.categoria)).toEqual([
      'PREV/REHAB',
      'ACONDICIONAMIENTO',
      'AISLAMIENTO',
    ])
  })

  it('de las 34 canónicas, ninguna que nombre un gesto se queda sin ficha', () => {
    // Las dos que no resuelven —PREV/REHAB y ACONDICIONAMIENTO— no nombran un gesto
    // sino un para qué, y ahí decide el nombre a propósito. Las cinco que sí nombraban
    // una acción articular y no tenían ficha ya la tienen: rotación de cadera, flexión
    // de hombro, las dos muñecas y la extensión lumbar.
    const sinFicha = CATEGORIAS.filter((c) => !patronDeCategoria(c))
    expect(sinFicha).toEqual(['PREV/REHAB', 'ACONDICIONAMIENTO'])
    expect(CATEGORIAS).toHaveLength(34)
  })

  it('cada ficha del catálogo se encuentra por su propia categoría', () => {
    // Es la comprobación que hace útil a la de arriba: si una ficha dejara de
    // resolverse por su categoría, el recuento seguiría cuadrando y la pérdida
    // pasaría inadvertida.
    for (const p of PATRONES) {
      expect(patronDeCategoria(p.categoria)?.id, `ficha inalcanzable: ${p.id}`).toBe(p.id)
    }
  })
})

describe('el barrido de los ejercicios con nombre y apellido', () => {
  it('los 27 del seed: los 27 con sujeto, ninguno sin', () => {
    // 2026-09-06: eran 19 y 8. Los ocho que faltaban eran TODOS de `AISLAMIENTO`, y
    // ninguno necesitaba ficha nueva —un curl femoral es una flexión de rodilla y una
    // elevación lateral es una abducción de hombro—. Necesitaban que la lista por
    // nombre los mirara, porque su categoría no dice el gesto. Era el agujero más
    // grande del barrido: el 30 % del seed.
    const reparto = repartir(ejerciciosDelSeed())
    expect(reparto.casos).toHaveLength(27)
    expect(reparto.conPatron).toHaveLength(27)
    expect(reparto.sinPatron).toHaveLength(0)
  })

  it('las 159 familias de nombre de producción: 153 con sujeto y 6 sin', () => {
    // 153 desde el 2026-09-07: cuatro familias de cardio de la cartera —cinta o elíptica en
    // zona 2, bicicleta, caminadora, escaladora— tienen sujeto desde que Bryan lo pidió.
    // 2026-09-06: eran 140 y 19. Las diez que entraron son las seis de PREV/REHAB, las
    // dos de EXTENSIÓN LUMBAR, el 90/90 y el swing —que es una bisagra de cadera
    // lanzada y compartía categoría con la cinta sin compartir nada más—.
    //
    // De las seis que quedan, CUATRO son cardio SIN modalidad o sin ficha —«CARDIO» a
    // secas, HIIT, TABATA, ERGÓMETRO— y quedarse fuera es lo correcto: no hay gesto que
    // enseñar sin saber sobre qué se corre, y el ergómetro de remo no tiene ficha todavía.
    // Bicicleta, cinta, escaladora y elíptica SALIERON de esta lista el 2026-09-07, cuando
    // Bryan pidió el cardio con sujeto; hasta entonces estaban aquí por decisión suya.
    //
    // La quinta es el CIRCUITO, y la sexta el TRINEO: un empuje de trineo sí es un gesto
    // enseñable, lo que no tiene es ficha. Hasta el 2026-09-06 caía en la lista por nombre y
    // le salía el muñeco del SALTO — un patrón EQUIVOCADO, que es peor que ninguno porque no
    // se ve venir. Decisión de Bryan: antes sin muñeco que con el de otro.
    const reparto = repartir(ejerciciosDeProduccion())
    expect(reparto.casos).toHaveLength(159)
    expect(reparto.conPatron).toHaveLength(153)
    expect(reparto.sinPatron.map((c) => `${c.categoria} · ${c.nombre}`)).toEqual([
      'ACONDICIONAMIENTO · CARDIO',
      'ACONDICIONAMIENTO · HIIT',
      'ACONDICIONAMIENTO · CIRCUITO',
      'ACONDICIONAMIENTO · TABATA',
      'ACONDICIONAMIENTO · ERGOMETRO',
      'ACONDICIONAMIENTO · TRINEO',
    ])
  })

  it('las seis familias de PREV/REHAB encuentran patrón, con el trozo pelado y con el nombre entero', () => {
    // El clasificador de la migración guarda el TROZO de nombre que le basta para
    // clasificar, no el nombre completo. Antes cuatro de las seis se quedaban sin
    // sujeto escritas de cualquiera de las dos formas; ahora las seis resuelven con el
    // trozo, que es la prueba más dura, así que con el nombre entero también.
    expect(patronDeCategoria('PREV/REHAB', 'ROTADOR')?.id).toBe('rotacion_externa_hombro')
    expect(patronDeCategoria('PREV/REHAB', 'Manguito rotador con banda')?.id).toBe(
      'rotacion_externa_hombro',
    )
    expect(patronDeCategoria('PREV/REHAB', 'Apoyo estable a una pierna (descalza)')?.id).toBe(
      'apoyo_una_pierna',
    )
    expect(patronDeCategoria('PREV/REHAB', 'Isometría de sostén en anillas')?.id).toBe(
      'antiextension',
    )
    expect(patronDeCategoria('PREV/REHAB', 'Arco plantar con toalla')?.id).toBe('apoyo_una_pierna')
    expect(patronDeCategoria('PREV/REHAB', 'Tibial posterior con banda')?.id).toBe('flexion_plantar')
    expect(patronDeCategoria('PREV/REHAB', 'Pliometría de escalón')?.id).toBe('salto')
  })

  it('los ocho de AISLAMIENTO del seed van cada uno a su gesto', () => {
    // La comprobación que hace útil el recuento de arriba: que estén cubiertos no basta,
    // tienen que estar cubiertos por el patrón CORRECTO. Un curl femoral enseñando una
    // bisagra de cadera contaría igual en el porcentaje y sería el defecto de la
    // rotación de cadera otra vez.
    const de = (nombre: string) => patronDeCategoria('AISLAMIENTO', nombre)?.id
    // Sentado: su propia silla desde el 2026-09-07. Antes caía en la ficha tumbada —boca
    // abajo con camilla— y Bryan lo vio en el iPhone.
    expect(de('Curl femoral sentado')).toBe('flexion_rodilla_sentado')
    expect(de('Curl femoral tumbado')).toBe('flexion_rodilla')
    expect(de('Abducción de cadera en máquina')).toBe('abduccion_cadera')
    expect(de('Elevaciones laterales con mancuernas')).toBe('abduccion_hombro')
    expect(de('Elevación lateral en polea')).toBe('abduccion_hombro')
    expect(de('Patada de glúteo en polea')).toBe('extension_cadera')
    expect(de('Curl de bíceps en banco inclinado')).toBe('flexion_codo')
    expect(de('Extensión de tríceps en polea con cuerda')).toBe('extension_codo')
  })

  it('el trineo ya no sale como un SALTO: sale sin muñeco', () => {
    // EL DEFECTO QUE ESTE ARCHIVO DEJÓ MEDIDO Y QUE SE CERRÓ EL 2026-09-06.
    //
    // La migración 0038 clasifica TRINEO como ACONDICIONAMIENTO —empuje de trineo, en el
    // mismo saco que la cinta— y la lista por nombre lo llevaba a `salto`, porque compartía
    // línea con el trabajo reactivo. Al asesorado al que se le manda empujar un trineo le
    // salía un muñeco saltando, con las flechas de fuerza de un salto.
    //
    // No se arregló dándole ficha propia —que se puede, y un empuje de trineo enseñaría algo
    // que en un vídeo no se ve: que la fuerza sale del ángulo del cuerpo y no de los
    // brazos— sino quitándole el muñeco. Decisión de Bryan: antes sin muñeco que con el de
    // otro. Está DECLARADO en `SIN_PATRON`, así que el día que alguien le escriba su ficha
    // hay que sacarlo de ahí y este test se pondrá rojo pidiéndolo.
    expect(patronDeCategoria('ACONDICIONAMIENTO', 'Empuje de trineo 20 m')).toBeUndefined()
    expect(patronDeCategoria('ACONDICIONAMIENTO', 'TRINEO')).toBeUndefined()
    expect(patronDeCategoria('ACONDICIONAMIENTO', 'Arrastre de trineo')).toBeUndefined()
    // Y los saltos de verdad siguen saliendo, que es lo que hace útil lo de arriba: se quitó
    // el trineo de la regla, no la regla.
    expect(patronDeCategoria('PREV/REHAB', 'Salto al cajón')?.id).toBe('salto')
    expect(patronDeCategoria('PREV/REHAB', 'Pliometría de escalón')?.id).toBe('salto')
    expect(patronDeCategoria('POTENCIA · REACTIVA', 'Drop squat')?.id).toBe('salto')
    // Y el resto del cardio del censo tampoco enseña gesto, que es lo correcto.
    expect(patronDeCategoria('ACONDICIONAMIENTO', 'HIIT en bicicleta 30/30')).toBeUndefined()
  })

  it('lo descartado por no ser un nombre literal no mueve el reparto', () => {
    // De la alternancia del clasificador se apartan las 21 alternativas que llevan
    // metacaracteres: inventarles una grafía metería en el barrido nombres que nadie
    // escribió. Sólo dos de ellas caen en una categoría que no resuelve sola, así que
    // el reparto de arriba no depende de esa decisión.
    const { descartadasDelClasificador, descartadasQueImportan } = barrido()
    expect(descartadasDelClasificador).toHaveLength(21)
    // 2026-09-06: eran dos —la elevación frontal y la rotación de cadera— y ahora
    // ninguna, porque las dos categorías ya tienen ficha y resuelven solas.
    expect(descartadasQueImportan).toEqual([])
    expect(patronDeCategoria('FLEXIÓN DE HOMBRO', 'Elevaciones frontales con disco')?.id).toBe(
      'flexion_hombro',
    )
  })

  it('una rotación externa de CADERA ya no enseña el manguito del HOMBRO', () => {
    // El defecto que este archivo dejó medido el 2026-09-05 y que se arregla hoy.
    // `ROTACIÓN DE CADERA` no tenía ficha, así que caía a la lista por nombre; y allí
    // `rotación externa` estaba escrito para el manguito rotador del HOMBRO. La familia
    // recibía sujeto, pero era el sujeto de otro ejercicio y de otra articulación: no
    // «falta un patrón» —que se ve venir con el aviso de sin modelo— sino un patrón
    // EQUIVOCADO, que se ve como si fuera correcto.
    //
    // Se arregla por los dos lados: la ficha `rotacion_cadera` hace que la categoría
    // resuelva sola, y en `POR_NOMBRE` la regla de cadera va ANTES que la de hombro,
    // para que un nombre suelto sin categoría tampoco se equivoque.
    expect(patronDeCategoria('ROTACIÓN DE CADERA', 'Rotación externa de cadera sentado')?.id).toBe(
      'rotacion_cadera',
    )
    expect(patronDeCategoria('ROTACIÓN DE CADERA', 'Rotación interna de cadera')?.id).toBe(
      'rotacion_cadera',
    )
    expect(patronDeCategoria('ROTACIÓN DE CADERA', '90/90 de cadera')?.id).toBe('rotacion_cadera')
    // Sin categoría que ayude, el nombre solo tiene que seguir separándolos.
    expect(patronDeCategoria('AISLAMIENTO', 'Rotación externa de cadera con banda')?.id).toBe(
      'rotacion_cadera',
    )
    expect(patronDeCategoria('AISLAMIENTO', 'Rotación externa de hombro en polea')?.id).toBe(
      'rotacion_externa_hombro',
    )
  })
})

describe('quién declara con qué se hace el ejercicio', () => {
  it('de los 93 ejemplos del catálogo, 91 declaran implemento y 2 no', () => {
    // El otro barrido cuenta quién tiene SUJETO; este cuenta quién tiene IMPLEMENTO, que es
    // lo que decide si además se le puede dibujar una flecha de fuerza. Un patrón con cuerpo
    // y sin implemento se ve moverse y no se puede medir.
    //
    // Eran 37 de 89 sin declarar el 2026-09-06 por la mañana. Se cerraron en dos tandas y de
    // dos formas distintas, que es la parte que conviene tener escrita:
    //
    //   · Por FAMILIA, cuando el nombre ya dice el implemento aunque no lo nombre: la banda
    //     —que ni siquiera existía en la tabla—, los saltos, las planchas, los equilibrios,
    //     los colgados, la movilidad, el banco romano, un crunch a secas y el pec deck, que
    //     es el nombre de la máquina y no del gesto.
    //   · Por APELLIDO, poniéndoselo al ejemplo, que es lo correcto cuando el gesto admite
    //     varios implementos y aquí se elige uno para dibujarlo: «Press militar CON BARRA»,
    //     «Face pull EN POLEA», «Peso muerto parcial CON BARRA desde rack».
    // LAS FICHAS CÍCLICAS NO ENTRAN EN ESTE RECUENTO: el cardio no lleva carga, así que no
    // tiene implemento de carga ni flecha de fuerza que dibujar, y contarlo aquí sería
    // contar como hueco lo que es la naturaleza del ejercicio. La cinta la pone la escena.
    const ejemplos = PATRONES.filter((p) => !p.ciclo).flatMap((p) => p.ejemplos.split('·').map((e) => e.trim()))
    const sin = ejemplos.filter((n) => !implementoDe(n))
    // 96 desde el 2026-09-06: los tres de la ficha de PRENSA; 99 desde el 2026-09-07, los
    // tres de la apertura inversa en máquina. Todos declaran implemento, así que los que no
    // lo declaran siguen siendo los dos de siempre.
    // 101 desde la tarde del 2026-09-07: los dos del curl femoral sentado; 104 con los tres
    // del face pull, que declaran los tres (polea, polea, banda).
    expect(ejemplos).toHaveLength(104)
    expect(sin).toHaveLength(2)
  })

  it('los dos que faltan faltan a propósito, y son el mismo ejercicio', () => {
    // `undefined` no es lo mismo que `barra`: un paseo del granjero se hace con mancuernas o
    // con barra hexagonal y el nombre no lo dice. Suponer es exactamente cómo entraría un
    // Smith por la puerta de atrás con el modelo equivocado.
    //
    // Y en este caso hay una segunda razón, MEDIDA: ponerle «con mancuerna» le da implemento
    // de peso libre, y con peso libre se enciende la ley de trayectoria de
    // `demandaDeTrayectoria` — que sobre un porteo da razón 1,12 y lo marca como incumplido.
    // No porque el gesto esté mal: porque un porteo CAMINA, y esa ley mide la deriva contra
    // el mundo. El día que se le declare implemento hay que medirla contra la pelvis.
    //
    // Va clavado para que nadie cierre el hueco adivinando.
    const sin = PATRONES.filter((p) => !p.ciclo).flatMap((p) => p.ejemplos.split('·').map((e) => e.trim())).filter(
      (n) => !implementoDe(n),
    )
    expect(sin.sort()).toEqual(['Maleta', 'Paseo del granjero a una mano'])
  })

  it('los 27 del seed declaran los 27, y solo una ficha se queda sin implemento', () => {
    // El seed es lo que ve el asesorado de demo: ahí no puede faltar ninguno.
    expect(ejerciciosDelSeed().filter((c) => !implementoDe(c.nombre ?? ''))).toHaveLength(0)
    // Y del catálogo, el PRIMER ejemplo es el que decide con qué se dibuja el patrón en el
    // salón. Solo uno se queda sin: el paseo del granjero, y a propósito — ver arriba.
    const fichas = PATRONES.filter((p) => !p.ciclo && !implementoDe(p.ejemplos.split('·')[0].trim()))
    expect(fichas.map((p) => p.id)).toEqual(['antiflexion_lateral'])
  })
})

describe('quién tiene modelo mecánico, y por tanto flechas de fuerza', () => {
  it('de las 149 familias con sujeto y carga, solo 3 se quedan sin plan de medida', () => {
    // El tercer barrido. Tener sujeto no basta: sin modelo mecánico el salón dibuja el
    // cuerpo moviéndose y NI UNA SOLA FLECHA, que es la mitad de lo que se prometió.
    //
    // Eran 22 el 2026-09-06 —el 15 % de lo que se prescribe—, y casi todas de PREV/REHAB:
    // manguito, apoyo monopodal, suspensión y trabajo reactivo. La causa era de índice: la
    // tabla de modelos va por categoría CANÓNICA y esas fichas tienen categorías que no
    // están en la taxonomía, así que no se las podía ni nombrar. `MODELOS_DE_FICHA` las
    // nombra.
    //
    // Las tres que quedan son MOVILIDAD, cuyo modelo está escrito `null` a propósito: una
    // movilidad no tiene carga contra la que medir palanca. Eso no es un hueco.
    // LAS FICHAS CÍCLICAS NO ENTRAN (2026-09-07): el cardio no lleva carga, así que no hay
    // palanca que medir ni flecha que dibujar. Es la naturaleza del ejercicio, no un hueco.
    const conSujeto = ejerciciosDeProduccion().filter((c) => {
      const p = patronDeCategoria(c.categoria, c.nombre)
      return p !== undefined && !p.ciclo
    })
    const sinPlan = conSujeto.filter((c) => {
      const p = patronDeCategoria(c.categoria, c.nombre)!
      return !planDeMedida(p.categoria, c.nombre ?? '')
    })
    expect(conSujeto).toHaveLength(149)
    expect(sinPlan.map((c) => `${c.categoria} · ${c.nombre}`)).toEqual([
      'MOVILIDAD · MOVILIDAD',
      'MOVILIDAD · DISLOCACION',
      'MOVILIDAD · FOAM ROLLER',
    ])
  })

  it('los cuatro modelos de ficha piden la cámara donde su eje se ve girar', () => {
    // Lo que hace útil el recuento de arriba: que exista un plan no basta si pide la
    // cámara donde el gesto no se ve. Dos de los cuatro NO se graban de lado, y eso es lo
    // que el modelo tiene que decir antes de que alguien plante el móvil:
    //
    // - la rotación del manguito ocurre en el plano transverso: de perfil el recorrido
    //   entero se proyecta sobre un punto y la medida sale cero con cara de dato;
    // - el apoyo a una pierna se rompe en el plano frontal —la pelvis cae hacia el lado
    //   libre— y de perfil no se ve caer nada.
    const vista = (categoria: string) => modeloDePalanca(categoria)?.vista
    expect(vista('POTENCIA · REACTIVA')).toBe('lateral')
    expect(vista('ROTACIÓN EXTERNA')).toBe('cenital')
    expect(vista('APOYO A UNA PIERNA')).toBe('frontal')
    expect(vista('SUSPENSIÓN')).toBe('frontal')
    // Y ninguno mide contra una barra que no existe: los tres de peso corporal van contra
    // el centro de masas y el del manguito contra la línea del cable.
    const linea = (categoria: string) => modeloDePalanca(categoria)?.linea.origen
    expect(linea('POTENCIA · REACTIVA')).toBe('centro-de-masas')
    expect(linea('APOYO A UNA PIERNA')).toBe('centro-de-masas')
    expect(linea('SUSPENSIÓN')).toBe('centro-de-masas')
    expect(linea('ROTACIÓN EXTERNA')).toBe('cable')
  })

  it('el `patron` prestado de esos cuatro no les cuela los consejos de otro ejercicio', () => {
    // LA TRAMPA LATENTE, clavada antes de que muerda. `ModeloDePalanca.patron` es de tipo
    // `Categoria` y estas cuatro claves no lo son, así que cada una declara la canónica
    // cuya mecánica comparte —el salto declara SENTADILLA—. Pero `conReglas()` usa ese
    // campo para pegarle a cada eje el consejo escrito para ESE patrón: si el salto
    // ganara un eje lumbar, heredaría «el ángulo del torso constante durante todo el
    // descenso», que es un consejo de sentadilla dicho sobre un salto.
    //
    // Hoy no pasa porque ningún eje coincide, y esta prueba es lo que hace que se sepa el
    // día que alguien añada uno.
    for (const categoria of [
      'POTENCIA · REACTIVA',
      'ROTACIÓN EXTERNA',
      'APOYO A UNA PIERNA',
      'SUSPENSIÓN',
    ]) {
      const modelo = modeloDePalanca(categoria)!
      const heredadas = modelo.ejes.filter((e) => e.regla).map((e) => e.articulacion)
      expect(heredadas, `${categoria} hereda consejos de ${modelo.patron}`).toEqual([])
    }
  })
})

describe('la puerta del salón dice lo mismo que el dominio', () => {
  it('sobre las 159 familias de producción, sin una sola discrepancia', () => {
    // `tienePatronDeMovimiento` es lo que decide si el salón monta el visor o monta
    // `SalonSinSujeto`. Que delegue en el dominio está escrito en su cuerpo; aquí se
    // comprueba sobre el censo entero, que es donde una segunda regla se destaparía.
    for (const caso of ejerciciosDeProduccion()) {
      const esperado = patronDeCategoria(caso.categoria, caso.nombre) !== undefined
      expect(tienePatronDeMovimiento(ejercicio(caso)), `${caso.categoria} · ${caso.nombre}`).toBe(
        esperado,
      )
    }
  })
})

describe('el barrido, para regenerar los números del informe', () => {
  it('imprime el reparto entero', () => {
    // Los números del punto 8 de `informes/verificacion-iphone.md` salen de aquí. Se
    // imprimen para que se puedan volver a sacar sin escribir código nuevo: corriendo
    // `npx vitest run pruebas/cobertura-de-patrones.test.ts` sale el mismo texto.
    const texto = informeDelBarrido()
    console.log(texto)
    expect(texto).toContain('FAMILIAS DE NOMBRE DE PRODUCCIÓN: 159')
  })
})
