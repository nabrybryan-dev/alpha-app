import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HUECOS } from './huecos'
import type { EjercicioPrescrito, Sesion } from '../../../domain/types'
import { EN_EL_HUECO, EN_EL_ROTULO, EN_OTRO_SITIO, MURO_IZQUIERDO } from './paredes/muros'
import { SessionProvider } from '../../../app/SessionProvider'
import { ThemeProvider } from '../../../app/ThemeProvider'
import { AppRouter } from '../../../app/router'
import { db, hoyIso } from '../../../data/dbInstance'
import { ejercicioCompleto } from '../../../domain/cumplimiento'
import { cargaPorGrupo } from '../../../domain/fatiga'
import { notasDelMicrociclo } from '../../../domain/notasDeLaSemana'
import { requisitosParaPeldano } from '../../../domain/nivelesAlfa'
import {
  armarSemana,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  type DatosRuta,
} from '../../../domain/rutaEntrenamiento'
import { indiceRecuperacion } from '../../../domain/readiness'
import { SalonEntrenar } from './SalonEntrenar'
import { TOPE_PARED } from './huecos'
import { contenidoPared } from './paredes/contenidoPared'

/**
 * EL SALÓN, MONTADO DE VERDAD EN `/entrenar`.
 *
 * No se renderiza `SalonEntrenar` a pelo con props de laboratorio: se entra por la ruta,
 * con el router, el `SessionProvider` y el seed de demo, porque la pregunta del encargo no
 * es «¿el componente pinta?» sino «¿la pestaña Entrenar ES el salón?». Un salón perfecto que
 * nadie ha enchufado a la ruta no es nada — y eso es exactamente lo que este archivo caza.
 *
 * ## Lo que jsdom NO puede decir aquí
 *
 * - **No hay WebGL.** `getContext('webgl')` devuelve `null`, así que el sujeto no se dibuja;
 *   `VisorPatron` cae en su modo degradado. Que el modelo se vea, orbite y ejecute la
 *   excéntrica es cosa del ojo de Bryan → `informes/verificacion-iphone.md`.
 * - **No hay maquetación.** Todo elemento mide 0×0 y `getComputedStyle` no resuelve
 *   `position: fixed` ni el apilado real. Así que «ocupa la pantalla entera» y «nada tapa al
 *   sujeto» no se comprueban midiendo: se comprueban leyendo lo DECLARADO —las clases y los
 *   `z-index`—, que es una comprobación más débil y está dicho como tal.
 * - **No hay `element.animate`.** Ninguna transición del salón se puede cronometrar aquí.
 */

function renderizarEntrenar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={['/entrenar']}>
          <AppRouter />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

/** Espera a que el salón esté montado y lo devuelve. */
async function esperarAlSalon(): Promise<HTMLElement> {
  return await waitFor(() => {
    const salon = document.querySelector('[data-salon="entrenar"]')
    if (!salon) throw new Error('el salón no se montó en /entrenar')
    return salon as HTMLElement
  })
}

/**
 * Los textos VISIBLES que hay dentro de un elemento, recorriendo el DOM nodo a nodo.
 *
 * A mano y no con `textContent` a propósito: `textContent` concatena y no dice CUÁNTOS
 * nodos hay ni dónde están, y la regla que hay que comprobar se cuenta en nodos. Se saltan
 * `<script>`, `<style>` y los `<title>` de SVG, que no son texto que nadie lea. Lo que cuelga
 * de un `aria-hidden` SÍ se cuenta: ese atributo lo esconde del lector de pantalla, no del ojo,
 * y la regla del punto 1 habla de lo que se VE sobre el sujeto.
 */
function nodosDeTexto(raiz: Element): { texto: string; camino: string }[] {
  const salida: { texto: string; camino: string }[] = []
  const paseador = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
  let nodo = paseador.nextNode()
  while (nodo) {
    const texto = (nodo.textContent ?? '').trim()
    const padre = nodo.parentElement
    if (texto.length > 0 && padre && !/^(script|style|title)$/i.test(padre.tagName)) {
      salida.push({ texto, camino: caminoDe(padre) })
    }
    nodo = paseador.nextNode()
  }
  return salida
}

/** Un camino legible del elemento, para que un fallo diga DÓNDE está el texto de más. */
function caminoDe(el: Element): string {
  const partes: string[] = []
  let actual: Element | null = el
  while (actual && partes.length < 6) {
    const marca = actual.getAttribute?.('data-hueco') ?? actual.getAttribute?.('data-salon')
    partes.unshift(marca ? `${actual.tagName.toLowerCase()}[${marca}]` : actual.tagName.toLowerCase())
    actual = actual.parentElement
  }
  return partes.join(' > ')
}

