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
  it('recorre 62 categorías y le salen 54 con patrón y 8 sin sujeto', () => {
    const reparto = repartir(categoriasDelRepo())
    expect(reparto.casos).toHaveLength(62)
    expect(reparto.conPatron).toHaveLength(54)
    expect(reparto.sinPatron.map((c) => c.categoria)).toEqual([
      'ROTACIÓN DE CADERA',
      'FLEXIÓN DE HOMBRO',
      'FLEXIÓN DE MUÑECA',
      'EXTENSIÓN DE MUÑECA',
      'EXTENSIÓN LUMBAR',
      'PREV/REHAB',
      'ACONDICIONAMIENTO',
      'AISLAMIENTO',
    ])
  })

  it('de las 34 canónicas, cinco nombran un gesto y no tienen ficha', () => {
    // Las otras dos que no resuelven —PREV/REHAB y ACONDICIONAMIENTO— no nombran un
    // gesto sino un para qué, y ahí decide el nombre a propósito. Estas cinco sí
    // nombran una acción articular y no tienen ficha que enseñar: sus ejercicios caen
    // al camino sin sujeto salvo que el nombre enganche por accidente en la lista por
    // nombre, que es lo que le pasa a ROTACIÓN DE CADERA — ver más abajo.
    const sinFicha = CATEGORIAS.filter((c) => !patronDeCategoria(c))
    expect(sinFicha).toEqual([
      'ROTACIÓN DE CADERA',
      'FLEXIÓN DE HOMBRO',
      'FLEXIÓN DE MUÑECA',
      'EXTENSIÓN DE MUÑECA',
      'EXTENSIÓN LUMBAR',
      'PREV/REHAB',
      'ACONDICIONAMIENTO',
    ])
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
  it('los 27 del seed: 19 con sujeto y 8 sin, y los 8 son de AISLAMIENTO', () => {
    const reparto = repartir(ejerciciosDelSeed())
    expect(reparto.casos).toHaveLength(27)
    expect(reparto.conPatron).toHaveLength(19)
    expect(reparto.sinPatron).toHaveLength(8)
    expect(new Set(reparto.sinPatron.map((c) => c.categoria))).toEqual(new Set(['AISLAMIENTO']))
  })

  it('las 159 familias de nombre de producción: 140 con sujeto y 19 sin', () => {
    const reparto = repartir(ejerciciosDeProduccion())
    expect(reparto.casos).toHaveLength(159)
    expect(reparto.conPatron).toHaveLength(140)
    expect(reparto.sinPatron.map((c) => `${c.categoria} · ${c.nombre}`)).toEqual([
      // Cardio: es lo correcto, no hay gesto resistido que enseñar.
      'ACONDICIONAMIENTO · CARDIO',
      'ACONDICIONAMIENTO · BICICLETA',
      'ACONDICIONAMIENTO · CINTA',
      'ACONDICIONAMIENTO · ESCALADORA',
      'ACONDICIONAMIENTO · ELIPTICA',
      'ACONDICIONAMIENTO · HIIT',
      'ACONDICIONAMIENTO · CIRCUITO',
      'ACONDICIONAMIENTO · TABATA',
      'ACONDICIONAMIENTO · ERGOMETRO',
      'ACONDICIONAMIENTO · SWING',
      // Prevención: aquí sí falta cobertura, la lista por nombre no los alcanza.
      'PREV/REHAB · ROTADOR',
      'PREV/REHAB · ISOMETRIA DE SOSTEN',
      'PREV/REHAB · APOYO ESTABLE',
      'PREV/REHAB · ARCO PLANTAR',
      'PREV/REHAB · TIBIAL POSTERIOR',
      'PREV/REHAB · PLIOMETRIA',
      // Categoría canónica sin ficha: no hay nombre que las salve.
      'EXTENSIÓN LUMBAR · BANCO ROMANO',
      'EXTENSIÓN LUMBAR · EXTENSION LUMBAR',
      'ROTACIÓN DE CADERA · 90/90',
    ])
  })

  it('dos familias sin patrón se salvarían con el nombre entero, y cuatro no', () => {
    // El clasificador de la migración guarda el TROZO de nombre que le basta para
    // clasificar, no el nombre completo. Con el trozo pelado —que es la prueba más
    // dura— seis familias de PREV/REHAB se quedan sin sujeto; escritas como las
    // escribe el coach, dos de las seis sí encuentran patrón. Las otras cuatro no
    // tienen término en la lista por nombre, se escriban como se escriban.
    expect(patronDeCategoria('PREV/REHAB', 'Manguito rotador con banda')?.id).toBe(
      'rotacion_externa_hombro',
    )
    expect(patronDeCategoria('PREV/REHAB', 'Apoyo estable a una pierna (descalza)')?.id).toBe(
      'apoyo_una_pierna',
    )
    expect(patronDeCategoria('PREV/REHAB', 'Isometría de sostén en anillas')).toBeUndefined()
    expect(patronDeCategoria('PREV/REHAB', 'Arco plantar con toalla')).toBeUndefined()
    expect(patronDeCategoria('PREV/REHAB', 'Tibial posterior con banda')).toBeUndefined()
    expect(patronDeCategoria('PREV/REHAB', 'Pliometría de escalón')).toBeUndefined()
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
    expect(descartadasQueImportan.map((d) => `${d.categoria} · ${d.alternativa}`)).toEqual([
      'FLEXIÓN DE HOMBRO · ELEVACION(ES)? FRONTAL',
      'ROTACIÓN DE CADERA · ROTACION (EXTERNA|INTERNA) DE CADERA',
    ])
    // Una de las dos no cambia nada: su categoría no tiene ficha y su nombre tampoco
    // engancha, así que se queda sin sujeto se escriba como se escriba.
    expect(patronDeCategoria('FLEXIÓN DE HOMBRO', 'Elevaciones frontales con disco')).toBeUndefined()
  })

  it('una rotación externa de CADERA enseña el manguito del HOMBRO', () => {
    // La otra descartada sí cambia algo, y a peor. `ROTACIÓN DE CADERA` no tiene ficha,
    // así que se cae a la lista por nombre; y allí `rotación externa` está escrito para
    // el manguito rotador del hombro. Resultado: la familia que la migración 0038 llama
    // `ROTACION (EXTERNA|INTERNA) DE CADERA` recibe sujeto, pero es el sujeto de otro
    // ejercicio y de otra articulación.
    //
    // No es «falta un patrón», que se ve venir con el aviso de sin modelo: es un patrón
    // EQUIVOCADO, que se ve como si fuera correcto. Se deja medido aquí; el arreglo está
    // en `src/domain/`, que esta capa no toca.
    expect(patronDeCategoria('ROTACIÓN DE CADERA', 'Rotación externa de cadera sentado')?.id).toBe(
      'rotacion_externa_hombro',
    )
    // La interna no engancha con nada y cae al aviso, que es el comportamiento honesto.
    expect(patronDeCategoria('ROTACIÓN DE CADERA', 'Rotación interna de cadera')).toBeUndefined()
    expect(patronDeCategoria('ROTACIÓN DE CADERA', '90/90 de cadera')).toBeUndefined()
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
