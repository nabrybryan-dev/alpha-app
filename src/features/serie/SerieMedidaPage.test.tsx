import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import SerieMedidaPage from './SerieMedidaPage'

/**
 * Las tres reglas del diseño de esta pantalla, convertidas en pruebas.
 *
 * No son detalles de maquetación: cada una responde a una forma concreta de
 * mentirle al asesorado, y las tres se han visto en herramientas de este tipo.
 *
 *  1. El fallo va arriba y con cifras, no con un «no se pudo procesar».
 *  2. Lo medido no se tira, y lo que no se pudo medir es una raya, no un cero.
 *  3. El aviso no puede ser rojo: en Alpha el rojo es la marca.
 */

function pintar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <SerieMedidaPage />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('La serie, medida · cuando no se pudo medir', () => {
  it('dice el fallo arriba, no lo esconde', () => {
    pintar('/entrenar/serie')
    expect(screen.getByRole('heading', { name: /no pude medir la serie/i })).toBeTruthy()
  })

  it('da motivos numerados, cada uno con su cifra', () => {
    pintar('/entrenar/serie')
    const motivos = screen.getAllByRole('listitem')
    expect(motivos.length).toBeGreaterThanOrEqual(4)
    // Sin cifra un motivo es una excusa: «el codo casi no se dobla» no vale,
    // «161° de media» sí, porque se puede comprobar en el vídeo.
    expect(screen.getByText(/161° de media/)).toBeTruthy()
    expect(screen.getByText(/Solo 125 de 193/)).toBeTruthy()
  })

  it('enseña lo que sí quedó medido', () => {
    pintar('/entrenar/serie')
    const bloque = screen.getByRole('heading', { name: /lo que sí quedó medido/i })
      .parentElement as HTMLElement
    expect(within(bloque).getByText(/23,2/)).toBeTruthy()
    expect(within(bloque).getByText(/0,92/)).toBeTruthy()
  })

  it('las repeticiones que no se pudieron contar son una raya, nunca un cero', () => {
    pintar('/entrenar/serie')
    // Un cero es un dato; una raya es una ausencia. Si esto se relaja, la
    // pantalla acabará diciendo «0 repeticiones» de una serie sin medir.
    expect(screen.getByLabelText('sin dato').textContent).toBe('—')
    expect(screen.queryByText(/^0 repeticiones$/)).toBeNull()
  })

  it('dibuja la traza, que es la prueba de qué entendió la app', () => {
    pintar('/entrenar/serie')
    expect(screen.getByRole('img', { name: /altura del implemento/i })).toBeTruthy()
  })
})

describe('La serie, medida · cuando sí se midió', () => {
  it('cuenta las repeticiones y la velocidad media', () => {
    pintar('/entrenar/serie?estado=medida')
    expect(screen.getByRole('heading', { name: /remo/i })).toBeTruthy()
    expect(screen.getByText('8 repeticiones')).toBeTruthy()
    expect(screen.getByText('0,63')).toBeTruthy()
  })

  it('pinta una barra por repetición, cada una con su etiqueta legible', () => {
    pintar('/entrenar/serie?estado=medida')
    const barras = screen.getAllByRole('img', { name: /repetición \d+:/i })
    expect(barras).toHaveLength(8)
  })

  it('compara la pérdida con el umbral del asesorado', () => {
    pintar('/entrenar/serie?estado=medida')
    expect(screen.getByText(/Tu umbral es 30 %/)).toBeTruthy()
  })

  it('dice la proporción entre bajada y tirón', () => {
    pintar('/entrenar/serie?estado=medida')
    expect(screen.getByText(/2,6 veces lo que el tirón/)).toBeTruthy()
  })
})

describe('El rojo es la marca, así que no puede avisar', () => {
  it('el aviso de la serie fallida usa ámbar, no rojo', () => {
    const { container } = pintar('/entrenar/serie')
    const aviso = container.querySelector('.border-ambar\\/35')
    expect(aviso).not.toBeNull()
    expect(container.querySelector('.bg-rojo, .text-rojo, .border-rojo')).toBeNull()
  })

  it('el aviso no depende solo del color: lleva punto y borde', () => {
    const { container } = pintar('/entrenar/serie')
    // Quien no distingue bien los colores tiene que poder leer la pantalla.
    expect(container.querySelector('.bg-ambar.rounded-full')).not.toBeNull()
  })
})
