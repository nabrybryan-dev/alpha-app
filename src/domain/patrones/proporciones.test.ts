import { describe, expect, it } from 'vitest'
import { huellaDePista, proporcionesDePista } from './huellaArticular'
import { LARGO, pistaSintetica, type LargosSinteticos } from './pistaSintetica'
import { JUEGOS } from './juegoDeHuesos'
import { juegoConProporciones } from './estatura'

/**
 * ¿RECUPERA LA PISTA LAS PROPORCIONES DE LA PERSONA? Medido contra una verdad conocida.
 *
 * La idea del encargo es que el sujeto del salón deje de tener el cuerpo del atlas y tenga
 * el de la persona: sus palancas, para que la técnica que se le enseña sea la suya. La
 * estatura ya la da la ficha; lo que faltaba eran las PROPORCIONES, y la pista de pose las
 * tiene —está en píxeles y los píxeles llevan los largos— pero nadie se las preguntaba.
 *
 * Con un solo cuerpo sintético esto no se puede comprobar: cualquier función que devuelva
 * siempre lo mismo pasaría. Por eso `pistaSintetica` acepta desde hoy los largos, y lo que
 * se afirma aquí es que **cuerpos distintos dan lecturas distintas y en la dirección
 * correcta**.
 *
 * ## Lo que este archivo NO prueba, y hay que saberlo
 *
 * La pista sintética es una proyección perfecta de perfil, así que aquí no hay escorzo de
 * verdad: prueba que la ARITMÉTICA es correcta. Lo que el escorzo real le hace a la lectura
 * se simula en el último bloque encogiendo el eje horizontal, que es exactamente lo que
 * pasa cuando alguien graba girado.
 */

const proporcionesDe = (largo: LargosSinteticos) =>
  proporcionesDePista(pistaSintetica({ repeticiones: 2, largo }))

describe('las proporciones que salen de una pista', () => {
  it('recupera las razones del cuerpo que las generó', () => {
    // El cuerpo de siempre: tibia 400, fémur 400, torso 500, húmero 250, antebrazo 250.
    // Suman 1800, así que el fémur es 400/1800 = 0,222 y el torso 500/1800 = 0,278.
    const p = proporcionesDe(LARGO)!
    expect(p).toBeDefined()
    const suma = LARGO.tibia + LARGO.femur + LARGO.torso + LARGO.humero + LARGO.antebrazo
    expect(p.femur).toBeCloseTo(LARGO.femur / suma, 2)
    expect(p.tibia).toBeCloseTo(LARGO.tibia / suma, 2)
    expect(p.torso).toBeCloseTo(LARGO.torso / suma, 2)
    expect(p.humero).toBeCloseTo(LARGO.humero / suma, 2)
    expect(p.antebrazo).toBeCloseTo(LARGO.antebrazo / suma, 2)
    expect(p.femur + p.tibia + p.torso + p.humero + p.antebrazo).toBeCloseTo(1, 6)
  })

  it('DISTINGUE a alguien de fémur largo, que es el caso del encargo', () => {
    // «Una sentadilla con fémur largo no es la misma sentadilla». Si esto no separa a los
    // dos cuerpos, todo lo demás sobra: el sujeto seguiría siendo el mismo para los dos.
    const normal = proporcionesDe(LARGO)!
    const femurLargo = proporcionesDe({ ...LARGO, femur: 500 })!
    expect(femurLargo.femur).toBeGreaterThan(normal.femur + 0.02)
    // Y lo que no cambió, no cambia de largo: baja su FRACCIÓN porque la suma creció, pero
    // su razón contra la tibia se mantiene. Es la comprobación de que se mide el cuerpo y
    // no se reparte un total a ojo.
    expect(femurLargo.torso / femurLargo.humero).toBeCloseTo(normal.torso / normal.humero, 2)
  })

  it('el orden se conserva: quien tiene la tibia más larga sale con la tibia más larga', () => {
    const cortas = proporcionesDe({ ...LARGO, tibia: 300 })!
    const largas = proporcionesDe({ ...LARGO, tibia: 520 })!
    expect(largas.tibia).toBeGreaterThan(cortas.tibia)
    expect(largas.tibia / largas.femur).toBeGreaterThan(cortas.tibia / cortas.femur)
  })
})

describe('cuándo NO hay proporciones, que es la mitad honesta', () => {
  it('una pista sin persona en casi ningún fotograma no da medida', () => {
    // `sinPersonaCada: 1` deja todos los fotogramas sin puntos. Sin cuerpo no hay cuerpo
    // que medir, y devolver algo sería inventarlo.
    expect(proporcionesDePista(pistaSintetica({ sinPersonaCada: 1 }))).toBeUndefined()
  })

  it('una pista demasiado corta tampoco: con cuatro fotogramas manda el ruido', () => {
    const corta = pistaSintetica({ repeticiones: 1, periodoSeg: 0.1, fps: 30 })
    expect(corta.fotogramas.length).toBeLessThan(10)
    expect(proporcionesDePista(corta)).toBeUndefined()
  })

  it('dice cuántos fotogramas la respaldan, para poder desconfiar de una toma corta', () => {
    const p = proporcionesDe(LARGO)!
    expect(p.fotogramas).toBeGreaterThan(50)
  })
})

