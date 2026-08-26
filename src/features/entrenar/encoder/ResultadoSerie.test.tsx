import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResultadoSerie } from './ResultadoSerie'
import type { Repeticion, ResultadoSerie as Resultado } from './nucleo/analisis'

/* Los casos son los de `datos-de-ejemplo.json`, con sus cifras: se diseñó contra
 * ellos y se prueba contra ellos. El que más importa es `descartada`, que trae un
 * número creíble y falso a propósito. */

function rep(p: Partial<Repeticion> = {}): Repeticion {
  return {
    n: 1,
    iInicio: 0,
    iFin: 4,
    rom: 0.58,
    concSeg: 1.21,
    vMedia: 0.7,
    vMediaCompleta: 0.61,
    vMediaPropulsiva: 0.72,
    vPico: 1.18,
    vPicoCrudo: 1.16,
    picoRecuperado: 0.02,
    ...p,
  }
}

function serie(p: Partial<Extract<Resultado, { ok: true }>> = {}): Resultado {
  return {
    ok: true,
    unidad: 'm/s',
    hayEscala: true,
    fpsReal: 58.4,
    deteccion: 0.98,
    sepPxMediana: 160,
    escalaPxM: 412.7,
    conDiana: false,
    inclinacionGrados: 6.1,
    inclinacionMax: 8,
    anguloMediana: 3.4,
    reps: [rep(), rep({ n: 2, iInicio: 5, iFin: 9, vMediaPropulsiva: 0.53 })],
    vPrimera: 0.72,
    vUltima: 0.51,
    pvPct: 29.2,
    ie: 21.3,
    concSegMedia: 1.34,
    romRelativo: 0.97,
    compensacion: 0.88,
    coberturaDisco: 0.96,
    calidad: { nivel: 'buena', motivos: [] },
    serie: {
      t: [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8],
      s: [0, 0.1, 0.25, 0.4, 0.5, 0.45, 0.3, 0.15, 0.05, 0],
      v: [0.1, 0.68, 1.18, 0.86, 0.21, -0.3, -0.74, -0.5, -0.2, 0],
    },
    ...p,
  } as Resultado
}

const props = { ejercicio: 'Peso muerto', cargaKg: 100, reps: 5 }

describe('resultado_serie', () => {
  it('el sello va ANTES que el número en el orden del documento', () => {
    const { container } = render(<ResultadoSerie resultado={serie()} {...props} />)
    const texto = container.textContent ?? ''
    expect(texto.indexOf('Buena')).toBeGreaterThan(-1)
    expect(texto.indexOf('Buena')).toBeLessThan(texto.indexOf('29.2'))
  })

  it('pinta el %PV a cuerpo de titular con v primera y v última al pie', () => {
    render(<ResultadoSerie resultado={serie()} {...props} />)
    expect(screen.getByText('29.2')).toBeInTheDocument()
    expect(screen.getByText('primera')).toBeInTheDocument()
    expect(screen.getByText('última')).toBeInTheDocument()
  })

  describe('descartada — el caso que más importa', () => {
    const descartada = serie({
      vPrimera: 0.94,
      vUltima: 0.71,
      pvPct: 24.5,
      ie: 23.5,
      calidad: { nivel: 'descartada', motivos: ['marcador_perdido', 'angulo', 'contorno_parcial'] },
    })

    it('NO pinta ninguna cifra de velocidad en ningún sitio', () => {
      // El 0,94 de este caso es creíble y es FALSO: la escala salió de ajustar el
      // círculo a la pila de discos. Si asoma en gris pequeñito, alguien lo usa.
      const { container } = render(<ResultadoSerie resultado={descartada} {...props} />)
      const texto = container.textContent ?? ''
      expect(texto).not.toContain('0.94')
      expect(texto).not.toContain('0.71')
      expect(texto).not.toContain('24.5')
      expect(texto).not.toContain('23.5')
    })

    it('tampoco pinta la gráfica, que es otra forma de enseñar el número', () => {
      const { container } = render(<ResultadoSerie resultado={descartada} {...props} />)
      expect(container.querySelector('svg')).toBeNull()
    })

    it('los tres motivos ocupan el lugar del número, con su acción', () => {
      render(<ResultadoSerie resultado={descartada} {...props} />)
      expect(screen.getByText('Referencia perdida')).toBeInTheDocument()
      expect(screen.getByText('Diana torcida')).toBeInTheDocument()
      expect(screen.getByText('Disco a medias')).toBeInTheDocument()
      expect(screen.getByText('Que nada tape el disco durante la serie.')).toBeInTheDocument()
    })
  })

  describe('sin escala — un número presente y otro ausente', () => {
    const sinEscala = serie({
      unidad: 'px/s',
      hayEscala: false,
      vPrimera: 297.4,
      vUltima: 211.8,
      pvPct: 28.8,
      ie: NaN,
      calidad: { nivel: 'dudosa', motivos: ['sin_escala'] },
    })

    it('el %PV se pinta entero, porque es un cociente y sobrevive', () => {
      render(<ResultadoSerie resultado={sinEscala} {...props} />)
      expect(screen.getByText('28.8')).toBeInTheDocument()
    })

    it('y el índice de esfuerzo se declara ausente, con su razón', () => {
      render(<ResultadoSerie resultado={sinEscala} {...props} />)
      expect(screen.getByText('No se puede dar')).toBeInTheDocument()
      expect(screen.getByText(/El %PV sí sobrevive, porque es un cociente/)).toBeInTheDocument()
    })

    it('la velocidad de 4 cifras no rompe el campo', () => {
      render(<ResultadoSerie resultado={sinEscala} {...props} />)
      expect(screen.getByText(/297[.,]40/)).toBeInTheDocument()
    })
  })

  describe('sin medición', () => {
    it('ocupa el mismo cuerpo que un resultado bueno y cuenta lo que sí se sabe', () => {
      const nada: Resultado = {
        ok: false,
        motivo: 'sin_segmentar',
        detalle: 'No se reconoció ninguna repetición',
        fpsReal: 57.9,
        deteccion: 0.44,
      } as Resultado
      render(<ResultadoSerie resultado={nada} {...props} />)
      expect(screen.getByText('Sin medición')).toBeInTheDocument()
      expect(screen.getByText(/La cámara grabó bien/)).toBeInTheDocument()
    })
  })

  it('un %PV negativo se pinta con su contexto, sin dramatizarlo', () => {
    render(<ResultadoSerie resultado={serie({ pvPct: -3.1 })} {...props} />)
    expect(screen.getByText('-3.1')).toBeInTheDocument()
    expect(screen.getByText(/la serie no llegó a fatigar/)).toBeInTheDocument()
  })
})
