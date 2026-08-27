import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComoLlegas } from './ruta/ComoLlegas'
import { CompetenciasEvaluadas } from './ruta/CompetenciasEvaluadas'
import { TarjetaProgresoNivel } from './ruta/TarjetaProgresoNivel'
import { Sheet } from '../../components/ui/Sheet'

/**
 * Lo que se anima tiene que quedarse en el compositor.
 *
 * Estas cuatro barras animaban `width` durante 700 ms. `width` dispara maquetación,
 * pintado y composición en cada fotograma, y todas viven en pantallas que ya tienen
 * algo caro corriendo: la Ruta hace scrub de un canvas de 36 fotogramas en su propio
 * `requestAnimationFrame`, y el par de errores del encuadre se arrastra con la cámara
 * abierta a 50 fps.
 *
 * El repo ya tenía la técnica correcta escrita —`scaleX` con `transform-origin: left`,
 * que es lo que hacen `barra-crece` y `crecer-barra` en `tokens.css`— y estas pantallas
 * eran justo las que no la usaban.
 *
 * Se comprueba la propiedad y no el aspecto: el riesgo real es que alguien vuelva a
 * poner un `width` porcentual porque «es más fácil de leer», y eso no lo caza ningún
 * test visual.
 */

function rellenoDe(barra: HTMLElement) {
  const relleno = barra.querySelector('span')
  expect(relleno).not.toBeNull()
  return relleno as HTMLElement
}

describe('las barras de progreso se mueven en el compositor, no en la maquetación', () => {
  it('el índice de recuperación va por scaleX y no por width', () => {
    render(<ComoLlegas recuperacion={{ indice: 62, dias: 4 }} />)
    const relleno = rellenoDe(screen.getByRole('progressbar'))

    expect(relleno.style.transform).toBe('scaleX(0.62)')
    expect(relleno.style.width).toBe('')
    expect(relleno.className).toContain('origin-left')
  })

  it('cada competencia evaluada va por scaleX y no por width', () => {
    render(
      <CompetenciasEvaluadas
        competencias={[
          { id: 'a', nombre: 'Empuje', pct: 40, nota: 'nota' },
          { id: 'b', nombre: 'Tracción', pct: 90, nota: 'nota' },
        ]}
      />,
    )
    const barras = screen.getAllByRole('progressbar')
    expect(barras).toHaveLength(2)
    for (const barra of barras) {
      const relleno = rellenoDe(barra)
      expect(relleno.style.width).toBe('')
      expect(relleno.style.transform).toMatch(/^scaleX\(/)
    }
  })

  it('el progreso de nivel va por scaleX, y el halo NO viaja con el relleno', () => {
    render(
      <TarjetaProgresoNivel
        pct={50}
        nivelActual={{
          numero: '03',
          nombre: 'RENDIMIENTO',
          nivelMetodo: 'intermedio',
          descripcion: 'da igual para esta prueba',
          estado: 'actual',
        }}
        siguienteNivel={{
          numero: '04',
          nombre: 'ELITE',
          nivelMetodo: 'avanzado',
          descripcion: 'da igual para esta prueba',
          estado: 'bloqueado',
        }}
        estadisticas={[]}
      />,
    )
    const barra = screen.getByRole('progressbar')
    const relleno = rellenoDe(barra)

    expect(relleno.style.transform).toBe('scaleX(0.5)')
    expect(relleno.style.width).toBe('')
    // El halo se quedó en el carril: sobre el relleno había que re-rasterizar un
    // anillo de 3 px más una sombra de 24 px en cada fotograma del recorrido, y una
    // sombra sobre algo que escala se deforma con él.
    expect(barra.style.boxShadow).toContain('--glow-accion')
    expect(relleno.style.boxShadow).toBe('')
  })
})

/**
 * La hoja que abre la cámara no puede entrar deslizando.
 *
 * `Sheet` gana entrada (`.scrim-entra` + `.subir-hoja`) porque once consumidores la
 * necesitaban y ninguno la tenía. Pero `HojaMedicion` monta el visor y arranca
 * `getUserMedia`, así que los 420 ms de `subir-hoja` caerían justo encima de los
 * primeros fotogramas de captura — el instante más caro de la app.
 *
 * Si alguien borra ese `animar={false}` no se rompe nada visible: simplemente se
 * empieza a perder alguna toma en móviles lentos, que es la peor clase de regresión.
 */
describe('Sheet: la entrada es opcional porque la hoja de la cámara no puede pagarla', () => {
  it('por defecto la hoja entra deslizando', () => {
    render(
      <Sheet abierto titulo="Cualquiera" onCerrar={() => {}}>
        <p>contenido</p>
      </Sheet>,
    )
    const dialogo = screen.getByRole('dialog', { name: 'Cualquiera' })
    expect(dialogo.querySelector('.subir-hoja')).not.toBeNull()
    expect(dialogo.querySelector('.scrim-entra')).not.toBeNull()
  })

  it('con animar={false} no se aplica ninguna de las dos clases', () => {
    render(
      <Sheet abierto titulo="Medir la barra" onCerrar={() => {}} animar={false}>
        <p>contenido</p>
      </Sheet>,
    )
    const dialogo = screen.getByRole('dialog', { name: 'Medir la barra' })
    expect(dialogo.querySelector('.subir-hoja')).toBeNull()
    expect(dialogo.querySelector('.scrim-entra')).toBeNull()
  })
})
