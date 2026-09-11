import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * CADA MIGRACIÓN TIENE QUE PODER COMPROBARSE EN LA BASE.
 *
 * ## El problema que esto cierra
 *
 * Las migraciones de este repo se aplican **pegándolas a mano** en el SQL Editor, y no hay
 * tabla de versiones: el repo tiene los archivos, y la base no sabe de dónde vienen. El
 * único puente entre los dos es `supabase/comprobar-migraciones.sql`, que pregunta por el
 * EFECTO de cada una.
 *
 * El 2026-09-10 se midió lo que pasa cuando ese puente se queda corto: en `main` había
 * **dos archivos 0062 y dos 0065**, y **ninguna 0063** aunque su efecto estuviera aplicado.
 * Con números repetidos y sin señal, la pregunta «¿cuál de las dos corrió?» no la contesta
 * nadie — ni el repo ni la base.
 *
 * ## Lo que se exige, y lo que NO
 *
 * Se exige que **toda migración nueva traiga su señal**. No se exige que los números sean
 * únicos: los dos pares que ya existen están **aplicados**, y renombrar lo aplicado es
 * justo como se pierde el rastro de verdad. Quedan aquí como línea base, con su nombre, y
 * el guardián impide que aparezcan MÁS — que es el trabajo de una línea base, no bendecir
 * lo que ya había.
 *
 * ## Por qué la señal se pide por NÚMERO y no por nombre de archivo
 *
 * Porque el archivo puede renombrarse y la señal seguiría valiendo: lo que identifica a una
 * migración es el efecto que dejó en la base, y el número es la etiqueta con la que se
 * habla de ella. Los pares repetidos se distinguen con sufijo —`0062a`, `0062b`— dentro del
 * comprobador.
 */

const CARPETA = join(process.cwd(), 'supabase', 'migrations')
const COMPROBADOR = join(process.cwd(), 'supabase', 'comprobar-migraciones.sql')

/**
 * Los números que ya estaban repetidos el 2026-09-10, con lo que son.
 *
 * **No se limpian renombrando**: las cuatro están aplicadas en producción. Se distinguen en
 * el comprobador con sufijo, que es lo que hace que la pregunta tenga respuesta.
 */
const REPETIDOS_DE_ANTES: Record<string, string> = {
  '0062': 'el cribado guarda su historia · el saludo es una via — las dos aplicadas el 10-sep',
  '0065': 'el video es de cada quien · los dias que puede entrenar — las dos del 10-sep',
}

/**
 * LAS QUE YA ESTABAN SIN SEÑAL, sembradas MIDIENDO el 2026-09-10 —no auditando una por
 * una—, igual que la lista de exportaciones huérfanas. Su trabajo es impedir que aparezcan
 * NUEVAS, no bendecir estas.
 *
 * Dos grupos, y el motivo no es el mismo:
 *
 * - **Las de datos** (`0029`–`0032`, altas de catálogo) no dejan efecto en el catálogo de
 *   Postgres: meten filas. Preguntarles «¿estás aplicada?» solo se puede contestar contando
 *   filas, y eso cambia cada día. Estas no van a tener señal nunca.
 * - **Las de esquema viejas** (`0001`–`0012`, `0043`) sí podrían tenerla y no la tienen. No
 *   se escriben ahora porque escribir una señal a ciegas es peor que no tenerla: hay que
 *   saber qué estado del mundo la haría decir NO, y eso pide mirar cada migración. Queda
 *   apuntado como deuda, no como decisión.
 */
