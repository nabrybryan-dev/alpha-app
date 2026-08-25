import { describe, expect, it } from 'vitest'
import { idDeYoutube } from './youtube'

/**
 * El visor sólo leía `watch?v=` y `youtu.be/`. Las fichas de técnica se pegan
 * desde el móvil, que comparte **Shorts**, así que con esas URLs no montaba el
 * iframe y el asesorado veía la ficha sin vídeo. Se reportó como «el vídeo no
 * está disponible».
 */
describe('idDeYoutube', () => {
  it('lee la forma clásica de escritorio', () => {
    expect(idDeYoutube('https://www.youtube.com/watch?v=Dy28eq2PjcM')).toBe('Dy28eq2PjcM')
  })

  it('lee el enlace corto de compartir', () => {
    expect(idDeYoutube('https://youtu.be/Dy28eq2PjcM')).toBe('Dy28eq2PjcM')
  })

  it('lee un Short — es la forma que llegaba rota', () => {
    expect(idDeYoutube('https://www.youtube.com/shorts/Dy28eq2PjcM')).toBe('Dy28eq2PjcM')
  })

  it('lee las formas embed, live y móvil', () => {
    expect(idDeYoutube('https://www.youtube.com/embed/Dy28eq2PjcM')).toBe('Dy28eq2PjcM')
    expect(idDeYoutube('https://www.youtube.com/live/Dy28eq2PjcM')).toBe('Dy28eq2PjcM')
    expect(idDeYoutube('https://m.youtube.com/watch?v=Dy28eq2PjcM')).toBe('Dy28eq2PjcM')
  })

  it('no se pierde con los parámetros que añade el móvil al compartir', () => {
    expect(idDeYoutube('https://youtu.be/Dy28eq2PjcM?t=42&feature=shared')).toBe('Dy28eq2PjcM')
    expect(idDeYoutube('https://www.youtube.com/watch?app=desktop&v=Dy28eq2PjcM&list=PL1')).toBe(
      'Dy28eq2PjcM',
    )
  })

  it('acepta un identificador pelado, porque alguna ficha se cargó así', () => {
    expect(idDeYoutube('Dy28eq2PjcM')).toBe('Dy28eq2PjcM')
  })

  it('devuelve undefined cuando no hay nada que leer', () => {
    expect(idDeYoutube('')).toBeUndefined()
    expect(idDeYoutube(undefined)).toBeUndefined()
    expect(idDeYoutube('https://vimeo.com/12345')).toBeUndefined()
  })
})
