import { describe, expect, it } from 'vitest'
import { PATRON_POR_ID } from './catalogo'
import {
  ALTURA_DE_REPOSO,
  angulosArticulares,
  claveDeCuerpo,
  definicionDe,
  encuadreDe,
  esqueletoDeFase,
  esqueletoEnReposo,
  largosDeHueso,
  mallaOsea,
  reposoMuscular,
  trazaDe,
  type DefinicionCorporal,
} from './definicionCorporal'
import { ESQUELETO, INDICE_HUESO } from './esqueleto'
import { esqueletoDe, JUEGOS } from './juegoDeHuesos'
import type { Malla } from './malla'
import type { ProporcionesDelCuerpo } from './huellaArticular'
import { brazosDeMomento } from '../biomecanica/brazosDeMomento'
import { planDeMedida } from '../biomecanica/palancas'

/**
 * LOS DOS CUERPOS DEL ENCARGO: la misma estatura y el fémur ±15 %.
 *
 * Es el caso que el escalado por estatura NO resolvía y que `estatura.ts` dejó escrito
 * como pendiente: «dos personas de 1,75 con fémures distintos siguen viéndose iguales, y
 * su sentadilla no lo es». Aquí sí son distintas, y esta prueba dice en qué.
 *
 * Las proporciones se construyen al revés de como salen de una pista —de los largos que
 * se quieren a las razones— porque lo que hay que fijar es exactamente eso: fémur ±15 %
 * SIN mover la estatura, la tibia ni los brazos. El tronco absorbe la diferencia, que es
 * lo que hace un cuerpo real: nadie es más alto por tener el fémur largo.
 */
const SEXO = 'hombre'
const ESTATURA_CM = 175

function proporcionesConFemur(factor: number): ProporcionesDelCuerpo {
  const base = definicionDe(SEXO, ESTATURA_CM).juego
  const disponible = base.coronilla - base.planta
  const femur = base.femur * factor
  const tibia = base.tibia
  const torso = disponible - femur - tibia
  const suma = femur + tibia + torso + base.humero + base.antebrazo
  return {
    femur: femur / suma,
    tibia: tibia / suma,
    torso: torso / suma,
    humero: base.humero / suma,
    antebrazo: base.antebrazo / suma,
    fotogramas: 30,
  }
}

const REFERENCIA = definicionDe(SEXO, ESTATURA_CM)
const LARGO = definicionDe(SEXO, ESTATURA_CM, proporcionesConFemur(1.15))
const CORTO = definicionDe(SEXO, ESTATURA_CM, proporcionesConFemur(0.85))
const PATRON = PATRON_POR_ID.sentadilla
const FASES = [0, 0.5, 1]

/** Cuánto ocupa la geometría de un hueso a lo largo de su eje local. */
function extension(m: Malla, nombre: string, eje: 0 | 1 | 2): number {
  const h = INDICE_HUESO[nombre]
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < m.vertices; i++) {
    if (m.hueso[i] !== h) continue
    const v = m.posicion[i * 3 + eje]
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  return max - min
}

describe('la definición corporal', () => {
  it('sin estatura ni proporciones es el esqueleto de siempre, el mismo array', () => {
    // El camino por defecto no cambia ni un byte: las huellas de `juegoDeHuesos.test.ts`
    // siguen valiendo porque siguen mirando exactamente estos objetos.
    expect(definicionDe('hombre').huesos).toBe(esqueletoDe('hombre'))
    expect(definicionDe('neutro').huesos).toBe(ESQUELETO)
    expect(definicionDe().huesos).toBe(esqueletoDe('hombre'))
    expect(definicionDe('hombre').juego).toBe(JUEGOS.hombre)
  })

  it('devuelve el mismo objeto para el mismo cuerpo, y otro para otro', () => {
    // De esto depende que la malla ósea se construya una vez y no en cada cuadro.
    expect(definicionDe(SEXO, ESTATURA_CM)).toBe(REFERENCIA)
    expect(definicionDe(SEXO, ESTATURA_CM, proporcionesConFemur(1.15))).toBe(LARGO)
    expect(LARGO).not.toBe(CORTO)
  })

  it('la clave distingue los cinco segmentos, no solo los tres que levantan del suelo', () => {
    expect(claveDeCuerpo('mujer')).toBe('mujer')
    expect(claveDeCuerpo('hombre', 175)).toBe('hombre|175')
    const a = proporcionesConFemur(1)
    const b = { ...a, humero: a.humero * 1.4, antebrazo: a.antebrazo * 0.6 }
    // Mismas piernas y mismo tronco, otros brazos: `juegoConProporciones` los ata al
    // fémur, así que es otro cuerpo y tiene que ser otra clave.
    expect(claveDeCuerpo('hombre', 175, a)).not.toBe(claveDeCuerpo('hombre', 175, b))
    expect(claveDeCuerpo('hombre', 175, a)).toBe(claveDeCuerpo('hombre', 175, { ...a }))
  })

  it('guarda de dónde salió el cuerpo: sexo, estatura, proporciones y la fuente del juego', () => {
    expect(LARGO.sexo).toBe(SEXO)
    expect(LARGO.estaturaCm).toBe(ESTATURA_CM)
    expect(LARGO.proporciones?.fotogramas).toBe(30)
    expect(LARGO.juego.fuente).toMatch(/BodyParts3D/)
    expect(LARGO.juego.fuente).toMatch(/pista de pose/)
  })
})

