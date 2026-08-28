import { describe, expect, it } from 'vitest'
import {
  aportesDeCategoria,
  CATEGORIAS,
  grupoPrimario,
  ORDEN_GRUPOS,
  type Categoria,
} from '../taxonomia'
import { REGLAS_DE_EJE } from './reglas'
import {
  EJES_DERIVADOS,
  IMPLEMENTOS,
  MODELOS_DE_PALANCA,
  ejePrincipal,
  esUnilateral,
  implementoDe,
  modeloDePalanca,
  planDeMedida,
  type Articulacion,
  type ModeloDePalanca,
} from './palancas'

/** Los tres que no son mecánica de palanca, igual que no suman volumen. */
const SIN_MODELO: readonly Categoria[] = ['PREV/REHAB', 'ACONDICIONAMIENTO', 'MOVILIDAD']

const conModelo = CATEGORIAS.filter((c) => !SIN_MODELO.includes(c))

function modelo(categoria: Categoria): ModeloDePalanca {
  const m = MODELOS_DE_PALANCA[categoria]
  if (!m) throw new Error(`sin modelo: ${categoria}`)
  return m
}

describe('cobertura de la matriz', () => {
  it('los 34 patrones de la taxonomía tienen entrada', () => {
    for (const categoria of CATEGORIAS) {
      expect(MODELOS_DE_PALANCA).toHaveProperty(categoria)
    }
  })

  it('los únicos sin modelo son los tres que tampoco suman volumen', () => {
    const nulos = CATEGORIAS.filter((c) => MODELOS_DE_PALANCA[c] === null)
    expect([...nulos].sort()).toEqual([...SIN_MODELO].sort())
  })

  it('un patrón sin modelo no devuelve uno inventado', () => {
    for (const categoria of SIN_MODELO) {
      expect(modeloDePalanca(categoria)).toBeUndefined()
      expect(planDeMedida(categoria)).toBeUndefined()
    }
  })

  it('una categoría que no existe devuelve undefined, no el modelo por defecto', () => {
    expect(modeloDePalanca('GLÚTEO FINISHER')).toBeUndefined()
  })
})

