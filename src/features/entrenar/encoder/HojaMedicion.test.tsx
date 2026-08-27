import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { RegistroSerie } from '../RegistroSerie'
import type { EjercicioPrescrito } from '../../../domain/types'

/* Lo que se prueba aquí no es la cámara —jsdom no la tiene— sino la razón de
 * ser de esta integración: que al medir NO haya que teclear nada. El criterio
 * que decide si el protocolo es viable son los segundos que la medición le roba
 * a cada serie, y teclear ejercicio, carga y reps entre series es justo lo que
 * hay que quitar. Si algún día el ejercicio o la carga dejan de llegar solos,
 * esto se pone rojo. */

function ejercicio(): EjercicioPrescrito {
  return {
    id: 'e1',
    categoria: 'BISAGRA DE CADERA',
    nombre: 'PESO MUERTO CONVENCIONAL',
    cues: '',
    prescripcion: 'REGISTRA TU CARGA A 3 REPS; 5 SERIES (RIR 3).',
    descansoMin: 3,
    sets: 5,
    rango: '3',
    repsDiana: 3,
    rirObjetivo: 3,
    series: [],
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('medir desde dentro de la serie', () => {
  it('el botón de medir está en la serie, antes del de guardar', async () => {
    render(
      <RegistroSerie ejercicio={ejercicio()} orden={1} borradorId="b1" onGuardar={() => {}} />,
    )
    const botones = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    const medir = botones.findIndex((t) => /Medir con la cámara/i.test(t))
    const guardar = botones.findIndex((t) => /Guardar serie/i.test(t))
    expect(medir).toBeGreaterThanOrEqual(0)
    // Al guardar la serie este bloque desaparece: debajo del botón de guardar,
    // nadie vería el de medir a tiempo.
    expect(medir).toBeLessThan(guardar)
  })

  it('abrir la camara marca el documento, y cerrarla lo limpia', async () => {
    // Que la camara este abierta es un hecho global: se publica en el <body> y
    // lo lee `tokens.css`, que aplana la profundidad y para TODA animacion
    // mientras se captura a 50 fps. Un gabinete tiene cuatro animaciones
    // infinitas corriendo a la vez y hasta hoy ninguna paraba durante la toma.
    const usuario = userEvent.setup()
    const { unmount } = render(
      <RegistroSerie ejercicio={ejercicio()} orden={1} borradorId="b-cam" onGuardar={() => {}} />,
    )

    expect(document.body.dataset.camaraAbierta).toBeUndefined()

    await usuario.click(screen.getByRole('button', { name: /Medir con la cámara/i }))
    expect(document.body.dataset.camaraAbierta).toBe('si')

    // Se desmonta en vez de pulsar el cierre a proposito: lo que hay que
    // garantizar es que el atributo NO se queda pegado pase lo que pase — si se
    // filtrara, la app entera se quedaria sin animaciones hasta recargar.
    unmount()
    expect(document.body.dataset.camaraAbierta).toBeUndefined()
  })

  it('la hoja llega con el ejercicio, la carga y las reps ya puestos', async () => {
    render(
      <RegistroSerie ejercicio={ejercicio()} orden={1} borradorId="b2" onGuardar={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Medir con la cámara/i }))

    const hoja = await screen.findByRole('dialog', { name: /Medir la barra/i })
    expect(hoja).toHaveTextContent('PESO MUERTO CONVENCIONAL')
    // 3 reps salen de `repsDiana`; la carga, de `cargaSugerida`.
    expect(hoja).toHaveTextContent('3 reps')
    expect(hoja).toHaveTextContent(/no hay nada que teclear/i)
  })

  it('avisa de que los números son provisionales, también aquí dentro', async () => {
    render(
      <RegistroSerie ejercicio={ejercicio()} orden={1} borradorId="b3" onGuardar={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Medir con la cámara/i }))
    const hoja = await screen.findByRole('dialog', { name: /Medir la barra/i })
    expect(hoja).toHaveTextContent(/Provisional/i)
    expect(hoja).toHaveTextContent(/No entran en tu historial/i)
  })

  it('el disco elegido se recuerda entre series', async () => {
    const { unmount } = render(
      <RegistroSerie ejercicio={ejercicio()} orden={1} borradorId="b4" onGuardar={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Medir con la cámara/i }))
    await userEvent.click(screen.getByRole('button', { name: /Olímpico 15 kg/i }))
    expect(localStorage.getItem('alpha-encoder-diametro')).toBe('400')
    unmount()

    // En una sesión no cambias de disco cada serie: volver a elegirlo nueve
    // veces es tiempo que cuenta en el criterio de segundos añadidos.
    render(
      <RegistroSerie ejercicio={ejercicio()} orden={2} borradorId="b5" onGuardar={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Medir con la cámara/i }))
    expect(screen.getByRole('button', { name: /Olímpico 15 kg/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

describe('el disco se recuerda por ejercicio, no a secas', () => {
  const CLAVE = 'alpha-encoder-diametro'
  const DEL_PESO_MUERTO = `${CLAVE}:peso muerto convencional`

  async function abrirHojaYElegir(etiqueta: string) {
    await userEvent.click(screen.getByRole('button', { name: /Medir con la cámara/i }))
    await screen.findByRole('dialog', { name: /Medir la barra/i })
    await userEvent.click(screen.getByRole('button', { name: etiqueta }))
  }

  it('elegir un disco lo guarda bajo la clave DEL EJERCICIO', async () => {
    // Alternar peso muerto con bumper y press con olímpico traía cada serie con
    // el disco del otro. Cambiarlo cuesta un toque; no cambiarlo saca la escala
    // de un diámetro equivocado, y eso produce un número perfectamente creíble.
    render(
      <RegistroSerie ejercicio={ejercicio()} orden={1} borradorId="d1" onGuardar={() => {}} />,
    )
    await abrirHojaYElegir('Hierro 10 kg')
    expect(localStorage.getItem(DEL_PESO_MUERTO)).toBe('325')
  })

  it('y también el global, que es de donde hereda un ejercicio nuevo', async () => {
    // La primera medición de un ejercicio que no tiene disco propio acierta más
    // veces heredando el último usado que empezando siempre en 450.
    render(
      <RegistroSerie ejercicio={ejercicio()} orden={1} borradorId="d2" onGuardar={() => {}} />,
    )
    await abrirHojaYElegir('Olímpico 15 kg')
    expect(localStorage.getItem(CLAVE)).toBe('400')
  })

  it('al reabrir, el ejercicio recupera EL SUYO y no el del otro', async () => {
    localStorage.setItem(DEL_PESO_MUERTO, '325')
    localStorage.setItem(CLAVE, '450') // el último de otro ejercicio
    render(
      <RegistroSerie ejercicio={ejercicio()} orden={1} borradorId="d3" onGuardar={() => {}} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Medir con la cámara/i }))
    await screen.findByRole('dialog', { name: /Medir la barra/i })
    // El chip activo es el suyo, no el global.
    expect(screen.getByRole('button', { name: 'Hierro 10 kg' }).className).toMatch(/border-rojo/)
  })
})
