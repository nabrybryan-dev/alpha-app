import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AVISO_SALUD,
  ESTADOS_COMENTARIO,
  ESTADO_PUBLICO,
  LARGO_MAXIMO_COMENTARIO,
  TIPOS_COMENTARIO,
  soloLaRuta,
} from './comentariosApp'

const SQL = readFileSync(join(process.cwd(), 'supabase', 'migrations', '0095_comentarios_app.sql'), 'utf8')

const entreComillas = (texto: string) => [...texto.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])

describe('comentarios de la app: el vocabulario es el de la migración 0095', () => {
  it('tipos y estados son los del check', () => {
    const tipo = SQL.slice(SQL.indexOf('tipo           text not null check'), SQL.indexOf('-- Solo `location.pathname`'))
    expect(entreComillas(tipo)).toEqual([...TIPOS_COMENTARIO])
    const estado = SQL.slice(SQL.indexOf("estado         text not null default 'nuevo'"), SQL.indexOf('contrato_id    text'))
    // El primero es el valor por defecto; el resto, la lista del check.
    expect(entreComillas(estado).slice(1)).toEqual([...ESTADOS_COMENTARIO])
  })

  it('el largo máximo es el del check de texto', () => {
    expect(SQL).toContain(`between 1 and ${LARGO_MAXIMO_COMENTARIO})`)
  })
})

describe('lo que ve quien comentó', () => {
  it('solo tres estados públicos', () => {
    expect(ESTADO_PUBLICO).toEqual({ nuevo: 'RECIBIDO', en_contrato: 'EN CONTRATO', arreglado: 'ARREGLADO' })
  })
  it('el aviso de salud y urgencias está escrito tal cual lo pide el contrato', () => {
    expect(AVISO_SALUD).toBe('Esto no es para salud ni urgencias: escríbele a tu coach. En una urgencia, llama al 123.')
  })
})

describe('soloLaRuta', () => {
  it('quita la consulta y el fragmento, que pueden traer identificadores', () => {
    expect(soloLaRuta('/entrenar/sesion/abc?token=secreto#parte')).toBe('/entrenar/sesion/abc')
  })
  it('lo que no es una ruta se dice desconocido, no se inventa', () => {
    expect(soloLaRuta('javascript:alert(1)')).toBe('desconocida')
    expect(soloLaRuta('')).toBe('desconocida')
  })
})
