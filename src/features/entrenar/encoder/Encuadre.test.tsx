import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Encuadre } from './Encuadre'
import { textoDeMotivo } from './motivosEncuadre'
import { calificarEncuadre, encuadre } from './nucleo/encuadre'

/* Las tres colocaciones son las de `datos-de-ejemplo.json`, y la mala es la mala
 * conocida del corpus: el móvil apoyado en el suelo a un metro. */

const COLOCADA_BIEN = { dist: 2.5, altura: 0.95, desvio: 0 }
const EN_EL_SUELO = { dist: 1.0, altura: 0.15, desvio: 0 }
const FUERA_DEL_EJE = { dist: 2.5, altura: 0.95, desvio: 22 }

describe('el traductor de motivos salva la ñ del núcleo', () => {
  it('disco_pequeño con ñ encuentra su copy sin ñ', () => {
    // El núcleo es de solo lectura y las claves de copy vienen del entregable de
    // diseño: si esto se rompe, la pantalla pinta la clave cruda en lugar del
    // texto, y solo en el menos frecuente de los cuatro motivos.
    expect(textoDeMotivo('disco_pequeño')).toBe('Disco pequeño')
    expect(textoDeMotivo('camara_baja')).toBe('Cámara baja')
    expect(textoDeMotivo('no_cabe')).toBe('No cabe')
    expect(textoDeMotivo('no_es_lateral')).toBe('No es lateral')
    expect(textoDeMotivo('desvio_sin_disco')).toBe('Muy en diagonal para no llevar disco')
  })
})

describe('el par de errores se enseña SIEMPRE', () => {
  it('también cuando el encuadre es bueno', () => {
    // Es lo que impide que un sello llano se lea como una promesa. Y hace falta:
    // el núcleo aprueba 22° de desvío, que llevan el error sin corregir al 14,7 %.
    render(<Encuadre inicial={COLOCADA_BIEN} />)
    expect(screen.getByText('sin corregir')).toBeInTheDocument()
    expect(screen.getByText('corrigiendo')).toBeInTheDocument()
  })

  it('y cuando está descartado, que es donde convence', () => {
    render(<Encuadre inicial={EN_EL_SUELO} />)
    expect(screen.getByText('sin corregir')).toBeInTheDocument()
    expect(screen.getByText('corrigiendo')).toBeInTheDocument()
  })

  it('dice que corrigiendo no se llega a cero', () => {
    // `errorCorregido` es 1/discoPx: nunca es cero, y presentarlo sin decirlo
    // convertiría la segunda cifra en una promesa de exactitud.
    render(<Encuadre inicial={COLOCADA_BIEN} />)
    expect(screen.getByText(/nunca se llega a cero/)).toBeInTheDocument()
  })
})

describe('el veredicto es el del núcleo, sin criterio propio de la pantalla', () => {
  it('bien colocada: sale buena y lo dice', () => {
    render(<Encuadre inicial={COLOCADA_BIEN} />)
    expect(screen.getByText('Buena')).toBeInTheDocument()
    expect(screen.getByText(/se puede confiar/)).toBeInTheDocument()
  })

  it('en el suelo: los motivos ocupan el sitio del veredicto', () => {
    render(<Encuadre inicial={EN_EL_SUELO} />)
    expect(screen.getByText('Desde aquí no.')).toBeInTheDocument()
    expect(screen.getByText(/Cámara baja · No cabe/)).toBeInTheDocument()
  })

  it('22° de desvío sin disco: ya no salen buena (puerta del 2026-08-26)', () => {
    // Este test documentaba lo contrario. Hasta el 26/08 el núcleo solo miraba
    // desvío > 30°, así que 22° devolvían `buena` con un 14,7 % de error sin
    // corregir, y la pantalla solo podía enseñar la cifra sin contradecirlo.
    // La puerta ya está decidida y vive en `calificarEncuadre`.
    const e = encuadre({ ...FUERA_DEL_EJE, fov: 70 })
    expect(calificarEncuadre(e).nivel).toBe('descartada')
    expect(e.errorSinCorregir).toBeGreaterThan(0.14)

    render(<Encuadre inicial={FUERA_DEL_EJE} />)
    expect(screen.getByText('Desde aquí no.')).toBeInTheDocument()
    // y el 14,7 % se sigue enseñando: el motivo explica, la cifra demuestra
    expect(screen.getByText(/14\.[0-9] %/)).toBeInTheDocument()
  })

  it('los mismos 22° CON disco pasan: φ se mide de la elipse y se corrige', () => {
    const e = encuadre({ ...FUERA_DEL_EJE, fov: 70 })
    expect(calificarEncuadre(e, { hayDisco: true }).nivel).toBe('buena')
    // Lo que queda tras corregir no depende del ángulo: es el ruido del borde.
    expect(e.errorCorregido).toBeLessThan(0.02)
  })

  it('el interruptor de disco cambia el veredicto sin mover la cámara', () => {
    render(<Encuadre inicial={FUERA_DEL_EJE} />)
    expect(screen.getByText('Desde aquí no.')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/Se ve un disco de la barra/))

    expect(screen.getByText('Desde aquí sale una medida en la que se puede confiar.'))
      .toBeInTheDocument()
  })
})

