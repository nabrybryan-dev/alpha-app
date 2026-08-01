import { describe, expect, it } from 'vitest'
import {
  ESTADOS_PESABLES,
  elegir,
  familia,
  hayQuePreguntar,
  variantes,
  variantesPesables,
  type AlimentoCatalogo,
} from './estado'

// Es la regla que más error evita del sistema: confundirlos vale entre x2,3
// y x3,3 -la lenteja pasa de 387 a 116 kcal-, más que cualquier otro error
// del registro.

const CATALOGO: AlimentoCatalogo[] = [
  { id: 'arroz-blanco-crudo', nombre: 'Arroz blanco, crudo', estado: 'crudo' },
  { id: 'arroz-blanco-cocido', nombre: 'Arroz blanco, cocido', estado: 'cocido' },
  { id: 'lechuga-cruda', nombre: 'Lechuga común, cruda', estado: 'crudo' },
  { id: 'pan-tajado', nombre: 'Pan tajado', estado: 'listo' },
]

describe('familia', () => {
  it('el mismo alimento en dos estados es una familia', () => {
    expect(familia('Arroz blanco, crudo')).toBe(familia('Arroz blanco, cocido'))
  })

  it('dos alimentos distintos no lo son', () => {
    expect(familia('Arroz blanco, crudo')).not.toBe(familia('Lechuga común, cruda'))
  })

  it('ignora las coletillas de sal', () => {
    expect(familia('Res, lomo, cocido, sin sal')).toBe(familia('Res, lomo, cocido, con sal'))
  })

  // Las siguientes protegen coletillas que COLETILLAS declara pero que
  // ningún otro test toca: se puede borrar cualquiera de estas palabras del
  // set y el resto de tests sigue en verde.

  it('seco es una coletilla', () => {
    expect(familia('Frijol rojo, seco')).toBe(familia('Frijol rojo, crudo'))
  })

  it('asado es una coletilla', () => {
    expect(familia('Pollo, asado')).toBe(familia('Pollo, crudo'))
  })

  it('frito es una coletilla', () => {
    expect(familia('Plátano, frito')).toBe(familia('Plátano, crudo'))
  })

  it('horneado es una coletilla', () => {
    expect(familia('Pan, horneado')).toBe(familia('Pan, crudo'))
  })

  it('dorado es una coletilla', () => {
    expect(familia('Papa, dorada')).toBe(familia('Papa, cruda'))
  })

  it('cocida es una coletilla', () => {
    // A diferencia de "Quinua, cocida" en el bloque de elegir -que pasa
    // igual si "cocida" se deja de reconocer, porque quinua no está en el
    // catálogo de todas formas- esta comparación sí depende de que se
    // reconozca.
    expect(familia('Yuca, cocida')).toBe(familia('Yuca, cruda'))
  })

  // Los siguientes cinco protegen el hallazgo real contra el catálogo de
  // 1.195 alimentos: comparar por SUBCADENA en vez de por palabra completa
  // corrompe nombres reales. No es teoría: "Cheesecake" ya vive en el
  // catálogo y ya se corrompía.

  it('cheesecake no pierde su nombre', () => {
    // "seca" (de dried/seco) aparece escondida dentro de "cheeSECAke". Con
    // un comparador por subcadena, familia("Cheesecake") daba "cheeke": el
    // "seca" de en medio desaparecía sin que el nombre tuviera nada que ver
    // con estados secos o crudos.
    expect(familia('Cheesecake')).toBe('cheesecake')
  })

  it('dorado el pescado no es familia vacía', () => {
    // "Dorado" es a la vez una coletilla (dorado/a de cocción) y una especie
    // de pescado real. Si la primera palabra se tratara como una coletilla
    // más, un alimento cuyo nombre ES la coletilla se queda sin ninguna
    // palabra: familia("Dorado, crudo") daba "", el mismo valor que
    // familia(null). Hoy el catálogo no tiene "Dorado" pesable, pero el
    // pescado y el pargo dorado existen y el catálogo va a crecer.
    expect(familia('Dorado, crudo')).toBe('dorado')
    expect(familia('Dorado, crudo')).not.toBe('')
  })

  it('null revienta en vez de devolver vacío', () => {
    // Mismo criterio que porcion.ts y topes.ts: un nombre inválido tiene que
    // reventar, no reinterpretarse en silencio como "sin coletillas".
    expect(() => familia(null)).toThrow()
  })

  it('cadena vacía también revienta', () => {
    // "" no tiene ninguna palabra de identidad, igual que null: es el mismo
    // caso inválido, no una entrada rara pero válida.
    expect(() => familia('')).toThrow()
  })

  it('puros signos también revienta', () => {
    // "" pasa el primer chequeo porque es la única cadena vacía que existe,
    // pero ",,," o "   " son cadenas NO vacías que igual se quedan sin
    // ninguna palabra después de tokenizar. Hace falta un segundo chequeo
    // aparte: sin él, esto se cuela silencioso como familia "" -el mismo bug
    // de Dorado, por otra puerta.
    expect(() => familia(',,,')).toThrow(/sin ninguna palabra/)
    expect(() => familia('   ')).toThrow(/sin ninguna palabra/)
  })

  it('los números no quedan en la familia', () => {
    // "Carne molida de res 90/10 (cruda)" es un nombre real del catálogo.
    // tokenizar() limpia cada palabra por separado (no solo separa por
    // espacios/coma/paréntesis): sin ese filtro por palabra, "90" y "10" se
    // quedarían como texto suelto en la familia, y dos fracciones distintas
    // del mismo corte (90/10 vs 80/20) dejarían de agruparse.
    expect(familia('Carne molida de res 90/10 (cruda)')).toBe('carnemolidaderes')
  })

  it('sin y con sueltos no son coletillas', () => {
    // "sin sal"/"con sal" se quitan como PAR. "sin"/"con" solos, sin la
    // "sal" al lado, no se tocan -aparecen en nombres compuestos donde sí
    // distinguen alimentos, como "con cáscara" / "sin cáscara"-. Si se
    // quitaran sueltos, estos dos colapsarían a la misma familia y una papa
    // con cáscara (con fibra) se confundiría con una sin cáscara.
    expect(familia('Papa, cocida, con cáscara')).not.toBe(familia('Papa, cocida, sin cáscara'))
  })

  it('un par real del catálogo sigue agrupando tras la reescritura por palabras', () => {
    // Confirma que comparar por palabra completa no deja de agrupar lo que
    // sí debe seguir junto -que es la regresión que más importa evitar en
    // todo esto-. Son dos nombres reales del catálogo (no un fixture
    // inventado).
    expect(familia('Arroz blanco, pulido, crudo')).toBe(
      familia('Arroz blanco, pulido, cocido, sin sal'),
    )
  })
})

