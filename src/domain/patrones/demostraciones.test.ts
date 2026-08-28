import { describe, expect, it } from 'vitest'
import { ARTICULACIONES } from './articulaciones'
import { DEMOSTRACIONES, DEMOSTRACION_POR_ID, demostracionesDe } from './demostraciones'
import { encuadrar, esqueletoEnFase } from './escena'
import { INDICE_HUESO, puntoDeHueso, resolver } from './esqueleto'
import { construirMusculos, longitudesEnReposo, PORCION_POR_CLAVE } from './musculos'
import { poseAnimada, RANGO } from './movimiento'
import { V } from './algebra'

const reposo = longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0]))

describe('el sujeto ejerciendo sus acciones', () => {
  it('tiene una demostración por cada eje de cada articulación', () => {
    const ejes = ARTICULACIONES.reduce((n, a) => n + a.ejes.length, 0)
    expect(DEMOSTRACIONES).toHaveLength(ejes)
    expect(Object.keys(DEMOSTRACION_POR_ID)).toHaveLength(ejes)
  })

  it('mueve una sola articulación y deja el resto quieto', () => {
    // Es el punto de aislar: si se mueve algo más, ya no se está viendo esa
    // acción sino un gesto. La ficha puede traer además la postura de estudio
    // —que coloca el brazo donde se vea—, y esa no recorre: vale igual en las
    // dos poses, así que se mira el recorrido y no la lista de canales.
    for (const d of DEMOSTRACIONES) {
      const canales = new Set([...Object.keys(d.patron.inicio), ...Object.keys(d.patron.fin)])
      const recorren = [...canales].filter(
        (c) => (d.patron.inicio[c] ?? 0) !== (d.patron.fin[c] ?? 0),
      )
      expect(recorren.length, `${d.id} recorre ${recorren.join(', ')}`).toBe(1)
      expect(recorren[0].replace(/[DI]$/, ''), d.id).toBe(d.eje.canal)
      // Y el canal tiene que ser uno que la pose de verdad lea.
      const { pose } = poseAnimada(d.patron, 1, 1, 0)
      expect(pose[recorren[0]], `${d.id}: el canal no llega a la pose`).toBeDefined()
    }
  })

  it('recorre casi todo el rango, pero no lo apura', () => {
    // Los últimos grados los sujeta el ligamento, no el músculo. Enseñarlos
    // como recorrido de trabajo invitaría a buscarlos con carga.
    for (const d of DEMOSTRACIONES) {
      const canal = Object.keys(d.patron.inicio).find(
        (c) => d.patron.inicio[c] !== d.patron.fin[c],
      )!
      const desde = d.patron.inicio[canal]
      const hasta = d.patron.fin[canal]
      const [min, max] = d.eje.rango
      expect(desde, d.id).toBeGreaterThanOrEqual(min)
      expect(hasta, d.id).toBeLessThanOrEqual(max)
      const recorrido = Math.abs(hasta - desde)
      expect(recorrido, `${d.id} apenas recorre`).toBeGreaterThan(Math.abs(max - min) * 0.8)
      expect(recorrido, `${d.id} apura el tope`).toBeLessThan(Math.abs(max - min))
    }
  })

  it('nunca lleva una articulación fuera de su rango', () => {
    for (const d of DEMOSTRACIONES) {
      for (const fase of [0, 0.5, 1]) {
        const { pose } = poseAnimada(d.patron, fase, 1, 0)
        for (const [canal, valor] of Object.entries(pose)) {
          const rango = RANGO[canal.replace(/[DI]$/, '')]
          expect(rango, `${d.id}: canal desconocido ${canal}`).toBeDefined()
          expect(valor, `${d.id}: ${canal}=${valor}`).toBeGreaterThanOrEqual(rango[0] - 0.01)
          expect(valor, `${d.id}: ${canal}=${valor}`).toBeLessThanOrEqual(rango[1] + 0.01)
        }
      }
    }
  })

  it('el codo no se dobla hacia atrás ni en su propia demostración', () => {
    const d = DEMOSTRACION_POR_ID['demo-codo-codoFlex']
    expect(d).toBeDefined()
    for (const fase of [0, 0.25, 0.5, 0.75, 1]) {
      const { pose } = poseAnimada(d.patron, fase, 1, 0)
      expect(pose.codoFlexD, `fase ${fase}`).toBeGreaterThanOrEqual(0)
    }
  })

  it('mira cada acción desde el plano en el que ocurre', () => {
    // Una flexión de perfil, una abducción de frente, un giro desde arriba.
    // Verla desde el ángulo equivocado es la forma más rápida de no entenderla.
    for (const d of DEMOSTRACIONES) {
      // Se mira el azimut en valor absoluto: el signo dice por qué lado se
      // rodea al sujeto —el del segmento que se estudia, o el tronco lo tapa—
      // y no cambia desde qué plano se ve la acción.
      if (d.eje.plano === 'sagital') expect(Math.abs(d.patron.camara.azimut), d.id).toBeGreaterThan(60)
      if (d.eje.plano === 'frontal') expect(Math.abs(d.patron.camara.azimut), d.id).toBeLessThan(20)
      if (d.eje.plano === 'transverso') expect(d.patron.camara.elevacion, d.id).toBeGreaterThan(40)
    }
  })

  it('enciende solo músculos que cruzan esa articulación', () => {
    // Un músculo que no la cruza no puede moverla, y pintarlo rojo sería
    // enseñar una relación que no existe.
    for (const d of DEMOSTRACIONES) {
      const claves = Object.keys(d.patron.activacion)
      expect(claves.length, `${d.id} no activa nada`).toBeGreaterThan(0)
      for (const clave of claves) {
        const sinLado = clave.split(':')[0]
        expect(PORCION_POR_CLAVE[sinLado], `${d.id}: ${sinLado}`).toBeDefined()
      }
    }
  })

  it('mueve de verdad el segmento distal', () => {
    // Si el hueso de debajo no se desplaza, la demostración no enseña nada.
    for (const d of DEMOSTRACIONES) {
      const hueso = d.articulacion.huesoDistal
      // Los huesos del eje —columna, cráneo, pelvis— son únicos y no llevan
      // sufijo de lado; los pares sí.
      const nombre = INDICE_HUESO[hueso + 'D'] ? hueso + 'D' : hueso
      // Con desvío lateral: una rotación axial no mueve los puntos que están
      // sobre su propio eje, y medirlos ahí daría cero aunque el giro ocurra.
      const desvio: [number, number, number] = [0.08, 0, 0]
      const a = puntoDeHueso(esqueletoEnFase(d.patron, 0), nombre, 1, desvio)
      const b = puntoDeHueso(esqueletoEnFase(d.patron, 1), nombre, 1, desvio)
      expect(V.largo(V.restar(a, b)), `${d.id} no mueve ${hueso}`).toBeGreaterThan(0.01)
    }
  })

  it('genera una malla muscular finita en cada demostración', () => {
    for (const d of DEMOSTRACIONES) {
      const esq = esqueletoEnFase(d.patron, 0.5)
      const malla = construirMusculos(esq, d.patron.activacion, reposo)
      expect(malla.vertices, d.id).toBeGreaterThan(1000)
      expect(malla.posicion.every(Number.isFinite), d.id).toBe(true)
    }
  })

  it('agrupa las demostraciones por articulación', () => {
    expect(demostracionesDe('codo')).toHaveLength(1)
    expect(demostracionesDe('hombro')).toHaveLength(3)
    expect(demostracionesDe('rodilla')).toHaveLength(1)
    expect(demostracionesDe('inexistente')).toHaveLength(0)
  })
})