describe('invariantes de cada modelo', () => {
  it('todos tienen al menos un eje principal', () => {
    for (const categoria of conModelo) {
      const principales = modelo(categoria).ejes.filter((e) => e.protagonismo === 'principal')
      expect(principales.length, categoria).toBeGreaterThan(0)
    }
  })

  it('un eje principal siempre declara qué músculo genera su momento', () => {
    for (const categoria of conModelo) {
      for (const eje of modelo(categoria).ejes) {
        if (eje.protagonismo !== 'principal') continue
        // O un grupo del PANEL, o el nombre del músculo que no tiene grupo. Lo
        // que no vale es dejarlo en blanco: la muñeca y la dorsiflexión existen.
        const declarado = eje.motores.length > 0 || (eje.motorSinGrupo ?? '').length > 0
        expect(declarado, `${categoria} · ${eje.articulacion}`).toBe(true)
      }
    }
  })

  /**
   * El error que esto caza ya ocurrió: la DORSIFLEXIÓN declaró `Pantorrillas`
   * —su ANTAGONISTA— hasta el 2026-08-27, y ningún test lo vio. Podía pasar
   * porque el grupo existe y la taxonomía había dejado de acreditarle volumen,
   * así que la comprobación que cruzaba las dos tablas se saltaba esa fila
   * entera. Cuando la taxonomía no le da grupo a un patrón, el eje que manda
   * tiene que decir el músculo por su nombre y no coger el grupo más cercano.
   */
  it('un patrón sin grupo en la taxonomía no se inventa uno en el eje que manda', () => {
    for (const categoria of conModelo) {
      if (aportesDeCategoria(categoria).length > 0) continue
      for (const eje of modelo(categoria).ejes) {
        if (eje.protagonismo !== 'principal') continue
        expect(eje.motores, `${categoria} · ${eje.articulacion}`).toEqual([])
        expect(eje.motorSinGrupo, `${categoria} · ${eje.articulacion}`).toBeTruthy()
      }
    }
  })

  it('los motores son grupos de la taxonomía, no nombres sueltos', () => {
    for (const categoria of conModelo) {
      for (const eje of modelo(categoria).ejes) {
        for (const grupo of eje.motores) {
          expect(ORDEN_GRUPOS, `${categoria} · ${eje.articulacion}`).toContain(grupo)
        }
      }
    }
  })

  /**
   * El puente con `taxonomia.ts`. Si el patrón acredita volumen directo a un
   * grupo, ese grupo tiene que aparecer generando momento en algún eje: si no,
   * una de las dos tablas está mintiendo y no hay forma de saber cuál.
   */
  it('el grupo que cobra el trabajo directo aparece moviendo algún eje', () => {
    for (const categoria of conModelo) {
      const primario = grupoPrimario(categoria)
      if (!primario) continue
      const motores = new Set(modelo(categoria).ejes.flatMap((e) => e.motores))
      expect([...motores], categoria).toContain(primario)
    }
  })

  it('cada eje o se marca en la piel o se deriva de marcas que sí están', () => {
    for (const categoria of conModelo) {
      const m = modelo(categoria)
      const marcas = new Set<Articulacion>(m.marcas)
      for (const eje of m.ejes) {
        if (marcas.has(eje.articulacion)) continue
        const origen = EJES_DERIVADOS[eje.articulacion]
        expect(origen, `${categoria} · ${eje.articulacion} no se marca ni se deriva`).toBeDefined()
        for (const necesaria of origen ?? []) {
          expect(marcas, `${categoria} · deriva ${eje.articulacion}`).toContain(necesaria)
        }
      }
    }
  })

  it('un brazo interno es un rango creciente y en milímetros plausibles', () => {
    for (const categoria of conModelo) {
      for (const eje of modelo(categoria).ejes) {
        const [min, max] = eje.brazoInternoMm
        expect(min, `${categoria} · ${eje.articulacion}`).toBeLessThan(max)
        expect(min).toBeGreaterThanOrEqual(10)
        expect(max).toBeLessThanOrEqual(80)
      }
    }
  })

  it('la cámara se planta donde se ve el eje que manda', () => {
    for (const categoria of conModelo) {
      const m = modelo(categoria)
      const principales = m.ejes.filter((e) => e.protagonismo === 'principal')
      // Si ni el eje principal se ve desde ahí, la vista elegida está mal.
      expect(principales.some((e) => e.vista === m.vista), categoria).toBe(true)
    }
  })

  it('todos dicen qué tiene que quedar alineado y con cuánta tolerancia', () => {
    for (const categoria of conModelo) {
      const { alineacion } = modelo(categoria)
      expect(alineacion.regla.length, categoria).toBeGreaterThan(0)
      expect(alineacion.porQue.length, categoria).toBeGreaterThan(0)
      // Por debajo de 15 mm el ruido de la propia medida manda sobre el consejo.
      expect(alineacion.toleranciaMm, categoria).toBeGreaterThanOrEqual(15)
    }
  })
})

