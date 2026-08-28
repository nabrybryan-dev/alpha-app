import { useState } from 'react'
import { useContadorAnimado } from './useContadorAnimado'

/**
 * Cuánto tarda la cifra en viajar hasta su valor nuevo, EN PROPORCIÓN AL SALTO.
 *
 * Esta es la regla, y es lo que separa una reacción de un adorno: la respuesta es
 * proporcional a la causa. Tocar `+` una vez mueve la cifra un paso, y eso tiene que
 * ser instantáneo — un mando que se lo piensa cuando lo tocas se siente roto, no
 * bonito. Pero cuando el valor llega de FUERA y da un salto grande —al cargar la
 * prescripción del ejercicio siguiente, o al volver de medir con la cámara— la cifra
 * recorre la distancia y se ve de dónde a dónde fue.
 *
 * 20 ms por paso, con techo en `--dur-panel` (360 ms). Un paso: 20 ms, o sea nada.
 * Setenta pasos —de 20 kg a 90— se topan en 360 y se ven viajar.
 */
const MS_POR_PASO = 20
const TECHO_MS = 360

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
  /**
   * La cifra VIAJA hasta su valor nuevo en vez de saltar.
   *
   * Opt-in por el mismo motivo que `profundidad`: este stepper lo comparten
   * nutricion y bienestar, donde la cifra es el resultado de una cuenta —gramos por
   * kcal— y ahi que el numero recorra la distancia no dice nada. En la consola de la
   * serie si: los kilos que vas a levantar son el estado de un mando, y un mando que
   * no acusa el cambio se siente muerto.
   */
  cifraViva?: boolean
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
  cifraViva = false,
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

  /**
   * LA CIFRA VIAJA HASTA SU VALOR, no salta.
   *
   * El área de entrenamiento no usaba `useContadorAnimado` ni una sola vez —está en
   * hoy, logros y nutrición— y es justo el área donde las cifras SON el producto: los
   * kilos, las reps, el RIR. Aquí un número aparecía y desaparecía sin que nada acusara
   * el cambio.
   *
   * Arranca en el objetivo y no en cero: esto es el estado de un mando, no un marcador.
   * Contar desde cero al montar diría «empiezas en 0 y subes» cuando el valor ya venía
   * puesto por la prescripción del coach.
   *
   * Y mientras se edita a mano manda el texto, no la animación: si no, cada tecla
   * pulsada dispararía un viaje y el campo pelearía con el dedo.
   */
  // El salto se calcula con estado derivado de props y NO con un ref: leer o escribir
  // un ref durante el render rompe `react-hooks/purity`, que en este repo es error y
  // está a cero. Este es el patrón que React sí admite para ajustar estado cuando una
  // prop cambia — el `setState` en render se resuelve antes de pintar, sin re-render
  // visible.
  const [anterior, setAnterior] = useState(valor)
  const [duracion, setDuracion] = useState(0)
  if (anterior !== valor) {
    setAnterior(valor)
    setDuracion(Math.min(TECHO_MS, (Math.abs(valor - anterior) / (paso || 1)) * MS_POR_PASO))
  }
  const animado = useContadorAnimado(valor, cifraViva ? duracion : 0, true)
  const mostrado = cifraViva
    ? decimal
      ? redondear(animado).toString()
      : String(Math.round(animado))
    : String(valor)

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
            value={editando ? texto : mostrado}
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
