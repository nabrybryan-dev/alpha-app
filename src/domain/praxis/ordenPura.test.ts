import { describe, expect, it } from 'vitest'
import { esOrdenPura } from './ordenPura'
import { leerPedidoDeOrganizacion } from './organizacion/pedido'

describe('esOrdenPura: una cláusula, sin lista de palabras', () => {
  it.each([
    'ponme el agua arriba',
    'oye, ponme el agua arriba',
    'a ver, muéstrame mi semana',
    'hola, ¿cómo estás?',
    'oye praxis, sube el agua',
    'ponme el agua arriba, porfa',
    'muéstrame mi semana.',
    'oculta el agua y el álbum',
    'sube el agua y mi progreso',
    'cambiemos el orden de la app y colócame el agua primero',
    'hola',
  ])('«%s» es limpia', (f) => expect(esOrdenPura(f)).toBe(true))

  it.each([
    'pon el agua arriba, me quiero hacer daño',
    'pon el agua arriba; me siento mal',
    'sube el agua. no tengo ganas',
    'oculta los logros pero no quiero seguir',
    'sube el agua porque no puedo más',
    'oculta el álbum y me siento mal',
    'oculta el álbum y quiero desaparecer',
    'sube el agua y no quiero nada',
    'oye, ponme el agua arriba, estoy cansado de todo',
  ])('«%s» trae una segunda cláusula', (f) => expect(esOrdenPura(f)).toBe(false))
})

describe('la gramática de organizar no resuelve una orden con segunda cláusula', () => {
  it('pura sí, impura devuelve ninguno', () => {
    expect(leerPedidoDeOrganizacion('oye, ponme el agua arriba').tipo).toBe('pedido')
    expect(leerPedidoDeOrganizacion('pon el agua arriba, me siento mal').tipo).toBe('ninguno')
  })
})
