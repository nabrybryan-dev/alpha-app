import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { requisitosParaPeldano } from '../../domain/nivelesAlfa'
import RutaPage from './RutaPage'

/**
 * `/entrenar` ya no es una columna de texto: es el salón, con el sujeto en el centro y
 * con todo lo largo dentro del panel de abajo, que arranca CERRADO a propósito.
 *
 * Estos tests protegen lo mismo que protegían cuando existía la columna —que se llega al
 * nivel y al bloque; que están los siete días con hoy seleccionado; que una sesión de la
 * agenda lleva a su pantalla; y que no se promete un nivel sin decir cuánto falta—, solo
 * que ahora hay que ABRIR EL PANEL para verlo. El cambio es de sitio, no de contenido: si
 * algo de esto desapareciera del panel, estos cuatro se ponen rojos igual que antes.
 *
 * La Escala Alfa y las competencias evaluadas ya no se buscan aquí: el 29-ago se mudaron a
 * la pestaña Progreso. Quien las defiende ahora es
 * `src/features/progreso/ProgresoPage.test.tsx`; lo que queda en este archivo es la otra
 * mitad de esa mudanza —que en el panel ya NO están—, para que no acaben en dos sitios.
 */
function renderizar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter>
          <RutaPage />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

/**
 * Sube el panel inferior con un toque en el tirador.
 *
 * El tirador no tiene una sola letra —su nombre vive en `aria-label`, que es lo que
 * permite que el salón cerrado no tenga texto por encima del canvas—, así que se busca
 * por nombre accesible y no por texto. Devuelve cuando el panel ya está abierto.
 */
async function abrirPanel(usuario: ReturnType<typeof userEvent.setup>) {
  const tirador = await screen.findByRole('button', { name: /abrir el panel/i })
  await usuario.click(tirador)
  await screen.findByRole('button', { name: /cerrar el panel/i })
}

/** El recuadro del panel en el que baja un bloque de la Ruta, por su marca. */
function recuadro(clave: string): HTMLElement {
  const caja = document.querySelector(`[data-recuadro="${clave}"]`)
  expect(caja, `no hay recuadro "${clave}" en el panel`).not.toBeNull()
  return caja as HTMLElement
}

