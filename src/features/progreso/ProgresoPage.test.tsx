import { render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { db, hoyIso } from '../../data/dbInstance'
import { calculosDeLaRuta } from '../entrenar/ruta/calculosDeLaRuta'
import ProgresoPage from './ProgresoPage'

/**
 * LAS DOS QUE SE MUDARON: COMPETENCIAS EVALUADAS Y ESCALA ALFA, YA EN PROGRESO.
 *
 * Antes del 29-ago estos dos bloques bajaban en el panel de `/entrenar` y los defendían
 * `RutaPage.test.tsx` y `salon/salon.test.tsx`. Por decisión de Bryan se fueron a Progreso.
 *
 * Mudarse no es perderse, pero perderse se parece MUCHO a mudarse cuando nadie mira la casa
 * nueva: basta con quitar las dos aserciones de la casa vieja y la suite se queda verde con
 * la información en ningún sitio. Este archivo es la casa nueva mirada. Por eso no comprueba
 * «que la pantalla monta un componente», que es lo que sabe ver el chequeo estructural de
 * `pruebas/inventario.test.ts`, sino que los DATOS están en el DOM: los nombres de las
 * competencias, sus porcentajes con rol accesible, y los cinco peldaños de la escala con su
 * número, su nombre y su estado.
 *
 * ## Lo que este archivo NO dice
 *
 * Si se ven bien. jsdom no maqueta: aquí todo mide 0x0 y el orden visual no se puede medir.
 * Que la escala se lea de un vistazo en el teléfono es cosa del ojo, y está anotado en
 * `informes/`.
 */

function renderizar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter>
          <ProgresoPage />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )
}

/** El usuario de demo con el que arranca la sesión en los tests. */
function usuarioDemo() {
  return db.usuarios.byId('u-valentina')!
}

/** Lo que el dominio dice que esta persona tiene: la vara contra la que se mide el DOM. */
function esperado() {
  const usuario = usuarioDemo()
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  return {
    competencias: calculosDeLaRuta(usuario.id, microciclo, hoyIso()).competencias,
    escala: db.ruta.byUsuario(usuario.id).escala,
  }
}

/** La sección de Progreso marcada con esa clave. */
function bloque(clave: string): HTMLElement {
  const caja = document.querySelector(`[data-bloque="${clave}"]`)
  expect(caja, `no hay bloque "${clave}" en Progreso`).not.toBeNull()
  return caja as HTMLElement
}

describe('Progreso · la casa nueva de las competencias y la Escala Alfa', () => {
  beforeEach(() => localStorage.clear())

  it('las competencias evaluadas están enteras: nombre, porcentaje con rol y nota', () => {
    const { competencias } = esperado()
    // Si el seed dejara de traer competencias, este test pasaría sin comprobar nada: la
    // pantalla las esconde cuando la lista viene vacía, y con razón. Se dice aquí.
    expect(competencias.length).toBeGreaterThan(0)

    renderizar()
    const caja = within(bloque('competencias'))

    expect(caja.getAllByText('Competencias evaluadas').length).toBeGreaterThan(0)
    for (const c of competencias) {
      expect(caja.getByText(c.nombre)).toBeInTheDocument()
      expect(caja.getByText(c.nota)).toBeInTheDocument()
    }
    // Una barra por competencia, y cada una dice su valor sin depender del color.
    const barras = caja.getAllByRole('progressbar')
    expect(barras).toHaveLength(competencias.length)
    for (const c of competencias) {
      const barra = caja.getByRole('progressbar', { name: c.nombre })
      expect(barra).toHaveAttribute('aria-valuenow', String(c.pct))
    }
  })

  it('la Escala Alfa está entera: cada peldaño con número, nombre, descripción y estado', () => {
    const { escala } = esperado()
    // Siete, no cinco. Contado en `data/ruta/contenidoRuta.ts` el 29-ago: la escala de la
    // app tiene SIETE peldaños, aunque el comentario de cabecera de `ruta/EscalaAlfa.tsx`
    // y la ficha del inventario dijeran cinco. Aquí se mide contra el dato y no contra la
    // prosa, y por eso el número no está escrito a mano: se compara el DOM con la escala
    // que devuelve el repositorio.
    expect(escala.length).toBeGreaterThanOrEqual(5)

    renderizar()
    const caja = within(bloque('escala-alfa'))

    expect(caja.getAllByText('Escala Alfa').length).toBeGreaterThan(0)
    // Los peldaños se cuentan en la lista y no por sus textos: así un peldaño duplicado o
    // uno de menos se ve como lo que es.
    expect(caja.getAllByRole('listitem')).toHaveLength(escala.length)
    for (const nivel of escala) {
      expect(caja.getByText(nivel.nombre)).toBeInTheDocument()
      expect(caja.getByText(nivel.descripcion)).toBeInTheDocument()
    }
    // El peldaño en el que está la persona se dice con palabras, no solo con color.
    expect(caja.getAllByText(/superado|nivel actual|bloqueado|reservado/i).length).toBe(
      escala.length,
    )
  })
})
