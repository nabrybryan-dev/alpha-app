import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** true = pantalla completa (raíz de la app); false = tarjeta dentro de la ruta */
  pantallaCompleta?: boolean
}

interface State {
  hayError: boolean
}

/**
 * Sin esto, cualquier excepción durante el render (un dato inesperado de la
 * nube, un microciclo con forma vieja…) dejaba la pantalla en blanco a mitad
 * de sesión. Aquí se contiene el fallo y se ofrece recuperación.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hayError: false }

  static getDerivedStateFromError(): State {
    return { hayError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Fallo de interfaz contenido por ErrorBoundary', error, info.componentStack)
  }

  private reintentar = () => {
    this.setState({ hayError: false })
  }

  render() {
    if (!this.state.hayError) return this.props.children

    if (this.props.pantallaCompleta) {
      return (
        <div className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
          <div>
            <p className="font-display text-xl text-texto">Algo salió mal</p>
            <p className="mt-2 text-sm text-tenue">
              Tus datos están a salvo. Recarga la app para continuar.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-rojo px-6 py-3 font-display text-sm text-white"
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="p-6 text-center">
        <p className="text-sm text-tenue">Esta sección no se pudo mostrar.</p>
        <button
          type="button"
          onClick={this.reintentar}
          className="mt-3 rounded-xl bg-rojo px-5 py-2 font-display text-sm text-white"
        >
          Reintentar
        </button>
      </div>
    )
  }
}
