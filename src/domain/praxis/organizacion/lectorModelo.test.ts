import { describe, expect, it } from 'vitest'
import { leerSalidaDeOrganizacion, promptDeOrganizacion } from './lectorModelo'

const IDS = new Set(['nutricion.agua', 'hoy.album', 'pantalla:/logros'])

describe('leerSalidaDeOrganizacion: el modelo solo elige del menú', () => {
  it('lee un verbo con pieza del catálogo', () => {
    expect(leerSalidaDeOrganizacion('{"verbo":"ocultar","pieza":"hoy.album"}', IDS)).toEqual({ verbo: 'ocultar', pieza: 'hoy.album' })
  })

  it('acepta la salida envuelta en bloque de código o con texto alrededor', () => {
    expect(leerSalidaDeOrganizacion('```json\n{"verbo":"traer","pieza":"nutricion.agua"}\n```', IDS)).toEqual({ verbo: 'traer', pieza: 'nutricion.agua' })
    expect(leerSalidaDeOrganizacion('Claro: {"verbo":"mover_arriba","pieza":"nutricion.agua"} listo', IDS)).toEqual({ verbo: 'mover_arriba', pieza: 'nutricion.agua' })
  })

  it('en los verbos sin pieza ignora la pieza que traiga', () => {
    expect(leerSalidaDeOrganizacion('{"verbo":"restablecer","pieza":"hoy.album"}', IDS)).toEqual({ verbo: 'restablecer', pieza: null })
    expect(leerSalidaDeOrganizacion('{"verbo":"ninguno","pieza":null}', IDS)).toEqual({ verbo: 'ninguno', pieza: null })
  })

  it('una pieza inventada, un verbo fuera del menú o una pieza que falta dan null: no se organiza nada', () => {
    expect(leerSalidaDeOrganizacion('{"verbo":"ocultar","pieza":"hoy.inventada"}', IDS)).toBeNull()
    expect(leerSalidaDeOrganizacion('{"verbo":"borrar","pieza":"hoy.album"}', IDS)).toBeNull()
    expect(leerSalidaDeOrganizacion('{"verbo":"ocultar","pieza":null}', IDS)).toBeNull()
    expect(leerSalidaDeOrganizacion('no entendí', IDS)).toBeNull()
    expect(leerSalidaDeOrganizacion('', IDS)).toBeNull()
  })
})

describe('promptDeOrganizacion', () => {
  it('lista los verbos del menú y solo las piezas que se le pasan', () => {
    const p = promptDeOrganizacion([{ id: 'hoy.album', nombre: 'el álbum' }])
    for (const v of ['traer', 'ocultar', 'mover_arriba', 'mover_abajo', 'restablecer', 'listar_ocultas', 'solo_lo_importante', 'ninguno']) expect(p).toContain(v)
    expect(p).toContain('hoy.album = el álbum')
    expect(p).not.toContain('nutricion.agua')
  })
})
