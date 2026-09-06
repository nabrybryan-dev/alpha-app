import { describe, expect, it } from 'vitest'
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
  it('recorre 62 categorías y le salen 59 con patrón y 3 sin sujeto', () => {
    // 2026-09-06: eran 54 con patrón y 8 sin. Las cinco que entraron son las cinco
    // fichas nuevas —`flexion_hombro`, `rotacion_cadera`, `extension_lumbar`,
    // `flexion_muneca`, `extension_muneca`—, y las tres que quedan NO son un hueco
    // del catálogo: son las tres categorías que no nombran un gesto sino un para
    // qué, y ahí decide el nombre del ejercicio a propósito.
    const reparto = repartir(categoriasDelRepo())
    expect(reparto.casos).toHaveLength(62)
    expect(reparto.conPatron).toHaveLength(59)
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

  it('las 159 familias de nombre de producción: 150 con sujeto y 9 sin, y las 9 son cardio', () => {
    // 2026-09-06: eran 140 y 19. Las diez que entraron son las seis de PREV/REHAB, las
    // dos de EXTENSIÓN LUMBAR, el 90/90 y el swing —que es una bisagra de cadera
    // lanzada y compartía categoría con la cinta sin compartir nada más—.
    //
    // Las nueve que quedan son cardio, y quedarse fuera es lo CORRECTO: no hay gesto
    // resistido que enseñar en una elíptica. La diferencia con antes es que ahora está
    // declarado en `SIN_PATRON` en vez de caerse por no encajar en ninguna regla.
    const reparto = repartir(ejerciciosDeProduccion())
    expect(reparto.casos).toHaveLength(159)
    expect(reparto.conPatron).toHaveLength(150)
    expect(reparto.sinPatron.map((c) => `${c.categoria} · ${c.nombre}`)).toEqual([
      'ACONDICIONAMIENTO · CARDIO',
      'ACONDICIONAMIENTO · BICICLETA',
      'ACONDICIONAMIENTO · CINTA',
      'ACONDICIONAMIENTO · ESCALADORA',
      'ACONDICIONAMIENTO · ELIPTICA',
      'ACONDICIONAMIENTO · HIIT',
      'ACONDICIONAMIENTO · CIRCUITO',
      'ACONDICIONAMIENTO · TABATA',
      'ACONDICIONAMIENTO · ERGOMETRO',
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
    expect(de('Curl femoral sentado')).toBe('flexion_rodilla')
    expect(de('Curl femoral tumbado')).toBe('flexion_rodilla')
    expect(de('Abducción de cadera en máquina')).toBe('abduccion_cadera')
    expect(de('Elevaciones laterales con mancuernas')).toBe('abduccion_hombro')
    expect(de('Elevación lateral en polea')).toBe('abduccion_hombro')
    expect(de('Patada de glúteo en polea')).toBe('extension_cadera')
    expect(de('Curl de bíceps en banco inclinado')).toBe('flexion_codo')
    expect(de('Extensión de tríceps en polea con cuerda')).toBe('extension_codo')
  })

  it('el trineo del acondicionamiento sale como un SALTO', () => {
    // Uno de los dos sitios del censo donde la lista por nombre contradice a la categoría
    // (el otro es la rotación de cadera, aquí abajo):
    // la migración 0038 clasifica TRINEO como ACONDICIONAMIENTO —empuje de trineo, sin
    // gesto que enseñar— y `POR_NOMBRE` lo lleva a `salto` porque comparte lista con el
    // trabajo reactivo. Un empuje de trineo enseñaría a un sujeto saltando.
    //
    // Queda escrito como test para que sea un hecho medido y no una impresión. No se
    // arregla desde aquí: la lista vive en `src/domain/`, que esta capa no toca.
    expect(patronDeCategoria('ACONDICIONAMIENTO', 'Empuje de trineo 20 m')?.id).toBe('salto')
    // Y el resto del cardio del censo no enseña ningún gesto, que es lo correcto.
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
