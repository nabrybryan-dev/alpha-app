import { describe, expect, it } from 'vitest'
import { accionesDelPatron, accionesPrincipales, fraseDelPatron, segmentosDe } from './acciones'
import { ARTICULACIONES, EJE_POR_CANAL, RANGO_POR_CANAL } from './articulaciones'
import { PATRONES, PATRON_POR_ID } from './catalogo'
import { poseAnimada } from './movimiento'

const de = (patron: (typeof PATRONES)[number], id: string) =>
  accionesDelPatron(patron).find((r) => r.articulacion.id === id)

describe('el catálogo articular', () => {
  it('no repite canales entre articulaciones', () => {
    // Dos articulaciones tirando del mismo canal harían que una mintiera.
    const canales = ARTICULACIONES.flatMap((a) => a.ejes.map((e) => e.canal))
    expect(new Set(canales).size).toBe(canales.length)
  })

  it('respeta los grados de libertad de cada tipo', () => {
    // Una bisagra con dos ejes no es una bisagra. El codo y la rodilla se
    // doblan y nada más: si algún día alguien les añade un eje para cuadrar una
    // pose, esto se pone rojo.
    for (const a of ARTICULACIONES.filter((x) => x.tipo === 'bisagra')) {
      expect(a.ejes, `${a.nombre} es bisagra`).toHaveLength(1)
      expect(a.ejes[0].plano, `${a.nombre}`).toBe('sagital')
    }
    for (const a of ARTICULACIONES.filter((x) => x.tipo === 'trocoide')) {
      expect(a.ejes, `${a.nombre} es trocoide`).toHaveLength(1)
    }
    for (const a of ARTICULACIONES.filter((x) => x.tipo === 'esferoidea')) {
      expect(a.ejes.length, `${a.nombre} es esferoidea`).toBe(3)
      expect(new Set(a.ejes.map((e) => e.plano)).size).toBe(3)
    }
  })

  it('el codo no se dobla hacia atrás', () => {
    // Es hueso contra hueso: el olécranon topa con su fosa y ahí acaba. Un
    // rango negativo aquí sería un codo roto en pantalla.
    const codo = ARTICULACIONES.find((a) => a.id === 'codo')!
    expect(codo.ejes[0].rango[0]).toBe(0)
    expect(codo.noPuede.length).toBeGreaterThan(0)
  })

  it('la rodilla tampoco', () => {
    const rodilla = ARTICULACIONES.find((a) => a.id === 'rodilla')!
    expect(rodilla.ejes[0].rango[0]).toBe(0)
  })

  it('explica lo que NO puede hacer cada articulación', () => {
    for (const a of ARTICULACIONES) {
      expect(a.noPuede.length, `${a.nombre} sin límites explicados`).toBeGreaterThan(0)
      expect(a.segmentoFijo.length, a.nombre).toBeGreaterThan(2)
      expect(a.segmentoMovil.length, a.nombre).toBeGreaterThan(2)
    }
  })

  it('es la única fuente de los topes que aplica el movimiento', () => {
    for (const [canal, rango] of Object.entries(RANGO_POR_CANAL)) {
      expect(EJE_POR_CANAL[canal], canal).toBeDefined()
      expect(EJE_POR_CANAL[canal].eje.rango).toBe(rango)
    }
  })
})

describe('ninguna pose se sale de los grados de libertad', () => {
  it.each(PATRONES.map((p) => [p.id, p] as const))('%s', (_id, p) => {
    for (const fase of [0, 0.5, 1]) {
      for (const sentido of [1, -1]) {
        const { pose } = poseAnimada(p, fase, sentido, 1.7)
        for (const canal of Object.keys(pose)) {
          const raiz = canal.replace(/[DI]$/, '')
          // Escribir en un canal que ninguna articulación tiene equivale a
          // inventarse un grado de libertad para que cuadre la animación.
          expect(EJE_POR_CANAL[raiz], `canal sin articulación: "${canal}"`).toBeDefined()
        }
      }
    }
  })
})