describe('/entrenar es el salón', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── CASO FELIZ ────────────────────────────────────────────────────────────
  it('caso feliz: entrar en /entrenar monta el salón, no la columna con scroll', async () => {
    renderizarEntrenar()
    const salon = await esperarAlSalon()
    // El salón ES la pantalla: `fixed inset-0`. jsdom no maqueta, así que esto comprueba lo
    // declarado, no lo pintado.
    expect(salon.className).toContain('fixed')
    expect(salon.className).toContain('inset-0')
    // Y arranca en la piel, que es el primer escalón del eje W.
    expect(salon.getAttribute('data-w')).toBe('0')
  })

  it('monta los huecos declarados y ninguno de más', async () => {
    renderizarEntrenar()
    const salon = await esperarAlSalon()
    const huecos = Array.from(salon.querySelectorAll('[data-hueco]')).map((h) => h.getAttribute('data-hueco'))
    // `centro` y `panelInferior` siempre; `paredes` y `ficha` cuando hay ejercicio del que
    // hablar; `sinPatron` solo cuando el ejercicio no tiene modelo. Lo que no puede
    // aparecer es un hueco que no esté en el contrato: en cuanto se admite un sitio
    // «provisional» de más vuelve la columna con scroll por la puerta de atrás.
    //
    // LA LISTA SALE DE `HUECOS`, NO ESCRITA AQUÍ. Estaba escrita a mano y por eso esta
    // prueba se puso roja el día que la ficha volvió a ser un hueco: no porque el salón
    // montara algo indebido, sino porque la copia de la lista se había quedado atrás. Dos
    // listas paralelas se desincronizan, y la que miente es siempre la de la prueba.
    const declarados = Object.keys(HUECOS)
    for (const hueco of huecos) expect(declarados).toContain(hueco)
    expect(huecos).toContain('centro')
    expect(huecos).toContain('panelInferior')
  })

  /**
   * SIN SUJETO NO HAY EJE W — la mitad que Bryan vio rota en el iPhone.
   *
   * La sesión que la agenda destaca hoy en el seed de demo es la metabólica: cardio, sin
   * gesto resistido, sin cuerpo en el centro. Antes el salón pintaba ahí los cinco peldaños
   * igual, y esa escalera respondía al dedo sin cambiar nada de lo que se veía: un mando
   * que miente. W es la profundidad DEL CUERPO, no un ajuste de la pantalla.
   *
   * La otra mitad —que con sujeto la escalera está entera— se comprueba abajo, en el
   * describe del ejercicio de fuerza. Las dos hacen falta: un test que solo dijera «no
   * está» se quedaría verde el día que la escalera desapareciera para siempre.
   */
  it('sin sujeto en el centro no hay eje W: no se pinta la escalera', async () => {
    // LA SESIÓN SE FIJA AQUÍ, y no se hereda del calendario.
    //
    // Este caso nació el 29-ago apoyándose en que ese día el seed destacaba la sesión
    // metabólica. Qué sesión toca lo decide la FECHA, así que el test daba verde o rojo
    // según el día en que se corriera: el 2-sep cayó en una de fuerza, el salón montó
    // sujeto y reventó en la línea de guarda de abajo — sin haber llegado a evaluar su
    // criterio ni una vez. Un test que depende del calendario no prueba lo que dice.
    //
    // Se arregla fijando el escenario, NO invirtiendo el criterio: se vacían los
    // ejercicios de todas las sesiones, así que caiga el día que caiga no hay cuerpo
    // que poner en el centro. Lo que se comprueba sigue siendo lo mismo.
    const real = db.microciclos.byUsuario.bind(db.microciclos)
    vi.spyOn(db.microciclos, 'byUsuario').mockImplementation((id: string) =>
      real(id).map((m) => ({ ...m, sesiones: (m.sesiones ?? []).map((s) => ({ ...s, ejercicios: [] })) })),
    )
    renderizarEntrenar()
    const salon = await esperarAlSalon()
    // Primero, que el centro esté de verdad SIN sujeto: si el salón no hubiera llegado a
    // montar el centro, lo de abajo saldría verde por la razón equivocada.
    expect(salon.querySelector('[data-hueco="sinPatron"]')).not.toBeNull()
    expect(salon.querySelector('canvas'), 'se montó un visor donde no hay patrón').toBeNull()

    // Y entonces no hay escalera. Ni suelta: ni un solo peldaño por el salón.
    expect(salon.querySelector('[role="group"][aria-label="Capa del cuerpo"]')).toBeNull()
    expect(salon.querySelectorAll('button[aria-pressed]')).toHaveLength(0)

    // `data-w` sí se queda puesto: es la capa en la que ESTÁ el salón —la piel, el escalón
    // 0—, que es lo que `huecos.ts` declara para el hueco `sinPatron` (`visibleEnW: [0]`).
    expect(salon.getAttribute('data-w')).toBe('0')
  })

  // ── ESTADO VACÍO ──────────────────────────────────────────────────────────
  it('estado VACÍO: sin microciclo activo no hay salón, hay un aviso que no alarma', async () => {
    // Parte de la cartera está inactiva a propósito, así que esto no es una urgencia y el
    // mensaje no puede sonar a error.
    vi.spyOn(db.microciclos, 'byUsuario').mockReturnValue([])
    renderizarEntrenar()
    expect(await screen.findByText('Sin microciclo activo')).toBeInTheDocument()
    expect(
      screen.getByText('El coach está preparando tu siguiente programación.'),
    ).toBeInTheDocument()
    expect(document.querySelector('[data-salon="entrenar"]')).toBeNull()
  })

  // ── ESTADO DE CARGA ───────────────────────────────────────────────────────
  it('estado CARGA: mientras baja el módulo se ve el aviso, no una pantalla en blanco', async () => {
    // `RutaPage` entra por `lazy()`, así que el primer fotograma de /entrenar es el
    // `Suspense` del router. Lo que no puede pasar es que sea una hoja vacía.
    //
    // Hay que estrenar el registro de módulos: `React.lazy` cachea el módulo resuelto en el
    // propio objeto, así que a partir del segundo render de esta suite el salón se monta de
    // golpe y el estado de carga ya no existe. Y se reimportan TAMBIÉN los dos proveedores:
    // con `vi.resetModules()` un contexto viejo y un consumidor nuevo son dos objetos
    // distintos, y el `useSesion` de dentro no encontraría a su proveedor.
    vi.resetModules()
    const [router, sesion, tema] = await Promise.all([
      import('../../../app/router'),
      import('../../../app/SessionProvider'),
      import('../../../app/ThemeProvider'),
    ])
    render(
      <tema.ThemeProvider>
        <sesion.SessionProvider>
          <MemoryRouter initialEntries={['/entrenar']}>
            <router.AppRouter />
          </MemoryRouter>
        </sesion.SessionProvider>
      </tema.ThemeProvider>,
    )
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    // Y termina: el aviso se va cuando el salón llega.
    await esperarAlSalon()
    expect(screen.queryByText('Cargando…')).toBeNull()
  })

  // ── ESTADO DE ERROR ───────────────────────────────────────────────────────
  it('estado ERROR: si los datos revientan, la sección se contiene y ofrece reintentar', async () => {
    // Sin `ErrorBoundary` una excepción durante el render deja la pantalla en blanco a mitad
    // de sesión, en el gimnasio. Con él, el fallo se queda dentro de la sección.
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db.microciclos, 'byUsuario').mockImplementation(() => {
      throw new Error('microciclo con forma vieja')
    })
    renderizarEntrenar()
    expect(await screen.findByText('Esta sección no se pudo mostrar.')).toBeInTheDocument()
    // El detalle se enseña a propósito: en el móvil no hay consola que mirar.
    expect(screen.getByText('microciclo con forma vieja')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(document.querySelector('[data-salon="entrenar"]')).toBeNull()
    silencio.mockRestore()
  })

  // ── LA REGLA DURA ─────────────────────────────────────────────────────────
  describe('la regla dura: cero texto suelto sobre el sujeto en la vista inicial', () => {
    it('dentro del salón, fuera de los huecos declarados, no queda un solo nodo de texto', async () => {
      renderizarEntrenar()
      const salon = await esperarAlSalon()

      // Primero, que la comprobación NO sea vacía: si el salón no tuviera texto en ninguna
      // parte, quitar los huecos dejaría cero por la razón equivocada.
      expect(nodosDeTexto(salon).length).toBeGreaterThan(0)

      // Se trabaja sobre una copia: quitar subárboles del DOM vivo desmontaría React.
      const copia = salon.cloneNode(true) as HTMLElement
      const huecos = Array.from(copia.querySelectorAll('[data-hueco]'))
      expect(huecos.length).toBeGreaterThan(0)
      for (const hueco of huecos) hueco.remove()

      const sobrantes = nodosDeTexto(copia)
      expect(
        sobrantes,
        `texto fuera de los huecos declarados: ${sobrantes.map((s) => `«${s.texto}» en ${s.camino}`).join(' | ')}`,
      ).toEqual([])
    })

    it('con el panel bajado, el panel inferior no escribe ni una letra', async () => {
      // El tirador es una barra sin texto: su nombre va en `aria-label`, que es un atributo
      // y no un nodo. Es lo que permite cumplir la regla sin dejar el gesto sin manija.
      renderizarEntrenar()
      const salon = await esperarAlSalon()
      const panel = salon.querySelector('[data-hueco="panelInferior"]') as HTMLElement
      expect(panel).not.toBeNull()
      expect(nodosDeTexto(panel)).toEqual([])
      const tirador = panel.querySelector('button') as HTMLButtonElement
      expect(tirador.getAttribute('aria-expanded')).toBe('false')
      expect(tirador.getAttribute('aria-label')).toBe('Abrir el panel con todo el detalle')
    })

    /**
     * Y ahora la misma regla mirando la PANTALLA, no solo el salón.
     *
     * El salón se declara `fixed inset-0` en `--z-elevado` (20). Pero no es lo único que se
     * pinta en `/entrenar`: la cáscara del asesorado monta también la `TopBar` y la
     * `BottomNav`. Si alguna de esas dos se apila POR ENCIMA de 20 y lleva texto, ese texto
     * queda escrito sobre el sujeto — exactamente lo que el punto 1 del encargo prohíbe.
     *
     * En jsdom no hay pintado, así que esto no se mide: se compara el `z-index` DECLARADO
     * del salón con el de la cáscara. Es una comprobación estructural y por eso el veredicto
     * final sigue siendo del ojo de Bryan; pero un apilado mal declarado se ve aquí sin
     * necesidad de teléfono.
     */
    it('nada de la cáscara con texto se apila por encima del salón', async () => {
      renderizarEntrenar()
      const salon = await esperarAlSalon()
      // El salón vive en `--z-elevado`, que `tokens.css` fija en 20.
      expect(salon.style.zIndex).toBe('var(--z-elevado)')
      const Z_SALON = 20

      const porEncimaConTexto: string[] = []
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        if (salon.contains(el)) continue
        // Tailwind escribe el apilado como clase (`z-40`), no como estilo: en jsdom no hay
        // hoja de estilos que resolverla, así que se lee la clase.
        const clase = Array.from(el.classList).find((c) => /^z-\d+$/.test(c))
        if (!clase) continue
        const z = Number(clase.slice(2))
        if (z <= Z_SALON) continue
        const textos = nodosDeTexto(el).map((t) => t.texto)
        if (textos.length > 0) porEncimaConTexto.push(`${clase} <${el.tagName.toLowerCase()}>: ${textos.join(' / ')}`)
      }

      expect(
        porEncimaConTexto,
        `hay texto de la cáscara apilado sobre el salón: ${porEncimaConTexto.join(' | ')}`,
      ).toEqual([])
    })
  })
})

