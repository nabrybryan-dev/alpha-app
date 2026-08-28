import { describe, expect, it } from 'vitest'
import { normalizarCategoria, patronDeCategoria, PATRONES, PATRON_POR_ID, type Patron } from './catalogo'
import { MUSCULO_POR_ID, PORCION_POR_CLAVE } from './musculos'
import { apoyarPies, INDICE_HUESO, puntoDeHueso, resolverConApoyo, type Lado } from './esqueleto'
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
   * La dorsiflexión que se acaba pidiendo es una suma de ángulos:
   *
   *     giro de la raíz − flexión de cadera + flexión de rodilla
   *
   * Con eso se vio que el remo y el pájaro pedían 30° y 29° por repartir mal la
   * inclinación: la ponía la rodilla en vez de la cadera, y la tibia acababa a
   * 30° de la vertical cuando en esos ejercicios va casi recta. Se repartió, y
   * ahora caben.
   *
   * Las dos sentadillas siguen pasándose, y ahí no es un fallo: bajar del todo
   * exige movilidad que no todo el mundo tiene, y por eso el déficit de tobillo
   * es lo primero que se mira cuando alguien no baja. Queda medido para que no
   * crezca solo.
   */
  const TECHO_DE_DORSIFLEXION: Record<string, number> = {
    sentadilla_unilateral: 34,
    sentadilla: 29,
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

describe('la cobertura sobre los ejercicios de verdad', () => {
  /**
   * Muestra de categorías y nombres tomada de los microciclos reales el
   * 2026-08-28: 2.702 ejercicios en 30 categorías. Aquí van los casos que
   * deciden, con la forma en que están escritos allí —mayúsculas irregulares,
   * paréntesis y todo—, porque es justo lo que rompe un emparejado ingenuo.
   *
   * Sin datos de nadie: solo el texto de la categoría y el del ejercicio.
   */
  const REALES: [string, string, boolean][] = [
    // Categoría que ya nombra el gesto: manda ella.
    ['EXTENSIÓN DE CADERA', 'Hip thrust en barra', true],
    ['ABDUCCIÓN HORIZONTAL', 'Pájaro con mancuernas', true],
    ['EXTENSIÓN DE HOMBRO', 'Pullover en polea', true],
    ['ANTIRROTACIÓN', 'Pallof press de rodillas', true],
    ['RETRACCIÓN ESCAPULAR', 'Band pull apart', true],
    ['APERTURA DE PECHO', 'Aperturas en banco plano', true],
    ['ANTIFLEXIÓN LATERAL', 'Paseo del granjero a una mano', true],
    ['DORSIFLEXIÓN', 'TIBIALIS RAISE (ESPALDA CONTRA PARED)', true],
    ['FLEXIÓN DE TRONCO', 'CRUNCH EN POLEA ARRODILLADO', true],
    // Categoría que dice para qué sirve: decide el nombre.
    ['PREV/REHAB', 'Rotación externa de hombro en polea (manguito rotador)', true],
    ['PREV/REHAB', 'CONTROL ESCAPULAR + ROTACIÓN EXTERNA', true],
    ['PREV/REHAB', 'Saltos cortos de tobillo (pogo jumps) a peso corporal', true],
    ['PREV/REHAB', 'Dead hang activo en barra', true],
    ['PREV/REHAB', 'Apoyo monopodal con alcance (descalza)', true],
    ['PREV/REHAB', 'ACTIVACIÓN GLÚTEA PREVIA', true],
    ['PREV/REHAB', 'Copenhague', true],
    ['PREV/REHAB', 'Bird-dog lento', true],
    ['PREV/REHAB', 'Isométrico de gemelo con talón colgando', true],
    ['POTENCIA · REACTIVA', 'Salto al cajón con bajada caminando', true],
    ['POTENCIA · REACTIVA', 'Lanzamiento de balón medicinal contra pared', true],
    ['MOVILIDAD', 'Movilidad torácica con foam roller (movilidad de columna)', true],
    ['MOVILIDAD', 'Gato-camello', true],
    // Y lo que no debe tener patrón, que es tan importante como lo que sí.
    ['ACONDICIONAMIENTO', 'ZONA 2 — 20 min en cinta o elíptica', false],
    ['ACONDICIONAMIENTO', 'Rodada larga en bicicleta (sábado)', false],
    ['ACONDICIONAMIENTO', 'Circuito metabólico 40/20', false],
    ['PREV/REHAB', 'Cribado de banderas rojas (antes de tocar una carga)', false],
  ]

  it('encuentra patrón para cada ejercicio que lo tiene', () => {
    for (const [categoria, nombre, esperado] of REALES) {
      const patron = patronDeCategoria(categoria, nombre)
      expect(patron !== undefined, `${categoria} · ${nombre}`).toBe(esperado)
    }
  })

  it('no enseña un gesto de fuerza para el cardio', () => {
    // Peor que no tener visor es tener uno que enseñe otra cosa: quien monta en
    // bicicleta no está haciendo ninguno de los treinta y un patrones.
    expect(patronDeCategoria('ACONDICIONAMIENTO', 'Bicicleta (cardio)')).toBeUndefined()
  })

  it('la categoría manda sobre el nombre cuando dice el gesto', () => {
    // El nombre lo escribe el coach a mano y admite cualquier cosa; la categoría
    // es vocabulario cerrado. Un remo llamado «salto del tigre» sigue siendo un
    // remo.
    expect(patronDeCategoria('TRACCIÓN HORIZONTAL', 'Salto del tigre')?.id).toBe(
      'traccion_horizontal',
    )
  })
})

describe('hacia dónde se mueve el cuerpo en cada patrón', () => {
  /** Dónde queda cada punto respecto al tobillo, en centímetros. +Z va delante. */
  const respectoAlTobillo = (patron: Patron, fase: number) => {
    const pies: Lado[] = patron.pies ?? (patron.apoyo === 'suelo' ? ['D', 'I'] : [])
    const { pose, desplazamiento, giroRaiz } = poseAnimada(patron, fase, 1, 0)
    const esq = resolverConApoyo(pose, desplazamiento, giroRaiz, patron.apoyo, patron.alturaApoyo, pies)
    const z = (h: string, t: number) => puntoDeHueso(esq, h, t)[2] * 100
    const tobillo = z('tibiaD', 1)
    return { cadera: z('pelvis', 0) - tobillo, rodilla: z('musloD', 1) - tobillo }
  }

  it('lleva la cadera ATRÁS en la bisagra', () => {
    // Es lo que define el gesto y lo que lo separa de agacharse: la cadera se
    // echa atrás y el tronco baja por consecuencia. Estaba al revés —la cadera
    // acababa 15 cm por DELANTE del tobillo—, así que el sujeto se doblaba hacia
    // adelante como quien recoge algo del suelo, que es justo lo que no se
    // quiere enseñar.
    const p = PATRON_POR_ID['bisagra_cadera']
    const arriba = respectoAlTobillo(p, 0)
    const abajo = respectoAlTobillo(p, 1)
    expect(abajo.cadera, 'la cadera no retrocede').toBeLessThan(arriba.cadera - 8)
    // Y la tibia se queda vertical: la rodilla no se adelanta.
    expect(Math.abs(abajo.rodilla), 'la rodilla se adelanta').toBeLessThan(5)
  })

  it('lleva la cadera atrás Y la rodilla adelante en la sentadilla', () => {
    // Aquí sí se adelanta la rodilla: es lo que distingue una sentadilla de una
    // bisagra, y por eso una carga el cuádriceps y la otra los isquios.
    const p = PATRON_POR_ID['sentadilla']
    const arriba = respectoAlTobillo(p, 0)
    const abajo = respectoAlTobillo(p, 1)
    expect(abajo.cadera).toBeLessThan(arriba.cadera - 15)
    expect(abajo.rodilla).toBeGreaterThan(arriba.rodilla + 8)
  })

  it('separa la bisagra de la sentadilla por dónde va la rodilla', () => {
    // Si las dos adelantaran la rodilla, el visor estaría enseñando el mismo
    // gesto dos veces con nombres distintos.
    const bisagra = respectoAlTobillo(PATRON_POR_ID['bisagra_cadera'], 1)
    const sentadilla = respectoAlTobillo(PATRON_POR_ID['sentadilla'], 1)
    expect(sentadilla.rodilla - bisagra.rodilla).toBeGreaterThan(12)
  })
})
