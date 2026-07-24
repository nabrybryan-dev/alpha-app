import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** true = pantalla completa (raíz de la app); false = tarjeta dentro de la ruta */
  pantallaCompleta?: boolean
}

interface State {
  hayError: boolean
  /** Mensaje del error capturado, para diagnóstico (el celular no ve la consola). */
  detalle: string
}

/**
 * Sin esto, cualquier excepción durante el render (un dato inesperado de la
 * nube, un microciclo con forma vieja…) dejaba la pantalla en blanco a mitad
 * de sesión. Aquí se contiene el fallo y se ofrece recuperación. Además se
 * muestra el mensaje del error para poder diagnosticar desde el propio móvil.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hayError: false, detalle: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hayError: true, detalle: error?.message ?? 'Error desconocido' }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Fallo de interfaz contenido por ErrorBoundary', error, info.componentStack)
  }

  private reintentar = () => {
    this.setState({ hayError: false, detalle: '' })
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
            {this.state.detalle && (
              <p className="mx-auto mt-2 max-w-xs break-words text-[11px] leading-snug text-tenue opacity-70">
                {this.state.detalle}
              </p>
            )}
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
        {this.state.detalle && (
          <p className="mx-auto mt-1 max-w-xs break-words text-[11px] leading-snug text-tenue opacity-70">
            {this.state.detalle}
          </p>
        )}
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