/**
 * LA MISMA REGLA, CON UN EJERCICIO DE FUERZA EN EL CENTRO.
 *
 * La sesión que la agenda destaca hoy en el seed de demo es la metabólica, y una sesión
 * metabólica no tiene `ejercicios`: el salón se monta sin paredes y sin registro. Comprobar
 * la regla dura solo ahí sería comprobarla sobre un salón medio vacío — pasaría por falta de
 * contenido, no por estar bien repartido.
 *
 * Así que aquí se monta `SalonEntrenar` con una sesión de FUERZA del mismo microciclo, que
 * es lo que enciende los cinco huecos a la vez: sujeto, ocho paredes, registro en el suelo y
 * panel abajo. Se monta el componente y no la ruta porque lo que se elige es el dato de
 * entrada, no el camino.
 */
/**
 * MONTA EL SALÓN CON UN EJERCICIO DE FUERZA.
 *
 * Vive fuera de los `describe` porque la usan dos: el de los cinco huecos y el de la
 * ficha de la serie. Copiada en cada uno, el día que el salón pida una prop más una de
 * las dos copias se quedaría montando otro salón.
 */
function montarConFuerza(elegirSesion?: (s: Sesion) => boolean) {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const sesion =
    (elegirSesion && microciclo.sesiones.find(elegirSesion)) ??
    microciclo.sesiones.find((s) => s.ejercicios.length > 0)!
  const ruta = db.ruta.byUsuario(usuario.id)
  const hoy = hoyIso()
  const datos: DatosRuta = {
    microcicloNumero: microciclo.numero,
    sesionesRegistradas: 0,
    sesionesTotales: microciclo.sesiones.length,
    seriesPorGrupo: cargaPorGrupo(microciclo).map((g) => g.seriesPautadas),
  }
  const requisitos = requisitosParaPeldano(2, datos)
  render(
    <MemoryRouter>
      <SalonEntrenar
        microciclo={microciclo}
        ruta={ruta}
        recuperacion={indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)}
        progresoPct={progresoAlSiguiente(requisitos)}
        estadisticas={estadisticasCalculadas(datos)}
        competencias={competenciasCalculadas(datos)}
        requisitos={requisitos}
        semana={armarSemana(microciclo, hoy)}
        notas={notasDelMicrociclo(microciclo)}
        sesion={sesion}
      />
    </MemoryRouter>,
  )
  return { microciclo, sesion }
}