describe('los dos cuerpos: misma estatura, fémur ±15 %', () => {
  it('el fémur cambia un 15 % y la estatura, la tibia y los brazos no se mueven', () => {
    expect(LARGO.juego.femur / REFERENCIA.juego.femur).toBeCloseTo(1.15, 9)
    expect(CORTO.juego.femur / REFERENCIA.juego.femur).toBeCloseTo(0.85, 9)
    expect(LARGO.juego.coronilla).toBeCloseTo(CORTO.juego.coronilla, 9)
    expect(LARGO.juego.coronilla).toBeCloseTo(1.75, 9)
    expect(LARGO.juego.tibia).toBeCloseTo(CORTO.juego.tibia, 9)
    expect(LARGO.juego.humero).toBeCloseTo(CORTO.juego.humero, 9)
    expect(LARGO.juego.antebrazo).toBeCloseTo(CORTO.juego.antebrazo, 9)
    // Y la cadera sube con el fémur, que es lo único que puede pasar sin crecer.
    expect(LARGO.juego.cadera).toBeGreaterThan(CORTO.juego.cadera + 0.13)
  })

  it('hacen EL MISMO ejercicio: los mismos ángulos articulares en las fases 0, 0,5 y 1', () => {
    // La parte de rotación de una matriz de mundo es el producto de las rotaciones de la
    // cadena: los largos solo entran en la traslación. Así que esto no es «casi iguales»,
    // es idéntico, y se comprueba sin tolerancia.
    for (const fase of FASES) {
      const a = angulosArticulares(esqueletoDeFase(LARGO, PATRON, fase), LARGO.huesos)
      const b = angulosArticulares(esqueletoDeFase(CORTO, PATRON, fase), CORTO.huesos)
      expect(Object.keys(a)).toEqual(ESQUELETO.map((h) => h.nombre))
      expect(a, `fase ${fase}`).toStrictEqual(b)
    }
  })

  it('y aun así la traza NO es la misma: es el fallo que esto cierra', () => {
    // Con la traza saliendo de `esqueletoDe(sexo)` —el camino viejo del visor— estas dos
    // listas eran idénticas: al asesorado se le dibujaba su cuerpo y encima el arco de la
    // barra de otro. Si alguien vuelve a atar la traza al sexo, esto se pone rojo.
    const a = trazaDe(LARGO, PATRON)
    const b = trazaDe(CORTO, PATRON)
    expect(a).not.toBeNull()
    expect(a!.length).toBe(b!.length)
    expect(a).not.toStrictEqual(b)
    const separacion = Math.max(
      ...a!.map((p, i) => Math.hypot(p[0] - b![i][0], p[1] - b![i][1], p[2] - b![i][2])),
    )
    // 14 cm en la sentadilla, medidos en `informes/definicion-corporal.json`.
    expect(separacion).toBeGreaterThan(0.1)
  })

  it('la cámara también sale del cuerpo, no del sexo', () => {
    expect(encuadreDe(LARGO, PATRON)).not.toStrictEqual(encuadreDe(CORTO, PATRON))
    expect(encuadreDe(LARGO, PATRON)).toStrictEqual(encuadreDe(LARGO, PATRON))
  })

  it('los brazos de momento son distintos, que es de lo que iba el encargo', () => {
    // «Una sentadilla con fémur largo no es la misma sentadilla»: los ángulos coinciden y
    // las palancas no. Los números están en `informes/definicion-corporal.json`.
    const plan = planDeMedida(PATRON.categoria, '')
    expect(plan).toBeDefined()
    const medir = (d: DefinicionCorporal, fase: number) =>
      brazosDeMomento(esqueletoDeFase(d, PATRON, fase), plan!)
    const a = medir(LARGO, 0.5)
    const b = medir(CORTO, 0.5)
    expect(a.length).toBeGreaterThan(0)
    expect(a.map((x) => x.articulacion)).toStrictEqual(b.map((x) => x.articulacion))
    let mayor = 0
    for (let i = 0; i < a.length; i++) mayor = Math.max(mayor, Math.abs(a[i].metros - b[i].metros))
    // Más de dos centímetros: 13,3 cm en la rodilla a media repetición.
    expect(mayor).toBeGreaterThan(0.02)
    // Y el largo del hueso que cuelga de cada eje sale del MISMO cuerpo que el brazo.
    const rodilla = a.find((x) => x.articulacion === 'rodilla')
    expect(rodilla?.largo).toBeCloseTo(LARGO.juego.tibia, 9)
    const cadera = a.find((x) => x.articulacion === 'cadera')
    expect(cadera?.largo).toBeCloseTo(LARGO.juego.femur, 9)
  })
})

