import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SEXOS_DE_FICHA } from '../../domain/sexoDeFicha'
import type { Perfil } from '../../domain/types'
import { enviosDeSync, esquemaDeLasMigraciones, sqlDeLasMigraciones } from '../../test/leerMigraciones'
import {
  COLUMNA_SEXO,
  SELECCION_PERFILES,
  TABLA_PERFILES,
  datosDePerfil,
  perfilesDe,
  type FilaPerfil,
} from './perfilEnNube'

/**
 * LA COLUMNA QUE SE PIDE ES LA QUE CREA LA MIGRACIÓN.
 *
 * Un `.select()` con una columna que no existe no avisa: los tests corren en
 * modo demo, `tsc` no sabe qué columnas tiene `perfiles`, y en producción
 * `hidratarDesdeNube` se traga el error y deja la app con la instantánea local
 * sin sincronizar. Ya pasó con otra columna. Aquí se lee el SQL de las
 * migraciones —como `contrato-payloads.test.ts`— y se cruza con la única
 * constante que nombra la columna.
 */

const NUBE = join(process.cwd(), 'src', 'data', 'nube')
const sql = sqlDeLasMigraciones()
const esquema = esquemaDeLasMigraciones(sql)

describe('la columna del sexo, contra la migración', () => {
  it('el lector encuentra la tabla: si no, lo de abajo pasaría sin comprobar nada', () => {
    expect(esquema.get(TABLA_PERFILES)?.size ?? 0).toBeGreaterThan(1)
  })

  it('cada columna que pide el select existe en las migraciones', () => {
    const columnas = esquema.get(TABLA_PERFILES)!
    for (const columna of SELECCION_PERFILES.split(',').map((c) => c.trim())) {
      expect(columnas.has(columna), `perfiles.${columna} no la crea ninguna migración`).toBe(true)
    }
    expect(SELECCION_PERFILES.split(',')).toContain(COLUMNA_SEXO)
  })

  it('la columna es opcional en la base: sin dato la ficha sigue valiendo', () => {
    expect(esquema.get(TABLA_PERFILES)!.get(COLUMNA_SEXO)?.obligatoria).toBe(false)
  })

  it('el check de la base admite exactamente lo que admite el dominio', () => {
    // `check (sexo in ('hombre', 'mujer'))`, sin los comentarios del archivo.
    const limpio = sql.replace(/--[^\n]*/g, '')
    const check = limpio.match(new RegExp(`check\\s*\\(\\s*${COLUMNA_SEXO}\\s+in\\s*\\(([^)]*)\\)`, 'i'))
    expect(check, `ninguna migración pone un check sobre ${COLUMNA_SEXO}`).not.toBeNull()
    const valores = check![1].split(',').map((v) => v.trim().replace(/^'|'$/g, ''))
    expect([...valores].sort()).toEqual([...SEXOS_DE_FICHA].sort())
  })

  it('hidratar.ts pide la ficha con la selección de aquí, no con un literal', () => {
    const hidratar = readFileSync(join(NUBE, 'hidratar.ts'), 'utf8')
    expect(hidratar).toContain('.from(TABLA_PERFILES).select(SELECCION_PERFILES)')
    expect(hidratar).not.toMatch(/from\('perfiles'\)/)
  })

  it('sync.ts sube la columna con este nombre en el envío del coach, y el del asesorado no la nombra', () => {
    const envios = enviosDeSync(readFileSync(join(NUBE, 'sync.ts'), 'utf8')).filter(
      (e) => e.tabla === TABLA_PERFILES && e.tipo === 'upsert',
    )
    expect(envios).toHaveLength(2)
    expect(envios.every((e) => !e.incompleto)).toBe(true)
    expect(envios.filter((e) => e.claves.includes(COLUMNA_SEXO))).toHaveLength(1)
    expect(envios.filter((e) => !e.claves.includes(COLUMNA_SEXO))).toHaveLength(1)
  })
})

const FICHA: Perfil = {
  usuarioId: 'u-a',
  objetivos: 'fuerza',
  edad: 30,
  diasEntrenamiento: 4,
  tiempoSesionMin: 60,
  somatotipo: 'meso',
  volumenSemanal: {},
  medidas: [],
}

const fila = (datos: unknown, sexo?: unknown): FilaPerfil =>
  sexo === undefined ? { datos } : { datos, [COLUMNA_SEXO]: sexo }

describe('perfilesDe: de la fila a la ficha', () => {
  it('la columna entra en la ficha', () => {
    const [p] = perfilesDe([fila(FICHA, 'mujer')])
    expect(p.sexo).toBe('mujer')
    expect(p.objetivos).toBe('fuerza')
  })

  it('null es «sin indicar»: la clave no está', () => {
    const [p] = perfilesDe([fila(FICHA, null)])
    expect('sexo' in p).toBe(false)
  })

  it('un valor fuera del vocabulario no dibuja nada: ni la M de la encuesta de nutrición', () => {
    const [p] = perfilesDe([fila(FICHA, 'M')])
    expect('sexo' in p).toBe(false)
  })

  it('la columna manda sobre lo que traiga el blob', () => {
    const [p] = perfilesDe([fila({ ...FICHA, sexo: 'hombre' }, 'mujer')])
    expect(p.sexo).toBe('mujer')
    const [sinColumna] = perfilesDe([fila({ ...FICHA, sexo: 'hombre' }, null)])
    expect('sexo' in sinColumna).toBe(false)
  })

  /**
   * EL RESPALDO. Un upsert pendiente reemplaza la fila entera (`conPendientes`)
   * y el del asesorado no nombra la columna. Sin esto, registrar una medida
   * sin red haría que el salón olvidara el sexo hasta la siguiente descarga.
   */
  it('una fila pendiente sin la clave conserva el sexo que tenía el servidor', () => {
    const servidor = [fila(FICHA, 'mujer')]
    const fusionadas = [fila({ ...FICHA, medidas: [{ fecha: '2026-09-06', alturaCm: 165, perimetros: {} }] })]
    const [p] = perfilesDe(fusionadas, servidor)
    expect(p.sexo).toBe('mujer')
    expect(p.medidas).toHaveLength(1)
  })

  it('pero una fila pendiente CON la clave a null es el coach quitándolo, y gana', () => {
    const servidor = [fila(FICHA, 'mujer')]
    const [p] = perfilesDe([fila(FICHA, null)], servidor)
    expect('sexo' in p).toBe(false)
  })

  it('no inventa filas ni las reordena', () => {
    const filas = [fila({ ...FICHA, usuarioId: 'u-a' }, 'hombre'), fila({ ...FICHA, usuarioId: 'u-b' }, null)]
    expect(perfilesDe(filas).map((p) => [p.usuarioId, p.sexo])).toEqual([
      ['u-a', 'hombre'],
      ['u-b', undefined],
    ])
  })
})

describe('datosDePerfil: el blob que sube', () => {
  it('no lleva el sexo dentro: viaja en su columna', () => {
    const datos = datosDePerfil({ ...FICHA, sexo: 'mujer' })
    expect('sexo' in datos).toBe(false)
    expect(datos).toEqual(FICHA)
  })

  it('no toca la ficha que le dan', () => {
    const ficha: Perfil = { ...FICHA, sexo: 'hombre' }
    datosDePerfil(ficha)
    expect(ficha.sexo).toBe('hombre')
  })
})