describe('lo que cada eje tiene que hacer para que el protagonista trabaje', () => {
  /**
   * El caso que enseña la idea: en un peso muerto la rodilla no «acompaña».
   * Colocada en vertical sobre el tobillo no tiene brazo, no se queda nada, y
   * toda la exigencia sigue hasta la cadera. Adelantada, una parte se va al
   * cuádriceps y la bisagra deja de estimular lo que se prescribió.
   */
  it('la rodilla del peso muerto se neutraliza para que la carga llegue a la cadera', () => {
    const plan = planDeMedida('BISAGRA DE CADERA', 'PESO MUERTO RUMANO')
    expect(plan?.ejeObjetivo).toBe('cadera')

    const rodilla = plan?.ejes.find((e) => e.articulacion === 'rodilla')
    expect(rodilla?.regla?.tipo).toBe('neutralizar')
    expect(rodilla?.regla?.regla).toContain('tobillo')
  })

  it('el codo del curl se congela: el recorrido es del codo, no del hombro', () => {
    const hombro = planDeMedida('FLEXIÓN DE CODO')?.ejes.find((e) => e.articulacion === 'hombro')
    expect(hombro?.regla?.tipo).toBe('neutralizar')
    expect(planDeMedida('FLEXIÓN DE CODO')?.ejeObjetivo).toBe('codo')
  })

  it('ningún eje protagonista lleva regla: es al que se le manda la carga, no el que se aparta', () => {
    for (const categoria of conModelo) {
      for (const eje of modelo(categoria).ejes) {
        if (eje.protagonismo !== 'principal') continue
        const regla = REGLAS_DE_EJE[categoria]?.[eje.articulacion]
        // Salvo cuando ese eje es principal Y hay que sostenerlo quieto: la
        // lumbar de la bisagra manda y aun así se congela.
        if (regla) expect(regla.tipo, `${categoria} · ${eje.articulacion}`).toBe('congelar')
      }
    }
  })

  it('toda regla apunta a un eje que existe en su patrón', () => {
    for (const [categoria, reglas] of Object.entries(REGLAS_DE_EJE)) {
      const m = MODELOS_DE_PALANCA[categoria as Categoria]
      expect(m, categoria).not.toBeNull()
      const articulaciones = new Set(m?.ejes.map((e) => e.articulacion))
      for (const articulacion of Object.keys(reglas ?? {})) {
        expect(articulaciones, `${categoria} · ${articulacion}`).toContain(articulacion)
      }
    }
  })

  it('cada regla dice qué hacer, cuánto se tolera y por qué', () => {
    for (const reglas of Object.values(REGLAS_DE_EJE)) {
      for (const [articulacion, regla] of Object.entries(reglas ?? {})) {
        expect(regla.regla.length, articulacion).toBeGreaterThan(0)
        expect(regla.porQue.length, articulacion).toBeGreaterThan(0)
        expect(regla.toleranciaMm, articulacion).toBeGreaterThanOrEqual(15)
      }
    }
  })
})

describe('la línea de fuerza', () => {
  it('lo que mueve el propio cuerpo no se mide desde la carga externa', () => {
    // No hay barra que seguir: la línea sale del centro de masas o no sale.
    expect(modelo('ANTIEXTENSIÓN').linea.origen).toBe('centro-de-masas')
    expect(modeloDePalanca('TRACCIÓN VERTICAL', 'DOMINADA LASTRADA')?.linea.origen).toBe(
      'centro-de-masas',
    )
    expect(modeloDePalanca('EMPUJE HORIZONTAL', 'FONDOS EN PARALELAS')?.linea.origen).toBe(
      'centro-de-masas',
    )
  })

  it('lo que va en máquina o polea no se mide contra la vertical', () => {
    expect(modelo('EXTENSIÓN DE RODILLA').linea.origen).toBe('cable')
    expect(modelo('TRACCIÓN VERTICAL').linea.origen).toBe('cable')
  })
})

