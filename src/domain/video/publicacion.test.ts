import { describe, expect, it } from 'vitest'

import {
  decidirPublicacion,
  filaDelVideo,
  rutaDelVideo,
  TOPE_BYTES,
  type EncargoDePublicacion,
} from './publicacion'

/**
 * Lo que se publica aquí no es un archivo: es **la cara y la voz de Bryan diciéndole sus
 * números a una persona**. Así que las pruebas que más valen son las que comprueban que
 * este módulo **se niega**, y sobre todas, las dos que impiden que publicar se convierta en
 * aprobar.
 */

const ENCARGO: EncargoDePublicacion = {
  usuarioId: '87f3c420-f2fb-4b5f-986c-95535bbac9dd',
  semana: '2026-09-14', // lunes
  tamanoBytes: 8 * 1024 * 1024,
  extension: 'mp4',
  guion: 'Esta semana hiciste 4 de 5 sesiones.',
}

describe('dónde va el archivo', () => {
  it('cuelga de la carpeta de la persona, con la semana por nombre', () => {
    expect(rutaDelVideo(ENCARGO.usuarioId, ENCARGO.semana, 'MP4')).toBe(
      `personas/${ENCARGO.usuarioId}/2026-09-14.mp4`,
    )
  })
})

describe('PUBLICAR NO ES APROBAR', () => {
  it('la fila que se escribe no lleva ninguna aprobación', () => {
    // Si el publicador pudiera aprobar, la firma sería un trámite que se salta solo con
    // volver a subir el archivo. La clave ni siquiera se escribe: el valor lo pone la base.
    const fila = filaDelVideo(ENCARGO, 'personas/x/2026-09-14.mp4')
    expect(Object.keys(fila).sort()).toEqual(['guion', 'path', 'semana', 'usuario_id'])
    expect(JSON.stringify(fila)).not.toMatch(/aprob/i)
  })

  it('se NIEGA a pisar un vídeo que ya está aprobado', () => {
    // Alguien firmó un vídeo; sobrescribirlo emitiría otro distinto bajo esa misma firma.
    const decision = decidirPublicacion(ENCARGO, {
      path: 'personas/x/2026-09-14.mp4',
      aprobadoEn: '2026-09-14T10:00:00Z',
    })
    expect(decision).toEqual({ publica: false, motivo: 'ya-aprobado' })
  })

  it('y solo lo pisa si se dice a propósito', () => {
    const decision = decidirPublicacion(
      ENCARGO,
      { path: 'personas/x/2026-09-14.mp4', aprobadoEn: '2026-09-14T10:00:00Z' },
      true,
    )
    expect(decision).toMatchObject({ publica: true, reemplaza: true })
  })

  it('pero sí reemplaza uno sin firmar, que es el caso normal de rehacer', () => {
    const decision = decidirPublicacion(ENCARGO, { path: 'personas/x/2026-09-14.mp4', aprobadoEn: null })
    expect(decision).toMatchObject({ publica: true, reemplaza: true })
  })
})

describe('lo que no se publica', () => {
  it('sin persona', () => {
    expect(decidirPublicacion({ ...ENCARGO, usuarioId: '  ' })).toMatchObject({ motivo: 'sin-usuario' })
  })

  it('una semana que no es lunes', () => {
    // La tabla guarda el lunes de la semana. Un martes crearía una segunda fila para la
    // misma semana, y entonces «el vídeo de esta semana» tendría dos respuestas.
    expect(decidirPublicacion({ ...ENCARGO, semana: '2026-09-15' })).toMatchObject({
      motivo: 'semana-no-es-lunes',
    })
    expect(decidirPublicacion({ ...ENCARGO, semana: 'el lunes' })).toMatchObject({
      motivo: 'semana-no-es-lunes',
    })
  })

  it('un archivo vacío o enorme', () => {
    expect(decidirPublicacion({ ...ENCARGO, tamanoBytes: 0 })).toMatchObject({ motivo: 'archivo-vacio' })
    expect(decidirPublicacion({ ...ENCARGO, tamanoBytes: TOPE_BYTES + 1 })).toMatchObject({
      motivo: 'archivo-enorme',
    })
  })

  it('algo que no es un vídeo', () => {
    expect(decidirPublicacion({ ...ENCARGO, extension: 'pdf' })).toMatchObject({
      motivo: 'extension-no-admitida',
    })
  })

  it('y SIN GUION no se publica', () => {
    // El guion es lo único que permite saber después qué se le dijo a alguien. Un vídeo sin
    // él es un vídeo que no se puede auditar, y eso no se arregla luego.
    expect(decidirPublicacion({ ...ENCARGO, guion: '   ' })).toMatchObject({ motivo: 'sin-guion' })
  })
})

describe('el caso normal', () => {
  it('publica, dice dónde, y avisa de que no reemplaza nada', () => {
    expect(decidirPublicacion(ENCARGO)).toEqual({
      publica: true,
      path: `personas/${ENCARGO.usuarioId}/2026-09-14.mp4`,
      reemplaza: false,
    })
  })
})
