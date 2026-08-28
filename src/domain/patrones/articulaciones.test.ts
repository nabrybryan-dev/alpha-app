import { describe, expect, it } from 'vitest'
import { ARTICULACIONES, NOMBRE_DE_TIPO, RANGO_POR_CANAL } from './articulaciones'
import { ESQUELETO, INDICE_HUESO, resolver } from './esqueleto'

/**
 * El catálogo articular no es documentación: es la fuente de la que salen los
 * topes que aplica la capa de movimiento. Un número mal puesto aquí hace que el
 * sujeto enseñe un movimiento que no existe, sin que nada falle.
 */

/** Cuántos grados de libertad tiene cada tipo de articulación, por definición. */
const EJES_POR_TIPO: Record<string, number> = {
  bisagra: 1,
  trocoide: 1,
  condilea: 2,
  esferoidea: 3,
}

describe('el catálogo articular', () => {
  it('no declara dos veces el mismo movimiento', () => {
    // La escápula llegó a tener `escapulaProt` (protracción→retracción) y
    // `escapulaRetr` (retracción→protracción): el mismo eje escrito al revés.
    // La app anunciaba tres grados de libertad y ofrecía dos botones idénticos.
    for (const a of ARTICULACIONES) {
      const vistos = new Set<string>()
      for (const e of a.ejes) {
        // El par ordenado alfabéticamente: si dos ejes mueven lo mismo en el
        // mismo plano, colisionan aunque estén escritos en distinto orden.
        const clave = [e.positivo, e.negativo].sort().join('|') + '@' + e.plano
        expect(vistos.has(clave), `${a.nombre} declara dos veces «${e.positivo}/${e.negativo}»`).toBe(
          false,
        )
        vistos.add(clave)
      }
    }
  })

  it('da a cada articulación los grados de libertad que su tipo promete', () => {
    // Decir «condílea» y ofrecer un solo eje es prometer dos y dar uno. Las
    // compuestas y las planas no entran: no son una articulación única.
    for (const a of ARTICULACIONES) {
      const esperados = EJES_POR_TIPO[a.tipo]
      if (esperados === undefined) continue
      expect(
        a.ejes.length,
        `${a.nombre} es ${NOMBRE_DE_TIPO[a.tipo].toLowerCase()} y tiene ${a.ejes.length} ${a.ejes.length === 1 ? 'eje' : 'ejes'}`,
      ).toBe(esperados)
    }
  })

  it('mueve de verdad el hueso en cada eje que declara', () => {
    // Éste es el guardián que faltaba. La elevación escapular se escribía en la
    // pose y no rotaba la escápula: el canal existía, se recortaba con su rango,
    // salía en el desglose... y no movía nada. Nada fallaba.
    //
    // Se compara la MATRIZ del hueso, no sus puntos. Una rotación axial no
    // desplaza lo que está sobre el eje —la lumbar rota sobre sí misma—, así que
    // medir puntos daba tres canales por muertos estando vivos.
    const ORIGEN: [number, number, number] = [0, 0, 0]
    const quieto = resolver({}, ORIGEN, ORIGEN)
    for (const a of ARTICULACIONES) {
      for (const e of a.ejes) {
        // Los huesos pares llevan sufijo de lado; los del eje, no.
        const lado = INDICE_HUESO[a.huesoDistal + 'D'] !== undefined ? 'D' : ''
        const hueso = a.huesoDistal + lado
        const [min, max] = e.rango
        // Se prueba el extremo más lejano de cero, que es donde más se nota.
        const grados = Math.abs(max) >= Math.abs(min) ? max : min
        const movido = resolver({ [e.canal + lado]: grados }, ORIGEN, ORIGEN)
        const antes = quieto.mundo[hueso]
        const ahora = movido.mundo[hueso]
        let cambio = 0
        for (let i = 0; i < 16; i++) cambio = Math.max(cambio, Math.abs(ahora[i] - antes[i]))
        expect(
          cambio,
          `${a.nombre}: «${e.canal}» a ${grados}° no mueve ${hueso} en absoluto`,
        ).toBeGreaterThan(0.01)
      }
    }
  })

  it('nombra huesos del rig que existen', () => {
    const nombres = new Set(ESQUELETO.map((h) => h.nombre.replace(/[DI]$/, '')))
    for (const a of ARTICULACIONES) {
      expect(nombres.has(a.huesoProximal), `${a.nombre}: ${a.huesoProximal}`).toBe(true)
      expect(nombres.has(a.huesoDistal), `${a.nombre}: ${a.huesoDistal}`).toBe(true)
    }
  })

  it('registra el rango de cada canal una sola vez', () => {
    // `RANGO_POR_CANAL` es la única lista de topes. Dos ejes con el mismo canal
    // dejarían uno de los dos rangos sin aplicar, en silencio.
    const canales = ARTICULACIONES.flatMap((a) => a.ejes.map((e) => e.canal))
    expect(new Set(canales).size, 'hay canales repetidos entre articulaciones').toBe(canales.length)
    for (const c of canales) expect(RANGO_POR_CANAL[c], c).toBeDefined()
  })

  it('no promete en el nombre un sentido que el rango no da', () => {
    // Un eje llamado «Protracción / Retracción» que va de 0 a 38 no puede
    // retraer. Ojo: lo contrario NO es un fallo —la rodilla va de 0° a 145° y
    // está bien, porque no hiperextiende—, así que solo se mira el caso en el
    // que el catálogo declara además el eje contrario por separado.
    for (const a of ARTICULACIONES) {
      const sentidos = a.ejes.flatMap((e) => [e.positivo, e.negativo])
      for (const e of a.ejes) {
        const [min, max] = e.rango
        if (min < 0 && max > 0) continue
        const inalcanzable = max <= 0 ? e.positivo : e.negativo
        expect(
          sentidos.filter((x) => x === inalcanzable).length,
          `${a.nombre}: «${e.positivo} / ${e.negativo}» va de ${min}° a ${max}°, así que «${inalcanzable}» solo existe en el nombre`,
        ).toBe(1)
      }
    }
  })

  it('marca los rangos que todavía esperan el número de un preparador', () => {
    // Los ejes que se añadieron para tapar un hueco llevan cifras de referencia,
    // no medidas. Que se note es la diferencia entre un dato y una suposición.
    const provisionales = ARTICULACIONES.flatMap((a) =>
      a.ejes.filter((e) => e.provisional).map((e) => e.canal),
    )
    for (const c of provisionales) expect(RANGO_POR_CANAL[c], c).toBeDefined()
    // Si algún día no queda ninguno, este test sobra: quítalo con el último.
    expect(provisionales.length).toBeGreaterThan(0)
  })
})
