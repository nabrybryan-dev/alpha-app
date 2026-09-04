import { describe, expect, it } from 'vitest'
import {
  INVENTARIO_ENTRENAR,
  bloquesDelInventario,
  datosDe,
  type EntradaDeInventario,
} from './inventario-entrenar'

/**
 * NO SE PERDIÓ NADA: cada bloque del inventario tiene sitio en el salón.
 *
 * `inventario-entrenar.ts` enumera lo que la pantalla vieja pintaba. Este archivo comprueba
 * que cada uno de esos bloques sigue teniendo un sitio DECLARADO en el salón nuevo, leyendo
 * el código del salón — no una lista paralela que alguien tenga que acordarse de actualizar.
 *
 * ## Por qué se lee el código y no se renderiza
 *
 * El montaje de verdad —con datos reales, el panel abierto y los doce recuadros en el DOM—
 * se comprueba en `src/features/entrenar/salon/salon.test.tsx`, que es donde vive el árbol
 * de React. Aquí la pregunta es distinta y más dura: **¿existe una decisión escrita sobre
 * dónde va cada bloque?** Un bloque puede aparecer en pantalla por accidente, arrastrado
 * por un componente padre, y desaparecer en el siguiente arreglo sin que nadie lo note. Un
 * bloque que está en `PanelInferior.tsx` con su `data-recuadro` está ahí porque alguien lo
 * puso.
 *
 * Así que este archivo lee los fuentes del salón y busca la marca de cada bloque. Es una
 * comprobación estructural, y por eso corre sin jsdom, sin WebGL y en milisegundos.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = join(__dirname, '..')

function fuente(ruta: string): string {
  return readFileSync(join(RAIZ, ruta), 'utf8')
}

const PANEL_INFERIOR = fuente('src/features/entrenar/salon/panel/PanelInferior.tsx')
const SALON = fuente('src/features/entrenar/salon/SalonEntrenar.tsx')
const RUTA_PAGE = fuente('src/features/entrenar/RutaPage.tsx')
const PROGRESO = fuente('src/features/progreso/ProgresoPage.tsx')

/**
 * Dónde vive cada bloque de la pantalla vieja dentro del salón.
 *
 * Los valores son marcas REALES del código, no nombres bonitos:
 *
 * - `recuadro:<clave>` — baja al panel inferior con ese `data-recuadro`.
 * - `hueco:<clave>`    — es uno de los cinco huecos de `huecos.ts`.
 * - `progreso:<clave>` — ya no vive en Entrenar: se mudó a la pestaña **Progreso** y allí
 *                        lleva ese `data-bloque`.
 * - `rutaPage`         — se queda en `RutaPage.tsx`, fuera del salón, porque solo ahí se
 *                        sabe (es el caso del estado «sin microciclo activo»).
 *
 * El mapa tiene que cubrir CADA UNO de los bloques del inventario: un bloque sin entrada aquí es
 * un bloque del que nadie ha decidido nada, y eso es exactamente lo que hay que cazar.
 *
 * ## Mudarse no es perderse — pero hay que mirar la casa nueva
 *
 * El 29-ago, por decisión de Bryan, «Competencias evaluadas» y «Escala Alfa» salieron del
 * panel del salón y entraron en Progreso. La tentación al ver el rojo era borrar sus dos
 * líneas de este mapa: la suite se habría quedado verde con la información en ningún sitio,
 * que es el fallo exacto que este archivo existe para impedir. Así que no se borran: se
 * REDIRIGEN, y el destino se comprueba igual de duro que el origen —el `data-bloque` en
 * `ProgresoPage.tsx` y el montaje del mismo componente de `ruta/`—. Los DATOS en el DOM de
 * Progreso los mide `src/features/progreso/ProgresoPage.test.tsx`.
 */
const SITIO_EN_EL_SALON: Record<string, string> = {
  'Pieza cinemática': 'hueco:centro',
  'Portada del microciclo': 'recuadro:microciclo',
  'Notas de la semana': 'recuadro:notas',
  'Cabecera de nivel': 'recuadro:nivel',
  'Enlace al encoder': 'recuadro:encoder',
  'Progreso al nivel': 'recuadro:progreso-nivel',
  'Cómo llegas': 'recuadro:como-llegas',
  'Bloque en curso': 'recuadro:bloque-en-curso',
  'Calendario de la semana': 'recuadro:calendario',
  'Competencias evaluadas': 'progreso:competencias',
  'Requisitos de nivel': 'recuadro:requisitos',
  'Escala Alfa': 'progreso:escala-alfa',
  'Estado sin microciclo': 'rutaPage',
}