describe('cuándo preguntar', () => {
  it('si hay dos estados se pregunta', () => {
    expect(hayQuePreguntar(CATALOGO, 'Arroz blanco, cocido')).toBe(true)
  })

  it('si solo hay uno NO se pregunta', () => {
    // Solo 65 de 1.089 familias tienen más de un estado: la pregunta tiene
    // que salir pocas veces o cansa.
    expect(hayQuePreguntar(CATALOGO, 'Lechuga común, cruda')).toBe(false)
  })

  it('lo que se compra listo no se pregunta', () => {
    expect(hayQuePreguntar(CATALOGO, 'Pan tajado')).toBe(false)
  })
})

describe('variantes', () => {
  it('devuelve las dos opciones del arroz', () => {
    const opciones = variantesPesables(CATALOGO, 'Arroz blanco, cocido')
    expect(new Set(opciones.map((v) => v.estado))).toEqual(new Set(['crudo', 'cocido']))
  })

  it('solo ofrece estados que se pueden pesar', () => {
    for (const v of variantesPesables(CATALOGO, 'Arroz blanco, cocido')) {
      expect(ESTADOS_PESABLES).toContain(v.estado)
    }
  })

  it('variantes SÍ incluye lo que se compra listo', () => {
    // `variantes` es la lista completa; `variantesPesables` es la de la
    // pregunta. Sin esa distinción, el pan tajado -que solo existe como
    // `listo`- no se podría registrar, y es un alimento corriente.
    expect(variantes(CATALOGO, 'Pan tajado')).toHaveLength(1)
    expect(variantesPesables(CATALOGO, 'Pan tajado')).toEqual([])
  })

  it('seco también es un estado pesable', () => {
    // ESTADOS_PESABLES = ["crudo", "cocido", "seco"], pero ningún alimento
    // de CATALOGO usa "seco". Un frijol seco (sin versión "cocida" en este
    // catálogo de prueba) es el caso real que lo ejercita.
    const frijol: AlimentoCatalogo[] = [
      { id: 'frijol-seco', nombre: 'Frijol rojo, seco', estado: 'seco' },
      { id: 'frijol-crudo', nombre: 'Frijol rojo, crudo', estado: 'crudo' },
    ]
    expect(new Set(variantesPesables(frijol, 'Frijol rojo, seco').map((v) => v.estado))).toEqual(
      new Set(['seco', 'crudo']),
    )
    expect(hayQuePreguntar(frijol, 'Frijol rojo, seco')).toBe(true)
  })
})

