import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Palancas } from './Palancas'
import type { FotogramaBrazo, MedidaDePalancas } from './medidaDePalancas'

/* Los cuatro casos son los de `datos-de-ejemplo.json`, con sus cifras. Cada uno
 * existe porque la pantalla tiene que decir algo DISTINTO, y confundirlos es el
 * fallo que más daño hace aquí: manda a alguien a repetir una toma que nunca va a
 * salir, o le quita una que sí. */

function fot(t: number, cadera: number): FotogramaBrazo {
  return {
    t,
    ok: true,
    torsoGrados: 62.1,
    brazos: {
      cadera: { mm: cadera, unLado: false, derivado: false, sigmaExtraMm: 0 },
      lumbar: { mm: cadera + 51, unLado: false, derivado: true, sigmaExtraMm: 38 },
    },
  }
}

const MEDIDO: MedidaDePalancas = {
  ok: true,
  grupoObjetivo: 'cadena_posterior',
  grupoObjetivoTexto: 'la cadena posterior',
  ejeObjetivo: 'cadera',
  escala: { mmPorPx: 2.41, dispersion: 0.07, fiable: true },
  sigmaArticulacionPx: 4.4,
  sigmaBrazoMm: 15,
  medidos: 71,
  total: 78,
  descartadosPorSalto: 3,
  negativas: [
    'El plano frontal no se mide con una sola cámara.',
    'El eje lumbar es estimado, no visto.',
  ],
  porFotograma: [fot(0, 291), fot(0.24, 264), fot(0.48, 213), fot(0.72, 131)],
  maximoEje: { mm: 291, t: 0, fraccion: 0 },
}

describe('las negativas mandan sobre el número', () => {
  it('van ANTES que cualquier cifra en el orden del documento', () => {
    // Es lo que separa esto de una app que da un número siempre. Si la advertencia
    // va debajo, se lee después de haber creído el dato — o no se lee.
    const { container } = render(<Palancas medida={MEDIDO} />)
    const texto = container.textContent ?? ''
    expect(texto.indexOf('Lo que no se puede prometer')).toBeGreaterThan(-1)
    expect(texto.indexOf('Lo que no se puede prometer')).toBeLessThan(texto.indexOf('291'))
  })

  it('se pintan todas, no solo la primera', () => {
    render(<Palancas medida={MEDIDO} />)
    expect(screen.getByText(/El plano frontal no se mide/)).toBeInTheDocument()
    expect(screen.getByText(/El eje lumbar es estimado/)).toBeInTheDocument()
  })
})

describe('caso medido', () => {
  it('da el brazo del eje protagónico con su ±', () => {
    render(<Palancas medida={MEDIDO} />)
    expect(screen.getByText('291')).toBeInTheDocument()
    expect(screen.getByText(/15/)).toBeInTheDocument()
  })

  it('cuenta los fotogramas que se cayeron por salto', () => {
    render(<Palancas medida={MEDIDO} />)
    expect(screen.getByText(/3 por salto imposible/)).toBeInTheDocument()
  })
})

describe('escala dudosa — el número existe y no se sostiene', () => {
  const DUDOSA: MedidaDePalancas = {
    ...MEDIDO,
    escala: { mmPorPx: 2.63, dispersion: 0.21, fiable: false },
    sigmaBrazoMm: 44,
    medidos: 63,
    maximoEje: { mm: 178, t: 0, fraccion: 0 },
    negativas: ['La escala de este vídeo dispersa un 21 %: los milímetros son orientativos.'],
  }

  it('el número se pinta, porque existe', () => {
    render(<Palancas medida={DUDOSA} />)
    expect(screen.getByText('178')).toBeInTheDocument()
  })

  it('y va con el sello de dudosa y su razón', () => {
    render(<Palancas medida={DUDOSA} />)
    expect(screen.getByText('Dudosa')).toBeInTheDocument()
    // Y la razón se dice UNA vez: el análisis ya la trae en las negativas.
    expect(screen.getAllByText(/dispersa un 21/)).toHaveLength(1)
  })
})

