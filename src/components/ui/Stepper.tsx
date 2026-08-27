import { useState } from 'react'

interface StepperProps {
  etiqueta: string
  valor: number
  paso: number
  minimo?: number
  maximo?: number
  sufijo?: string
  /** Permite decimales al escribir (p. ej. cargas 42.5). */
  decimal?: boolean
  /** Variante grande (dato principal, p. ej. la Carga). */
  grande?: boolean
  /**
   * Teclas en relieve y cifra hundida, para cuando el stepper vive dentro de una
   * escena con perspectiva.
   *
   * Es opt-in y no automatico a proposito: este stepper lo usan tambien
   * bienestar y dos pantallas de nutricion, que estan fuera del area de
   * entrenamiento. El `translateZ` sin perspectiva alrededor no pintaria nada,
   * pero la sombra interior del hueco SI se veria, y ahi no viene a cuento.
   */
  profundidad?: boolean
  onCambiar: (valor: number) => void
}

export function Stepper({
  etiqueta,
  valor,
  paso,
  minimo = 0,
  maximo = 999,
  sufijo = '',
  decimal = false,
  grande = false,
  profundidad = false,
  onCambiar,
}: StepperProps) {
  const redondear = (n: number) => Math.round(n * 100) / 100
  const acotar = (n: number) => redondear(Math.min(maximo, Math.max(minimo, n)))
  const bajar = () => onCambiar(acotar(valor - paso))
  const subir = () => onCambiar(acotar(valor + paso))

  /**
   * El texto se edita libremente (permite "", "42.", "42.5") y solo se confirma un
   * número válido; al salir del campo se normaliza al valor acotado.
   *
   * `texto` SOLO se usa mientras se está editando (ver el `value` del input, que
   * fuera de la edición muestra `valor` directamente). Por eso no hace falta
   * mantenerlo sincronizado con un efecto: basta con ponerlo al día en el momento
   * exacto en que empieza a usarse, que es al enfocar el campo.
   */
  const [texto, setTexto] = useState(String(valor))
  const [editando, setEditando] = useState(false)

  const alEscribir = (bruto: string) => {
    const limpio = bruto.replace(',', '.')
    if (limpio === '' || limpio === '.' || /^\d*\.?\d*$/.test(limpio)) {
      setTexto(limpio)
      const n = Number.parseFloat(limpio)
      if (Number.isFinite(n)) onCambiar(acotar(decimal ? n : Math.round(n)))
    }
  }

  const alSalir = () => {
    setEditando(false)
    const n = Number.parseFloat(texto.replace(',', '.'))
    onCambiar(acotar(Number.isFinite(n) ? (decimal ? n : Math.round(n)) : valor))
  }

  const tamBoton = grande ? 'h-12 w-12' : 'h-10 w-10'
  // `.tecla-3d` SUSTITUYE a `.press`, no se suma: las dos escriben `transform`.
  const tacto = profundidad ? 'tecla-3d' : 'press'
  const tamValor = grande ? 'text-[26px]' : 'text-lg'

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-tenue">{etiqueta}</span>
      {/* LA ESCENA VA AQUI, en el padre DIRECTO de las teclas y del pozo.
          `perspective` solo alcanza a los hijos directos: con la escena declarada mas
          arriba —en la tarjeta o en la pantalla— estas tres piezas son nietas y el
          `translateZ` se aplica sin escorzar. O sea que la tecla no sobresale y el
          pozo no se hunde, y no hay forma de notarlo: el transform esta ahi, la capa
          se promueve, y se ve exactamente plano.

          Paso de verdad: los seis botones y los tres pozos de kg / reps / RIR de la
          pantalla de sesion estuvieron planos desde que se les puso profundidad. Se
          descubrio midiendo el ENCOGIMIENTO —`getBoundingClientRect().width /
          offsetWidth`, que a --prof-hueco tiene que dar 0,9878 y daba 1—, no leyendo
          los estilos calculados, que decian que el translateZ estaba puesto. */}
      <div
        className={`flex w-full items-center justify-center gap-1.5 ${profundidad ? 'escena-prof' : ''}`}
      >
        <button
          type="button"
          aria-label={`Bajar ${etiqueta}`}
          onClick={bajar}
          className={`${tamBoton} ${tacto} shrink-0 rounded-boton border border-linea bg-surface-2 text-xl font-bold text-tenue active:bg-surface-3`}
        >
          −
        </button>
        {/* El pozo envuelve la cifra Y su sufijo. El sufijo es HERMANO del input
            y lleva `-ml-1`, o sea que ya solapa 4 px a proposito: dejarlo fuera
            del hueco lo partiria en dos materias distintas justo donde se tocan. */}
        <div
          className={`flex min-w-0 flex-1 items-baseline justify-center ${
            profundidad ? 'pozo-3d rounded-boton px-2 py-1' : ''
          }`}
        >
          <input
            aria-label={`${etiqueta}${sufijo ? ` en ${sufijo}` : ''}`}
            type="text"
            inputMode={decimal ? 'decimal' : 'numeric'}
            value={editando ? texto : String(valor)}
            onFocus={(e) => {
              // El texto arranca en el valor de AHORA, no en el de la última edición.
              setTexto(String(valor))
              setEditando(true)
              e.currentTarget.select()
            }}
            onChange={(e) => alEscribir(e.target.value)}
            onBlur={alSalir}
            className={`cifras w-full min-w-0 bg-transparent text-center ${tamValor} font-bold text-texto focus:outline-none`}
          />
          {sufijo && <span className="-ml-1 shrink-0 text-xs font-normal text-tenue">{sufijo}</span>}
        </div>
        <button
          type="button"
          aria-label={`Subir ${etiqueta}`}
          onClick={subir}
          className={`${tamBoton} ${tacto} shrink-0 rounded-boton border border-linea bg-surface-2 text-xl font-bold text-accion active:bg-surface-3`}
        >
          +
        </button>
      </div>
    </div>
  )
}
