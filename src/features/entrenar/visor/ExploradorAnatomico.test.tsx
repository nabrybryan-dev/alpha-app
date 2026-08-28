import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ARTICULACIONES } from '../../../domain/patrones/articulaciones'
import { ExploradorAnatomico } from './ExploradorAnatomico'

describe('el explorador anatómico', () => {
  it('ofrece todas las articulaciones del catálogo', () => {
    render(<ExploradorAnatomico />)
    for (const a of ARTICULACIONES) {
      expect(screen.getByRole('button', { name: a.nombre }), a.nombre).toBeInTheDocument()
    }
  })

  it('arranca por el codo, que es el ejemplo más claro de una bisagra', () => {
    render(<ExploradorAnatomico />)
    expect(screen.getByRole('heading', { name: 'Codo' })).toBeInTheDocument()
    expect(screen.getByText(/un grado de libertad/i)).toBeInTheDocument()
    expect(screen.getByText(/Cúbito sobre húmero/i)).toBeInTheDocument()
  })

  it('cambia de articulación al elegirla', async () => {
    const usuario = userEvent.setup()
    render(<ExploradorAnatomico />)
    await usuario.click(screen.getByRole('button', { name: 'Rodilla' }))
    expect(screen.getByRole('heading', { name: 'Rodilla' })).toBeInTheDocument()
    expect(screen.getByText(/Tibia sobre fémur/i)).toBeInTheDocument()
  })

  it('solo ofrece elegir eje cuando hay más de uno', async () => {
    const usuario = userEvent.setup()
    render(<ExploradorAnatomico />)
    // El codo es de un solo eje: enseñar un selector de uno no dice nada.
    expect(screen.queryByRole('button', { name: /Flexión \/ Extensión/i })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Hombro' }))
    // El hombro tiene tres: ahí sí hay que poder elegir.
    expect(screen.getByRole('button', { name: /Abducción \/ Aducción/i })).toBeInTheDocument()
    expect(screen.getByText(/3 grados de libertad/i)).toBeInTheDocument()
  })

  it('anuncia cuál está elegida para quien no ve el color', async () => {
    const usuario = userEvent.setup()
    render(<ExploradorAnatomico />)
    await usuario.click(screen.getByRole('button', { name: 'Cadera' }))
    expect(screen.getByRole('button', { name: 'Cadera' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Codo' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('explica lo que la articulación no puede hacer', async () => {
    const usuario = userEvent.setup()
    render(<ExploradorAnatomico />)
    // Es la mitad de entender una articulación, y lo que evita forzarla.
    expect(screen.getByText(/olécranon topa con su fosa/i)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Rodilla' }))
    expect(screen.getByText(/no se dobla hacia el otro lado/i)).toBeInTheDocument()
  })
})

describe('el arranque dirigido', () => {
  it('abre por la articulación que se le pide', () => {
    // Se llega aquí desde un ejercicio concreto: si el press mueve el hombro,
    // empezar por el codo obligaría a buscar lo que se venía a ver.
    render(<ExploradorAnatomico articulacionInicial="hombro" />)
    expect(screen.getByRole('heading', { name: 'Hombro' })).toBeInTheDocument()
  })

  it('cae en el codo si le piden una articulación que no existe', () => {
    // El id viene de fuera; que un id malo deje la pantalla en blanco sería
    // peor que enseñar otra cosa.
    render(<ExploradorAnatomico articulacionInicial="tercer-fémur" />)
    expect(screen.getByRole('heading', { name: 'Codo' })).toBeInTheDocument()
  })
})
