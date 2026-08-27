import { useCallback, useEffect, useRef, useState } from 'react'
import { useMovimientoReducido } from '../../../components/ui/movimientoReducido'
import { COPY } from './copys'
import { huecosPorSalto, rangoConBandas, sigmaDe, tramosDeEje, type FotogramaBrazo } from './medidaDePalancas'

/**
 * El brazo de momento a lo largo de la repetición, en una escena de dos planos.
 *
 * ## Por qué esto es 3D y no una gráfica plana con adornos
 *
 * El brazo de momento **es una proyección**. Se mide en plano sagital porque los
 * detectores de pose dan cinco grados de libertad —dos puntos por segmento, no
 * tres— y por eso **el plano frontal no se puede medir con una sola cámara**.
 *
 * Hasta ahora eso se contaba con una frase en las negativas. Aquí se dibuja: el
 * plano sagital al frente con las curvas medidas y, detrás, el plano frontal
 * **vacío**, en filete punteado y rotulado. La profundidad no es decoración — es
 * la única representación honesta de lo que el método sabe y de lo que no.
 *
 * ## Por qué la órbita está limitada
 *
 * ±25°. No es órbita libre: más allá las curvas se solapan y el dato se pierde.
 * Los valores se leen a 0°, que es la vista canónica; cualquier otra rotación es
 * exploración, y por eso el doble toque devuelve ahí.
 *
 * ## Las bandas de error se extruyen
 *
 * Un ±44 no es una banda más gruesa: es un **volumen mayor**. En `escala_dudosa`
 * ese volumen tapa las líneas al orbitar, y esa oclusión es literalmente el
 * argumento del estado. No se disimula.
 */

const EJES_ORDEN = ['cadera', 'rodilla', 'lumbar'] as const
const TOPE_GRADOS = 25

interface Props {
  fotogramas: FotogramaBrazo[]
  ejeObjetivo: string
  sigmaBrazoMm: number
  /** Sube el peso visual de las bandas: en `escala_dudosa` tapan las líneas. */
  bandasDominantes?: boolean
  alto?: number
}

/* La pregunta de si hay que moverse menos se hace en `components/ui/movimientoReducido`
 * y en ningún otro sitio. Aquí vivía una copia local: el mismo `useSyncExternalStore`,
 * pero SIN el respaldo de `addListener`/`removeListener` que el módulo canónico
 * documenta para Safari viejo. Con esa copia, en un Safari antiguo la suscripción no
 * enganchaba —sin error y sin escucha—, así que si alguien activaba «reducir
 * movimiento» con esta pantalla ya abierta, la órbita y el trazado seguían corriendo
 * para quien acababa de pedir que pararan. Y esta es la única pantalla del área que
 * se mueve. */

/* La resistencia del tope: cuánto se deja pasar del ±25° antes de que la escena se
 * plante del todo. Sin esto el recorte era una PARED —el dedo seguía y la escena se
 * quedaba clavada—, que es justo lo que STANDARDS pide evitar: fricción creciente,
 * no un muro invisible.
 *
 * ES EL ÚNICO NÚMERO DE ESTE ARCHIVO QUE NO SALE DE NINGÚN SITIO: ni tokens.css ni
 * STANDARDS dan una constante de amortiguación. Queda escrito aquí, con nombre, para
 * poder ajustarlo con el dedo en un móvil real, que es la única forma de elegirlo.
 * No está medido. */
const GIRO_ELASTICO = 6

/* Cuanto gira el guino de bienvenida. Es `MAX_GRADOS` de `inclinacionAlPuntero`, el
 * mismo tope que usa la ficha coleccionable, y cabe de sobra dentro del +-25 grados
 * que esta escena se fijo a si misma. */
const MAX_GUINO = 12