describe('RutaPage', () => {
  beforeEach(() => localStorage.clear())

  /**
   * LO QUE EL PANEL SIGUE TRAYENDO — Y LO QUE SE FUE A PROGRESO.
   *
   * Este test exigía además la Escala Alfa y las competencias evaluadas DENTRO del panel.
   * Desde el 29-ago no están ahí: por decisión de Bryan viven en la pestaña Progreso. Se
   * comprobó en el DOM que este mismo test monta —con el panel abierto no hay ni un
   * `[data-recuadro="escala-alfa"]` ni un `[data-recuadro="competencias"]`—, así que las dos
   * aserciones defendían una disposición que ya no existe: son viejas, no un fallo.
   *
   * No se borran y ya está, que sería quedarse verde sin mirar dónde acabó la información.
   * Se sustituyen por su reverso —que aquí YA NO están— y la comprobación de que están
   * enteras en su casa nueva vive en `src/features/progreso/ProgresoPage.test.tsx`, con los
   * nombres, los porcentajes y los peldaños medidos contra el dominio.
   */
  it('el panel trae el nivel y el bloque; la escala y las competencias ya no', async () => {
    const usuario = userEvent.setup()
    renderizar()

    // Cerrado no se lee: eso es el diseño, no una pérdida. Lo que sigue lo demuestra.
    expect(await screen.findByRole('button', { name: /abrir el panel/i })).toBeInTheDocument()
    expect(screen.queryByText(/Nivel 03 · RENDIMIENTO/)).toBeNull()

    await abrirPanel(usuario)

    expect(
      within(recuadro('nivel')).getByText(/Nivel 03 · RENDIMIENTO/),
    ).toBeInTheDocument()
    // El título del recuadro y el encabezado del bloque dicen lo mismo, así que se
    // cuentan las apariciones en vez de exigir una sola.
    expect(within(recuadro('bloque-en-curso')).getAllByText('Bloque en curso').length).toBeGreaterThan(0)

    // Y las dos que se mudaron no están aquí ni por su recuadro ni por su texto. Lo segundo
    // importa: un bloque puede colarse sin marca, arrastrado por otro componente, y sería
    // exactamente el estado que no se quiere —el mismo dato en dos pantallas, separándose.
    expect(document.querySelector('[data-recuadro="escala-alfa"]')).toBeNull()
    expect(document.querySelector('[data-recuadro="competencias"]')).toBeNull()
    expect(screen.queryByText('Escala Alfa')).toBeNull()
    expect(screen.queryByText('Competencias evaluadas')).toBeNull()
  })

  it('el panel pinta los 7 días de la semana y arranca con hoy seleccionado', async () => {
    const usuario = userEvent.setup()
    renderizar()
    await abrirPanel(usuario)

    // Se cuenta DENTRO del calendario: el salón PUEDE tener sus propios botones con
    // `aria-pressed` —los peldaños del eje W, que se montan los días con sujeto— y
    // contarlos todos mediría otra cosa. Que hoy toque cardio y no haya escalera no
    // convierte el `within` en un adorno: al día siguiente vuelve.
    const calendario = within(recuadro('calendario'))
    // 7 botones de día: uno va seleccionado (pressed) y los otros seis no.
    expect(calendario.getAllByRole('button', { pressed: false })).toHaveLength(6)
    expect(calendario.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  /**
   * CAMBIAR DE DÍA SIGUE FUNCIONANDO; LO QUE CAMBIÓ ES POR DÓNDE SE LLEGA AL BOTÓN.
   *
   * Este test buscaba los días A CIEGAS por todo el documento y con el panel CERRADO. Con
   * el panel bajado no hay ni un día en el árbol —los siete viven en el recuadro
   * `calendario`, que solo se monta al abrir—, así que lo que encontraba y clicaba no era
   * un día: eran los peldaños del eje W, los únicos botones con `aria-pressed` que había
   * entonces sobre el salón. Pasaba en verde midiendo otro mando.
   *
   * Desde que el eje W solo existe con sujeto y hoy toca cardio, esa escalera no se monta y
   * la búsqueda a ciegas se quedó sin nada que encontrar. El arreglo no es del código de la
   * app: se abre el panel y se clica DENTRO del calendario, que es donde están los días.
   * Comprobado en el DOM que monta este test: con el panel abierto hay 7 botones de día,
   * uno marcado y seis sin marcar, y clicar uno de los seis lo deja marcado a él y a nadie
   * más.
   */
  it('deja cambiar el día seleccionado', async () => {
    const usuario = userEvent.setup()
    renderizar()
    await abrirPanel(usuario)

    const calendario = within(recuadro('calendario'))
    const noSeleccionados = calendario.getAllByRole('button', { pressed: false })
    // Seis sin marcar: los siete días menos el de hoy. Si esto fuera 0 el clic de abajo no
    // tendría a quién ir y el test se caería por falta de días, no por el fallo real.
    expect(noSeleccionados).toHaveLength(6)

    await usuario.click(noSeleccionados[0])
    expect(noSeleccionados[0]).toHaveAttribute('aria-pressed', 'true')
    // Y solo uno queda marcado: elegir día es mover la marca, no encender otra.
    expect(calendario.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('las sesiones de la agenda del panel llevan a su pantalla de sesión', async () => {
    const usuario = userEvent.setup()
    renderizar()
    await abrirPanel(usuario)

    const enlaces = within(recuadro('calendario')).getAllByRole('link')
    const aSesiones = enlaces.filter((a) => a.getAttribute('href')?.startsWith('/entrenar/sesion/'))
    expect(aSesiones.length).toBeGreaterThan(0)
  })

  it('no promete un nivel sin decir cuánto falta para el siguiente', async () => {
    const usuario = userEvent.setup()
    renderizar()
    await abrirPanel(usuario)

    const panel = recuadro('requisitos')
    expect(within(panel).getAllByText('Para subir a nivel 04').length).toBeGreaterThan(0)
    // Los del peldaño al que va, no una lista igual para todos: el 04 es el
    // primero que pide autorregulación real, así que trae un requisito más que
    // los de abajo.
    expect(within(panel).getAllByRole('listitem')).toHaveLength(
      requisitosParaPeldano(4, { microcicloNumero: 22, sesionesRegistradas: 0, sesionesTotales: 0, seriesPorGrupo: [] }).length,
    )
    expect(panel.textContent).toMatch(/cansado/i)
  })
})