describe('la variante cambia el modelo, no solo el reparto', () => {
  /**
   * El caso que motiva todo el mecanismo: una dominada y un jalón son el mismo
   * patrón en la taxonomía y modelos mecánicos opuestos. Si la variante no
   * mandara, la dominada se mediría contra un cable que no existe.
   */
  it('una dominada no es un jalón invertido', () => {
    const jalon = modeloDePalanca('TRACCIÓN VERTICAL', 'JALÓN AL PECHO')
    const dominada = modeloDePalanca('TRACCIÓN VERTICAL', 'DOMINADA PRONA')

    expect(jalon?.cadena).toBe('abierta')
    expect(dominada?.cadena).toBe('cerrada')
    expect(jalon?.linea.origen).not.toBe(dominada?.linea.origen)
    expect(dominada?.variante).toBe('DOMINADA')
  })

  it('sin variante declarada manda el modelo del patrón', () => {
    expect(modeloDePalanca('TRACCIÓN VERTICAL')?.variante).toBeUndefined()
  })

  it('la variante se reconoce con acentos y en minúsculas', () => {
    expect(modeloDePalanca('SENTADILLA UNILATERAL', 'búlgara (torso inclinado)')?.variante).toBe(
      'TORSO INCLINADO',
    )
  })

  it('la carga delante cambia el consejo de alineación, no el eje', () => {
    const trasera = modeloDePalanca('SENTADILLA', 'SENTADILLA TRASERA')
    const frontal = modeloDePalanca('SENTADILLA', 'SENTADILLA FRONTAL')
    expect(frontal?.variante).toBe('CARGA DELANTE')
    expect(frontal?.ejes).toEqual(trasera?.ejes)
    expect(frontal?.alineacion.regla).not.toBe(trasera?.alineacion.regla)
  })
})

describe('planDeMedida', () => {
  it('ordena los ejes con los principales delante', () => {
    const plan = planDeMedida('SENTADILLA')
    expect(plan?.ejes.map((e) => e.protagonismo)).toEqual([
      'principal',
      'principal',
      'secundario',
      'estabilizador',
    ])
  })

  it('avisa cuando el brazo no sale de la distancia horizontal', () => {
    // Hombros en el banco y pies en el suelo: la carga se reparte entre dos
    // apoyos y la regla de la horizontal deja de valer.
    expect(planDeMedida('EXTENSIÓN DE CADERA')?.necesitaRepartoDeApoyos).toBe(true)
    expect(planDeMedida('SENTADILLA')?.necesitaRepartoDeApoyos).toBe(false)
  })

  it('dice qué no puede medir la cámara donde está, en vez de callarlo', () => {
    // La antirrotación de un Pallof es isométrica y transversa: de lado no se
    // ve, así que la vista que se pide es otra. Decirlo es el producto.
    expect(planDeMedida('ANTIRROTACIÓN')?.vista).toBe('cenital')

    // Y la caída de pelvis de una búlgara ocurre en el plano frontal: ahí la
    // vista principal sigue siendo lateral y lo que se avisa es el eje suelto.
    const bulgara = planDeMedida('SENTADILLA UNILATERAL')
    expect(bulgara?.vista).toBe('lateral')
    expect(bulgara?.fueraDeVista.join(' ')).toContain('cadera')
  })

  it('un patrón que se ve entero desde su vista no inventa avisos', () => {
    expect(planDeMedida('EXTENSIÓN DE RODILLA')?.fueraDeVista).toEqual([])
    // La elevación lateral se graba de frente, y entonces sí se ve entera.
    expect(planDeMedida('ABDUCCIÓN DE HOMBRO')?.vista).toBe('frontal')
    expect(planDeMedida('ABDUCCIÓN DE HOMBRO')?.fueraDeVista).toEqual([])
  })

  it('nombra el músculo, no solo la articulación', () => {
    // «rodilla» no es un consejo; «cuádriceps» sí. Y sale de la taxonomía, que
    // es donde ya estaba decidido quién cobra el trabajo directo.
    expect(planDeMedida('SENTADILLA')?.grupoObjetivo).toBe('Cuádriceps')
    expect(planDeMedida('BISAGRA DE CADERA')?.grupoObjetivo).toBe('Isquios')
    // La variante manda también aquí: la búlgara con torso inclinado es aductor.
    expect(planDeMedida('SENTADILLA UNILATERAL', 'BÚLGARA (TORSO INCLINADO)')?.grupoObjetivo).toBe(
      'Aductores',
    )
  })

  it('pide las marcas del modelo, sin quitar ninguna', () => {
    expect(planDeMedida('SENTADILLA')?.marcas).toEqual(modelo('SENTADILLA').marcas)
  })
})