describe('lo que el escorzo le hace a la lectura', () => {
  it('grabar girado ACORTA lo que se ve, y el percentil 90 lo aguanta mejor que la media', () => {
    // El escorzo solo puede RESTAR: un segmento que apunta a la cámara se ve más corto,
    // nunca más largo. Se simula encogiendo el eje horizontal de la pista, que es lo que
    // hace grabar desde un ángulo en vez de de perfil.
    //
    // Con 30° de giro el coseno es 0,87, así que lo que se mueve en horizontal encoge un
    // 13 %. Lo que se afirma no es que no pase nada —pasa— sino que las razones aguantan
    // lo suficiente para seguir distinguiendo un fémur largo de uno corto, que es para lo
    // que se usan.
    const girar = (k: number) => {
      const pista = pistaSintetica({ repeticiones: 2 })
      for (const f of pista.fotogramas) {
        if (!f.puntos) continue
        for (const nombre of Object.keys(f.puntos)) {
          const p = f.puntos[nombre]
          f.puntos[nombre] = [540 + (p[0] - 540) * k, p[1], p[2]]
        }
      }
      return proporcionesDePista(pista)!
    }
    const dePerfil = girar(1)
    const girado = girar(Math.cos((30 * Math.PI) / 180))
    // Ninguna proporción se desmadra: el error se queda en unas pocas centésimas.
    for (const campo of ['femur', 'tibia', 'torso', 'humero', 'antebrazo'] as const) {
      expect(Math.abs(girado[campo] - dePerfil[campo]), campo).toBeLessThan(0.04)
    }
    // Y lo que importa: sigue separando dos cuerpos distintos mejor de lo que se equivoca.
    const femurLargo = proporcionesDe({ ...LARGO, femur: 500 })!
    const normal = proporcionesDe(LARGO)!
    expect(femurLargo.femur - normal.femur).toBeGreaterThan(
      Math.abs(girado.femur - dePerfil.femur),
    )
  })
})

describe('de las proporciones al cuerpo del muñeco', () => {
  const proporciones = proporcionesDe({ ...LARGO, femur: 520, tibia: 340 })!

  it('LA ESTATURA MANDA: repartir no cambia cuánto mide la persona', () => {
    // Es la regla que ordena el reparto. La estatura es el único número medido en metros
    // que hay; las proporciones son razones de una proyección. Salir de la ficha con 1,72
    // para acabar dibujando 1,68 sería estropear el dato bueno con el aproximado.
    for (const cm of [158, 172, 191]) {
      const j = juegoConProporciones(JUEGOS.hombre, proporciones, cm)
      expect(j.coronilla, `${cm} cm`).toBeCloseTo(cm / 100, 3)
      // Y la cadera sigue siendo lo que hay debajo de ella: planta + tibia + fémur.
      expect(j.cadera).toBeCloseTo(j.planta + j.tibia + j.femur, 6)
    }
  })

  it('el fémur largo llega hasta el hueso: el muñeco lo tiene largo', () => {
    // La cadena entera, que es lo que hay que comprobar: cuerpo sintético con el fémur
    // largo → pista → proporciones → juego de huesos. Si en algún eslabón se pierde, aquí
    // se ve, y no en la pantalla.
    const normal = juegoConProporciones(JUEGOS.hombre, proporcionesDe(LARGO), 175)
    const largo = juegoConProporciones(JUEGOS.hombre, proporciones, 175)
    expect(largo.femur).toBeGreaterThan(normal.femur + 0.03)
    expect(largo.tibia).toBeLessThan(normal.tibia)
    // Y los dos miden lo mismo: lo que cambia es CÓMO se reparte, no cuánto.
    expect(largo.coronilla).toBeCloseTo(normal.coronilla, 6)
  })

  it('los brazos van atados al fémur, con la razón de la persona', () => {
    const j = juegoConProporciones(JUEGOS.hombre, proporciones, 175)
    expect(j.humero / j.femur).toBeCloseTo(proporciones.humero / proporciones.femur, 3)
    expect(j.antebrazo / j.femur).toBeCloseTo(proporciones.antebrazo / proporciones.femur, 3)
  })

  it('sin proporciones se queda en el escalado por estatura, sin inventar reparto', () => {
    const soloEstatura = juegoConProporciones(JUEGOS.hombre, undefined, 175)
    expect(soloEstatura.coronilla).toBeCloseTo(1.75, 3)
    expect(soloEstatura.femur / soloEstatura.tibia).toBeCloseTo(
      JUEGOS.hombre.femur / JUEGOS.hombre.tibia,
      6,
    )
  })

  it('la huella de una pista se lleva las proporciones dentro', () => {
    // Es lo que hace que esto llegue a alguna parte: la pista NO se guarda, así que si las
    // proporciones no viajaran en la huella se perderían al importar.
    const huella = huellaDePista(pistaSintetica({ repeticiones: 2, largo: { ...LARGO, femur: 520 } }))
    expect(huella?.proporciones).toBeDefined()
    expect(huella!.proporciones!.femur).toBeGreaterThan(proporcionesDe(LARGO)!.femur)
  })
})
