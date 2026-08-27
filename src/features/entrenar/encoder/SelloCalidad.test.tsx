import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NumeroConError, IntervaloAEscala } from './NumeroConError'
import { PlacaHundida, SelloCalidad } from './SelloCalidad'
import { COPY } from './copys'

/* Estas pruebas no comprueban que "se vea bonito": comprueban las cuatro
 * restricciones que el diseño puso por escrito y que son fáciles de romper sin
 * darse cuenta al retocar estilos. */

describe('el sello de calidad', () => {
  it('los tres estados usan el MISMO cuerpo tipográfico', () => {
    // Si el estado se leyera en la letra, dejaría de leerse en la forma. El eje
    // es la materia de la placa, y solo la materia.
    const cuerpos = (['buena', 'dudosa', 'descartada'] as const).map((nivel) => {
      const { container, unmount } = render(<SelloCalidad nivel={nivel} />)
      const titulo = container.querySelector('p')!
      const clases = titulo.className
      unmount()
      return clases
    })
    expect(cuerpos[0]).toBe(cuerpos[1])
    expect(cuerpos[1]).toBe(cuerpos[2])
    expect(cuerpos[0]).toContain('text-[25px]')
    expect(cuerpos[0]).toContain('font-extrabold')
  })

  it('descartada NO se señala bajando la opacidad', () => {
    // A tres metros con luz de gimnasio un elemento al 50 % desaparece, y
    // descartada es justo el que más tiene que verse. Se señala con materia.
    const { container } = render(<SelloCalidad nivel="descartada" />)
    const placa = container.querySelector('[style*="clip-path"]')!
    expect(placa.className).not.toMatch(/opacity-[0-7]/)
    expect(placa.className).toContain('--hundido')
    expect(placa.className).toContain('--sombra-hundido')
  })

  it('los tres comparten silueta: el mismo troquel', () => {
    const clips = (['buena', 'dudosa', 'descartada'] as const).map((nivel) => {
      const { container, unmount } = render(<SelloCalidad nivel={nivel} />)
      const clip = container.querySelector<HTMLElement>('[style*="clip-path"]')!.style.clipPath
      unmount()
      return clip
    })
    expect(new Set(clips).size).toBe(1)
    expect(clips[0]).toContain('var(--troquel)')
  })

  it('el motivo va soldado a la placa, y buena no lo lleva', () => {
    // Un sello dudoso sin su motivo no es un sello.
    render(
      <SelloCalidad nivel="dudosa">
        <span>Pocos fps</span>
      </SelloCalidad>,
    )
    expect(screen.getByText('Pocos fps')).toBeInTheDocument()

    const { queryByText } = render(
      <SelloCalidad nivel="buena">
        <span>no deberia salir</span>
      </SelloCalidad>,
    )
    expect(queryByText('no deberia salir')).not.toBeInTheDocument()
  })

  it('usa los copys cerrados, no textos inventados', () => {
    render(<SelloCalidad nivel="descartada" />)
    expect(screen.getByText(COPY.calidad_descartada)).toBeInTheDocument()
    expect(screen.getByText(COPY.calidad_descartada_sub)).toBeInTheDocument()
  })
})

describe('la placa hundida de «no lo sé»', () => {
  it('ocupa el mismo cuerpo que un resultado bueno', () => {
    // Doctrina d2: el estado «no sé» no es un hueco, es un resultado con otro
    // contenido, y tiene que verse igual de resuelto.
    const { container } = render(<PlacaHundida titulo={COPY.palancas_no_medible} />)
    const titulo = container.querySelector('p')!
    expect(titulo.className).toContain('font-extrabold')
    expect(titulo.className).toContain('text-[24px]')
    expect(screen.getByText('No lo sé')).toBeInTheDocument()
  })
})

describe('el número con su error', () => {
  it('el par valor y ± no se parte de línea', () => {
    const { container } = render(<NumeroConError valor={177} sigma={15} unidad="mm" />)
    expect(container.firstElementChild!.className).toContain('whitespace-nowrap')
  })

  it('sin sigma no se inventa un ±', () => {
    render(<NumeroConError valor={291} unidad="mm" />)
    expect(screen.queryByText(/±/)).not.toBeInTheDocument()
  })

  it('un eje estimado lleva ≈ pegado al número', () => {
    render(<NumeroConError valor={231} sigma={41} aproximado unidad="mm" />)
    expect(screen.getByText('≈')).toBeInTheDocument()
  })

  it('atenuado es el ÚNICO caso en que un valor medido no va en texto pleno', () => {
    const { container: normal } = render(<NumeroConError valor={177} sigma={15} />)
    const { container: dudoso } = render(<NumeroConError valor={178} sigma={44} atenuado />)
    expect(normal.firstElementChild!.className).toContain('text-texto')
    expect(dudoso.firstElementChild!.className).toContain('text-tenue')
  })

  it('los tres casos del encargo se componen sin romperse', () => {
    for (const [v, s] of [
      [177, 15],
      [178, 44],
      [231, 41],
    ] as const) {
      const { container, unmount } = render(<NumeroConError valor={v} sigma={s} unidad="mm" />)
      expect(container.textContent).toContain(String(v))
      expect(container.textContent).toContain(String(s))
      unmount()
    }
  })
})

