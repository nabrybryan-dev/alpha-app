import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** La escena 3D. */
  children: ReactNode
  /** Lo que se enseña si la 3D lanza un error: la escena SVG de siempre. */
  respaldo: ReactNode
  /** Para que quien contiene sepa que WebGL falló y no lo vuelva a intentar. */
  alFallar: (error: Error) => void
}

interface Estado {
  hayError: boolean
}

/**
 * Un `ErrorBoundary` pequeño solo para el lienzo 3D. Que no se pueda crear el contexto WebGL
 * (memoria del teléfono, controlador, límite de contextos) o que la escena lance un error no
 * puede dejar a Manuela con un hueco en plena llamada: cae a la escena SVG, que dice lo mismo.
 */
export class RespaldoSiFalla extends Component<Props, Estado> {
  state: Estado = { hayError: false }

  static getDerivedStateFromError(): Estado {
    return { hayError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('La escena 3D falló; se usa el respaldo SVG.', error, info.componentStack)
    this.props.alFallar(error)
  }

  render() {
    return this.state.hayError ? this.props.respaldo : this.props.children
  }
}
