import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MARCA_DE_TEXTO_PENDIENTE, TEXTOS_APROBADOS as A, TEXTOS_PENDIENTES as P } from './textos'

const fuente = readFileSync(join(process.cwd(), 'src/features/praxis/unToque/textos.ts'), 'utf8')

describe('textos de Praxis a un toque', () => {
  it('las frases aprobadas son las de la tabla del 11-nov, tal cual', () => {
    expect(`${A.saludoTitulo} ${A.saludoLinea}`).toBe('¿Qué necesitas? Te explico y te ordeno la app. Tu plan y tu salud los decide tu coach.')
    expect(A.traje('el agua')).toBe('Te traje el agua. No cambié nada de tu orden.')
    expect(A.ocultarFija).toBe('Esa parte no se oculta: es para cuidarte. Si quieres, la muevo de sitio; sus avisos te siguen llegando igual.')
    expect(A.ocultarDelCoach('X')).toBe('No puedo ocultar X. ¿Le dejo el aviso de que te sobra?')
    expect(A.ocultarDelCoachSub).toBe('El aviso no lleva tu frase, solo qué parte es.')
    expect(A.confirmaOcultar('X', 'Hoy')).toBe('Voy a ocultar X de Hoy.')
    expect(A.confirmaOcultarSub('X')).toBe('No se borra nada. La traes cuando quieras con «muéstrame X».')
    expect([A.confirmaOcultarSi, A.confirmaOcultarNo]).toEqual(['Sí, ocultar', 'No, dejarlo'])
    expect(A.hechoOcultar(2)).toBe('Hecho. Tienes 2 de 6 ocultas. Si te arrepientes, dime «déjalo como estaba».')
    expect(A.tope).toBe('Ya tienes 6 partes ocultas, que es el tope para que la app no se quede vacía. Trae una de vuelta y oculto esta.')
    expect(A.barra).toBe('Hoy y Praxis se quedan en su puesto en la barra, para que siempre sepas volver. Lo demás sí lo puedo mover.')
    expect(A.saludTitulo).toBe('No lo valoro yo. Tu coach es quien decide qué hacer con tu sesión.')
    expect(A.saludSub).toBe('Si sientes que es urgente, no esperes al coach: acude a un servicio de salud.')
    expect([A.saludAvisar, A.saludCheckin]).toEqual(['Avisar a mi coach', 'Abrir mi check-in'])
    expect(A.noEntendi).toBe('¿Qué quisiste decir? Puedo traerte una parte de la app, ocultarla, moverla o buscarte una ficha.')
    expect(A.rotuloProvisional).toBe('Respuesta provisional, sin revisar. Confírmala con tu coach.')
  })

  it('cada línea del grupo pendiente lleva la marca de «texto pendiente de aprobación»', () => {
    const desde = fuente.indexOf('export const TEXTOS_PENDIENTES')
    const lineas = fuente.slice(desde).split('\n')
    // Las claves del objeto, sin contar los cierres ni los comentarios sueltos.
    const claves = lineas.filter((l) => /^ {2}[a-zA-Z]+: /.test(l) || /^ {2}[a-zA-Z]+: \{$/.test(l) || /^ {2}[a-zA-Z]+: \[$/.test(l))
    expect(claves.length).toBeGreaterThan(80)
    const sinMarca = claves.filter((l) => !l.includes(MARCA_DE_TEXTO_PENDIENTE) && !l.endsWith('{') && !l.endsWith('['))
    expect(sinMarca).toEqual([])
    expect(Object.keys(P).length).toBeGreaterThan(80)
  })

  it('el grupo aprobado no lleva la marca de pendiente', () => {
    const grupo = fuente.slice(fuente.indexOf('export const TEXTOS_APROBADOS'), fuente.indexOf('export const MARCA_DE_TEXTO_PENDIENTE'))
    expect(grupo).not.toContain('PENDIENTE')
  })
})