describe('la malla y la traza salen de la MISMA definición', () => {
  it('los largos de hueso del reposo son los del juego, hueso a hueso', () => {
    for (const d of [LARGO, CORTO]) {
      const largos = largosDeHueso(d)
      expect(largos.musloD).toBeCloseTo(d.juego.femur, 12)
      expect(largos.musloI).toBeCloseTo(d.juego.femur, 12)
      expect(largos.tibiaD).toBeCloseTo(d.juego.tibia, 12)
      expect(largos.brazoD).toBeCloseTo(d.juego.humero, 12)
      expect(largos.antebrazoD).toBeCloseTo(d.juego.antebrazo, 12)
    }
    expect(largosDeHueso(LARGO).musloD / largosDeHueso(CORTO).musloD).toBeCloseTo(1.15 / 0.85, 9)
  })

  it('la malla ósea se estira en la MISMA razón que el hueso que resuelve la traza', () => {
    // Es la comprobación del encargo: si la malla saliera de un cuerpo y la traza de otro,
    // estas dos razones no coincidirían. Se comparan razones y no largos absolutos porque
    // la geometría del fémur no ocupa exactamente su largo (tiene cabeza y cóndilos).
    const razonDelHueso = largosDeHueso(LARGO).musloD / largosDeHueso(CORTO).musloD
    const razonDeLaMalla =
      extension(mallaOsea(LARGO), 'musloD', 1) / extension(mallaOsea(CORTO), 'musloD', 1)
    expect(razonDeLaMalla).toBeCloseTo(razonDelHueso, 4)
    // Y la tibia, que NO cambia, tampoco cambia en la malla.
    expect(extension(mallaOsea(LARGO), 'tibiaD', 1)).toBeCloseTo(
      extension(mallaOsea(CORTO), 'tibiaD', 1),
      9,
    )
    // La malla se construye una vez por cuerpo.
    expect(mallaOsea(LARGO)).toBe(mallaOsea(LARGO))
    expect(mallaOsea(LARGO)).not.toBe(mallaOsea(CORTO))
  })

  it('el reposo muscular se mide sobre esos mismos huesos, a la altura de siempre', () => {
    const esq = esqueletoEnReposo(LARGO)
    expect(esq).toBe(esqueletoEnReposo(LARGO))
    expect(ALTURA_DE_REPOSO).toBe(0.95)
    // La raíz en reposo está a la altura declarada: es el punto de partida de la cadena.
    expect(esq.raiz[13]).toBeCloseTo(ALTURA_DE_REPOSO, 9)
    const a = reposoMuscular(LARGO)
    const b = reposoMuscular(CORTO)
    expect(reposoMuscular(LARGO)).toBe(a)
    expect(Object.keys(a).length).toBeGreaterThan(100)
    for (const [clave, largo] of Object.entries(a)) {
      expect(Number.isFinite(largo), clave).toBe(true)
      expect(largo, clave).toBeGreaterThan(0)
    }
    // El recto femoral cruza el fémur entero: con fémur largo está 14 cm más largo.
    expect(a['cuadriceps.rectoD0'] - b['cuadriceps.rectoD0']).toBeGreaterThan(0.1)
    // Y EL CONTROL: el sóleo vive entero sobre la tibia, que en estos dos cuerpos es la
    // misma, así que sale idéntico al milímetro. Es lo que dice que no se estiró el cuerpo
    // entero, sino el hueso que se pidió estirar.
    expect(a['triceps_sural.soleoD0']).toBeCloseTo(b['triceps_sural.soleoD0'], 9)
  })
})

describe('los ángulos articulares', () => {
  it('leen la pose y no el tamaño: de pie y sin pose, todos los huesos están en su reposo', () => {
    const angulos = angulosArticulares(esqueletoEnReposo(REFERENCIA), REFERENCIA.huesos)
    // El muslo cuelga hacia abajo desde una pelvis que apunta hacia arriba: 180° menos
    // los 2,5° de apertura natural que `poseAEuler` le da a la cadera en bipedestación.
    expect(angulos.musloD).toBeCloseTo(177.5, 1)
    // La rodilla y el codo, extendidos: el hueso sigue a su padre.
    expect(angulos.tibiaD).toBeCloseTo(0, 5)
    expect(angulos.antebrazoD).toBeCloseTo(0, 5)
  })

  it('sin decirle qué huesos, usa los de por defecto', () => {
    const porDefecto = definicionDe()
    expect(angulosArticulares(esqueletoEnReposo(porDefecto))).toStrictEqual(
      angulosArticulares(esqueletoEnReposo(porDefecto), porDefecto.huesos),
    )
  })
})