describe('el desglose de un ejercicio', () => {
  it('describe el press militar como flexión de hombro y extensión de codo', () => {
    // Es el ejemplo canónico: dos articulaciones motoras en direcciones
    // distintas, y una muñeca que no recorre nada pero aguanta.
    const p = PATRON_POR_ID.empuje_vertical
    expect(de(p, 'hombro')?.rol).toBe('motor')
    expect(de(p, 'codo')?.rol).toBe('motor')
    const codo = de(p, 'codo')!.acciones[0]
    expect(codo.accion).toBe('Extensión')
    expect(codo.hasta).toBeLessThan(codo.desde)
  })

  it('reconoce la muñeca como estabilizadora cuando no recorre nada', () => {
    const muneca = de(PATRON_POR_ID.empuje_vertical, 'muneca')
    expect(muneca?.rol).toBe('estabilizador')
    expect(muneca?.acciones ?? []).toHaveLength(0)
  })

  it('ve la dorsiflexión de tobillo en la sentadilla, que no está escrita', () => {
    // El apoyo plantar la calcula solo, así que solo aparece si se mira la pose
    // resuelta. Y es una de las claves de ejecución del patrón.
    const tobillo = de(PATRON_POR_ID.sentadilla, 'tobillo')
    expect(tobillo?.rol).toBe('motor')
    expect(tobillo?.acciones[0].accion).toBe('Dorsiflexión')
  })

  it('no cuenta como motor una articulación que solo acompaña', () => {
    // En sentadilla los brazos se adelantan doce grados para equilibrar. Se
    // mueven, pero nadie hace una sentadilla con los codos.
    expect(de(PATRON_POR_ID.sentadilla, 'codo')?.rol).not.toBe('motor')
  })

  it('marca la lumbar como estabilizadora en todo lo que carga la espalda', () => {
    for (const id of ['sentadilla', 'bisagra_cadera', 'traccion_horizontal']) {
      expect(de(PATRON_POR_ID[id], 'lumbar')?.rol, id).toBe('estabilizador')
    }
  })

  it('resume cada patrón en una frase legible', () => {
    for (const p of PATRONES) {
      const frase = fraseDelPatron(p)
      expect(frase.length, p.id).toBeGreaterThan(10)
      expect(frase[0], `${p.id}: "${frase}"`).toBe(frase[0].toUpperCase())
    }
    expect(fraseDelPatron(PATRON_POR_ID.flexion_codo)).toContain('codo')
  })

  it('todo patrón tiene al menos una articulación motora', () => {
    for (const p of PATRONES) {
      const motores = accionesPrincipales(p).filter((r) => r.rol === 'motor')
      // La plancha es la excepción: no recorre, sostiene.
      if (p.invertido) continue
      expect(motores.length, `${p.id} no mueve nada`).toBeGreaterThan(0)
    }
  })

  it('deja fuera del listado principal lo que solo acompaña', () => {
    const todas = accionesDelPatron(PATRON_POR_ID.sentadilla)
    const principales = accionesPrincipales(PATRON_POR_ID.sentadilla)
    expect(principales.length).toBeLessThan(todas.length)
    expect(principales.every((r) => r.rol !== 'libre')).toBe(true)
  })
})

describe('qué segmento se mueve en cada ejercicio', () => {
  it('en la sentadilla mueve el fémur sobre la tibia, no al revés', () => {
    // Es el malentendido que hay que evitar. La rodilla flexiona en los dos
    // casos, pero en una sentadilla el pie está clavado en el suelo: la tibia no
    // puede ir a ninguna parte y es el fémur el que baja sobre ella. Decir
    // «tibia sobre fémur» lo hace leer como un curl femoral, que carga los
    // isquios en vez del cuádriceps.
    const s = segmentosDe(PATRON_POR_ID['sentadilla'], 'rodilla')
    expect(s.movil).toBe('Fémur')
    expect(s.fijo).toBe('Tibia')
  })

  it('en la flexión de rodilla mueve la tibia sobre el fémur', () => {
    // Cadena abierta: el pie va libre y es él quien viaja.
    const s = segmentosDe(PATRON_POR_ID['flexion_rodilla'], 'rodilla')
    expect(s.movil).toBe('Tibia')
    expect(s.fijo).toBe('Fémur')
  })

  it('en la sentadilla mueve la pelvis sobre el fémur', () => {
    // Lo mismo un eslabón más arriba: la cadera flexiona, pero lo que se
    // desplaza es la pelvis hacia atrás, no el muslo hacia delante.
    const s = segmentosDe(PATRON_POR_ID['sentadilla'], 'cadera')
    expect(s.movil).toBe('Pelvis')
    expect(s.fijo).toBe('Fémur')
  })

  it('en la abducción de cadera mueve el fémur sobre la pelvis', () => {
    const s = segmentosDe(PATRON_POR_ID['abduccion_cadera'], 'cadera')
    expect(s.movil).toBe('Fémur')
    expect(s.fijo).toBe('Pelvis')
  })

  it('invierte todas las articulaciones en cadena cerrada', () => {
    // No es un caso especial de la rodilla: en cadena cerrada se invierte la
    // relación en toda la cadena, porque el punto fijo está en el extremo.
    for (const p of PATRONES) {
      for (const a of ARTICULACIONES) {
        const s = segmentosDe(p, a.id)
        const esperadoMovil = p.cadena === 'cerrada' ? a.segmentoFijo : a.segmentoMovil
        expect(s.movil, `${p.id} · ${a.id}`).toBe(esperadoMovil)
      }
    }
  })
})
