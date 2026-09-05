import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID, type Patron } from './catalogo'
import { demandaDe, juzgarCatalogo, juzgarTrayectoria, recorridoDeCarga } from './demandaDeTrayectoria'
import { esqueletoEnFase } from './escena'
import { puntoDeHueso } from './esqueleto'
import { planDeMedida } from '../biomecanica/palancas'
import { brazosDeMomento } from '../biomecanica/brazosDeMomento'
import type { Vec3 } from './algebra'

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
  // VACÍA desde el 2026-09-05. La única entrada que tuvo fue el empuje de cadera —subía
  // 15 cm y se iba 14 de lado, razón 0,97 sobre la pelvis— y se cerró abriendo el rango de
  // cadera de 68° a 88°, que es el del empuje real: v=28cm h=7cm razón=0,27. La lista se
  // queda en pie porque es el mecanismo, no el caso: la próxima deuda entra aquí con su
  // número medido y el trinquete de abajo obliga a sacarla el día que alguien la arregle.
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

  /**
   * LA SEGUNDA QUE SE CAZÓ, y la que estuvo un día en `DEUDA`. Va aparte por lo mismo que
   * la del peso muerto: el recuento dice cuántos fallan, no QUÉ falla.
   */
  it('en el empuje de cadera la barra sube el recorrido del ejercicio, no un palmo de lado', () => {
    const r = recorridoDeCarga(PATRON_POR_ID.extension_cadera)!
    // Sube lo que sube un empuje de cadera: cerca de 28 cm. Antes eran 15.
    expect(r.vertical).toBeGreaterThan(0.24)
    // Y se desplaza como mucho un tercio de eso: es un arco corto, no un viaje.
    expect(r.deriva / r.vertical).toBeLessThan(0.35)
    // La barra descansa en la pelvis, así que el recorrido se mide ahí y no en las manos:
    // seguir las manos daba 2,17 de razón sobre 0,96, un número falso que parecía medida.
    const primera = r.puntos[0]
    const ultima = r.puntos[r.puntos.length - 1]
    expect(ultima[1]).toBeGreaterThan(primera[1] + 0.24)
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

  /**
   * POR QUÉ LA CADENA ABIERTA SIGUE SIN GUARDIÁN, en ejecutable y no en prosa.
   *
   * La ley candidata era «el eje que gira no se traslada»: que el codo no viaje en un curl,
   * que el hombro no se vaya de sitio en una elevación lateral. Se midió el 2026-09-05
   * relativa al TRONCO —no al mundo, que el cuerpo entero puede moverse— y salió
   * tautológica: en seis de los ocho patrones de cadena abierta el eje principal es el
   * hombro, y `brazoD`/`brazoI` cuelgan del `torax` con un `desde` constante. El hombro no
   * se puede mover respecto al tronco: sale 3·10⁻¹⁶ m, el error de coma flotante.
   *
   * Esto queda clavado aquí, y no comentado, por lo que ya pasó con el radio contra el
   * hueso proximal: una tautología descrita en prosa se re-propone cada pocos meses. Si el
   * rig gana algún día traslación escapular, este test se pone rojo y dice que la ley
   * volvió a ser medible.
   */
  it('la ley del eje que no viaja es tautológica en este rig: el hombro no se puede mover', () => {
    /** El eje principal del patrón, en coordenadas del tórax, a lo largo de la repetición. */
    const viajeDelEje = (patron: Patron): number | undefined => {
      const plan = planDeMedida(patron.categoria, patron.ejemplos.split('·')[0].trim())
      if (!plan) return undefined
      const puntos: Vec3[] = []
      for (let i = 0; i < 21; i++) {
        const esq = esqueletoEnFase(patron, i / 20)
        const eje = brazosDeMomento(esq, plan).find((b) => b.protagonismo === 'principal')
        if (!eje) return undefined
        const m = esq.mundo.torax
        const o = puntoDeHueso(esq, 'torax', 0)
        const d: Vec3 = [eje.eje[0] - o[0], eje.eje[1] - o[1], eje.eje[2] - o[2]]
        // El marco del tórax es rígido: la traspuesta de su rotación es su inversa.
        puntos.push([
          m[0] * d[0] + m[1] * d[1] + m[2] * d[2],
          m[4] * d[0] + m[5] * d[1] + m[6] * d[2],
          m[8] * d[0] + m[9] * d[1] + m[10] * d[2],
        ])
      }
      let diametro = 0
      for (const a of puntos)
        for (const b of puntos)
          diametro = Math.max(diametro, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]))
      return diametro
    }

    const conEjeEnElHombro = [
      'traccion_horizontal',
      'abduccion_hombro',
      'empuje_vertical',
      'empuje_horizontal',
      'empuje_inclinado',
      'apertura_pecho',
    ]
    for (const id of conEjeEnElHombro) {
      expect(
        viajeDelEje(PATRON_POR_ID[id]),
        `${id}: el hombro se movió respecto al tronco. Si el rig ganó traslación escapular, ` +
          'la ley del eje que no viaja vuelve a ser medible y toca calibrarla.',
      ).toBeLessThan(1e-9)
    }
    // El único de cadena abierta donde la medida tiene contenido, y por eso no basta: un
    // solo punto no calibra un umbral. `extension_hombro` ni siquiera tiene eje que medir.
    expect(viajeDelEje(PATRON_POR_ID.flexion_codo)).toBeGreaterThan(0.1)
    expect(viajeDelEje(PATRON_POR_ID.extension_hombro)).toBeUndefined()
  })

  it('a una polea no se le exige que se comporte como una barra', () => {
    const v = juzgarTrayectoria(PATRON_POR_ID.traccion_vertical)
    expect(v.cumple).toBe(true)
    expect(v.medida).toBe('no se comprueba')
  })
})