export function GraficaBrazo({
  fotogramas,
  ejeObjetivo,
  sigmaBrazoMm,
  bandasDominantes = false,
  alto = 260,
}: Props) {
  const reducido = useMovimientoReducido()
  const [grados, setGrados] = useState(0)
  const arrastre = useRef<{ x: number; desde: number; puntero: number } | null>(null)
  const escenaRef = useRef<HTMLDivElement>(null)
  // El plano que gira. Durante el gesto se le escribe el `transform` DIRECTAMENTE.
  const planoRef = useRef<HTMLDivElement>(null)
  // Los grados de verdad mientras dura el arrastre. Viven en un ref y no en estado
  // porque el estado re-renderiza, y aquí re-renderizar es exactamente el problema.
  const gradosVivos = useRef(0)
  // El guino de bienvenida, para poder cancelarlo en cuanto el dedo toque: una WAAPI
  // se interrumpe, y si no se cancela el giro seguiria peleando con el arrastre.
  const guinoRef = useRef<Animation | null>(null)

  const presentes = EJES_ORDEN.filter((e) =>
    fotogramas.some((f) => f.ok && f.brazos?.[e] && Number.isFinite(f.brazos[e].mm)),
  )
  const rango = rangoConBandas(fotogramas, presentes as unknown as string[], sigmaBrazoMm)
  const tiempos = fotogramas.filter((f) => f.ok).map((f) => f.t)
  const t0 = tiempos[0] ?? 0
  const t1 = tiempos[tiempos.length - 1] ?? 1

  const W = 1000
  const H = alto
  const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W
  const y = (mm: number) => ((rango.max - mm) / (rango.max - rango.min || 1)) * H

  // `will-change` solo mientras dura el gesto: una capa promovida de forma
  // permanente reserva memoria de textura en un móvil de gama media.
  const [gestoActivo, setGestoActivo] = useState(false)
  const alSoltar = useCallback(() => {
    arrastre.current = null
    setGestoActivo(false)
    // Al soltar, el excedente elástico se devuelve al tope y el valor sube UNA vez a
    // estado: es el único render de todo el gesto, y es el que necesitan el depth
    // cueing y el texto del botón.
    const fijado = Math.max(-TOPE_GRADOS, Math.min(TOPE_GRADOS, gradosVivos.current))
    gradosVivos.current = fijado
    setGrados(fijado)
    // EL EXCEDENTE ELASTICO NO SIEMPRE LO DEVUELVE REACT.
    //
    // `setGrados` con el valor que ya estaba no provoca render: React corta antes. Y
    // `grados` YA vale el tope siempre que el arrastre anterior termino pasado de el.
    // Asi que al segundo arrastre elastico seguido nadie reescribe el transform y el
    // plano se queda clavado FUERA del tope, sin volver nunca.
    //
    // Va en el frame siguiente a proposito: para entonces `gestoActivo` ya es false y
    // la transicion esta de vuelta, asi que el excedente se devuelve animado y no de
    // un tiron. La opacidad no lo necesita —su `cerca` ya viene recortado a 1, asi que
    // el gesto dejo escrito exactamente lo que React iba a poner.
    // NO se vacia `style.opacity` aqui, y es a proposito. `pintarGiro` escribe la
    // MISMA formula que `lejania`, asi que el gesto y React comparten canal y valor:
    // al soltar, el nodo ya tiene puesto lo que el proximo render iba a poner.
    //
    // Vaciarlo seria peor que inutil. `setGrados` con el valor que ya habia no
    // provoca render —React corta antes—, asi que en el caso de soltar en el mismo
    // angulo en que se empezo nadie volveria a escribir la opacidad y los ejes se
    // quedarian a 1: el depth cueing desaparecido, y sin nada en rojo.
  }, [])

  // Fricción en el borde en vez de pared: pasado el tope, el excedente entra cada vez
  // más amortiguado y se acerca asintóticamente a `TOPE_GRADOS + GIRO_ELASTICO`, así
  // que el dedo siempre obtiene algo de respuesta pero el dato nunca se pierde de
  // vista. El valor del tope (±25°) no se toca: está razonado en el docblock.
  const conFriccion = (g: number) => {
    const exceso = Math.abs(g) - TOPE_GRADOS
    if (exceso <= 0) return g
    return Math.sign(g) * (TOPE_GRADOS + GIRO_ELASTICO * (1 - Math.exp(-exceso / GIRO_ELASTICO)))
  }

  /**
   * Pinta el giro sin pasar por el estado: las DOS cosas que cambian al orbitar.
   *
   * La rotación del mundo ya se escribía directa —es lo que evita un ciclo completo
   * de React por cada movimiento del dedo, en la pantalla donde el bucle de captura
   * necesita el hilo—. Lo que faltaba era el depth cueing.
   *
   * Antes se quedaba congelado durante el arrastre y saltaba de golpe al soltar. Se
   * documentó como precio aceptado y no lo era: el salto es de hasta un 40 % de
   * opacidad de un tirón, y llega justo cuando la mano se para y la vista vuelve al
   * dato. Son tres nodos como mucho —un eje por presente—, así que escribirlos a mano
   * cuesta muchísimo menos que el render que se estaba evitando.
   *
   * Lo que NO se toca aquí es el estado: sigue subiendo una sola vez, al soltar.
   */
  const pintarGiro = useCallback((g: number) => {
    gradosVivos.current = g
    if (planoRef.current) planoRef.current.style.transform = `rotateY(${g.toFixed(2)}deg)`
    const cerca = Math.min(1, Math.abs(g) / TOPE_GRADOS)
    escenaRef.current?.querySelectorAll<SVGGElement>('[data-eje]').forEach((nodo) => {
      const esObjetivo = nodo.dataset.objetivo === '1'
      nodo.style.opacity = `${1 - cerca * (esObjetivo ? 0.1 : 0.4)}`
    })
  }, [])

  /**
   * UN GUIÑO DE ÓRBITA al abrir cada medida, y solo uno.
   *
   * A 0° no hay forma de ver que esto es tridimensional: la órbita se anuncia con
   * texto —«arrastra para orbitar»— y con nada más. Un giro corto de ida y vuelta lo
   * enseña en medio segundo, y devuelve a la vista canónica, que es donde los valores
   * se leen.
   *
   * UNA VEZ POR MEDIDA, no por sesión. `GraficaBrazo` no se remonta al abrir otra
   * medición —`PanelPalancas` la pinta con props nuevas y sin `key`— así que con las
   * dependencias en `[reducido]` a secas el guiño corría una sola vez en toda la
   * sesión y quien abría una segunda medida ya no lo veía. `fotogramas` es estable
   * mientras la medida no cambia, así que no se dispara en re-renders sueltos.
   *
   * Los valores son del sistema: 12° es `MAX_GRADOS`, el mismo tope que usa la ficha
   * coleccionable, y cabe de sobra dentro del ±25° que esta escena se fijó. 520 ms es
   * `--dur-escena`, el único escalón que admite una ida y vuelta —con `--dur-panel`
   * cada mitad queda en 180 ms y no se lee—. La curva es `--ease-salida`, escrita
   * literal porque la Web Animations API no resuelve `var()`.
   */
  useEffect(() => {
    if (reducido) return
    const el = planoRef.current
    // En jsdom `Element.prototype.animate` no existe: sin esta guarda el montaje
    // revienta en los tests, y con ella simplemente no hay guiño.
    if (!el || typeof el.animate !== 'function') return
    const anim = el.animate(
      [
        { transform: 'rotateY(0deg)' },
        { transform: `rotateY(-${MAX_GUINO}deg)`, offset: 0.5 },
        { transform: 'rotateY(0deg)' },
      ],
      { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'none' },
    )
    guinoRef.current = anim
    return () => anim.cancel()
  }, [reducido, fotogramas])

  useEffect(() => {
    if (!gestoActivo) return
    // El `transform` se escribe DIRECTO en el nodo, sin pasar por estado. Antes cada
    // `pointermove` llamaba a `setGrados`, y eso re-renderizaba el SVG entero:
    // `tramosDeEje` se recorre dos veces por eje, y `camino()` y `bandaDe()` vuelven a
    // serializar todos los `path` recorriendo fotograma a fotograma. Un ciclo completo
    // de reconciliación de React por cada movimiento del dedo, en la misma pantalla
    // donde el bucle de captura hace `getImageData` por fotograma — y el bucle NO se
    // detiene al pulsar «Parar». Ahora el arrastre cuesta una escritura de `transform`
    // en el compositor y CERO renders; el único render llega al soltar.
    // El depth cueing va con el dedo, no congelado: lo escribe `pintarGiro`.
    const mover = (e: PointerEvent) => {
      const a = arrastre.current
      if (!a) return
      // Multitáctil: solo manda el dedo que empezó el gesto. Con el móvil en una mano y
      // el pulgar de la otra encima, un segundo puntero le cambiaba el dueño al
      // arrastre a mitad de camino.
      if (e.pointerId !== a.puntero) return
      const dx = e.clientX - a.x
      pintarGiro(conFriccion(a.desde + dx * 0.16))
    }
    // Se filtra por el mismo puntero: sin esto, LEVANTAR el segundo dedo terminaba el
    // arrastre aunque el primero siguiera apoyado y moviéndose.
    const alLevantar = (e: PointerEvent) => {
      if (arrastre.current && e.pointerId !== arrastre.current.puntero) return
      alSoltar()
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', alLevantar)
    window.addEventListener('pointercancel', alLevantar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', alLevantar)
      window.removeEventListener('pointercancel', alLevantar)
    }
  }, [gestoActivo, alSoltar, pintarGiro])

  const camino = (puntos: Array<{ t: number; mm: number }>) =>
    puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p.mm).toFixed(1)}`).join(' ')

  const bandaDe = (puntos: Array<{ t: number; mm: number; sigmaExtraMm: number }>) => {
    const arriba = puntos.map((p) => `${x(p.t).toFixed(1)} ${y(p.mm + sigmaDe(p as never, sigmaBrazoMm)).toFixed(1)}`)
    const abajo = [...puntos]
      .reverse()
      .map((p) => `${x(p.t).toFixed(1)} ${y(p.mm - sigmaDe(p as never, sigmaBrazoMm)).toFixed(1)}`)
    return `M ${arriba.join(' L ')} L ${abajo.join(' L ')} Z`
  }

  return (
    <div className="select-none">
      <div
        ref={escenaRef}
        className="relative touch-pan-y"
        style={{ perspective: '1000px', height: alto + 26 }}
        onPointerDown={(e) => {
          if (reducido) return
          // Un gesto ya empezado no se reancla con un segundo dedo.
          if (arrastre.current) return
          // El dedo gana al instante: si el guino sigue corriendo, se corta.
          guinoRef.current?.cancel()
          gradosVivos.current = grados
          arrastre.current = { x: e.clientX, desde: grados, puntero: e.pointerId }
          setGestoActivo(true)
        }}
        onDoubleClick={() => {
          gradosVivos.current = 0
          setGrados(0)
        }}
      >
        <div
          ref={planoRef}
          className="absolute inset-0"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${reducido ? 0 : grados}deg)`,
            // 240 ms y `--ease-salida`, los del sistema. Antes eran 420 ms con una
            // `cubic-bezier(.16,1,.3,1)` tecleada a mano que no existe en tokens.css:
            // una de las cuatro curvas casi iguales que andaban sueltas por el repo.
            // No es cosmético — la vuelta a 0° devuelve a la VISTA CANÓNICA, que es
            // donde los valores se leen, así que cada milisegundo de más es un
            // milisegundo en que el número todavía no se lee bien.
            transition: gestoActivo ? 'none' : 'transform var(--dur-base) var(--ease-salida)',
            willChange: gestoActivo ? 'transform' : undefined,
          }}
        >
          {/* EL PLANO QUE NO SE MIDIÓ. Está vacío a propósito: con una sola cámara
              el plano frontal no existe como dato, y dibujarlo con algo dentro
              sería inventarlo. Con movimiento reducido se desplaza en X para que
              siga viéndose que está: se pierde la órbita, no el argumento. */}
          <div
            className="absolute inset-0 rounded-panel border border-dashed border-[var(--placa-muerta)]"
            style={{
              transform: `translateZ(-64px)${reducido ? ' translateX(26px)' : ''}`,
              opacity: 0.55,
            }}
          >
            <span className="absolute bottom-1 right-2 text-[10.5px] text-[var(--placa-muerta)]">
              plano frontal · sin medir
            </span>
          </div>

          {/* El plano sagital, con lo que sí se midió. */}
          <div className="absolute inset-0" style={{ transform: 'translateZ(0)' }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: alto }} role="img"
              aria-label={`Brazo de momento de ${presentes.join(', ')} a lo largo de la repetición`}>
              {/* El trazado progresivo va por MÁSCARA y no por stroke-dasharray,
                  porque el dasharray ya está ocupado: el trazo discontinuo 7-5 es
                  una de las tres señales que distinguen un eje estimado de uno
                  visto, y no se puede gastar en una animación de entrada. */}
              {!reducido && (
                <defs>
                  {presentes.map((eje, i) => (
                    <clipPath key={eje} id={`trazo-${eje}`}>
                      {/* El barrido va por `transform: scaleX` y no animando el
                          atributo `width` del rect. El width obligaba a recalcular la
                          geometría del recorte en cada fotograma, en el hilo principal
                          y con la cámara capturando; es el mismo argumento que
                          `tokens.css` ya escribió para `crecer-barra`, y esta pantalla
                          era justo la que no lo aplicaba.
                          Se reutiliza esa keyframe —solo tiene `from`, así que el
                          estado final es el rect entero— con la duración y la curva
                          del sistema: 240 ms en vez de 600, dentro del techo de 300 ms.
                          El escalonado de 60 ms se conserva: cae en la banda 30-80 ms.
                          `transform-origin: 0 0` es el origen del viewBox y el rect
                          empieza en x=0, así que crece desde el borde izquierdo. */}
                      <rect
                        x={0}
                        y={0}
                        height={H}
                        width={W}
                        style={{
                          transformOrigin: '0 0',
                          animation: `crecer-barra var(--dur-base) var(--ease-salida) ${i * 60}ms backwards`,
                        }}
                      />
                    </clipPath>
                  ))}
                </defs>
              )}

              {/* El cero: un brazo negativo significa que la carga pasó al otro
                  lado del eje, y eso tiene que verse. */}
              <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--placa-muerta)" strokeWidth={1.2} />

              {presentes.map((eje) => {
                const esObjetivo = eje === ejeObjetivo
                const derivado = fotogramas.some((f) => f.brazos?.[eje]?.derivado)
                // Depth cueing: lo que está detrás pierde contraste, como la
                // perspectiva aérea. El ojo lo entiende sin leer nada.
                const lejania = 1 - Math.min(1, Math.abs(grados) / TOPE_GRADOS) * (esObjetivo ? 0.1 : 0.4)
                return (
                  <g
                    key={eje}
                    // El asa por la que el gesto los encuentra para escribirlos en
                    // vivo, y la opacidad en `style` y NO en el atributo: un estilo en
                    // linea gana siempre al atributo, asi que si volviera al atributo,
                    // React y el gesto escribirian en canales distintos y el efecto
                    // dejaria de moverse SIN que nada se pusiera rojo.
                    data-eje={eje}
                    data-objetivo={esObjetivo ? '1' : undefined}
                    // La opacidad va con la MISMA duración y curva que el transform del
                    // plano. Al volver a 0°, dos propiedades del mismo objeto acababan
                    // en momentos distintos: el giro interpolaba y el contraste saltaba
                    // en el primer render. Es justo lo que STANDARDS manda revisar a
                    // cámara lenta — «coordinated properties stay in sync».
                    style={{
                      opacity: lejania,
                      // Durante el gesto la transicion estorba: la opacidad se escribe
                      // a mano en cada movimiento y una transicion la haria ir con
                      // retraso respecto al giro. Fuera del gesto vuelve, y con la
                      // MISMA duracion y curva que el transform del plano.
                      transition: gestoActivo ? 'none' : 'opacity var(--dur-base) var(--ease-salida)',
                    }}
                  >
                    {tramosDeEje(fotogramas, eje).map((tramo, i) =>
                      tramo.length > 1 ? (
                        <path
                          key={`b${i}`}
                          d={bandaDe(tramo)}
                          fill={derivado ? 'none' : 'var(--placa)'}
                          fillOpacity={derivado ? 0 : bandasDominantes ? 0.3 : 0.16}
                          stroke={derivado ? 'var(--placa-muerta)' : 'none'}
                          strokeDasharray={derivado ? '2 3' : undefined}
                          strokeWidth={derivado ? 1 : 0}
                        />
                      ) : null,
                    )}
                    {tramosDeEje(fotogramas, eje).map((tramo, i) =>
                      tramo.length > 1 ? (
                        <path
                          key={`l${i}`}
                          d={camino(tramo)}
                          fill="none"
                          stroke="var(--placa)"
                          strokeWidth={esObjetivo ? 2.6 : 1.8}
                          strokeDasharray={derivado ? '7 5' : undefined}
                          strokeLinecap={derivado ? 'butt' : 'round'}
                          clipPath={reducido ? undefined : `url(#trazo-${eje})`}
                        />
                      ) : null,
                    )}
                    {huecosPorSalto(fotogramas, eje).map((t) => (
                      <g key={`h${t}`}>
                        <line
                          x1={x(t)} x2={x(t)} y1={0} y2={H}
                          stroke="var(--placa-muerta)" strokeWidth={1} strokeDasharray="3 4"
                        />
                        <text x={x(t) + 4} y={12} fontSize={9} fill="var(--tenue)">hueco</text>
                      </g>
                    ))}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between font-mono text-[10.5px] tabular-nums text-tenue">
        <span>{Math.round(rango.min)} mm</span>
        {!reducido && (
          <button
            type="button"
            onClick={() => setGrados(0)}
            className="press min-h-11 px-2 text-[11px] text-tenue underline-offset-2 hover:underline"
          >
            {grados === 0 ? 'arrastra para orbitar' : 'Volver a 0°'}
          </button>
        )}
        <span>{Math.round(rango.max)} mm</span>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-tenue">{COPY.palancas_lumbar}</p>
    </div>
  )
}
