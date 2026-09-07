import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Contenido } from '../../domain/types'
import { esVideoDirecto } from '../../lib/videoDirecto'
import { VisorContenido } from './VisorContenido'

const base: Contenido = {
  id: 'c-prueba',
  tipo: 'video',
  categoria: 'Patrones de movimiento',
  titulo: 'Extensión de cadera en máquina',
  descripcion: 'Demostración grabada en el gimnasio.',
  url: 'https://ejemplo.supabase.co/storage/v1/object/public/demos/extension-de-cadera.mp4',
  patronMovimiento: 'Extensión de cadera',
}

describe('VisorContenido', () => {
  it('un vídeo de YouTube sigue saliendo en su iframe, como siempre', () => {
    const { container } = render(
      <VisorContenido contenido={{ ...base, url: 'https://www.youtube.com/watch?v=Dy28eq2PjcM' }} />,
    )
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('Dy28eq2PjcM')
    expect(container.querySelector('video')).toBeNull()
    expect(screen.getByRole('link', { name: /YouTube/ })).toBeInTheDocument()
  })

  it('un archivo de vídeo alojado en el proyecto se reproduce directo, sin pantalla completa forzada', () => {
    const { container } = render(<VisorContenido contenido={base} />)
    const video = container.querySelector('video')
    expect(video).not.toBeNull()
    expect(video?.getAttribute('src')).toBe(base.url)
    expect(video?.hasAttribute('controls')).toBe(true)
    expect(video?.hasAttribute('playsinline')).toBe(true)
    expect(video?.getAttribute('preload')).toBe('metadata')
    expect(container.querySelector('iframe')).toBeNull()
    // El enlace de salida sigue ahí: si el navegador no puede con el archivo, se abre aparte.
    expect(screen.getByRole('link', { name: /Abrir video/ })).toHaveAttribute('href', base.url)
  })

  it('un vídeo sin URL reconocible no pinta reproductor, solo la descripción', () => {
    const { container } = render(<VisorContenido contenido={{ ...base, url: 'https://ejemplo.com/sin-archivo' }} />)
    expect(container.querySelector('video')).toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
    expect(screen.getByText(base.descripcion)).toBeInTheDocument()
  })
})

describe('esVideoDirecto', () => {
  it('reconoce los archivos de vídeo por la ruta y deja fuera a YouTube y a lo que no es un archivo', () => {
    expect(esVideoDirecto(base.url)).toBe(true)
    expect(esVideoDirecto('https://ejemplo.com/clip.MOV')).toBe(true)
    expect(esVideoDirecto('https://www.youtube.com/watch?v=Dy28eq2PjcM')).toBe(false)
    expect(esVideoDirecto('https://youtu.be/Dy28eq2PjcM')).toBe(false)
    expect(esVideoDirecto('https://ejemplo.com/pagina')).toBe(false)
    expect(esVideoDirecto('no es una url.mp4')).toBe(false)
    expect(esVideoDirecto('')).toBe(false)
    expect(esVideoDirecto(undefined)).toBe(false)
  })
})