describe('el intervalo dibujado a escala', () => {
  it('la banda ocupa en pantalla lo que mide de verdad', () => {
    // Si el copy dice que una banda es un intervalo, la banda tiene que estar a
    // escala. Un realce decorativo detrás del número sería un velo que finge medir.
    const { container } = render(
      <IntervaloAEscala valor={178} sigma={44} sigmaSana={15} max={400} />,
    )
    const bandas = container.querySelectorAll<HTMLElement>('[style*="width"]')
    // 2·44 sobre 400 = 22 %; 2·15 sobre 400 = 7,5 %
    expect(bandas[0].style.width).toBe('22%')
    expect(bandas[1].style.width).toBe('7.5%')
  })

  it('dice cuántas veces más ancha es, que es la lectura que importa', () => {
    render(<IntervaloAEscala valor={178} sigma={44} sigmaSana={15} max={400} />)
    expect(screen.getByText('2.9')).toBeInTheDocument()
  })

  it('escribe el intervalo en números, no solo dibujado', () => {
    render(<IntervaloAEscala valor={178} sigma={44} sigmaSana={15} max={400} />)
    expect(screen.getByText('134 – 222 mm')).toBeInTheDocument()
  })
})

describe('la lectura del veredicto cambia con lo que se juzga', () => {
  it('sin subtitulo propio usa la genérica del sistema', () => {
    render(<SelloCalidad nivel="buena" />)
    expect(screen.getByText(/Este número decide carga/)).toBeInTheDocument()
  })

  it('con subtitulo propio manda el de la pantalla', () => {
    // El encuadre juzga una colocación, no un número: allí `buena` no puede
    // decir «este número decide carga» porque todavía no hay número.
    render(<SelloCalidad nivel="buena" subtitulo="Desde aquí sale una medida en la que se puede confiar." />)
    expect(screen.getByText(/se puede confiar/)).toBeInTheDocument()
    expect(screen.queryByText(/decide carga/)).toBeNull()
  })

  it('pero NO abre la puerta a los motivos en buena', () => {
    // El subtítulo sustituye una frase; los motivos siguen sin pintarse en un
    // sello bueno, que por definición no los tiene.
    render(
      <SelloCalidad nivel="buena" subtitulo="otra cosa">
        <p>un motivo que no debería salir</p>
      </SelloCalidad>,
    )
    expect(screen.queryByText('un motivo que no debería salir')).toBeNull()
  })

  describe('la hundida se hunde', () => {
    const placa = (contenedor: HTMLElement) =>
      contenedor.querySelector('[style*="clip-path"], [style*="clipPath"]') as HTMLElement

    it('descartada se inclina y retrocede un escalón', () => {
      const { container } = render(<SelloCalidad nivel="descartada" />)
      expect(placa(container).style.transform).toBe(
        'rotateX(var(--giro-lectura)) translateZ(var(--prof-hueco))',
      )
    })

    it.each(['buena', 'dudosa'] as const)('%s se queda a cero, sin un valor inventado', (nivel) => {
      // Hay UN solo grado de profundidad en el sistema. `dudosa` no recibe un
      // tercer valor a medio camino: la única que se mueve es la que representa
      // una ausencia.
      const { container } = render(<SelloCalidad nivel={nivel} />)
      expect(placa(container).style.transform).toBe('rotateX(0deg) translateZ(0)')
    })

    it('el sello de una fila NO se inclina', () => {
      // Seis grados sobre un chip de 9,5 px son ruido. Ahí el estado se lee en
      // la materia, que es justo para lo que se diseñó.
      const { container } = render(<SelloCalidad nivel="descartada" tamano="inline" />)
      expect(placa(container).style.transform).toBe('')
    })

    it('la profundidad REFUERZA la materia, no la sustituye', () => {
      // La comprobación que sostiene todo lo demás: quitando el `transform`, los
      // tres estados se siguen distinguiendo. El eje siempre fue la cantidad de
      // materia; esto solo le añade cuerpo.
      const materias = (['buena', 'dudosa', 'descartada'] as const).map((nivel) => {
        const { container } = render(<SelloCalidad nivel={nivel} />)
        return placa(container).className
      })
      expect(new Set(materias).size).toBe(3)
    })
  })
})