describe('no medible — no hay número en ninguna parte', () => {
  const NO_MEDIBLE: MedidaDePalancas = {
    ok: false,
    ejeObjetivo: 'rodilla',
    grupoObjetivo: 'isquiosurales',
    escala: { mmPorPx: 2.4, dispersion: 0.08, fiable: true },
    sigmaArticulacionPx: 4.4,
    sigmaBrazoMm: 15,
    medidos: 4,
    total: 96,
    descartadosPorSalto: 0,
    negativas: ['Los dos detectores no coinciden en las piernas: la máquina las tapa.'],
    porFotograma: [],
    causas: { sin_persona: 2, sin_carga: 1, sin_consenso: 85, sin_eje: 0, salto: 4 },
  }

  it('no pinta ni una cifra de brazo', () => {
    const { container } = render(<Palancas medida={NO_MEDIBLE} />)
    expect(container.textContent).not.toMatch(/\d+\s*mm/)
  })

  it('con el grueso en sin_consenso dice que repetir no lo arregla', () => {
    render(<Palancas medida={NO_MEDIBLE} />)
    expect(screen.getByText('No lo sé')).toBeInTheDocument()
    expect(screen.getByText(/no lo va a haber por mucho que repitas/)).toBeInTheDocument()
  })

  it('pero con el grueso en encuadre dice EXACTAMENTE LO CONTRARIO', () => {
    // El mismo estado, otra causa, otra frase. Reusar el copy de arriba aquí sería
    // quitarle a alguien una toma que sí iba a salir.
    render(
      <Palancas
        medida={{
          ...NO_MEDIBLE,
          causas: { sin_persona: 80, sin_carga: 6, sin_consenso: 3, sin_eje: 0, salto: 1 },
        }}
      />,
    )
    expect(screen.getByText(/Vuelve a encuadrar y repite/)).toBeInTheDocument()
    expect(screen.queryByText(/por mucho que repitas/)).toBeNull()
  })
})

describe('el ejercicio no entra en el modelo', () => {
  const NO_APLICA: MedidaDePalancas = {
    ok: false,
    motivo: 'ejercicio_no_aplica',
    explicacion:
      'Con polea, la vertical de la carga no es la línea de acción: la marca el cable.',
    ejeObjetivo: 'codo',
    grupoObjetivo: 'dorsal',
    escala: { mmPorPx: 2.4, dispersion: 0.06, fiable: true },
    sigmaArticulacionPx: 4.4,
    sigmaBrazoMm: 15,
    medidos: 0,
    total: 0,
    descartadosPorSalto: 0,
    negativas: [],
    porFotograma: [],
  }

  it('NO lleva placa de calidad: no es un veredicto sobre la toma', () => {
    // Darle placa haría que la persona repitiera la grabación buscando arreglar
    // algo que no se arregla grabando. Es un límite del método, no un fallo suyo.
    render(<Palancas medida={NO_APLICA} />)
    expect(screen.queryByText('No lo sé')).toBeNull()
    expect(screen.queryByText('Dudosa')).toBeNull()
    expect(screen.queryByText('Buena')).toBeNull()
  })

  it('explica por qué, con la explicación del análisis y no una genérica', () => {
    render(<Palancas medida={NO_APLICA} />)
    expect(screen.getByText('Este ejercicio no entra en el modelo')).toBeInTheDocument()
    expect(screen.getByText(/la marca el cable/)).toBeInTheDocument()
  })

  it('no se confunde con no_medible aunque sus contadores estén a cero', () => {
    const { container } = render(<Palancas medida={NO_APLICA} />)
    expect(container.textContent).not.toMatch(/fotogramas medibles/)
  })
})

describe('la selección de atleta se calla cuando no hay duda', () => {
  it('con una sola persona es una fila discreta, no un paso', () => {
    // Nueve de cada diez tomas no son ambiguas. Cobrarle a todas el error de unas
    // pocas es empeorar la toma de evidencia para casi todo el mundo.
    render(<Palancas medida={MEDIDO} seleccion={{ personas: 1, ambiguo: false }} />)
    expect(screen.getByText(/una persona en cuadro/)).toBeInTheDocument()
    expect(screen.queryByText('Cambiar de persona')).toBeNull()
  })

  it('y solo sube de jerarquía cuando de verdad compiten', () => {
    render(
      <Palancas
        medida={MEDIDO}
        seleccion={{ personas: 3, ambiguo: true }}
        onCambiarAtleta={() => {}}
      />,
    )
    expect(screen.getByText('3 personas en cuadro')).toBeInTheDocument()
    expect(screen.getByText('Cambiar de persona')).toBeInTheDocument()
  })

  it('sin dato de selección la fila no existe', () => {
    const { container } = render(<Palancas medida={MEDIDO} />)
    expect(container.textContent).not.toMatch(/en cuadro/)
  })
})
