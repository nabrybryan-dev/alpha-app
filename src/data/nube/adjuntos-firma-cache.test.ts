import { beforeEach, describe, expect, it, vi } from 'vitest'
import { olvidarDatosLocales } from '../mockDb'
import { urlFirmada } from './adjuntos'

/** Cuántas veces se ha pedido una firma al Storage en la prueba en curso. */
let firmas = 0
/** Qué devuelve Storage. `undefined` simula el fallo. */
let urlQueDevuelve: string | undefined

vi.mock('../supabase', () => ({
  modoNube: true,
  supabase: () => ({
    storage: {
      from: () => ({
        createSignedUrl: () => {
          firmas += 1
          return Promise.resolve({
            data: urlQueDevuelve ? { signedUrl: urlQueDevuelve } : null,
          })
        },
      }),
    },
  }),
}))

beforeEach(() => {
  firmas = 0
  urlQueDevuelve = 'https://storage/firmada-1'
  // Sube la época de sesión, que es justo lo que vacía la caché de firmas.
  // Vale como limpieza entre pruebas *porque* es el mismo mecanismo que usa el
  // cierre de sesión de verdad: si dejara de funcionar, estas pruebas se
  // contaminarían entre sí y se vería aquí antes que en producción.
  olvidarDatosLocales()
})

describe('urlFirmada · caché en memoria', () => {
  /**
   * El motivo de existir de la caché. Antes se firmaba en CADA montaje del
   * componente, así que abrir un chat con fotos, salir y volver eran dos
   * llamadas de red por foto para dos URLs equivalentes.
   */
  it('reutiliza la firma en vez de pedir otra', async () => {
    const primera = await urlFirmada('u-valentina/msg-1.jpg')
    const segunda = await urlFirmada('u-valentina/msg-1.jpg')

    expect(primera).toBe('https://storage/firmada-1')
    expect(segunda).toBe(primera)
    expect(firmas).toBe(1)
  })

  /**
   * Un chat pinta todas sus burbujas a la vez: sin deduplicar, diez fotos del
   * mismo adjunto en pantalla serían diez firmas simultáneas del mismo path.
   */
  it('dos peticiones a la vez del mismo adjunto se resuelven con una firma', async () => {
    const [a, b] = await Promise.all([
      urlFirmada('u-valentina/msg-2.jpg'),
      urlFirmada('u-valentina/msg-2.jpg'),
    ])

    expect(a).toBe(b)
    expect(firmas).toBe(1)
  })

  /**
   * LA QUE DE VERDAD IMPORTA. Una URL firmada es un enlace vivo a la foto del
   * cuerpo de alguien. Si sobreviviera al cierre de sesión, la siguiente
   * persona que entrase en este dispositivo se lo encontraría servido desde la
   * caché sin pasar por Storage ni por RLS.
   */
  it('tras cerrar sesión NO reutiliza la firma de quien salió', async () => {
    const antes = await urlFirmada('u-valentina/msg-3.jpg')
    expect(firmas).toBe(1)

    olvidarDatosLocales()
    urlQueDevuelve = 'https://storage/firmada-2'

    const despues = await urlFirmada('u-valentina/msg-3.jpg')

    expect(firmas).toBe(2)
    expect(despues).not.toBe(antes)
    expect(despues).toBe('https://storage/firmada-2')
  })

  /**
   * Cachear el fallo dejaría el adjunto roto casi una hora por un corte de red
   * de un segundo. Se guarda lo que salió bien, y nada más.
   */
  it('no se queda con el fallo: vuelve a intentarlo', async () => {
    urlQueDevuelve = undefined
    expect(await urlFirmada('u-valentina/msg-4.jpg')).toBeUndefined()

    urlQueDevuelve = 'https://storage/firmada-3'
    expect(await urlFirmada('u-valentina/msg-4.jpg')).toBe('https://storage/firmada-3')

    expect(firmas).toBe(2)
  })

  /** La llave es el path, así que dos adjuntos distintos no se pisan. */
  it('cada adjunto tiene su propia firma', async () => {
    urlQueDevuelve = 'https://storage/de-la-uno'
    const uno = await urlFirmada('u-valentina/msg-5.jpg')

    urlQueDevuelve = 'https://storage/de-la-dos'
    const dos = await urlFirmada('u-valentina/msg-6.jpg')

    expect(uno).toBe('https://storage/de-la-uno')
    expect(dos).toBe('https://storage/de-la-dos')
    expect(firmas).toBe(2)
  })
})
