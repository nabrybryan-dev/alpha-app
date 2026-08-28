import { describe, expect, it } from 'vitest'
import { normalizarCategoria, patronDeCategoria, PATRONES, PATRON_POR_ID } from './catalogo'
import { MUSCULO_POR_ID, PORCION_POR_CLAVE } from './musculos'
import { apoyarPies, INDICE_HUESO, type Lado } from './esqueleto'
import { poseAnimada, RANGO } from './movimiento'

describe('el catálogo de patrones', () => {
  it('no repite identificadores ni categorías', () => {
    const ids = PATRONES.map((p) => p.id)
    const categorias = PATRONES.map((p) => normalizarCategoria(p.categoria))
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(categorias).size).toBe(categorias.length)
  })

  it('encuentra el patrón por la categoría del ejercicio, con tildes o sin ellas', () => {
    expect(patronDeCategoria('SENTADILLA')?.id).toBe('sentadilla')
    // La categoría la escriben personas distintas en sitios distintos: la que
    // llega del microciclo puede venir sin tilde o con espacios de más.
    expect(patronDeCategoria('  flexion de rodilla ')?.id).toBe('flexion_rodilla')
    expect(patronDeCategoria('FLEXIÓN DE RODILLA')?.id).toBe('flexion_rodilla')
  })

  it('devuelve undefined cuando la categoría no tiene patrón', () => {
    expect(patronDeCategoria(undefined)).toBeUndefined()
    expect(patronDeCategoria('')).toBeUndefined()
    expect(patronDeCategoria('ACONDICIONAMIENTO')).toBeUndefined()
    // «Aislamiento» no dice qué gesto es: sin patrón, y así debe quedarse.
    expect(patronDeCategoria('AISLAMIENTO')).toBeUndefined()
  })

  it('entiende el vocabulario viejo de categorías', () => {
    // Las categorías se consolidaron de 51 a 30 nombres, pero por los
    // microciclos y por el seed de demo siguen circulando los de antes. Sin
    // esto el botón del visor no sale en media sesión y parece roto.
    expect(patronDeCategoria('DOMINANTE DE CADERA')?.id).toBe('bisagra_cadera')
    expect(patronDeCategoria('DOMINANTE DE RODILLA')?.id).toBe('sentadilla')
    expect(patronDeCategoria('CORE')?.id).toBe('antiextension')
  })

  it('entiende también las categorías que nombran el músculo', () => {
    expect(patronDeCategoria('BÍCEPS')?.id).toBe('flexion_codo')
    expect(patronDeCategoria('Tríceps')?.id).toBe('extension_codo')
    expect(patronDeCategoria('gemelos')?.id).toBe('flexion_plantar')
    expect(patronDeCategoria('PECHO')?.id).toBe('empuje_horizontal')
  })

  it('no crea alias que apunten a un patrón inexistente', () => {
    // Un alias mal escrito no da error: simplemente deja de haber botón.
    for (const categoria of ['DOMINANTE DE CADERA', 'DOMINANTE DE RODILLA', 'CORE',
      'JALON', 'REMO', 'PECHO', 'HOMBRO', 'BICEPS', 'TRICEPS', 'GEMELOS',
      'ZANCADA', 'GLUTEO', 'ISQUIOS', 'CUADRICEPS', 'ESPALDA', 'BISAGRA',
      'ABDOMEN', 'DOMINADA', 'PANTORRILLA', 'PIERNA', 'EMPUJE',
      'CADENA POSTERIOR', 'UNILATERAL DE PIERNA']) {
      expect(patronDeCategoria(categoria), `alias huérfano: ${categoria}`).toBeDefined()
    }
  })

  it('no guarda cifras de uso: este repositorio es público', () => {
    // Si alguien añade "prescripciones" o "microciclos" a una ficha, el tamaño
    // de la operación acabaría publicado en el código sin que nadie lo decida.
    const prohibidos = ['prescripciones', 'presc', 'sesiones', 'microciclos', 'ses', 'mic']
    for (const p of PATRONES) {
      for (const clave of prohibidos) {
        expect(Object.hasOwn(p, clave), `${p.id} no debe llevar "${clave}"`).toBe(false)
      }
    }
  })

  it('cada ficha trae el material didáctico completo', () => {
    for (const p of PATRONES) {
      expect(p.titulo.length, p.id).toBeGreaterThan(3)
      expect(p.resumen.length, p.id).toBeGreaterThan(40)
      expect(p.ejemplos.length, p.id).toBeGreaterThan(5)
      expect(p.claves.length, p.id).toBeGreaterThanOrEqual(3)
      expect(p.errores.length, p.id).toBeGreaterThanOrEqual(2)
    }
  })

  it('solo activa músculos y porciones que existen', () => {
    // Escribir mal una clave no da error: la porción simplemente no se pinta y
    // el asesorado ve gris un músculo que debería estar trabajando.
    for (const p of PATRONES) {
      for (const clave of Object.keys(p.activacion)) {
        const sinLado = clave.split(':')[0]
        const existe = sinLado.includes('.')
          ? PORCION_POR_CLAVE[sinLado] !== undefined
          : MUSCULO_POR_ID[sinLado] !== undefined
        expect(existe, `${p.id} activa "${sinLado}", que no existe`).toBe(true)
      }
      // Un patrón sin agonista claro no enseña nada: siempre hay alguien al 100 %.
      const maximo = Math.max(...Object.values(p.activacion))
      expect(maximo, p.id).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('no activa un músculo entero y una porción suya en el mismo lado', () => {
    // La porción gana sobre el músculo, así que las dos claves juntas dejan una
    // de las dos sin efecto y no hay forma de saber cuál se quiso decir. En
    // lados distintos sí es legítimo: una zancada detalla la pierna que trabaja
    // y deja la otra en bloque, porque ahí solo estabiliza.
    for (const p of PATRONES) {
      const lado = (c: string) => (c.includes(':') ? c.split(':')[1] : '')
      for (const clave of Object.keys(p.activacion)) {
        const sinLado = clave.split(':')[0]
        if (!sinLado.includes('.')) continue
        const musculo = sinLado.split('.')[0]
        const choca = Object.keys(p.activacion).some(
          (otra) => otra.split(':')[0] === musculo && lado(otra) === lado(clave),
        )
        expect(choca, `${p.id} activa "${musculo}" y también "${sinLado}"`).toBe(false)
      }
    }
  })

  it('desglosa por porción donde las cabezas NO se comportan igual', () => {
    // No es un capricho de detalle: en estos patrones una porción trabaja y
    // otra no, y activar el músculo en bloque borraría justo lo que distingue
    // un ejercicio de otro. Donde las porciones sí van a la par —el curl
    // femoral carga las cuatro por igual— el bloque es lo honesto.
    const obligatorio: Record<string, string[]> = {
      sentadilla: ['cuadriceps'],
      extension_rodilla: ['cuadriceps'],
      bisagra_cadera: ['isquiotibiales'],
      extension_cadera: ['isquiotibiales', 'gluteo_mayor'],
      extension_codo: ['triceps'],
      flexion_codo: ['biceps'],
      empuje_vertical: ['triceps', 'deltoides'],
      empuje_horizontal: ['pectoral_mayor', 'triceps'],
      empuje_inclinado: ['pectoral_mayor'],
      abduccion_hombro: ['deltoides'],
      abduccion_horizontal: ['deltoides'],
      traccion_vertical: ['trapecio'],
      traccion_horizontal: ['trapecio'],
      aduccion_cadera: ['aductores'],
      flexion_plantar: ['triceps_sural'],
    }
    for (const [patron, musculos] of Object.entries(obligatorio)) {
      const p = PATRON_POR_ID[patron]
      expect(p, `no existe el patrón ${patron}`).toBeDefined()
      const claves = Object.keys(p.activacion).map((c) => c.split(':')[0])
      for (const musculo of musculos) {
        const desglosado = claves.some((c) => c.startsWith(`${musculo}.`))
        expect(desglosado, `${patron}: "${musculo}" tiene que ir por porciones`).toBe(true)
      }
    }
  })

  it('usa lados válidos en la activación unilateral', () => {
    for (const p of PATRONES) {
      for (const clave of Object.keys(p.activacion)) {
        if (!clave.includes(':')) continue
        expect(['D', 'I'], `${p.id}: ${clave}`).toContain(clave.split(':')[1])
      }
    }
  })

  it('sigue un hueso que existe en el esqueleto', () => {
    for (const p of PATRONES) {
      if (!p.seguimiento) continue
      const [hueso] = p.seguimiento
      const existe = INDICE_HUESO[hueso + 'D'] !== undefined || INDICE_HUESO[hueso] !== undefined
      expect(existe, `${p.id} sigue "${hueso}"`).toBe(true)
    }
  })

  it('escribe las poses solo en canales conocidos y dentro del rango', () => {
    for (const p of PATRONES) {
      const poses = [p.inicio, p.fin, ...(p.medio ? [p.medio] : [])]
      for (const pose of poses) {
        for (const [canal, valor] of Object.entries(pose)) {
          const raiz = canal.replace(/[DI]$/, '')
          const rango = RANGO[raiz]
          expect(rango, `${p.id}: canal desconocido "${canal}"`).toBeDefined()
          expect(valor, `${p.id}: ${canal}=${valor}`).toBeGreaterThanOrEqual(rango[0])
          expect(valor, `${p.id}: ${canal}=${valor}`).toBeLessThanOrEqual(rango[1])
        }
      }
    }
  })

  it('mueve algo de verdad en cada patrón', () => {
    for (const p of PATRONES) {
      const canales = new Set([...Object.keys(p.inicio), ...Object.keys(p.fin)])
      let mayor = 0
      for (const c of canales) {
        mayor = Math.max(mayor, Math.abs((p.fin[c] ?? 0) - (p.inicio[c] ?? 0)))
      }
      const giroInicio = p.giroInicio ?? p.giro ?? [0, 0, 0]
      const giroFin = p.giroFin ?? p.giro ?? [0, 0, 0]
      const giro = Math.abs(giroFin[0] - giroInicio[0])
      // Un recorrido corto no se lee: o hay ángulo articular o hay giro de pelvis.
      expect(Math.max(mayor, giro), `${p.id} apenas se mueve`).toBeGreaterThan(25)
    }
  })

  it('indexa por id sin perder ninguno', () => {
    expect(Object.keys(PATRON_POR_ID)).toHaveLength(PATRONES.length)
  })
})

describe('la movilidad que los patrones dan por supuesta', () => {
  /**
   * El apoyo plantar calcula el ángulo de tobillo DESPUÉS de que se apliquen
   * los topes, para que la planta quede horizontal pase lo que pase. Eso está
   * bien —si no, los pies se clavarían o flotarían—, pero tiene una
   * consecuencia: un patrón puede exigir más recorrido del que la articulación
   * tiene y nadie se entera.
   *
   * Con la dorsiflexión en sus 20° estándar, cinco patrones piden más. No es
   * necesariamente un fallo: una sentadilla profunda de verdad exige movilidad
   * que no todo el mundo tiene, y por eso el déficit de tobillo es lo primero
   * que se mira cuando alguien no baja. Pero conviene que esté medido y no
   * crezca solo, así que esto fija el estado de hoy como techo.
   */
  const TECHO_DE_DORSIFLEXION: Record<string, number> = {
    sentadilla_unilateral: 34,
    traccion_horizontal: 31,
    abduccion_horizontal: 29,
    sentadilla: 29,
    bisagra_cadera: 24,
  }

  it('no pide más tobillo del que ya pedía', () => {
    const tope = Math.abs(RANGO['tobilloPlantar'][0])
    for (const p of PATRONES) {
      const pies: Lado[] = p.pies ?? (p.apoyo === 'suelo' ? ['D', 'I'] : [])
      if (!pies.length) continue
      let peor = 0
      for (let i = 0; i <= 20; i++) {
        const { pose, desplazamiento, giroRaiz } = poseAnimada(p, i / 20, 1, 0)
        const r = apoyarPies(pose, desplazamiento, giroRaiz, pies)
        for (const c of ['tobilloPlantarD', 'tobilloPlantarI'])
          if (r[c] !== undefined && r[c] < peor) peor = r[c]
      }
      const pedido = Math.abs(peor)
      const permitido = TECHO_DE_DORSIFLEXION[p.id] ?? tope
      expect(
        pedido,
        `${p.id} pide ${pedido.toFixed(1)}° de dorsiflexión y el tope es ${permitido}°`,
      ).toBeLessThanOrEqual(permitido)
    }
  })
})
