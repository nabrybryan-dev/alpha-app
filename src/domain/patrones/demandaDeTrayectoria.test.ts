import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from './catalogo'
import { demandaDe, juzgarCatalogo, juzgarTrayectoria, recorridoDeCarga } from './demandaDeTrayectoria'

/**
 * EL GUARDIÁN DE LAS TRAYECTORIAS.
 *
 * Nace el 2026-09-05 porque Bryan miró el peso muerto en el salón y dijo que la barra no
 * podía moverse así. Tenía razón y se pudo medir: la carga recorría **19 cm hacia abajo y
 * 35 hacia los lados**, y —peor— las manos SUBÍAN de 86 a 103 cm mientras el peso muerto
 * bajaba. Con peso libre la resistencia tira en una sola dirección, así que eso no existe.
 *
 * Lo que vigila esta prueba es que **ningún patrón contradiga a su propio implemento**. La
 * demanda no se declara a mano: sale de los `ejemplos` que el patrón ya lista y de su
 * `cadena`.
 */

/**
 * LO QUE HOY NO CUMPLE, con su número medido.
 *
 * Es una lista que solo puede MENGUAR. Cada entrada dice qué se midió el día que se metió,
 * y la prueba comprueba las dos direcciones: que los de fuera cumplen **y que los de dentro
 * siguen fallando**. Así, el día que alguien arregle uno, la prueba se pone roja pidiendo
 * que lo saque de aquí, en vez de dejar una excepción muerta que ya no excusa nada.
 */
const DEUDA: Record<string, string> = {
  // El empuje de cadera sube 15 cm y se va 14 de lado, medido sobre la pelvis, que es donde
  // descansa la barra. Debería subir cerca de 28 y desplazarse una tercera parte de eso: es
  // un arco corto alrededor de los hombros apoyados en el banco. No se arregla con el mismo
  // ángulo que arregló la bisagra —ahí el fallo era el brazo, aquí es cuánto sube la cadera—
  // y pide su propia tanda.
  extension_cadera: 'v=15cm h=14cm razón=0.97 (2026-09-05)',
}

describe('la trayectoria contra lo que pide la carga', () => {
  it('todos los patrones cumplen su demanda, salvo la deuda declarada', () => {
    const incumplen = juzgarCatalogo()
      .filter((v) => !v.cumple)
      .map((v) => `${v.patron}: ${v.medida} — ${v.motivo}`)
    const esperados = Object.keys(DEUDA)
    expect(incumplen.map((t) => t.split(':')[0]).sort()).toEqual(esperados.sort())
  })

  it('la deuda sigue siendo deuda: si alguien la arregla, hay que borrarla de la lista', () => {
    for (const id of Object.keys(DEUDA)) {
      const patron = PATRON_POR_ID[id]
      expect(patron, `${id} ya no está en el catálogo: sácalo de DEUDA`).toBeDefined()
      expect(
        juzgarTrayectoria(patron).cumple,
        `${id} ya cumple su demanda. Bórralo de DEUDA en vez de dejar la excepción.`,
      ).toBe(false)
    }
  })

  /**
   * LA QUE HABRÍA CAZADO EL FALLO. Se mira aparte del recuento porque un guardián que solo
   * cuenta cuántos fallan no dice QUÉ falla: aquí queda escrito el caso concreto.
   */
  it('en el peso muerto la carga baja, y baja casi recta', () => {
    const r = recorridoDeCarga(PATRON_POR_ID.bisagra_cadera)!
    const primera = r.puntos[0]
    const ultima = r.puntos[r.puntos.length - 1]
    // Baja: en el fondo de una bisagra la carga está más abajo que de pie. Antes subía.
    expect(ultima[1]).toBeLessThan(primera[1] - 0.25)
    // Y acaba cerca de la espinilla, no a la altura de la cadera.
    expect(ultima[1]).toBeLessThan(0.55)
    // Casi recta: menos de un tercio de deriva por cada metro de bajada.
    expect(r.deriva / r.vertical).toBeLessThan(0.35)
  })

  it('la demanda sale del implemento que el patrón ya declara, no de una tabla nueva', () => {
    // Peso muerto rumano: uno de sus ejemplos va con mancuernas, y su cadena es cerrada.
    expect(demandaDe(PATRON_POR_ID.bisagra_cadera)).toBe('gravedad-cadena-cerrada')
    // El jalón es de polea: ahí la línea la fija el cable y no se le exige la vertical.
    expect(demandaDe(PATRON_POR_ID.traccion_vertical)).toBe('linea-de-cable')
    // La sentadilla del catálogo son prensa, hack y Smith: el recorrido lo pone el riel.
    expect(demandaDe(PATRON_POR_ID.sentadilla)).toBe('riel-de-maquina')
    // El curl es peso libre pero de cadena abierta: el arco es legítimo y no se acota.
    expect(demandaDe(PATRON_POR_ID.flexion_codo)).toBe('gravedad-cadena-abierta')
  })

  it('a una polea no se le exige que se comporte como una barra', () => {
    const v = juzgarTrayectoria(PATRON_POR_ID.traccion_vertical)
    expect(v.cumple).toBe(true)
    expect(v.medida).toBe('no se comprueba')
  })
})
