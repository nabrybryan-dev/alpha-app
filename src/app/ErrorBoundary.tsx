import { Component, type ErrorInfo, type ReactNode } from 'react'
import {
  esModuloQueYaNoExiste,
  recargarPorDespliegue,
  tirarLoViejoYRecargar,
} from './despliegueNuevo'

interface Props {
  children: ReactNode
  /** true = pantalla completa (raíz de la app); false = tarjeta dentro de la ruta */
  pantallaCompleta?: boolean
}

interface State {
  hayError: boolean
  /** Mensaje del error capturado, para diagnóstico (el celular no ve la consola). */
  detalle: string
  /**
   * El fallo es «el trozo de código que pido ya no existe», no un fallo de la
   * app. Cambia el mensaje y lo que hace el botón: aquí reintentar el render no
   * sirve de nada, hay que recargar la página. Ver `despliegueNuevo.ts`.
   */
  esDespliegue: boolean
}

/**
 * Sin esto, cualquier excepción durante el render (un dato inesperado de la
 * nube, un microciclo con forma vieja…) dejaba la pantalla en blanco a mitad
 * de sesión. Aquí se contiene el fallo y se ofrece recuperación. Además se
 * muestra el mensaje del error para poder diagnosticar desde el propio móvil.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hayError: false, detalle: '', esDespliegue: false }

  static getDerivedStateFromError(error: Error): State {
    return {
      hayError: true,
      detalle: error?.message ?? 'Error desconocido',
      esDespliegue: esModuloQueYaNoExiste(error),
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Tras un despliegue, la pestaña vieja pide un fichero que ya no existe.
    // Recargar es lo único que lo arregla, así que se hace sin molestar a nadie
    // -con freno contra el bucle dentro de `recargarPorDespliegue`-. Si recarga,
    // la página está a punto de irse: no merece la pena ensuciar la consola.
    if (this.state.esDespliegue && recargarPorDespliegue()) return

    console.error('Fallo de interfaz contenido por ErrorBoundary', error, info.componentStack)
  }

  /**
   * El botón, cuando el fallo es un despliegue.
   *
   * Recargar pelado NO basta, y es justo aquí donde se nota: a este botón solo
   * se llega cuando la recarga automática ya se intentó y el freno la paró, o
   * sea en el único caso en que el service worker sigue siendo el viejo. Una
   * recarga sin limpiar volvería a servir su `index.html` cacheado, que pide
   * los mismos ficheros que ya no existen. Ver `despliegueNuevo.ts`.
   */
  private recargarLimpiando = () => {
    void tirarLoViejoYRecargar()
  }

  private reintentar = () => {
    // Volver a renderizar pediría EL MISMO fichero que no existe, y fallaría
    // igual. Por eso «Reintentar» no servía y había que salir de la app.
    if (this.state.esDespliegue) {
      this.recargarLimpiando()
      return
    }
    this.setState({ hayError: false, detalle: '', esDespliegue: false })
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
              onClick={this.state.esDespliegue ? this.recargarLimpiando : () => window.location.reload()}
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
        <p className="text-sm text-tenue">
          {this.state.esDespliegue
            ? 'Hay una versión nueva de la app. Recarga para seguir.'
            : 'Esta sección no se pudo mostrar.'}
        </p>
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
          {this.state.esDespliegue ? 'Recargar' : 'Reintentar'}
        </button>
      </div>
    )
  }
}