describe('el salón con un ejercicio de fuerza: los cinco huecos encendidos', () => {

  beforeEach(() => {
    localStorage.clear()
  })

  it('enciende paredes y el cuadro del registro, que con la metabólica no salen', () => {
    // Relojes falsos SOLO en esta prueba: el tablón se anuncia 5,5 s y hay que llegar a
    // su estado de reposo sin esperarlos de verdad. Se devuelven al final para no
    // contagiar a las pruebas que sí usan `userEvent`, que necesita el reloj real.
    vi.useFakeTimers()
    try {
    montarConFuerza()
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    const huecos = Array.from(salon.querySelectorAll('[data-hueco]')).map((h) => h.getAttribute('data-hueco'))
    expect(huecos).toContain('paredes')
    // EL MANDO DE REGISTRAR YA NO CUELGA DE NINGÚN MURO. Llenar y guardar viven en la
    // ficha que sale del borde izquierdo, así que lo que se comprueba es que la ficha
    // esté montada — un cuadro más en la pared era el mismo gesto en dos sitios.
    expect(salon.querySelector('[data-cajon="serie"]')).not.toBeNull()
    expect(salon.querySelector('[data-cuadro="registro"]'), 'el mando volvió al muro').toBeNull()
    // Y LAS CUATRO ESTACIONES ESTÁN, que es donde vive ahora la prescripción.
    expect(salon.querySelectorAll('[data-estacion]')).toHaveLength(4)
    expect(huecos).toContain('centro')
    expect(huecos).toContain('panelInferior')
    // CINCO paneles de pared, no nueve — pero YA NO A LA VEZ, y por eso esto se cuenta
    // por capas desde el 2026-09-03.
    //
    // Los otros cuatro —los del encuadre: dónde va el móvil, a qué distancia, qué palanca
    // y qué velocidad— bajaron al panel el 2026-09-02, y la CARGA subió a la pared el
    // 2026-09-03 porque series, carga y RIR se leen juntos o no se leen.
    //
    // Lo que cambió después es CUÁNDO se ve cada uno: el tablón agrupa por tiempo, así que
    // al montarse anuncia el ejercicio —nombre y técnica— y en reposo deja encendida la
    // prescripción de la serie. Contar cinco en un solo instante volvería a exigir la
    // pantalla cargada que Bryan rechazó; contar la UNIÓN es lo que impide que plegar se
    // convierta en perder. Los grupos salen de `muros.ts`, no de una lista escrita aquí:
    // dos listas separadas se desincronizan y esta prueba dejaría de vigilar nada.
    const camposVisibles = () =>
      Array.from(salon.querySelectorAll('[data-campo][data-tope]')).map((n) =>
        n.getAttribute('data-campo'),
      )

    // AL ABRIR: el rótulo del ejercicio y la carga en el hueco de la derecha, más los
    // tres que se dicen FUERA del muro y aquí van montados sin ver. El orden es el del
    // DOM —columna izquierda, columna derecha, y debajo los mudos—, así que se escribe en
    // ese orden y no alfabéticamente: si alguien mueve un bloque de sitio, esto lo dice.
    expect(camposVisibles()).toEqual([...EN_EL_ROTULO, ...EN_EL_HUECO, ...EN_OTRO_SITIO])

    act(() => {
      vi.advanceTimersByTime(6500)
    })
    // EN REPOSO la carga le devuelve el hueco al cronómetro. El rótulo SIGUE escrito —es
    // rotulación, no un aviso— y los mudos siguen montados.
    expect(camposVisibles()).toEqual([...EN_EL_ROTULO, ...EN_OTRO_SITIO])

    // LOS QUE SE DICEN FUERA VAN MARCADOS Y NO SE VEN. Si alguien los volviera a hacer
    // visibles estaría escribiendo en la pared lo que ya dicen las cuatro estaciones y la
    // lectura de abajo, que es exactamente de lo que se salió el 2026-09-04.
    for (const clave of EN_OTRO_SITIO) {
      const nodo = salon.querySelector(`[data-campo="${clave}"]`)
      expect(nodo?.className, `${clave} se ve, y ya lo dice otro sitio`).toContain('sr-only')
    }

    // Y la unión siguen siendo los cinco del muro, sin repetidos y sin perder ninguno.
    expect([...EN_EL_ROTULO, ...EN_EL_HUECO, ...EN_OTRO_SITIO].sort()).toEqual(
      [...MURO_IZQUIERDO].sort(),
    )
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * CON SUJETO SÍ HAY EJE W — la otra mitad de la regla.
   *
   * Este es el test que antes vivía arriba, en el describe de la ruta, y que pasaba porque
   * la escalera se pintaba siempre. Ahora se monta donde de verdad hay cuerpo que
   * atravesar: la sesión de fuerza. Si el arreglo de la interfaz se pasara de frenada y
   * apagara el eje también con sujeto, este se pone rojo.
   */
  it('con sujeto, el eje W se puede atravesar con el dedo', () => {
    // LA ESCALERA SE FUE el 2026-09-04: cinco botones pegados al borde, el último mando de
    // aplicación que quedaba sobre la sala. Lo que se comprueba ya no es que existan cinco
    // peldaños, sino lo que esos peldaños servían para hacer — que con cuerpo en el centro
    // se puede entrar en él. Si el arreglo de la interfaz se hubiera pasado de frenada y
    // apagado también el gesto, esto se pone rojo.
    montarConFuerza()
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    // Que hay cuerpo: el visor montado es la condición de la que cuelga el eje.
    expect(salon.querySelector('canvas'), 'no hay sujeto en el centro con la sesión de fuerza').not.toBeNull()
    expect(salon.getAttribute('data-w')).toBe('0')

    const centro = salon.querySelector('[data-hueco="centro"]') as HTMLElement
    // Un `PointerEvent` de jsdom no transporta `clientX`/`clientY`; un `MouseEvent` con el
    // mismo tipo sí, y React lo entrega igual a `onPointerDown`.
    const dedo = (tipo: string, y: number) =>
      fireEvent(centro, new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: 200, clientY: y }))
    dedo('pointerdown', 400)
    dedo('pointermove', 200)
    dedo('pointerup', 200)

    expect(salon.getAttribute('data-w'), 'el dedo no entró en el cuerpo').toBe('1')
    // Y NO HAY MANDOS DE CAPA sobre la sala: si vuelven, esto lo dice.
    expect(salon.querySelector('[role="group"][aria-label="Capa del cuerpo"]')).toBeNull()
  })

  /**
   * DESLIZAR DE LADO PASA DE EJERCICIO.
   *
   * Es lo que Bryan no podía hacer el 2026-09-05: «no me deja desplazarme entre
   * ejercicios». Y no le fallaba a él —estaba escondido detrás de aguantar el dedo 320 ms
   * hasta que el cuerpo empezaba a hundirse—. La regla pura vive en `gestoHorizontal.ts` y
   * se prueba sola; aquí se comprueba el CABLE, que es lo que se rompe al mover código.
   */
  it('deslizar de lado pasa de ejercicio, sin aguantar el dedo antes', () => {
    montarConFuerza((s) => s.ejercicios.length > 1)
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    // Sin este `expect` la prueba se saldría por la puerta de atrás el día que la sesión
    // de prueba tuviera un solo ejercicio: verde sin haber probado nada.
    const puntos = Array.from(salon.querySelectorAll('[data-punto]'))
    expect(puntos.length, 'la sesión de prueba no tiene recorrido que barrer').toBeGreaterThan(1)

    const antes = salon.querySelectorAll('[data-punto="aqui"]').length
    expect(antes, 'no hay un punto marcando dónde estás').toBe(1)
    const indiceDe = () =>
      Array.from(salon.querySelectorAll('[data-punto]')).findIndex(
        (p) => p.getAttribute('data-punto') === 'aqui',
      )
    const partida = indiceDe()

    const centro = salon.querySelector('[data-hueco="centro"]') as HTMLElement
    const dedo = (tipo: string, x: number, y: number) =>
      fireEvent(centro, new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y }))

    // Un deslizamiento hacia la izquierda, sin pausa previa: 70 px, que pasa del paso.
    dedo('pointerdown', 300, 400)
    dedo('pointermove', 230, 402)
    dedo('pointerup', 230, 402)

    expect(indiceDe(), 'el deslizamiento no pasó de ejercicio').toBe(partida + 1)
  })

  it('un arrastre vertical NO cambia de ejercicio: ese gesto es del eje W', () => {
    montarConFuerza((s) => s.ejercicios.length > 1)
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    expect(salon.querySelectorAll('[data-punto]').length).toBeGreaterThan(1)
    const indiceDe = () =>
      Array.from(salon.querySelectorAll('[data-punto]')).findIndex(
        (p) => p.getAttribute('data-punto') === 'aqui',
      )
    const partida = indiceDe()

    const centro = salon.querySelector('[data-hueco="centro"]') as HTMLElement
    const dedo = (tipo: string, x: number, y: number) =>
      fireEvent(centro, new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: x, clientY: y }))
    dedo('pointerdown', 200, 400)
    dedo('pointermove', 206, 200)
    dedo('pointerup', 206, 200)

    expect(indiceDe(), 'un gesto vertical se llevó el ejercicio').toBe(partida)
    expect(salon.getAttribute('data-w'), 'y el eje W sí tenía que moverse').toBe('1')
  })

  /** La vía directa, y la única que existe para quien navega con teclado o lector. */
  it('los puntos se tocan y saltan a su ejercicio', () => {
    montarConFuerza((s) => s.ejercicios.length > 2)
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    const botones = Array.from(salon.querySelectorAll('button[data-punto], button > [data-punto]'))
      .map((n) => (n.tagName === 'BUTTON' ? n : n.parentElement) as HTMLElement)
    expect(botones.length, 'hacen falta tres puntos para probar el salto directo').toBeGreaterThan(2)

    fireEvent.click(botones[2])
    const puntos = Array.from(salon.querySelectorAll('[data-punto]'))
    expect(puntos[2].getAttribute('data-punto'), 'tocar el punto no llevó a su ejercicio').toBe('aqui')
  })

  /**
   * NADA REESCALA NI DESENFOCA EL LIENZO.
   *
   * Bryan, 2026-09-05: «pixelea cuando se dan movimientos y se suele cubrir todo como si
   * nublara». Las causas estaban aquí, en estilos sobre el lienzo: un `scale()` del hueco
   * entero al subir el panel (reescala la imagen ya pintada, como ampliar una foto), un
   * `scale(1.04)` más un `drop-shadow` del sujeto mientras el dedo estaba dentro (el
   * drop-shadow hace una copia desenfocada del lienzo entero en rojo: ese era el «se
   * nubla»), y un `backdrop-filter: blur(20px)` en la hoja del panel. Ahora la sala se
   * retira y se acerca POR LA CÁMARA, el halo es un nodo aparte, y la hoja es opaca.
   */
  it('con el dedo dentro, el sujeto no lleva transform ni filter: el acuse es un halo aparte', () => {
    vi.useFakeTimers()
    try {
      montarConFuerza()
      const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
      const centro = salon.querySelector('[data-hueco="centro"]') as HTMLElement
      const sujeto = salon.querySelector('[data-testigo="sujeto"]') as HTMLElement
      const halo = salon.querySelector('[data-halo="hundiendo"]') as HTMLElement
      expect(halo, 'el halo del dedo dentro no está montado').not.toBeNull()
      expect(halo.style.opacity).toBe('0')

      fireEvent(centro, new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 200, clientY: 400 }))
      act(() => {
        vi.advanceTimersByTime(400) // más que ESPERA: el dedo ya está dentro
      })
      expect(sujeto.hasAttribute('data-hundiendo'), 'el dedo no llegó a hundirse').toBe(true)
      // Lo que NO puede haber sobre el lienzo mientras el dedo está dentro:
      expect(sujeto.style.transform, 'un scale() sobre el lienzo lo reescala pintado').toBe('')
      expect(sujeto.style.filter, 'un filter sobre el lienzo lo desenfoca entero').toBe('')
      expect(centro.style.transform).toBe('')
      // Y lo que sí: el halo encendido, en su propio nodo.
      expect(halo.style.opacity).toBe('1')
    } finally {
      vi.useRealTimers()
    }
  })

  it('con el panel arriba, la sala se retira por la cámara y no por un scale(); y la hoja no lleva cristal esmerilado', async () => {
    const usuario = userEvent.setup()
    montarConFuerza()
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    const centro = salon.querySelector('[data-hueco="centro"]') as HTMLElement
    const panel = salon.querySelector('[data-hueco="panelInferior"]') as HTMLElement

    await usuario.click(screen.getByRole('button', { name: 'Abrir el panel con todo el detalle' }))

    expect(centro.style.transform, 'el hueco del centro volvió a llevar un scale()').toBe('')
    expect(centro.style.filter).toBe('')
    expect(panel.querySelector('.glass-blur'), 'la hoja del panel volvió a llevar backdrop-filter').toBeNull()
  })

  it('y la regla dura se sigue cumpliendo con los huecos llenos', () => {
    montarConFuerza()
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement

    // La comprobación no es vacía: ahora hay texto de sobra dentro de los huecos.
    expect(nodosDeTexto(salon).length).toBeGreaterThan(10)

    const copia = salon.cloneNode(true) as HTMLElement
    const huecos = Array.from(copia.querySelectorAll('[data-hueco]'))
    // TRES y no cuatro: `registro` dejó de ser hueco propio y ahora cuelga del muro
    // dentro de `paredes`. Quedan `paredes`, `centro` y `panelInferior`.
    expect(huecos.length).toBeGreaterThanOrEqual(3)
    for (const hueco of huecos) hueco.remove()

    const sobrantes = nodosDeTexto(copia)
    expect(
      sobrantes,
      `texto fuera de los huecos declarados: ${sobrantes.map((s) => `«${s.texto}» en ${s.camino}`).join(' | ')}`,
    ).toEqual([])
  })

  it('el panel sube con un toque y trae los quince recuadros, todos interactivos', async () => {
    const usuario = userEvent.setup()
    montarConFuerza()
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    const panel = salon.querySelector('[data-hueco="panelInferior"]') as HTMLElement

    // Cerrado: solo el tirador, y sin una letra.
    expect(salon.querySelectorAll('[data-recuadro]')).toHaveLength(0)
    await usuario.click(screen.getByRole('button', { name: 'Abrir el panel con todo el detalle' }))

    const recuadros = Array.from(salon.querySelectorAll('[data-recuadro]'))
    // Quince, y cada uno llegó bajando de la pared: los dos del reparto del §1 —«El
    // encuadre de hoy» con sus cuatro campos y «Material de la sesión»— y, desde el
    // 2026-09-04, «Cómo va la sesión», que era la marquesina corrida del muro. Lo que baja
    // de la pared aterriza aquí; nada se tira.
    expect(recuadros).toHaveLength(15)
    // Cada recuadro trae un elemento interactivo real: el título ES el botón que pliega. No
    // es una promesa que haya que ir comprobando bloque a bloque, es estructura.
    for (const r of recuadros) {
      const boton = r.querySelector('button[aria-expanded]')
      expect(boton, `el recuadro «${r.getAttribute('data-recuadro')}» no tiene nada que tocar`).not.toBeNull()
      expect(boton!.getAttribute('aria-expanded')).toBe('true')
    }
    expect(panel.querySelector('button')!.getAttribute('aria-expanded')).toBe('true')
  })

  /**
   * PLEGAR Y DESPLEGAR, MEDIDO SOBRE UN RECUADRO QUE SIGUE EXISTIENDO.
   *
   * Este test plegaba el recuadro `escala-alfa`. Desde el 29-ago la Escala Alfa vive en
   * Progreso y ese recuadro no se monta: el test se caía al leer `querySelector` de `null`,
   * o sea que estaba rojo por la mudanza, no por el plegado. Lo que protegía —que un
   * recuadro nace abierto, se pliega al tocarlo y NO desaparece al plegarse— no tiene nada
   * que ver con qué bloque lleve dentro.
   *
   * Así que se mide sobre `calendario`, que es un bloque de la Ruta que sigue en el panel y
   * tiene contenido de verdad dentro. Se comprueba el texto de su encabezado además del
   * `aria-expanded` para que no pueda pasar sobre un recuadro vacío.
   */
  it('los recuadros nacen abiertos y se pliegan al tocarlos, sin perder el hueco', async () => {
    const usuario = userEvent.setup()
    montarConFuerza()
    await usuario.click(screen.getByRole('button', { name: 'Abrir el panel con todo el detalle' }))
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    const caja = salon.querySelector('[data-recuadro="calendario"]') as HTMLElement
    expect(caja, 'no hay recuadro «calendario» en el panel abierto').not.toBeNull()
    const boton = caja.querySelector('button[aria-expanded]') as HTMLButtonElement

    expect(caja.textContent).toMatch(/La semana/)
    await usuario.click(boton)
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    // El recuadro sigue en el panel: plegar es comodidad de quien ya leyó, no borrar.
    expect(salon.querySelector('[data-recuadro="calendario"]')).not.toBeNull()
    await usuario.click(boton)
    expect(boton.getAttribute('aria-expanded')).toBe('true')
  })

  /**
   * Y LAS DOS QUE SE MUDARON NO ESTÁN AQUÍ, NI SIQUIERA DE REBOTE.
   *
   * El reverso de la mudanza del 29-ago. Sin esta comprobación, devolverlas al panel sin
   * quitarlas de Progreso dejaría el mismo dato calculado y pintado en dos pantallas: el
   * día que alguien ajuste una, la otra seguiría enseñando la cifra vieja y nadie tendría
   * un rojo que se lo dijera. Que estén ENTERAS en Progreso lo mide
   * `src/features/progreso/ProgresoPage.test.tsx`.
   */
  it('la Escala Alfa y las competencias ya no están en el panel: se fueron a Progreso', async () => {
    const usuario = userEvent.setup()
    montarConFuerza()
    await usuario.click(screen.getByRole('button', { name: 'Abrir el panel con todo el detalle' }))
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement

    expect(salon.querySelector('[data-recuadro="escala-alfa"]')).toBeNull()
    expect(salon.querySelector('[data-recuadro="competencias"]')).toBeNull()
    // Ni por su marca ni por su texto: un bloque puede colarse sin `data-recuadro`.
    expect(salon.textContent).not.toMatch(/Escala Alfa/)
    expect(salon.textContent).not.toMatch(/Competencias evaluadas/)
  })

  it('lo que las paredes recortaron está ÍNTEGRO abajo, con su huella', async () => {
    const usuario = userEvent.setup()
    const { sesion } = montarConFuerza()
    await usuario.click(screen.getByRole('button', { name: 'Abrir el panel con todo el detalle' }))

    const ejercicio = sesion.ejercicios.find((e) => !ejercicioCompleto(e)) ?? sesion.ejercicios[0]
    const esperados = contenidoPared(ejercicio).alPanel
    expect(esperados.length).toBeGreaterThan(0)

    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    const enPantalla = Array.from(salon.querySelectorAll('[data-huella]'))
    // Se comparan HUELLAS y no prosa: comparar párrafos a ojo no dice si falta uno.
    expect(new Set(enPantalla.map((n) => n.getAttribute('data-huella')))).toEqual(
      new Set(esperados.map((t) => t.huella)),
    )
    // Y el texto que se pinta es el completo, no otro recorte.
    for (const t of esperados) {
      const nodo = salon.querySelector(`[data-huella="${t.huella}"]`)
      expect(nodo!.textContent).toContain(t.texto)
    }
  })

  it('ninguna pared se pasa del tope de 42 caracteres', () => {
    montarConFuerza()
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    for (const panel of Array.from(salon.querySelectorAll('[data-campo][data-tope]'))) {
      const tope = Number(panel.getAttribute('data-tope'))
      expect(tope).toBe(TOPE_PARED)
      // El primer párrafo es el rótulo del panel; el segundo, el texto recortado.
      const texto = panel.querySelectorAll('p')[1]?.textContent ?? ''
      expect(
        [...texto].length,
        `la pared «${panel.getAttribute('data-campo')}» se pasa del tope: ${texto}`,
      ).toBeLessThanOrEqual(tope)
    }
  })
})

