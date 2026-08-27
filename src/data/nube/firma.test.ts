import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  clavesConservables,
  pedirFirma,
  sinCambios,
  tablasQueNoSePiden,
  type FirmaSync,
} from './firma'

const clienteQue = (resultado: unknown) =>
  ({ rpc: vi.fn().mockResolvedValue(resultado) }) as unknown as SupabaseClient

describe('pedirFirma', () => {
  /** PostgREST devuelve `bigint` como texto: `count(*)` llega '24', no 24. */
  it('convierte el conteo, que llega como texto', async () => {
    const firma = await pedirFirma(
      clienteQue({
        data: [{ tabla: 'premiaciones', filas: '24', ultimo_cambio: '2026-08-27T05:00:00Z' }],
        error: null,
      }),
    )

    expect(firma).toEqual({
      premiaciones: { filas: 24, ultimo: '2026-08-27T05:00:00Z' },
    })
  })

  /** Una tabla vacía no tiene «última fecha», y eso no es un fallo. */
  it('una tabla vacía firma con ultimo null', async () => {
    const firma = await pedirFirma(
      clienteQue({ data: [{ tabla: 'premiaciones', filas: '0', ultimo_cambio: null }], error: null }),
    )

    expect(firma?.premiaciones).toEqual({ filas: 0, ultimo: null })
  })

  /**
   * LA QUE PROTEGE EL DESPLIEGUE. Mientras la 0049 no esté aplicada el RPC no
   * existe. Devolver `undefined` hace que quien llama descargue todo, como
   * siempre. Si en cambio devolviera una firma vacía, se leería como «no ha
   * cambiado nada» y la app dejaría de refrescarse contra un servidor vivo.
   */
  it('devuelve undefined si el RPC no existe todavía', async () => {
    const firma = await pedirFirma(
      clienteQue({ data: null, error: { message: 'function does not exist' } }),
    )

    expect(firma).toBeUndefined()
  })

  it('devuelve undefined ante una respuesta que no entiende', async () => {
    expect(await pedirFirma(clienteQue({ data: [], error: null }))).toBeUndefined()
    expect(await pedirFirma(clienteQue({ data: 'vaya', error: null }))).toBeUndefined()
    expect(
      await pedirFirma(clienteQue({ data: [{ tabla: 'x', filas: 'ocho' }], error: null })),
    ).toBeUndefined()
  })
})

describe('sinCambios', () => {
  const base: FirmaSync = {
    microciclos: { filas: 113, ultimo: '2026-08-27T05:00:00Z' },
    premiaciones: { filas: 0, ultimo: null },
  }

  it('idénticas: se puede saltar la descarga', () => {
    expect(sinCambios(base, { ...base })).toBe(true)
  })

  /** Sin nada con qué comparar no se puede afirmar que no cambió. */
  it('sin firma previa, hay que descargar', () => {
    expect(sinCambios(base, undefined)).toBe(false)
  })

  it('una fila más se detecta', () => {
    const nueva = { ...base, microciclos: { filas: 114, ultimo: '2026-08-27T05:00:00Z' } }
    expect(sinCambios(nueva, base)).toBe(false)
  })

  /**
   * EL CASO QUE JUSTIFICA EL CONTEO. Un borrado puede no mover ninguna fecha
   * —la fila que se fue era vieja— pero baja el conteo. Es justo lo que un
   * delta por fila no ve, y por lo que aquí no se usa uno.
   */
  it('un BORRADO se detecta aunque la fecha no se mueva', () => {
    const nueva = { ...base, microciclos: { filas: 112, ultimo: '2026-08-27T05:00:00Z' } }
    expect(sinCambios(nueva, base)).toBe(false)
  })

  it('una modificación mueve la fecha y se detecta', () => {
    const nueva = { ...base, microciclos: { filas: 113, ultimo: '2026-08-27T06:00:00Z' } }
    expect(sinCambios(nueva, base)).toBe(false)
  })

  /**
   * Una tabla nueva en el servidor —una migración recién aplicada— no está en
   * la firma local. Comparando solo las locales diría «igual» y esa tabla no se
   * bajaría nunca.
   */
  it('una tabla que solo existe en el servidor obliga a descargar', () => {
    const nueva = { ...base, despensa: { filas: 3, ultimo: '2026-08-27T05:00:00Z' } }
    expect(sinCambios(nueva, base)).toBe(false)
  })

  it('una tabla que solo existe en la copia local también', () => {
    const previa = { ...base, tabla_que_ya_no_esta: { filas: 1, ultimo: null } }
    expect(sinCambios(base, previa)).toBe(false)
  })
})

describe('clavesConservables', () => {
  const t = (filas: number, ultimo = 'a') => ({ filas, ultimo })
  const firma = (cambios: Record<string, { filas: number; ultimo: string }> = {}): FirmaSync => ({
    usuarios_app: t(26),
    microciclos: t(113),
    checkins: t(66),
    checkins_nutricion: t(66),
    registro_comida: t(159),
    registro_item: t(528),
    ...cambios,
  })

  it('lo que no cambió se conserva; lo que cambió, no', () => {
    const conservar = clavesConservables(firma({ microciclos: t(114) }), firma())

    expect(conservar.has('usuarios')).toBe(true)
    expect(conservar.has('microciclos')).toBe(false)
  })

  /**
   * `checkins` se arma con DOS fuentes: la tabla y la vista de la
   * nutricionista. Basta con que una cambie para que el campo entero tenga que
   * rebajarse — conservar la mitad sería peor que no conservar nada.
   */
  it('un campo con dos fuentes necesita que las DOS estén iguales', () => {
    const soloLaVista = clavesConservables(firma({ checkins_nutricion: t(67) }), firma())
    expect(soloLaVista.has('checkins')).toBe(false)

    const soloLaTabla = clavesConservables(firma({ checkins: t(67) }), firma())
    expect(soloLaTabla.has('checkins')).toBe(false)
  })

  it('lo mismo con registrosComida, que sale de comida e item', () => {
    const conservar = clavesConservables(firma({ registro_item: t(529) }), firma())
    expect(conservar.has('registrosComida')).toBe(false)
  })

  /**
   * Ante la duda, bajar. Equivocarse de más cuesta una descarga; equivocarse de
   * menos sirve datos viejos.
   */
  it('sin firma previa no se conserva nada', () => {
    expect(clavesConservables(firma(), undefined).size).toBe(0)
  })

  it('una tabla que falta en alguna de las dos firmas no se conserva', () => {
    const sinMicrociclos = { ...firma() }
    delete (sinMicrociclos as Record<string, unknown>).microciclos

    expect(clavesConservables(sinMicrociclos, firma()).has('microciclos')).toBe(false)
    expect(clavesConservables(firma(), sinMicrociclos).has('microciclos')).toBe(false)
  })
})

describe('tablasQueNoSePiden', () => {
  /**
   * LA PROPIEDAD QUE SUJETA EL DISEÑO. Las tablas que no se piden se DERIVAN de
   * los campos que se conservan. Saltarse la descarga de una tabla cuyo campo
   * no se va a conservar dejaría ese campo vacío, y `aplicarSnapshot` reemplaza
   * la instantánea entera: seria un borrado.
   */
  it('solo devuelve tablas de campos que se conservan', () => {
    const omitir = tablasQueNoSePiden(new Set(['checkins', 'usuarios']))

    expect([...omitir].sort()).toEqual(['checkins', 'checkins_nutricion', 'usuarios_app'])
  })

  it('sin nada que conservar, no se omite ninguna', () => {
    expect(tablasQueNoSePiden(new Set()).size).toBe(0)
  })
})
