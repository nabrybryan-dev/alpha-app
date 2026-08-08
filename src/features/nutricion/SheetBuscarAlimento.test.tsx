import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetBuscarAlimento } from './SheetBuscarAlimento'
import { catalogoRepo } from '../../data/catalogo/catalogoRepo'

/**
 * Corre contra el catálogo real de 1.196 alimentos, no contra un montaje: lo
 * que importa de un buscador es que encuentre lo que la gente escribe de
 * verdad, y eso no se prueba con tres alimentos inventados.
 */

const pintar = (props: Partial<Parameters<typeof SheetBuscarAlimento>[0]> = {}) => {
  const onElegir = vi.fn()
  render(
    <SheetBuscarAlimento abierto onCerrar={vi.fn()} onElegir={onElegir} {...props} />,
  )
  return { onElegir }
}

const campo = () => screen.getByLabelText('Nombre del alimento')

describe('SheetBuscarAlimento', () => {
  it('encuentra escribiendo, sin tildes', async () => {
    pintar()
    await userEvent.type(campo(), 'platano')
    expect(screen.getAllByText(/plátano/i).length).toBeGreaterThan(0)
  })

  it('al tocar un resultado, lo entrega', async () => {
    const { onElegir } = pintar()
    await userEvent.type(campo(), 'arroz')
    const filas = screen.getAllByRole('button', { name: /kcal\/100 g/i })
    await userEvent.click(filas[0])
    expect(onElegir).toHaveBeenCalledTimes(1)
    expect(onElegir.mock.calls[0][0].nombre).toMatch(/arroz/i)
  })

  it('el contador dice cuántos hay de los 1.196', async () => {
    pintar()
    await userEvent.type(campo(), 'arroz')
    expect(screen.getByText(/de 1.196 alimentos/)).toBeInTheDocument()
  })

  it('un filtro deja solo su grupo', async () => {
    pintar()
    await userEvent.click(screen.getByRole('button', { name: 'Grasas' }))
    const elegidos = catalogoRepo.buscar('', { grupo: 'grasas' }, 60)
    expect(screen.getByText(new RegExp(`${elegidos.length} de`))).toBeInTheDocument()
  })

  it('las legumbres son alcanzables desde un chip', async () => {
    // No están en el diseño; sin ellas el fríjol y la lenteja solo se
    // alcanzarían escribiendo el nombre exacto.
    pintar()
    await userEvent.click(screen.getByRole('button', { name: 'Legumbres' }))
    expect(screen.getAllByText(/fríjol|frijol|lenteja/i).length).toBeGreaterThan(0)
  })

  describe('el chip de estado', () => {
    it('aparece cuando el alimento existe en varios estados', async () => {
      pintar()
      await userEvent.type(campo(), 'arroz')
      const conVariantes = catalogoRepo
        .buscar('arroz', {}, 60)
        .find((a) => catalogoRepo.variantesDe(a).length > 0)
      if (!conVariantes) throw new Error('el catálogo no trae ningún arroz con varios estados')
      const fila = screen.getByText(conVariantes.nombre).closest('button')
      expect(within(fila as HTMLElement).getByText(conVariantes.estado)).toBeInTheDocument()
    })

    it('no aparece cuando solo hay un estado', async () => {
      pintar()
      await userEvent.type(campo(), 'aceite de girasol')
      const unico = catalogoRepo
        .buscar('aceite de girasol', {}, 60)
        .find((a) => catalogoRepo.variantesDe(a).length === 0)
      if (!unico) throw new Error('se esperaba un aceite con un solo estado')
      const fila = screen.getByText(unico.nombre).closest('button')
      expect(within(fila as HTMLElement).queryByText(unico.estado)).not.toBeInTheDocument()
    })
  })

  describe('cuando no hay nada', () => {
    it('no deja al asesorado en un callejón sin salida', async () => {
      pintar()
      await userEvent.type(campo(), 'zzzzqqq')
      expect(screen.getByText(/pídele a tu coach que lo agregue/i)).toBeInTheDocument()
    })

    it('sin nada registrado, invita a buscar en vez de decir "vacío"', () => {
      pintar({ recientes: [] })
      expect(screen.getByText(/todavía no has registrado nada/i)).toBeInTheDocument()
    })
  })

  describe('recientes', () => {
    it('abre por lo último que registró, en ese orden', () => {
      const [uno, dos] = catalogoRepo.buscar('arroz', {}, 2)
      pintar({ recientes: [dos.id, uno.id] })
      const filas = screen.getAllByRole('button', { name: /kcal\/100 g/i })
      expect(within(filas[0]).getByText(dos.nombre)).toBeInTheDocument()
      expect(within(filas[1]).getByText(uno.nombre)).toBeInTheDocument()
    })

    it('un id que ya no existe en el catálogo se ignora sin romper nada', () => {
      const [uno] = catalogoRepo.buscar('arroz', {}, 1)
      pintar({ recientes: ['fantasma', uno.id] })
      expect(screen.getAllByRole('button', { name: /kcal\/100 g/i })).toHaveLength(1)
    })

    it('al escribir, la búsqueda manda sobre los recientes', async () => {
      const [uno] = catalogoRepo.buscar('arroz', {}, 1)
      pintar({ recientes: [uno.id] })
      await userEvent.type(campo(), 'pollo')
      expect(screen.queryByText(uno.nombre)).not.toBeInTheDocument()
    })
  })
})
