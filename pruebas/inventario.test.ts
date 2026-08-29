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

/**
 * Dónde vive cada bloque de la pantalla vieja dentro del salón.
 *
 * Los valores son marcas REALES del código, no nombres bonitos:
 *
 * - `recuadro:<clave>` — baja al panel inferior con ese `data-recuadro`.
 * - `hueco:<clave>`    — es uno de los cinco huecos de `huecos.ts`.
 * - `rutaPage`         — se queda en `RutaPage.tsx`, fuera del salón, porque solo ahí se
 *                        sabe (es el caso del estado «sin microciclo activo»).
 *
 * El mapa tiene que cubrir CADA UNO de los bloques del inventario: un bloque sin entrada aquí es
 * un bloque del que nadie ha decidido nada, y eso es exactamente lo que hay que cazar.
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
  'Competencias evaluadas': 'recuadro:competencias',
  'Requisitos de nivel': 'recuadro:requisitos',
  'Escala Alfa': 'recuadro:escala-alfa',
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
    expect(SALON).toContain(`data-hueco="${clave}"`)
  })

  /**
   * Los doce recuadros del panel, contados.
   *
   * `PanelInferior.tsx` documenta doce bloques en su tabla de cabecera. Once son bloques del
   * inventario; el doceavo —`ejercicio`— es NUEVO: lleva los textos completos que
   * `contenidoPared()` recortó para las paredes. Contar aquí evita el fallo silencioso de
   * que alguien quite un recuadro y el panel siga pareciendo lleno.
   */
  it('el panel monta doce recuadros: los once bloques que bajaron más el del ejercicio', () => {
    const claves = [...PANEL_INFERIOR.matchAll(/clave="([a-z-]+)"/g)].map((m) => m[1])
    expect(new Set(claves).size).toBe(claves.length) // ninguno repetido
    expect(claves).toHaveLength(12)
    const delInventario = bloquesDelInventario()
      .map((b) => SITIO_EN_EL_SALON[b])
      .filter((s) => s.startsWith('recuadro:'))
      .map((s) => s.slice('recuadro:'.length))
    expect(claves).toEqual(expect.arrayContaining(delInventario))
    expect(claves).toContain('ejercicio')
  })

  /**
   * Los ocho de `ruta/` bajan montando EL MISMO componente, no una copia adaptada.
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
    ['CompetenciasEvaluadas', '../../ruta/CompetenciasEvaluadas'],
    ['RequisitosNivel', '../../ruta/RequisitosNivel'],
    ['EscalaAlfa', '../../ruta/EscalaAlfa'],
    ['NotasDeLaSemana', '../../NotasDeLaSemana'],
  ])('el panel monta el %s de la Ruta, no una copia', (componente, ruta) => {
    expect(PANEL_INFERIOR).toContain(`import { ${componente} } from '${ruta}'`)
    expect(PANEL_INFERIOR).toContain(`<${componente}`)
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
})