const SIN_SENAL_POSIBLE: Record<string, string> = {
  '0001': 'el esquema base: si no estuviera, no habria base',
  '0002': 'semilla de datos, no deja efecto en el catalogo',
  '0003': 'deuda: podria tener senal, no la tiene',
  '0004': 'deuda: podria tener senal, no la tiene',
  '0005': 'deuda: podria tener senal, no la tiene',
  '0006': 'deuda: podria tener senal, no la tiene',
  '0007': 'deuda: podria tener senal, no la tiene',
  '0009': 'deuda: podria tener senal, no la tiene',
  '0010': 'deuda: podria tener senal, no la tiene',
  '0011': 'deuda: podria tener senal, no la tiene',
  '0012': 'deuda: podria tener senal, no la tiene',
  '0029': 'altas de catalogo: mete filas, no deja efecto en el catalogo',
  '0030': 'altas de catalogo: mete filas, no deja efecto en el catalogo',
  '0031': 'altas de catalogo: mete filas, no deja efecto en el catalogo',
  '0032': 'altas de catalogo: mete filas, no deja efecto en el catalogo',
  '0043': 'deuda: podria tener senal, no la tiene',
}

function migraciones(): { numero: string; archivo: string }[] {
  return readdirSync(CARPETA)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .map((archivo) => ({ numero: archivo.slice(0, 4), archivo }))
    .sort((a, b) => a.archivo.localeCompare(b.archivo))
}

describe('las migraciones se pueden comprobar contra la base', () => {
  it('toda migración tiene su señal en comprobar-migraciones.sql', () => {
    const comprobador = readFileSync(COMPROBADOR, 'utf8')
    const sinSenal = migraciones()
      .filter(({ numero }) => !(numero in SIN_SENAL_POSIBLE))
      // La señal se escribe como `select '0061 - ...'` o, si el número está repetido,
      // `select '0062a - ...'`. Basta con que el número aparezca abriendo una.
      .filter(({ numero }) => !new RegExp(`'${numero}[ab]? `).test(comprobador))
      .map(({ archivo }) => archivo)

    expect(
      sinSenal,
      'Estas migraciones no se pueden comprobar contra la base: nadie podrá saber si ' +
        'corrieron. Añade su señal a supabase/comprobar-migraciones.sql —preguntando por lo ' +
        'que HACE, no por si existe algo con ese nombre— o decláralas en SIN_SENAL_POSIBLE.',
    ).toEqual([])
  })

  it('no aparecen números repetidos nuevos', () => {
    const cuenta = new Map<string, string[]>()
    for (const { numero, archivo } of migraciones()) {
      cuenta.set(numero, [...(cuenta.get(numero) ?? []), archivo])
    }
    const repetidos = [...cuenta.entries()]
      .filter(([, archivos]) => archivos.length > 1)
      .map(([numero]) => numero)
      .filter((numero) => !(numero in REPETIDOS_DE_ANTES))

    expect(
      repetidos,
      'Dos migraciones con el mismo número: con las migraciones pegadas a mano, nadie podrá ' +
        'saber cuál corrió. Pide el número por el canal de sesiones antes de escribir el ' +
        'archivo, y si el tuyo ya está cogido, renumera el TUYO —nunca uno ya aplicado.',
    ).toEqual([])
  })

  it('la lista de deuda no crece sola: lo declarado tiene que seguir sin señal', () => {
    // Si alguien escribe la señal de una de estas, su entrada tiene que desaparecer de
    // aquí. Sin esto, la lista se convierte en un cajón que solo engorda.
    const comprobador = readFileSync(COMPROBADOR, 'utf8')
    const yaTienen = Object.keys(SIN_SENAL_POSIBLE).filter((n) =>
      new RegExp(`'${n}[ab]? `).test(comprobador),
    )
    expect(yaTienen, 'Estas ya tienen señal: quita su entrada de SIN_SENAL_POSIBLE.').toEqual([])
  })

  it('y la línea base no crece sola: los repetidos declarados siguen estando repetidos', () => {
    // Si alguien limpia un par de verdad, su entrada tiene que desaparecer de aquí. Sin
    // esto, la lista se convierte en un cajón que solo engorda.
    const cuenta = new Map<string, number>()
    for (const { numero } of migraciones()) cuenta.set(numero, (cuenta.get(numero) ?? 0) + 1)
    for (const numero of Object.keys(REPETIDOS_DE_ANTES)) {
      expect(
        cuenta.get(numero) ?? 0,
        `El ${numero} ya no está repetido: quita su entrada de REPETIDOS_DE_ANTES.`,
      ).toBeGreaterThan(1)
    }
  })
})