describe('ejePrincipal', () => {
  it('la sentadilla se mide primero en la rodilla', () => {
    expect(ejePrincipal('SENTADILLA')).toBe('rodilla')
  })

  it('la bisagra se mide primero en la cadera', () => {
    expect(ejePrincipal('BISAGRA DE CADERA')).toBe('cadera')
  })

  it('un patrón sin modelo no devuelve eje', () => {
    expect(ejePrincipal('MOVILIDAD')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// El implemento
// ─────────────────────────────────────────────────────────────────────────────
//
// Los nombres de esta sección salen del catálogo de 168 vídeos reales
// (`Cerebro Alpha/herramientas/encoder-camara/banco/corpus-gimnasio.tsv`), no
// están inventados: son los ejercicios que de verdad llegan.

describe('el implemento declarado en el nombre', () => {
  it('lo detecta en los ejercicios que trae el corpus', () => {
    expect(implementoDe('PESO MUERTO CON BARRA')).toBe('barra')
    expect(implementoDe('PESO MUERTO RUMANO CON MANCUERNAS')).toBe('mancuernas')
    expect(implementoDe('SENTADILLA EN SMITH')).toBe('guiado-vertical')
    expect(implementoDe('PRENSA DE PIERNAS 45')).toBe('guiado-inclinado')
    expect(implementoDe('JALON AL PECHO EN POLEA')).toBe('polea')
    expect(implementoDe('ZANCADA BULGARA CON DISCO')).toBe('disco')
    expect(implementoDe('CURL FEMORAL EN MAQUINA')).toBe('maquina')
  })

  it('lo específico gana a lo general', () => {
    expect(implementoDe('PATADA DE GLUTEO EN POLEA CON TOBILLERA')).toBe('polea-tobillera')
    expect(implementoDe('SENTADILLA EN SMITH CON BARRA')).toBe('guiado-vertical')
  })

  it('unilateral NO es un implemento: es ortogonal', () => {
    // El fallo que cazó el corpus la primera vez que se corrió esta tabla: con
    // «unilateral» dentro de la detección de implemento, un jalón en polea
    // salía clasificado como mancuerna y se perdía la línea de cable.
    expect(implementoDe('JALON UNILATERAL EN POLEA')).toBe('polea')
    expect(implementoDe('PRESS UNILATERAL DE HOMBRO CON BARRA')).toBe('barra')
    expect(implementoDe('REMO CON MANCUERNA A UNA MANO')).toBe('mancuernas')

    expect(esUnilateral('JALON UNILATERAL EN POLEA')).toBe(true)
    expect(esUnilateral('REMO CON MANCUERNA A UNA MANO')).toBe(true)
    expect(esUnilateral('PESO MUERTO CON BARRA')).toBe(false)
  })

  it('un nombre que no declara implemento devuelve undefined, no barra', () => {
    // No saber y suponer barra no es lo mismo: es por donde entraría un Smith
    // con el modelo equivocado.
    expect(implementoDe('PESO MUERTO')).toBeUndefined()
    expect(implementoDe('')).toBeUndefined()
  })

  it('los acentos y las minúsculas no lo despistan', () => {
    expect(implementoDe('prensa de piernas')).toBe('guiado-inclinado')
    expect(implementoDe('Jalón al pecho')).toBe('polea')
  })
})

describe('lo que el implemento le hace al plan', () => {
  it('un raíl le quita al brazo su significado, y el plan lo dice', () => {
    const smith = planDeMedida('SENTADILLA', 'SENTADILLA EN SMITH')
    expect(smith?.implemento).toBe('guiado-vertical')
    expect(smith?.brazoPorDistanciaHorizontal).toBe(false)
    expect(smith?.limites.length).toBeGreaterThan(0)

    // El mismo patrón con barra libre sí conserva la regla.
    const libre = planDeMedida('SENTADILLA', 'SENTADILLA CON BARRA')
    expect(libre?.brazoPorDistanciaHorizontal).toBe(true)
    expect(libre?.limites).toEqual([])
  })

  it('una carga a un lado pide un plano que la vista del patrón no da', () => {
    const unaMano = planDeMedida('TRACCIÓN HORIZONTAL', 'REMO CON MANCUERNA A UNA MANO')
    expect(unaMano?.unilateral).toBe(true)
    expect(unaMano?.vista).toBe('lateral')
    expect(unaMano?.fueraDeVista.some((t) => t.includes('frontal'))).toBe(true)
    expect(unaMano?.limites.some((t) => t.includes('plano sagital'))).toBe(true)
  })

  it('y lo pide venga la carga de donde venga, no solo de una mancuerna', () => {
    // El mismo problema mecánico con tres implementos distintos.
    for (const nombre of [
      'REMO CON MANCUERNA A UNA MANO',
      'JALON UNILATERAL EN POLEA',
      'PRESS UNILATERAL DE HOMBRO CON BARRA',
    ]) {
      const plan = planDeMedida('TRACCIÓN HORIZONTAL', nombre)
      expect(plan?.unilateral, nombre).toBe(true)
      expect(plan?.fueraDeVista.some((t) => t.includes('frontal')), nombre).toBe(true)
    }
  })

  it('y un jalón unilateral en polea sigue midiéndose contra el cable', () => {
    const plan = planDeMedida('TRACCIÓN VERTICAL', 'JALON UNILATERAL EN POLEA')
    expect(plan?.implemento).toBe('polea')
    expect(plan?.linea.origen).toBe('cable')
    expect(plan?.unilateral).toBe(true)
  })

  it('la polea manda sobre el origen de la línea que declara el patrón', () => {
    const conBarra = planDeMedida('EXTENSIÓN DE CADERA', 'HIP THRUST CON BARRA')
    expect(conBarra?.linea.origen).toBe('carga-externa')

    const conPolea = planDeMedida('EXTENSIÓN DE CADERA', 'PATADA DE GLUTEO EN POLEA CON TOBILLERA')
    expect(conPolea?.linea.origen).toBe('cable')
  })

  it('una carga que entra por el tobillo añade esa marca', () => {
    const plan = planDeMedida('EXTENSIÓN DE CADERA', 'PATADA DE GLUTEO EN POLEA CON TOBILLERA')
    expect(plan?.marcas).toContain('tobillo')
    expect(plan?.perfilDeImplemento?.aplicacion).toBe('tobillo')
  })

  it('sin implemento declarado el plan no inventa limites', () => {
    const plan = planDeMedida('BISAGRA DE CADERA')
    expect(plan?.implemento).toBeUndefined()
    expect(plan?.limites).toEqual([])
    expect(plan?.brazoPorDistanciaHorizontal).toBe(true)
  })
})

describe('coherencia de la tabla de implementos', () => {
  it('todo implemento que rompe la regla de la distancia horizontal dice por qué', () => {
    // Es la invariante que evita el peor fallo posible: apagar la medida sin
    // decírselo a nadie.
    for (const [clave, perfil] of Object.entries(IMPLEMENTOS)) {
      if (!perfil.distanciaHorizontalVale) {
        expect(perfil.limite, `${clave} apaga el brazo y no explica el límite`).toBeTruthy()
      }
    }
  })

  it('dos cargas solo las tienen las mancuernas bilaterales', () => {
    const conDos = Object.entries(IMPLEMENTOS).filter(([, p]) => p.cargas === 2)
    expect(conDos.map(([k]) => k)).toEqual(['mancuernas'])
  })

  it('todo perfil explica su porqué', () => {
    for (const [clave, perfil] of Object.entries(IMPLEMENTOS)) {
      expect(perfil.porQue.length, `${clave} sin porQue`).toBeGreaterThan(40)
    }
  })
})
