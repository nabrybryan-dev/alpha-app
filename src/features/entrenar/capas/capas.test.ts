import { describe, expect, it } from 'vitest'
import { ARTICULACIONES } from '../../../domain/patrones/articulaciones'
import { ESQUELETO } from '../../../domain/patrones/esqueleto'
import { MUSCULO_POR_ID, PORCION_POR_CLAVE } from '../../../domain/patrones/musculos'
import { CAPAS_W } from '../salon/huecos'
import {
  CAPA_MAXIMA,
  CAPA_MINIMA,
  UMBRAL_DE_CAPA,
  capaTrasArrastre,
} from './gestoVertical'
import {
  NIVELES_ANATOMICOS,
  NIVEL_POR_W,
  estructurasDe,
  estructurasDesconocidas,
  musculoVisibleEn,
  musculosSinNivel,
} from './nivelesAnatomicos'

/**
 * EL CUARTO EJE, comprobado sin navegador.
 *
 * Los dos módulos de `capas/` son puros a propósito —sin React, sin WebGL, sin puntero—,
 * así que el eje que decide qué ve el asesorado del cuerpo se puede probar entero aquí.
 *
 * Este archivo prueba la DECLARACIÓN: que los cinco niveles existen, que el reparto es una
 * partición y que ningún identificador está inventado. Lo que declara un nivel llega a ser
 * geometría en `mallaDelNivel.test.ts`, que compara los búferes que se suben al motor y
 * comprueba que las cinco capas mandan cinco escenas distintas — cuando esta cabecera se
 * escribió, el constructor filtrado no existía todavía y eso estaba dicho aquí como
 * pendiente; existe desde el 2026-08-29 y aquella frase ya no vale.
 *
 * Lo que sigue sin poderse probar en jsdom es que los cinco niveles se VEAN distintos en
 * pantalla: eso necesita un contexto WebGL que jsdom no tiene. Queda anotado en
 * `informes/verificacion-iphone.md` como pendiente del ojo de Bryan.
 */

describe('los cinco niveles del eje W', () => {
  it('son cinco, en orden, y el índice del array ES el valor de W', () => {
    expect(NIVELES_ANATOMICOS).toHaveLength(5)
    expect(NIVELES_ANATOMICOS.map((n) => n.w)).toEqual([0, 1, 2, 3, 4])
    expect(NIVELES_ANATOMICOS.map((n) => n.id)).toEqual([
      'piel',
      'musculo-superficial',
      'musculo-profundo',
      'tendon',
      'hueso',
    ])
  })

  it('el hueso está en el nivel 4 y es el fondo del eje', () => {
    const hueso = NIVELES_ANATOMICOS[4]
    expect(hueso.id).toBe('hueso')
    expect(hueso.w).toBe(4)
    expect(hueso.piezas).toEqual(['huesos'])
    // Sin nada de tejido blando encima: es lo que hace que se vea la palanca desnuda.
    expect(hueso.musculos).toEqual([])
    expect(hueso.acabado).toBe('ninguno')
    // Y están los veintiún huesos del rig, no un subconjunto.
    expect(hueso.huesos).toHaveLength(ESQUELETO.length)
  })

  it('ninguno de los cinco devuelve una lista vacía de estructuras', () => {
    // Es el mínimo que hace que el eje tenga cinco escalones de verdad y no tres con dos
    // huecos: un nivel al que se llega y no enseña nada es una pantalla rota.
    for (const nivel of NIVELES_ANATOMICOS) {
      expect(estructurasDe(nivel.w).length, `el nivel ${nivel.w} (${nivel.id}) está vacío`).toBeGreaterThan(0)
    }
  })

  it('`NIVEL_POR_W` no es una segunda tabla: sale del array', () => {
    for (const nivel of NIVELES_ANATOMICOS) {
      expect(NIVEL_POR_W[nivel.w]).toBe(nivel)
    }
  })

  it('los nombres del eje son los mismos que declara el contrato de huecos', () => {
    // `huecos.ts` es la frontera con la interfaz y `nivelesAnatomicos.ts` el contrato de lo
    // que se ve. Si los ids se separan, la escalera de la pantalla y el modelo hablarían de
    // capas distintas con el mismo número.
    expect(CAPAS_W.map((c) => c.id)).toEqual(NIVELES_ANATOMICOS.map((n) => n.id))
    expect(CAPAS_W.map((c) => c.w)).toEqual(NIVELES_ANATOMICOS.map((n) => n.w))
  })

  it('el reparto superficial/profundo es una partición del catálogo', () => {
    // Un músculo que se cae de los dos lados desaparece del salón sin que nadie se entere,
    // que es exactamente la pérdida de información que el encargo prohíbe.
    expect(musculosSinNivel()).toEqual({ fuera: [], repetidos: [] })
    const superficiales = NIVELES_ANATOMICOS[1].musculos
    const profundos = NIVELES_ANATOMICOS[2].musculos
    expect(superficiales.length + profundos.length).toBe(Object.keys(MUSCULO_POR_ID).length)
  })

  it('no inventa taxonomía: todos los identificadores existen en el catálogo', () => {
    expect(estructurasDesconocidas()).toEqual([])
    // Y la comprobación de arriba no es vacía: los cuatro catálogos tienen contenido.
    expect(Object.keys(MUSCULO_POR_ID).length).toBeGreaterThan(0)
    expect(Object.keys(PORCION_POR_CLAVE).length).toBeGreaterThan(0)
    expect(ARTICULACIONES.length).toBeGreaterThan(0)
    expect(ESQUELETO.length).toBeGreaterThan(0)
  })

  it('el nivel 2 enseña lo profundo Y NO lo superficial, que es a lo que se viene', () => {
    // Si el profundo llevara también el primer plano, sería el nivel 1 con cosas encima y
    // el psoas seguiría sin verse.
    expect(musculoVisibleEn(1, 'gluteo_mayor')).toBe(true)
    expect(musculoVisibleEn(2, 'gluteo_mayor')).toBe(false)
    expect(musculoVisibleEn(2, 'psoas_iliaco')).toBe(true)
    expect(musculoVisibleEn(1, 'psoas_iliaco')).toBe(false)
  })

  it('el nivel 3 es el del tejido pasivo: porciones biarticulares del catálogo real', () => {
    const tendon = NIVELES_ANATOMICOS[3]
    expect(tendon.porcionesPasivas.length).toBeGreaterThan(0)
    for (const clave of tendon.porcionesPasivas) {
      const localizada = PORCION_POR_CLAVE[clave]
      expect(localizada, `la porción ${clave} no existe en el catálogo`).toBeDefined()
      // El nivel del «no puede»: son las que se tensan por lo que hace la articulación de
      // al lado. Una porción monoarticular aquí no diría nada.
      expect(localizada.porcion.biarticular, `${clave} no es biarticular`).toBe(true)
    }
  })

  /**
   * Y no se ha dejado ninguna fuera.
   *
   * La cabecera de `nivelesAnatomicos.ts` promete que `BIARTICULARES` son «las que el
   * catálogo marca `biarticular: true`». Comprobar solo que las listadas lo son deja pasar
   * el fallo contrario y más silencioso: una porción biarticular del catálogo que nadie
   * apuntó, y que por tanto desaparece del nivel 3 sin que nada se ponga en rojo.
   */
  it('el nivel 3 lista TODAS las porciones biarticulares del catálogo', () => {
    const enElCatalogo = Object.values(PORCION_POR_CLAVE)
      .filter((p) => p.porcion.biarticular)
      .map((p) => p.clave)
      .sort()
    const enElNivel = [...NIVELES_ANATOMICOS[3].porcionesPasivas].sort()
    expect(enElNivel).toEqual(enElCatalogo)
  })
})