describe('la postura de estudio', () => {
  it('separa del tronco la articulación del brazo que se estudia', () => {
    // Con el brazo colgando, la muñeca queda pegada a la cadera y mirarla de
    // perfil es mirar a través del muslo. No es un problema de cámara: la pose
    // tiene que poner el segmento donde se vea, que es como se enseña.
    for (const id of ['codo', 'radiocubital', 'muneca']) {
      for (const d of demostracionesDe(id)) {
        const esq = esqueletoEnFase(d.patron, 0.5)
        const codo = puntoDeHueso(esq, 'antebrazoD', 0)
        const cadera = puntoDeHueso(esq, 'pelvis', 0)
        const separacion = Math.hypot(codo[0] - cadera[0], codo[2] - cadera[2])
        expect(separacion, `${d.id}: el brazo queda a ${(separacion * 100).toFixed(0)} cm del eje`).toBeGreaterThan(
          0.28,
        )
      }
    }
  })

  it('deja quieto lo que no se estudia', () => {
    // La postura de estudio coloca el cuerpo, pero el único canal que RECORRE
    // sigue siendo el de la articulación elegida: si se moviera otra cosa, la
    // demostración dejaría de aislar nada.
    for (const d of DEMOSTRACIONES) {
      const canales = new Set([...Object.keys(d.patron.inicio), ...Object.keys(d.patron.fin)])
      const recorren = [...canales].filter(
        (c) => (d.patron.inicio[c] ?? 0) !== (d.patron.fin[c] ?? 0),
      )
      expect(recorren, `${d.id} recorre ${recorren.join(', ')}`).toHaveLength(1)
    }
  })
})

describe('desde dónde se mira', () => {
  /** Dónde queda la cámara orbital en la pose de partida. */
  const posicionDeCamara = (d: (typeof DEMOSTRACIONES)[number]) => {
    const { centro, distancia } = encuadrar(d.patron)
    const az = (d.patron.camara.azimut * Math.PI) / 180
    const el = (d.patron.camara.elevacion * Math.PI) / 180
    return [
      centro[0] + distancia * Math.cos(el) * Math.sin(az),
      centro[1] + distancia * Math.sin(el),
      centro[2] + distancia * Math.cos(el) * Math.cos(az),
    ] as [number, number, number]
  }

  it('no deja el tronco entre la cámara y lo que enseña', () => {
    // La muñeca derecha vive en x negativo y la cámara sagital estaba en x
    // positivo: el tórax quedaba justo en medio y se veía un amasijo de
    // costillas con la mano detrás. La cámara va del lado del segmento.
    for (const d of DEMOSTRACIONES) {
      const esq = esqueletoEnFase(d.patron, 0.5)
      const { centro } = encuadrar(d.patron)
      const cam = posicionDeCamara(d)
      const torax = puntoDeHueso(esq, 'torax', 0.5)
      // Distancia del tórax al segmento cámara→centro, solo si queda en medio.
      const v = V.restar(centro, cam)
      const w = V.restar(torax, cam)
      const t = V.punto(v, w) / V.punto(v, v)
      // Solo tapa si se cruza en el primer tramo del recorrido, es decir, si
      // está más cerca de la cámara que lo que se quiere ver. El tórax al fondo
      // no estorba: en el hombro y la escápula es justo el contexto que hace
      // falta para entender contra qué se mueven.
      if (t <= 0 || t >= 0.72) continue
      const cerca = V.largo(V.restar(V.sumar(cam, V.escalar(v, t)), torax))
      // El tórax mide unos 15 cm de radio: por debajo de eso, tapa.
      expect(cerca, `${d.id}: el tórax se cruza a ${(cerca * 100).toFixed(0)} cm de la vista`).toBeGreaterThan(0.16)
    }
  })
})
