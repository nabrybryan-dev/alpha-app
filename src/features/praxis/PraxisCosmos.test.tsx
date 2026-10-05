import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PraxisCosmos } from './PraxisCosmos'
import type { Trato } from './motor/entorno'

/**
 * jsdom no anima ni pinta: no tiene `Element.animate`, ni lienzo, ni `matchMedia`. Aquí se
 * prueba la LÓGICA de la pantalla —qué texto sale en cada trato, qué camino toma con
 * movimiento reducido, qué enseña la Quieta—, no los píxeles. Lo que se ve se comprueba
 * con capturas en un navegador de verdad.
 */
function ponerMedio(reducido: boolean) {
  window.matchMedia = ((consulta: string) => ({
    matches: reducido && consulta.includes('prefers-reduced-motion'),
    media: consulta,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function montar(trato: Trato = 'tu') {
  const r = render(
    <MemoryRouter>
      <PraxisCosmos trato={trato} />
    </MemoryRouter>,
  )
  const raiz = r.container.querySelector('.praxis') as HTMLElement
  const $ = (s: string) => raiz.querySelector(s) as HTMLElement
  return { ...r, raiz, $ }
}

/** Abre la sala y acepta la bienvenida: deja a Praxis diciendo su primera frase. */
async function abrirYAceptar(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole('button', { name: 'Hablar con Praxis' }))
  await u.click(await screen.findByRole('button', { name: 'Acepto y empiezo' }))
}

beforeEach(() => {
  localStorage.clear()
  ponerMedio(false)
  // jsdom avisa por consola en cada getContext: aquí no hay lienzo y la escena lo tolera.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Praxis · el aviso de EJEMPLO', () => {
  it('dice a la vista que los datos son de ejemplo, en la portada y en la sala', () => {
    const { $ } = montar()
    expect(screen.getByText('Datos de ejemplo')).toBeInTheDocument()
    expect($('#salaFecha').textContent).toContain('EJEMPLO')
    expect(screen.getByText(/Todas las personas, fechas y cifras son de ejemplo/)).toBeInTheDocument()
  })
})

describe('Praxis · tú y usted', () => {
  it('en tú, toda la portada va en tú', () => {
    const { raiz } = montar('tu')
    expect(screen.getByRole('heading', { name: '¿Cómo amaneciste?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tu semana' })).toBeInTheDocument()
    expect(screen.getByText('Tus permisos')).toBeInTheDocument()
    expect(raiz.textContent).not.toMatch(/¿Cómo amaneció\?|Sus permisos|Su semana/)
  })

  it('en usted, toda la portada va en usted y no se mezcla con el tú', () => {
    const { raiz, $ } = montar('usted')
    expect(screen.getByRole('heading', { name: '¿Cómo amaneció?' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Su semana' })).toBeInTheDocument()
    expect(screen.getByText('Sus permisos')).toBeInTheDocument()
    expect($('#entrada').getAttribute('placeholder')).toBe('Cuéntemelo con sus palabras')
    expect(raiz.textContent).not.toMatch(/amaneciste|Tus permisos|Tu semana|tu teléfono|lo que cuentas/)
  })

  it('la primera pregunta de Praxis respeta el trato', async () => {
    ponerMedio(true) // con movimiento reducido la frase llega entera: se lee de una vez
    const u = userEvent.setup()
    const { $ } = montar('usted')
    await abrirYAceptar(u)
    await waitFor(() => expect($('#frase').textContent).toMatch(/¿Pudo dejar el celular cargando en la cocina\?/))
    expect($('#frase').textContent).toContain('Bryan y Manuela leen su resumen después.')
    expect($('#frase').textContent).not.toMatch(/Pudiste|tu resumen/)
  })
})

describe('Praxis · movimiento reducido', () => {
  it('con prefers-reduced-motion la frase llega entera desde el primer cuadro', async () => {
    ponerMedio(true)
    const u = userEvent.setup()
    const { $, raiz } = montar()
    await abrirYAceptar(u)
    await waitFor(() => expect(raiz.querySelectorAll('#frase .w').length).toBeGreaterThan(10))
    await waitFor(() => {
      const palabras = Array.from(raiz.querySelectorAll('#frase .w'))
      expect(palabras.every((w) => w.classList.contains('on'))).toBe(true)
    })
    expect($('#dicho').classList.contains('lee')).toBe(false)
    expect($('#btnCompletar').hidden).toBe(true)
  })

  it('sin la preferencia, la frase se revela palabra a palabra', async () => {
    const u = userEvent.setup()
    const { $, raiz } = montar()
    await abrirYAceptar(u)
    await waitFor(() => expect($('#dicho').classList.contains('lee')).toBe(true))
    const palabras = Array.from(raiz.querySelectorAll('#frase .w'))
    expect(palabras.length).toBeGreaterThan(10)
    expect(palabras.some((w) => !w.classList.contains('on'))).toBe(true)
  })

  it('con movimiento reducido no hay agujero viajero ni estrellas viajeras', async () => {
    ponerMedio(true)
    const u = userEvent.setup()
    const { raiz } = montar()
    await abrirYAceptar(u)
    expect(raiz.querySelector('.viaje')).toBeNull()
    expect(raiz.querySelector('.viajera')).toBeNull()
  })

  it('el ajuste propio «Movimiento suave» lleva al mismo camino quieto', async () => {
    const u = userEvent.setup()
    const { $, raiz } = montar()
    await u.click($('#cMovSuave'))
    expect(raiz.hasAttribute('data-mov-suave')).toBe(true)
    await abrirYAceptar(u)
    await waitFor(() => expect(raiz.querySelectorAll('#frase .w').length).toBeGreaterThan(10))
    await waitFor(() => {
      const palabras = Array.from(raiz.querySelectorAll('#frase .w'))
      expect(palabras.every((w) => w.classList.contains('on'))).toBe(true)
    })
    expect($('#dicho').classList.contains('lee')).toBe(false)
  })
})

describe('Praxis · la Quieta', () => {
  it('la demostración muestra los números de ayuda, llamables y a la vista', async () => {
    const u = userEvent.setup()
    const { $, raiz } = montar()
    await u.click($('#btnDemoQuieta'))
    const panel = raiz.querySelector('.quieta') as HTMLElement
    expect(panel).not.toBeNull()
    const enlaces = Array.from(panel.querySelectorAll('a[href^="tel:"]')).map((a) => a.getAttribute('href'))
    expect(enlaces).toContain('tel:123')
    expect(enlaces.length).toBeGreaterThanOrEqual(2)
    const numeros = Array.from(panel.querySelectorAll('.numero-quieta .mono')).map((n) => n.textContent)
    expect(numeros).toContain('123')
    expect(panel.textContent).toContain('Si es urgente, no lo esperes: llama al 123.')
  })

  it('apaga lo lúdico: sin pentagrama, sin muelle y sin controles de juego', async () => {
    const u = userEvent.setup()
    const { $, raiz } = montar()
    await u.click($('#btnDemoQuieta'))
    expect($('#penta').hidden).toBe(true)
    expect($('#muelle').hidden).toBe(true)
    expect(raiz.querySelector('#controles .ochip')).toBeNull()
    expect($('#ondaCaja').classList.contains('compacta')).toBe(true)
  })

  it('una frase de riesgo escrita detiene la conversación y enseña los números', async () => {
    ponerMedio(true)
    const u = userEvent.setup()
    const { $, raiz } = montar()
    await abrirYAceptar(u)
    await u.type($('#entrada'), 'no quiero vivir más{Enter}')
    const panel = raiz.querySelector('.quieta') as HTMLElement
    expect(panel).not.toBeNull()
    expect(panel.querySelector('a[href="tel:123"]')).not.toBeNull()
    expect($('#muelle').hidden).toBe(true)
  })

  it('la violencia de pareja lleva a la Línea 155', async () => {
    ponerMedio(true)
    const u = userEvent.setup()
    const { $, raiz } = montar()
    await abrirYAceptar(u)
    await u.type($('#entrada'), 'mi esposo me pegó anoche{Enter}')
    expect(raiz.querySelector('.quieta a[href="tel:155"]')).not.toBeNull()
  })

  it('en usted, la Quieta habla de usted y los números no cambian', async () => {
    const u = userEvent.setup()
    const { $, raiz } = montar('usted')
    await u.click($('#btnDemoQuieta'))
    const panel = raiz.querySelector('.quieta') as HTMLElement
    expect(panel.textContent).toContain('llame ahora')
    expect(panel.textContent).not.toContain('llama ahora')
    expect(panel.querySelector('a[href="tel:123"]')).not.toBeNull()
  })
})

describe('Praxis · al salir no deja nada puesto', () => {
  it('desmontar quita la clase del body', async () => {
    const u = userEvent.setup()
    const { $, unmount } = montar()
    await u.click($('#btnDemoQuieta'))
    expect(document.body.classList.contains('praxis-sala-abierta')).toBe(true)
    unmount()
    expect(document.body.classList.contains('praxis-sala-abierta')).toBe(false)
  })
})
