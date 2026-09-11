import { describe, expect, it } from 'vitest'

import {
  FORMATOS,
  tipoDelMedio,
  contentTypeDelMedio,
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
    // El 11-sep entró `tipo` (audio o vídeo) y este guardián saltó, que es
    // justo su trabajo: vigila qué campos viaja la fila. Se amplía la lista a
    // mano —nunca se relaja a «contiene»— porque lo que protege es que no
    // aparezca un campo de aprobación por la puerta de atrás.
    const decision = decidirPublicacion(ENCARGO, undefined)
    if (!decision.publica) throw new Error('el encargo de prueba deberia publicarse')
    const fila = filaDelVideo(ENCARGO, decision)
    expect(Object.keys(fila).sort()).toEqual(['guion', 'path', 'semana', 'tipo', 'usuario_id'])
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
    // El `tipo` entro el 11-sep y viaja CON la decision, no con la fila: es lo
    // que impide construir una fila con un tipo que nadie valido.
    expect(decidirPublicacion(ENCARGO)).toEqual({
      publica: true,
      path: `personas/${ENCARGO.usuarioId}/2026-09-14.mp4`,
      tipo: 'video',
      reemplaza: false,
    })
  })
})

describe('el audio, que es lo que se publica primero', () => {
  // Hasta el 11-sep este modulo rechazaba un mp3 por «extension no admitida»:
  // la pieza que publica no podia publicar el unico formato que habia que
  // publicar. Se vio fallar quitando las extensiones de audio de la lista.
  it('acepta mp3, m4a y wav', () => {
    for (const extension of ['mp3', 'm4a', 'wav']) {
      const d = decidirPublicacion(
        { usuarioId: 'u-1', semana: '2026-09-14', tamanoBytes: 200_000, extension, guion: 'hola' },
        undefined,
      )
      expect(d.publica).toBe(true)
    }
  })

  it('la fila dice si es audio o video, y lo dice el ARCHIVO', () => {
    const encargo = (extension: string) => ({
      usuarioId: 'u-1',
      semana: '2026-09-14',
      tamanoBytes: 200_000,
      extension,
      guion: 'hola',
    })
    const fila = (extension: string) => {
      const e = encargo(extension)
      const d = decidirPublicacion(e, undefined)
      if (!d.publica) throw new Error(`no deberia negarse con ${extension}`)
      return filaDelVideo(e, d)
    }
    expect(fila('mp3')).toMatchObject({ tipo: 'audio' })
    expect(fila('MP3')).toMatchObject({ tipo: 'audio' })
    expect(fila('mp4')).toMatchObject({ tipo: 'video' })
  })

  it('lo que no es ni audio ni video sigue sin entrar', () => {
    const d = decidirPublicacion(
      { usuarioId: 'u-1', semana: '2026-09-14', tamanoBytes: 200_000, extension: 'txt', guion: 'hola' },
      undefined,
    )
    expect(d).toMatchObject({ publica: false, motivo: 'extension-no-admitida' })
  })
})

describe('la tabla de formatos', () => {
  it('toda extension admitida tiene tipo y Content-Type', () => {
    // Para que anadir una septima extension sin pensar no cuele: si falta
    // cualquiera de las dos cosas, el archivo se sube y el movil no lo abre.
    for (const [extension, formato] of Object.entries(FORMATOS)) {
      expect(['audio', 'video']).toContain(formato.tipo)
      expect(formato.contentType).toMatch(/^(audio|video)\//)
      expect(contentTypeDelMedio(extension)).toBe(formato.contentType)
    }
  })

  it('lo que no esta en la tabla no tiene Content-Type', () => {
    expect(contentTypeDelMedio('txt')).toBeUndefined()
  })
})

describe('el tipo no se puede inventar', () => {
  // Lo cazo la otra sesion en mi propio codigo: `tipoDelMedio` devolvia 'video'
  // para lo que no reconocia, que es EXACTAMENTE el olvido que este campo venia
  // a impedir -la columna ya tiene `default 'video'`, asi que no escribirlo no
  // falla: miente-. Ahora no hay camino: el tipo sale de la decision, y la
  // decision solo existe si la extension paso el filtro.
  it('una extension desconocida no tiene tipo, y no se lo inventa', () => {
    expect(tipoDelMedio('pdf')).toBeUndefined()
    expect(tipoDelMedio('exe')).toBeUndefined()
    expect(tipoDelMedio('mp3')).toBe('audio')
  })

  it('sin decision aceptada no hay fila: el compilador lo impide', () => {
    // Esta es la comprobacion de verdad y no corre en tiempo de ejecucion: la
    // firma de `filaDelVideo` pide una `PublicacionAceptada`, asi que pasarle
    // una ruta a mano -como se hacia hasta el 11-sep- ya no compila.
    const e = { usuarioId: 'u-1', semana: '2026-09-14', tamanoBytes: 10, extension: 'pdf', guion: 'x' }
    const d = decidirPublicacion(e, undefined)
    expect(d).toMatchObject({ publica: false, motivo: 'extension-no-admitida' })
  })
})