describe('inventario de /entrenar · ningún bloque se quedó por el camino', () => {
  it('el inventario tiene bloques y cada entrada está completa', () => {
    expect(INVENTARIO_ENTRENAR.length).toBeGreaterThan(40)
    for (const entrada of INVENTARIO_ENTRENAR satisfies readonly EntradaDeInventario[]) {
      expect(entrada.bloque.length, `bloque vacío en ${entrada.dato}`).toBeGreaterThan(0)
      expect(entrada.dato.length, `dato vacío en ${entrada.bloque}`).toBeGreaterThan(0)
      // El origen tiene que ser un archivo que existe: un inventario que cita rutas
      // inventadas no se puede auditar contra el código.
      expect(() => fuente(entrada.origen), `no existe ${entrada.origen}`).not.toThrow()
    }
  })

  it('ningún bloque del inventario se ha quedado sin sitio asignado', () => {
    const sinSitio = bloquesDelInventario().filter((b) => !SITIO_EN_EL_SALON[b])
    expect(sinSitio).toEqual([])
  })

  it('cada bloque tiene al menos un dato: no hay bloques declarados y vacíos', () => {
    for (const bloque of bloquesDelInventario()) {
      expect(datosDe(bloque).length, `«${bloque}» no enumera ni un dato`).toBeGreaterThan(0)
    }
  })

  it.each(bloquesDelInventario())('«%s» tiene su sitio escrito en el salón', (bloque) => {
    const sitio = SITIO_EN_EL_SALON[bloque]
    if (sitio === 'rutaPage') {
      // El estado sin microciclo NO baja al panel: vive donde se decide, que es la página
      // que lee los microciclos de la persona.
      expect(RUTA_PAGE).toContain('Sin microciclo activo')
      return
    }
    const [tipo, clave] = sitio.split(':')
    if (tipo === 'recuadro') {
      expect(PANEL_INFERIOR).toContain(`clave="${clave}"`)
      return
    }
    if (tipo === 'progreso') {
      // En su casa nueva, y con la marca puesta a mano: un bloque que apareciera en
      // Progreso de rebote, arrastrado por otro componente, no cuenta como decidido.
      expect(PROGRESO).toContain(`data-bloque="${clave}"`)
      // Y que ya NO esté en el panel del salón. Sin esto, el día que alguien lo devuelva a
      // Entrenar sin avisar, el mapa seguiría diciendo que vive en Progreso y nadie lo
      // desmentiría: estaría en los dos sitios, o en el que no toca.
      expect(PANEL_INFERIOR).not.toContain(`clave="${clave}"`)
      return
    }
    expect(SALON).toContain(`data-hueco="${clave}"`)
  })

  /**
   * Los catorce recuadros del panel, contados — y de dónde sale cada uno.
   *
   * La cuenta sola nunca habría notado los cambios, y ya van dos: salieron `competencias`
   * y `escala-alfa` camino de Progreso, entraron los cuadros verdes del encargo —`antes`,
   * `patron`— junto al de `ejercicio`, y el 2026-09-02 bajaron de la pared otros dos,
   * `encuadre` y `material`. Por eso aquí no se cuenta a secas: se comprueba que los NUEVE
   * que el mapa manda al panel están, que los que se mudaron NO están, y que el total
   * cuadra con la suma de los grupos.
   *
   * Los dos últimos bajaron por el reparto del §1 de `SEMANA-2.md`: los campos del encuadre
   * y el estante del material no están en la lista amarilla, y en la pared ocupaban juntos
   * el 98 % del ancho a la altura de las piernas del sujeto — tapando los implementos 3D
   * hasta dejarlos en 36 píxeles.
   */
  it('el panel monta quince recuadros: los nueve del inventario más los seis del salón', () => {
    const claves = [...PANEL_INFERIOR.matchAll(/clave="([a-z-]+)"/g)].map((m) => m[1])
    expect(new Set(claves).size).toBe(claves.length) // ninguno repetido

    const sitios = bloquesDelInventario().map((b) => SITIO_EN_EL_SALON[b])
    const alPanel = sitios
      .filter((s) => s.startsWith('recuadro:'))
      .map((s) => s.slice('recuadro:'.length))
    const aProgreso = sitios
      .filter((s) => s.startsWith('progreso:'))
      .map((s) => s.slice('progreso:'.length))
    expect(alPanel).toHaveLength(9)
    expect(aProgreso).toHaveLength(2)

    // Los del inventario que siguen aquí, todos.
    expect(claves).toEqual(expect.arrayContaining(alPanel))
    // Los que se fueron, ninguno: si volviera alguno sin cambiar el mapa, se vería.
    for (const clave of aProgreso) expect(claves).not.toContain(clave)
    // Y los SEIS que no vienen del inventario, sino del encargo del salón: la prescripción
    // entera, lo de antes de entrenar, las notas de ejecución, los dos que bajaron de la
    // pared en el reparto —el encuadre y el material— y, desde el 2026-09-04, «cómo va la
    // sesión»: era la marquesina corrida del muro, y dice cómo va LA SESIÓN, no la serie
    // que estás a punto de hacer. Se lee al bajar a mirar, no mientras se levanta.
    const DEL_SALON = ['ejercicio', 'antes', 'patron', 'encuadre', 'material', 'ritmo']
    for (const clave of DEL_SALON) expect(claves).toContain(clave)
    expect(claves).toHaveLength(alPanel.length + DEL_SALON.length)
  })

  /**
   * Los de `ruta/` bajan montando EL MISMO componente, no una copia adaptada.
   *
   * Es la única forma de poder afirmar que no se perdió un dato dentro de un bloque. Una
   * versión «adaptada al panel» de `CalendarioSemana` sería una segunda maqueta, y lo que
   * se pierde en esa deriva no lo ve nadie hasta que un asesorado lo echa de menos.
   */
  it.each([
    ['CabeceraNivel', '../../ruta/CabeceraNivel'],
    ['TarjetaProgresoNivel', '../../ruta/TarjetaProgresoNivel'],
    ['ComoLlegas', '../../ruta/ComoLlegas'],
    ['BloqueEnCurso', '../../ruta/BloqueEnCurso'],
    ['CalendarioSemana', '../../ruta/CalendarioSemana'],
    ['RequisitosNivel', '../../ruta/RequisitosNivel'],
    ['NotasDeLaSemana', '../../NotasDeLaSemana'],
  ])('el panel monta el %s de la Ruta, no una copia', (componente, ruta) => {
    // Se busca el componente DENTRO de la llave de su import, no la línea entera: el
    // 2026-09-03 `ComoLlegas` pasó a traerse también su función de tono —la cifra del
    // índice subió al rótulo del tramo y el color tenía que subir con ella— y esta
    // prueba se puso roja sin que nada estuviera mal. Lo que tiene que vigilar es el
    // ORIGEN del componente; qué más venga de ese mismo archivo no es asunto suyo.
    const linea = PANEL_INFERIOR.split('\n').find((l) => l.includes(`} from '${ruta}'`))
    expect(linea, `no hay import desde '${ruta}'`).toBeDefined()
    expect(linea).toMatch(new RegExp(`[{,]\\s*${componente}\\s*[,}]`))
    expect(PANEL_INFERIOR).toContain(`<${componente}`)
  })

  /**
   * Y LOS DOS QUE SE MUDARON MONTAN EL MISMO COMPONENTE EN PROGRESO.
   *
   * La misma exigencia que se le hacía al panel, ahora en la casa nueva: si Progreso los
   * hubiera reescrito «a su manera», la mudanza sería una copia, y una copia se separa del
   * original al primer arreglo sin que nadie vea qué dato se quedó por el camino. La
   * comprobación de que además se pintan CON DATOS está en
   * `src/features/progreso/ProgresoPage.test.tsx`.
   */
  it.each([
    ['CompetenciasEvaluadas', '../entrenar/ruta/CompetenciasEvaluadas'],
    ['EscalaAlfa', '../entrenar/ruta/EscalaAlfa'],
  ])('Progreso monta el %s de la Ruta, no una copia', (componente, ruta) => {
    expect(PROGRESO).toContain(`import { ${componente} } from '${ruta}'`)
    expect(PROGRESO).toContain(`<${componente}`)
    // Y el panel del salón ya no lo monta: si estuviera en los dos sitios, los dos se
    // separarían con el tiempo y cada pantalla enseñaría un número distinto.
    expect(PANEL_INFERIOR).not.toContain(`<${componente}`)
  })

  /**
   * Los números de Progreso salen de las MISMAS cuentas que los de la Ruta.
   *
   * Es el riesgo que trae toda mudanza en este repo: no perder el bloque, sino que la casa
   * nueva se ponga a calcular por su cuenta. Dos pantallas con cifras creíbles y distintas
   * no las desmiente nadie. `calculosDeLaRuta()` es el único sitio donde se arman.
   */
  it('Progreso calcula las competencias con calculosDeLaRuta, no con cuentas propias', () => {
    expect(PROGRESO).toContain("from '../entrenar/ruta/calculosDeLaRuta'")
    expect(PROGRESO).toContain('calculosDeLaRuta(')
    expect(PROGRESO).not.toContain('competenciasCalculadas(')
  })

  /**
   * La portada es el único bloque que NO se pudo mudar montando su componente, y hay que
   * poder verlo escrito.
   *
   * `PortadaMicrociclo` se borra sola en cuanto se cierra —«se ve una vez por microciclo»—,
   * y eso es correcto para un cartel pero no para lo que el cartel lleva dentro: el número
   * del microciclo, las sesiones, las series, los grupos, el foco y la frase son datos del
   * plan. Montarla en el panel habría dejado el recuadro en blanco a partir del segundo día,
   * que es perder información de la forma más silenciosa posible.
   */
  it('la portada baja como contenido permanente, no como cartel que se cierra', () => {
    const recuadro = fuente('src/features/entrenar/salon/panel/recuadros/RecuadroMicrociclo.tsx')
    // Ni la importa ni la monta. (Su nombre SÍ aparece en la tabla de la cabecera del
    // archivo, que documenta de dónde viene cada recuadro; por eso se busca el import y la
    // etiqueta, y no la palabra suelta.)
    expect(PANEL_INFERIOR).not.toMatch(/import .*PortadaMicrociclo/)
    expect(PANEL_INFERIOR).not.toContain('<PortadaMicrociclo')
    expect(PANEL_INFERIOR).toContain('<RecuadroMicrociclo')
    // Y usa las MISMAS funciones de dominio que la portada, no cuentas propias.
    for (const fn of ['cargaPorGrupo', 'formatearSeries', 'fraseDelMicrociclo']) {
      expect(recuadro, `RecuadroMicrociclo no usa ${fn}`).toContain(fn)
    }
  })

  /**
   * LOS BLOQUES DE LA RUTA ENTRAN EN LA HOJA SIN MARCO NI ROTULO PROPIOS.
   *
   * Los seis venian de una pantalla que era una columna de tarjetas, y cada uno traia lo
   * suyo: un `<section>` con borde y fondo, y dentro un `<h3>` con su titulo. Dentro del
   * panel eso se convertia en una caja dentro de una caja y en el titulo dicho dos veces
   * seguidas —el rotulo del tramo, y dos lineas mas abajo el mismo texto—. Bryan lo
   * senalo el 2026-09-03 mirando la pantalla, no el codigo.
   *
   * La prueba mira la etiqueta RAIZ de cada bloque y solo esa: por dentro sí hay objetos
   * con marco —las siete teclas del calendario, sus filas de agenda— y eso es correcto,
   * son objetos de verdad. Lo que no puede volver es que el BLOQUE sea una tarjeta.
   *
   * `<h3>` es la forma exacta que tenia el eco, así que se prohíbe por nombre. El `<h2>`
   * de `CabeceraNivel` se queda: no repite el rotulo del tramo, dice el nivel.
   */
  const BLOQUES_DE_LA_RUTA = [
    'CabeceraNivel',
    'TarjetaProgresoNivel',
    'ComoLlegas',
    'BloqueEnCurso',
    'CalendarioSemana',
    'RequisitosNivel',
  ]

  /**
   * El codigo sin sus comentarios.
   *
   * Hace falta porque las dos comprobaciones de abajo buscan formas que se NOMBRAN al
   * explicar por que se fueron: el comentario de `ComoLlegas` dice «el `<h3>` decia por
   * segunda vez lo que el rotulo acababa de decir», y sin esto la prueba lo cazaba a el.
   * Un falso rojo cuesta mas que un falso verde: se vuelve ruido y acaba en `skip`.
   */
  function sinComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  }

  /** Las clases de la etiqueta raiz, saltandose los comentarios que la preceden. */
  function claseRaiz(codigo: string): string {
    const cuerpo = sinComentarios(codigo).slice(sinComentarios(codigo).indexOf('return ('))
    const etiqueta = cuerpo.match(/<(?:section|header|div|article)([^>]*)>/)
    if (!etiqueta) return ''
    const clase = etiqueta[1].match(/className="([^"]*)"/)
    return clase ? clase[1] : ''
  }

  it.each(BLOQUES_DE_LA_RUTA)('%s entra en la hoja sin marco propio', (componente) => {
    const clase = claseRaiz(fuente(`src/features/entrenar/ruta/${componente}.tsx`))
    for (const marca of ['border', 'rounded', 'bg-ink', 'shadow-']) {
      expect(clase, `${componente} vuelve a ser una tarjeta: "${clase}"`).not.toContain(marca)
    }
  })

  it.each(BLOQUES_DE_LA_RUTA)('%s no repite el rotulo de su tramo', (componente) => {
    expect(sinComentarios(fuente(`src/features/entrenar/ruta/${componente}.tsx`))).not.toContain(
      '<h3',
    )
  })
})