describe('los controles mueven la geometría', () => {
  it('bajar la lente al suelo cambia el veredicto', () => {
    render(<Encuadre inicial={COLOCADA_BIEN} />)
    expect(screen.getByText('Buena')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Altura lente'), { target: { value: '0.05' } })
    fireEvent.change(screen.getByLabelText('Distancia'), { target: { value: '1' } })

    expect(screen.queryByText('Buena')).toBeNull()
    expect(screen.getByText('Desde aquí no.')).toBeInTheDocument()
  })

  it('el diagrama cuenta los dos errores por separado', () => {
    // Girar y subir el trípode son correcciones opuestas: si la pantalla no
    // distingue cuál se está cometiendo, la persona prueba la que no es.
    render(<Encuadre inicial={FUERA_DEL_EJE} />)
    expect(screen.getByText('22° fuera del eje')).toBeInTheDocument()
    expect(screen.getByText('a la altura del eje')).toBeInTheDocument()
  })
})

describe('la nota del pie', () => {
  it('dice que esto descarta colocaciones, no que garantice precisión', () => {
    render(<Encuadre inicial={COLOCADA_BIEN} />)
    expect(screen.getByText(/sirve para descartar colocaciones/)).toBeInTheDocument()
  })
})

describe('confirmar devuelve la colocación elegida', () => {
  it('entrega los tres valores, no el veredicto', () => {
    const recibido: Array<{ dist: number; altura: number; desvio: number }> = []
    render(<Encuadre inicial={COLOCADA_BIEN} onConfirmar={(v) => recibido.push(v)} />)
    fireEvent.click(screen.getByText('Ya está colocada'))
    expect(recibido).toEqual([{ dist: 2.5, altura: 0.95, desvio: 0 }])
  })
})

describe('una sola placa para los tres estados', () => {
  it('el nodo PERSISTE al cruzar el umbral, no se sustituye', () => {
    // De esto depende que la placa pueda moverse. Hasta hoy `descartada`
    // renderizaba OTRO componente, así que al cruzar el umbral arrastrando el
    // desvío el nodo no cambiaba de estado: se sustituía. Y una transición sobre
    // un nodo que nace ya en su estado final no interpola nada, por muy bien
    // escrito que esté el `transform`.
    //
    // Se comprueba con la identidad del nodo del DOM, que es justamente lo que
    // React tira al cambiar el tipo de elemento.
    // Se cruza moviendo los DESLIZADORES, no con `rerender`: esta pantalla
    // inicializa su estado una sola vez, así que cambiar la prop `inicial` no
    // mueve nada. La primera versión de este test lo hacía así y pasaba en vacío
    // — con el nodo forzado a sustituirse seguía en verde.
    const { container } = render(<Encuadre inicial={COLOCADA_BIEN} />)
    const placa = () => container.querySelector('[style*="clip-path"], [style*="clipPath"]')
    const antes = placa()
    expect(antes).toBeTruthy()
    expect(screen.getByText('Buena')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Altura lente'), { target: { value: '0.05' } })
    fireEvent.change(screen.getByLabelText('Distancia'), { target: { value: '1' } })

    // Ya es otro veredicto...
    expect(screen.getByText('Desde aquí no.')).toBeInTheDocument()
    // ...y sigue siendo el MISMO nodo.
    expect(placa()).toBe(antes)
  })

  it('la descartada conserva su titular y sus motivos en grande', () => {
    // Unificar el nodo no puede costar información: cuando la toma no sirve, el
    // porqué es lo más importante de la pantalla.
    render(<Encuadre inicial={EN_EL_SUELO} />)
    expect(screen.getByText('Desde aquí no.')).toBeInTheDocument()
    const motivos = screen.getByText(/Cámara baja · No cabe/)
    expect(motivos.className).toContain('font-display')
    expect(motivos.className).toContain('font-bold')
  })
})