/**
 * LA FICHA DE LA SERIE, DE PUNTA A PUNTA.
 *
 * Las reglas de qué pasa al guardar están probadas sueltas en `despuesDeGuardar.test.ts`.
 * Esto prueba la otra mitad, la que un módulo puro no puede: que la ficha sale del borde
 * izquierdo, que lo que se guarda desde ella llega a la base, y que después SALE ALGO —la
 * frase y el descanso—. Sin esta, las reglas podrían ser perfectas y no estar enchufadas.
 */
describe('la ficha de la serie sale de la izquierda, y al guardar pasa algo', () => {
  it('el asidero saca la ficha, y guardar desde ella escribe la serie y arranca el descanso', async () => {
    // LA SESIÓN TIENE QUE TENER TRABAJO PENDIENTE. La que el seed destaca está entera —el
    // salón se abre en «3 series registradas»— y la ficha de un ejercicio terminado no
    // tiene botón de guardar. Esta prueba fallaba por el sitio equivocado hasta que se
    // miró qué había DENTRO del cajón.
    const { microciclo, sesion } = montarConFuerza((s) =>
      s.ejercicios.some((e: EjercicioPrescrito) => e.series.length < e.sets),
    )
    // El mismo que enseña el salón: el primero incompleto, no el primero del array.
    const ejercicio = sesion.ejercicios.find((e) => e.series.length < e.sets) ?? sesion.ejercicios[0]
    const seriesAntes = ejercicio.series.length

    // LA FICHA NO ESTÁ FUERA AL ABRIR EL SALÓN. Si lo estuviera, taparía la sala entera
    // desde el primer fotograma — que es de lo que este salón vino a salir.
    const cajon = document.querySelector('[data-cajon="serie"]') as HTMLElement
    expect(cajon).not.toBeNull()
    expect(cajon.style.visibility).toBe('hidden')

    // Se abre con el asidero. Con teclado el gesto es un toque: no hay dedo que arrastrar,
    // y un cajón que solo se abre arrastrando sería un cajón sin llave para quien navega
    // con teclado o con lector.
    const asidero = document.querySelector('[data-asidero="ficha"]') as HTMLElement
    fireEvent.keyDown(asidero, { key: 'Enter' })
    await waitFor(() => expect(cajon.style.visibility).toBe('visible'))

    // Guardar desde DENTRO de la ficha. El botón es el de `RegistroSerieSalon`, que es el
    // que ya está probado: aquí lo que se comprueba es que está enchufado.
    const guardar = within(cajon).getByRole('button', { name: /guardar/i })
    fireEvent.click(guardar)

    await waitFor(() => {
      const despues = db.microciclos
        .byUsuario('u-valentina')
        .find((m) => m.id === microciclo.id)!
        .sesiones.find((s) => s.id === sesion.id)!
        .ejercicios.find((e) => e.id === ejercicio.id)!
      expect(despues.series.length).toBe(seriesAntes + 1)
    })

    // Y SALE ALGO. La frase sobre la sala y el descanso corriendo: guardar una serie sin
    // acuse deja al asesorado sin saber si se guardó, y mirando el teléfono en vez de
    // soltando la barra.
    await waitFor(() => expect(document.querySelector('[data-logro]')).not.toBeNull())
    expect(cajon.style.visibility).toBe('hidden')
  })
})