describe('el gesto vertical que atraviesa el cuerpo', () => {
  it('un arrastre corto no cambia de capa: no hay capa 1,4', () => {
    expect(capaTrasArrastre(-(UMBRAL_DE_CAPA - 1), 1)).toBe(1)
    expect(capaTrasArrastre(UMBRAL_DE_CAPA - 1, 1)).toBe(1)
    expect(capaTrasArrastre(0, 3)).toBe(3)
    expect(capaTrasArrastre(-1, 0)).toBe(0)
  })

  it('justo en el umbral ya cuenta, y hacia arriba se ENTRA', () => {
    // El signo sigue la convención de la pantalla: +Y es hacia abajo, así que la Y negativa
    // es el dedo que sube. Confundirlo invertiría el eje entero sin romper ningún tipo.
    expect(capaTrasArrastre(-UMBRAL_DE_CAPA, 0)).toBe(1)
    expect(capaTrasArrastre(UMBRAL_DE_CAPA, 1)).toBe(0)
  })

  it('un arrastre completo avanza exactamente UNA capa, por largo que sea', () => {
    // Media pantalla de una tirada no puede llevar de la piel al hueso saltándose todo.
    expect(capaTrasArrastre(-600, 0)).toBe(1)
    expect(capaTrasArrastre(-2000, 1)).toBe(2)
    expect(capaTrasArrastre(600, 4)).toBe(3)
  })

  it('en el tope 0 el gesto de salir no hace nada', () => {
    expect(capaTrasArrastre(UMBRAL_DE_CAPA * 5, 0)).toBe(CAPA_MINIMA)
    expect(capaTrasArrastre(UMBRAL_DE_CAPA, CAPA_MINIMA)).toBe(0)
  })

  it('en el tope 4 el gesto de entrar no hace nada: se acabó el cuerpo', () => {
    expect(capaTrasArrastre(-UMBRAL_DE_CAPA * 5, 4)).toBe(CAPA_MAXIMA)
    expect(capaTrasArrastre(-UMBRAL_DE_CAPA, CAPA_MAXIMA)).toBe(4)
  })

  it('recorre los cinco escalones sin saltarse ninguno', () => {
    let capa = 0
    const recorrido = [capa]
    for (let i = 0; i < 4; i += 1) {
      capa = capaTrasArrastre(-UMBRAL_DE_CAPA, capa)
      recorrido.push(capa)
    }
    expect(recorrido).toEqual([0, 1, 2, 3, 4])
  })

  it('una entrada rara devuelve una capa válida en vez de propagar basura', () => {
    // Devolver `NaN` aquí apagaría el sujeto entero sin lanzar ningún error.
    expect(capaTrasArrastre(Number.NaN, 2)).toBe(2)
    expect(capaTrasArrastre(Number.POSITIVE_INFINITY, 2)).toBe(2)
    expect(capaTrasArrastre(-UMBRAL_DE_CAPA, Number.NaN)).toBe(1)
    // Un 2,5 salido de una interpolación, o una capa fuera de rango de un estado viejo.
    expect(capaTrasArrastre(-UMBRAL_DE_CAPA, 2.5)).toBe(4)
    expect(capaTrasArrastre(-UMBRAL_DE_CAPA, 99)).toBe(4)
    expect(capaTrasArrastre(UMBRAL_DE_CAPA, -7)).toBe(0)
  })

  it('los topes del gesto y los del contrato de huecos son el mismo eje', () => {
    expect(CAPA_MINIMA).toBe(CAPAS_W[0].w)
    expect(CAPA_MAXIMA).toBe(CAPAS_W[CAPAS_W.length - 1].w)
  })
})