describe('elegir', () => {
  it('respeta lo que el asesorado ya contestó', () => {
    const [elegido, asumido] = elegir(CATALOGO, 'Arroz blanco, cocido', 'crudo')
    expect(elegido!.id).toBe('arroz-blanco-crudo')
    expect(asumido).toBe(false)
  })

  it('por defecto cocido', () => {
    // Decisión de Bryan: se pesa cocido, que es lo que de verdad se sirven.
    const [elegido] = elegir(CATALOGO, 'Arroz blanco, cocido', null)
    expect(elegido!.estado).toBe('cocido')
  })

  it('si solo hay un estado lo usa y AVISA que lo asumió', () => {
    const [elegido, asumido] = elegir(CATALOGO, 'Lechuga común, cruda', 'cocido')
    expect(elegido!.id).toBe('lechuga-cruda')
    expect(asumido).toBe(true)
  })

  it('EL PAN TAJADO SE PUEDE REGISTRAR', () => {
    // Si `elegir` solo mirara los estados pesables, todo lo que se compra
    // listo -pan, galletas, yogur- sería imposible de registrar.
    const [elegido, asumido] = elegir(CATALOGO, 'Pan tajado', null)
    expect(elegido!.id).toBe('pan-tajado')
    expect(asumido).toBe(false)
  })

  it('un alimento que no está no se inventa', () => {
    expect(elegir(CATALOGO, 'Quinua, cocida', null)).toEqual([null, false])
  })

  // Los tres tests que siguen completan la tabla de verdad de la rama de un
  // solo estado. Antes de estos, un mutante que borrara el chequeo "estado
  // pesable" -dejando que cualquier preferencia distinta marcara
  // asumido=true, incluso para el pan tajado- pasaba el resto de tests sin
  // que ninguno se quejara: el único test del pan tajado usa
  // preferencia=null, que no ejercita esa rama.

  it('un solo estado pesable sin preferencia no asume nada', () => {
    // Sin preferencia expresada no hay nada que "no se pudo respetar".
    const [elegido, asumido] = elegir(CATALOGO, 'Lechuga común, cruda', null)
    expect(elegido!.id).toBe('lechuga-cruda')
    expect(asumido).toBe(false)
  })

  it('un solo estado pesable que coincide no asume nada', () => {
    const [elegido, asumido] = elegir(CATALOGO, 'Lechuga común, cruda', 'crudo')
    expect(elegido!.id).toBe('lechuga-cruda')
    expect(asumido).toBe(false)
  })

  it('lo que se compra listo nunca avisa que asumió', () => {
    // Pan tajado solo existe "listo": aunque venga arrastrada una
    // preferencia de otro alimento (p. ej. "crudo"), no hay elección que
    // hacer, así que no hay nada que asumir.
    const [elegido, asumido] = elegir(CATALOGO, 'Pan tajado', 'crudo')
    expect(elegido!.id).toBe('pan-tajado')
    expect(asumido).toBe(false)
  })

  it('si ninguna opción es el default igual elige una', () => {
    // La mitad "o las opciones" del fallback: la única familia con más de un
    // estado en CATALOGO (el arroz) siempre tiene "cocido" entre las
    // opciones, así que ningún test de arriba fuerza este camino. Un frijol
    // solo catalogado seco/crudo -sin versión cocida- fuerza el fallback.
    // Sin ese "o las opciones" (dejando solo el primer elemento del default),
    // esto revienta en vez de degradar con aviso.
    const frijol: AlimentoCatalogo[] = [
      { id: 'frijol-seco', nombre: 'Frijol rojo, seco', estado: 'seco' },
      { id: 'frijol-crudo', nombre: 'Frijol rojo, crudo', estado: 'crudo' },
    ]
    const [elegido, asumido] = elegir(frijol, 'Frijol rojo, seco', null)
    expect(elegido!.id).toBe('frijol-seco')
    expect(asumido).toBe(true)
  })
})

describe('entradas inválidas', () => {
  it('catálogo null revienta en vez de declarar que no hay nada', () => {
    // Mismo criterio que porcion.ts: un catálogo no cargado (null) tiene que
    // reventar, no comportarse como un catálogo vacío -que sí es una entrada
    // válida y devuelve "no encontrado" sin protestar.
    expect(() => variantes(null as unknown as AlimentoCatalogo[], 'Arroz blanco, cocido')).toThrow(
      TypeError,
    )
    expect(() =>
      elegir(null as unknown as AlimentoCatalogo[], 'Arroz blanco, cocido', null),
    ).toThrow(TypeError)
  })
})

// El resto de TestCatalogoReal en el original (test_hay_algo_que_revisar,
// test_ninguna_familia_real_sale_vacia) corre familia() contra los 1.195
// alimentos reales de herramientas/base-alimentos/catalogo.json. Ese
// archivo vive fuera de app/ -que es un repositorio git aparte- así que no
// tiene equivalente aquí sin crear una dependencia frágil entre repos. El
// tercer test de ese bloque (arroz pulido real) no toca el catálogo -son
// dos nombres literales- y sí se portó arriba, dentro de "familia".
