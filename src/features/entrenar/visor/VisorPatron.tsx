import { useEffect, useRef, useState } from 'react'
import { M4, grados } from '../../../domain/patrones/algebra'
import type { Patron } from '../../../domain/patrones/catalogo'
import {
  DURACION_CICLO,
  encuadrar,
  esqueletoEnFase,
  faseDeTiempo,
  guias,
  trazaDelPatron,
} from '../../../domain/patrones/escena'
import { construirHuesos } from '../../../domain/patrones/huesos'
import { BAHIA, construirLaboratorio } from '../../../domain/escenario/laboratorio'
import { construirSala, SALA, vistaDeGrabacion, type DatosDeSerie } from '../../../domain/escenario/sala'
import { Malla } from '../../../domain/patrones/malla'
import { resolver } from '../../../domain/patrones/esqueleto'
import { colorDeMusculo, construirMusculos, longitudesEnReposo, MUSCULO_POR_ID } from '../../../domain/patrones/musculos'
import { movimientoReducido, useMovimientoReducido } from '../../../components/ui/movimientoReducido'
import { IconoPausa, IconoReproducir } from '../../../components/ui/Icono'
import { FONDO_ESTUDIO } from './motor'

type Capa = 'ambas' | 'musculo' | 'hueso'

/**
 * Se calculan una sola vez para toda la vida de la app: el esqueleto es
 * geometría fija —la mueve el shader— y las longitudes en reposo son la línea
 * base contra la que se mide cuánto se acorta cada músculo.
 */
let huesosCache: ReturnType<typeof construirHuesos> | null = null

/**
 * La bahía de medida: el suelo, la placa, el bordillo y el estadiómetro.
 *
 * Se cachea como los huesos y por el mismo motivo: es geometría fija que no depende
 * del patrón ni de la fase, así que reconstruirla en cada cambio de capa serían miles
 * de vértices recalculados para dibujar exactamente lo mismo.
 *
 * Va con hueso 0 —la identidad— así que entra en la misma malla que el sujeto y se
 * dibuja en la misma llamada. El motor no se entera de que existe.
 */
let laboratorioCache: Malla | null = null

function laboratorio(): Malla {
  if (!laboratorioCache) {
    laboratorioCache = new Malla()
    construirLaboratorio(laboratorioCache)
  }
  return laboratorioCache
}

/**
 * La sala se cachea POR SUS NÚMEROS, no a secas.
 *
 * Las paredes y la estación de grabación no cambian nunca, pero los marcadores llevan
 * cifras de siete segmentos hechas de geometría: cambiar un número es reconstruir esos
 * dígitos. Cachear por el trío evita rehacer la sala entera en cada fotograma y a la
 * vez deja que el marcador reaccione cuando la serie avanza — que es el único momento
 * en que TIENE que cambiar.
 */
let salaCache: { clave: string; malla: Malla } | null = null

function sala(datos: DatosDeSerie): Malla {
  const clave = `${datos.series}|${datos.reps}|${datos.rir}`
  if (!salaCache || salaCache.clave !== clave) {
    const malla = new Malla()
    construirSala(malla, datos)
    salaCache = { clave, malla }
  }
  return salaCache.malla
}
let reposoCache: Record<string, number> | null = null
function precalculado() {
  huesosCache ??= construirHuesos()
  reposoCache ??= longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0]))
  return { huesos: huesosCache, reposo: reposoCache }
}

interface VisorPatronProps {
  patron: Patron
  /**
   * Los números de la serie que se está haciendo. Opcional a propósito: sin ellos la
   * sala no se construye y el visor se queda con la bahía, que es lo que hace falta
   * cuando esto se abre solo para estudiar el patrón y no para entrenar.
   */
  datos?: DatosDeSerie
}

/**
 * Visor 3D de un patrón de movimiento.
 *
 * El asesorado lo gira con el dedo y ve qué músculo se acorta. Es el
 * complemento del vídeo de técnica: el vídeo enseña cómo se hace y esto enseña
 * qué pasa por dentro mientras se hace.
 */
export function VisorPatron({ patron, datos }: VisorPatronProps) {
  const lienzoRef = useRef<HTMLCanvasElement>(null)
  const [fase, setFase] = useState(0)
  const [reproduciendo, setReproduciendo] = useState(true)
  const [capa, setCapa] = useState<Capa>('ambas')
  const [girando, setGirando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reducido = useMovimientoReducido()

  // Todo lo que cambia sesenta veces por segundo va por referencia y no por
  // estado: meterlo en `useState` volvería a renderizar el árbol en cada cuadro.
  const estado = useRef({
    fase: 0,
    sentido: 1,
    reloj: 0,
    reproduciendo: true,
    girando: false,
    capa: 'ambas' as Capa,
    // Los números del marcador viven aquí y no en las dependencias del efecto que
    // monta la escena: incluirlos ahí recrearía el contexto WebGL entero cada vez
    // que avanza una serie. Van por referencia y se repinta, como la capa.
    datos: undefined as DatosDeSerie | undefined,
  })
  /** La rellena el efecto que monta la escena; sirve para repintar desde fuera. */
  const redibujar = useRef<(() => void) | null>(null)
  /**
   * Lleva la cámara a una vista concreta. La rellena el mismo efecto, porque la órbita
   * vive dentro de él y no tiene sentido sacarla: lo que se necesita fuera es la orden,
   * no el objeto.
   */
  const irAVista = useRef<((a: 'grabacion' | 'patron') => void) | null>(null)
  const [enGrabacion, setEnGrabacion] = useState(false)

  // Los controles se copian al ref en un efecto y no durante el render: tocar
  // `ref.current` mientras se renderiza es justo lo que prohíbe `react-hooks/refs`.
  // Y hay que repintar aquí, porque en pausa no corre el bucle: sin esto,
  // cambiar de capa con el modelo parado no se veía hasta volver a darle a play.
  useEffect(() => {
    estado.current.reproduciendo = reproduciendo && !reducido
    estado.current.girando = girando
    estado.current.capa = capa
    estado.current.datos = datos
    // `redibujar` reconstruye ADEMÁS de pintar, y aquí hace falta que lo haga: los
    // dígitos del marcador son geometría, así que un número nuevo es una malla nueva.
    // Solo repintar dejaría en la pared las cifras de la serie anterior — el fallo
    // mudo de manual, porque la escena seguiría viéndose perfecta.
    redibujar.current?.()
  }, [reproduciendo, reducido, girando, capa, datos])

  useEffect(() => {
    const lienzo = lienzoRef.current
    if (!lienzo) return

    let motor: import('./motor').Motor
    let orbita: import('./motor').Orbita
    let vivo = true
    let cuadro = 0
    let cancelado = false

    // El motor se carga aparte para no meter WebGL en el paquete inicial: la
    // mayoría de las sesiones no abren el visor ni una vez.
    void import('./motor')
      .then(({ Motor, Orbita }) => {
        if (cancelado) return
        try {
          motor = new Motor(lienzo)
        } catch {
          setError('Este navegador no puede mostrar el modelo 3D.')
          return
        }

        const { huesos, reposo } = precalculado()
        const traza = trazaDelPatron(patron)
        const encuadre = encuadrar(patron)
        let mostrarEsfera = false

        orbita = new Orbita(lienzo, () => pintar())
        orbita.azimut = patron.camara.azimut
        orbita.elevacion = patron.camara.elevacion
        orbita.distancia = encuadre.distancia
        orbita.centro = encuadre.centro

        let matrices = resolver({}, [0, 0.95, 0], [0, 0, 0]).matrices

        const construir = () => {
          const esq = esqueletoEnFase(patron, estado.current.fase, estado.current.sentido, estado.current.reloj)
          matrices = esq.matrices
          // El escenario va PRIMERO, y no da igual: los índices se concatenan en el
          // orden de las partes, así que ponerlo delante deja el sujeto al final del
          // búfer — que es donde conviene cuando lo que cambia en cada fotograma es él.
          const partes = [laboratorio()]
          const d = estado.current.datos
          if (d) partes.push(sala(d))
          if (estado.current.capa !== 'musculo') partes.push(huesos)
          if (estado.current.capa !== 'hueso') partes.push(construirMusculos(esq, patron.activacion, reposo))
          partes.push(guias(traza, estado.current.fase, orbita.centro, mostrarEsfera))
          motor.subir(partes)
        }

        const pintar = () => {
          const aspecto = motor.ajustarTamano()
          motor.dibujar(matrices, orbita.vista(), M4.perspectiva(grados(34), aspecto, 0.05, 40), orbita.ojo())
        }

        const mostrarEsferaAl = (v: boolean) => {
          mostrarEsfera = v
          construir()
          pintar()
        }
        lienzo.addEventListener('pointerdown', () => mostrarEsferaAl(true))
        lienzo.addEventListener('pointerup', () => mostrarEsferaAl(estado.current.girando))
        lienzo.addEventListener('pointercancel', () => mostrarEsferaAl(estado.current.girando))

        const arranque = performance.now() / 1000
        const bucle = () => {
          if (!vivo) return
          const ahora = performance.now() / 1000
          let cambia = false
          if (estado.current.reproduciendo) {
            const { fase: f, sentido } = faseDeTiempo(ahora - arranque)
            estado.current.reloj = ahora - arranque
            estado.current.sentido = sentido
            if (Math.abs(f - estado.current.fase) > 0.0015) {
              estado.current.fase = f
              setFase(f)
            }
            cambia = true
          }
          if (estado.current.girando) {
            orbita.azimut = (orbita.azimut + 0.32) % 360
            mostrarEsfera = true
            cambia = true
          }
          if (cambia) {
            construir()
            pintar()
          }
          cuadro = requestAnimationFrame(bucle)
        }

        redibujar.current = () => {
          construir()
          pintar()
        }

        /**
         * El viaje a una vista, interpolado.
         *
         * Teletransportar la cámara desorienta: se pierde de dónde venías, y aquí eso
         * importa porque el sentido de la vista de grabación es entender la RELACIÓN
         * entre dónde está el móvil y dónde está el sujeto. El recorrido es la
         * explicación.
         *
         * El azimut se interpola por el camino corto —la diferencia se normaliza a
         * ±180°— o girar de −170° a 170° daría una vuelta entera de 340 en vez de los
         * 20 que hay de verdad.
         *
         * Con movimiento reducido no se viaja: se llega. La vista es información, no
         * decoración, así que no puede perderse — lo que se pierde es el trayecto.
         */
        let viaje = 0
        irAVista.current = (adonde) => {
          // El destino se resuelve AQUÍ y no fuera, porque depende de `orbita.centro`,
          // que es el encuadre propio de este patrón. Calcularlo fuera obligaría a
          // adivinar ese centro, y una vista de grabación calculada contra un centro
          // que no es el real enseñaría un encuadre que el móvil no va a tener.
          const destino =
            adonde === 'grabacion'
              ? vistaDeGrabacion(orbita.centro)
              : {
                  azimut: patron.camara.azimut,
                  elevacion: patron.camara.elevacion,
                  distancia: encuadre.distancia,
                }
          cancelAnimationFrame(viaje)
          const desde = {
            azimut: orbita.azimut,
            elevacion: orbita.elevacion,
            distancia: orbita.distancia,
          }
          let giro = destino.azimut - desde.azimut
          giro = ((((giro + 180) % 360) + 360) % 360) - 180

          if (movimientoReducido()) {
            orbita.azimut = destino.azimut
            orbita.elevacion = destino.elevacion
            orbita.distancia = destino.distancia
            pintar()
            return
          }

          const DURACION = 520
          const arranque = performance.now()
          const paso = (ahora: number) => {
            const t = Math.min(1, (ahora - arranque) / DURACION)
            // La curva de salida del sistema: rápido al principio y posándose al final.
            const e = 1 - Math.pow(1 - t, 3)
            orbita.azimut = desde.azimut + giro * e
            orbita.elevacion = desde.elevacion + (destino.elevacion - desde.elevacion) * e
            orbita.distancia = desde.distancia + (destino.distancia - desde.distancia) * e
            pintar()
            if (t < 1) viaje = requestAnimationFrame(paso)
          }
          viaje = requestAnimationFrame(paso)
        }
        construir()
        pintar()
        cuadro = requestAnimationFrame(bucle)
      })
      .catch(() => setError('No se pudo cargar el modelo 3D.'))

    const alRedimensionar = () => {
      if (motor) {
        motor.ajustarTamano()
      }
    }
    window.addEventListener('resize', alRedimensionar)

    return () => {
      cancelado = true
      vivo = false
      cancelAnimationFrame(cuadro)
      window.removeEventListener('resize', alRedimensionar)
      redibujar.current = null
      irAVista.current = null
      orbita?.destruir()
    }
  }, [patron])

  // El deslizador manda sobre la reproducción: si alguien lo mueve es porque
  // quiere mirar un punto concreto del recorrido.
  const alMoverFase = (v: number) => {
    estado.current.fase = v
    estado.current.sentido = 1
    setFase(v)
    setReproduciendo(false)
    redibujar.current?.()
  }

  const musculos = Object.entries(patron.activacion)
    .map(([clave, valor]) => ({ id: clave.split(':')[0], valor }))
    .filter((m) => m.valor >= 0.25)
    .sort((a, b) => b.valor - a.valor)
    .filter((m, i, todos) => todos.findIndex((o) => o.id === m.id) === i)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-xl"
        style={{ background: FONDO_ESTUDIO }}>
        <canvas
          ref={lienzoRef}
          className="block h-[46vh] max-h-[420px] min-h-[240px] w-full touch-none"
          aria-label={`Modelo tridimensional del patrón ${patron.titulo}`}
        />
        {error && (
          <p className="absolute inset-0 grid place-content-center px-6 text-center text-xs text-silver-300">
            {error}
          </p>
        )}
        {/* LA LEYENDA DE LA RETICULA. Sin ella el suelo es un fondo bonito; con ella
            es un instrumento: se puede LEER cuanto bajo la cadera contando cuadros en
            vez de intuirlo. Los numeros salen de la geometria —no estan escritos dos
            veces— asi que si el paso cambia, la leyenda cambia con el.
            En centimetros porque es la unidad con la que se habla de un recorrido. */}
        {!error && (
          <p className="pointer-events-none absolute bottom-2 right-3 text-right font-mono text-[9px] uppercase tracking-[0.1em] text-white/35">
            retícula {BAHIA.pasoMenor * 100} cm
            <span className="mx-1 text-white/20">·</span>
            {BAHIA.pasoMayor * 100} cm
          </p>
        )}
        {/* EL ENCUADRE, cuando se mira desde el trípode.
            Dos escuadras y un punto rojo: es lo que dice «esto ya no es una vista
            libre, es la cámara». Sin esa señal la vista de grabación se confunde con
            cualquier otro ángulo de la órbita, y entonces no enseña nada. */}
        {enGrabacion && !error && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <span className="absolute left-4 top-4 h-5 w-5 border-l-2 border-t-2 border-rojo/70" />
            <span className="absolute right-4 top-4 h-5 w-5 border-r-2 border-t-2 border-rojo/70" />
            <span className="absolute bottom-4 left-4 h-5 w-5 border-b-2 border-l-2 border-rojo/70" />
            <span className="absolute bottom-4 right-4 h-5 w-5 border-b-2 border-r-2 border-rojo/70" />
            <span className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-rojo">
              <span className="h-1.5 w-1.5 rounded-full bg-rojo" />
              encuadre
            </span>
          </div>
        )}
        {/* DÓNDE VA EL MÓVIL DE VERDAD.
            La marca del suelo no es decoración: es la posición desde la que el encoder
            puede medir. El sujeto mira a +Z, así que su plano sagital es X=0, y una
            sola cámara no da los grados de libertad del plano frontal — de perfil es
            el ÚNICO sitio desde el que sale una velocidad de barra que valga.
            El ±  es la tolerancia real que aplica la puerta de encuadre, no un número
            de adorno: sin un disco a la vista solo se admiten 12° de desvío. */}
        {!error && datos && (
          <p className="pointer-events-none absolute right-3 top-2 text-right font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-white/35">
            trípode {SALA.estacion.distancia.toFixed(1).replace('.', ',')} m
            <span className="mx-1 text-white/20">·</span>
            {SALA.estacion.altura.toFixed(1).replace('.', ',')} m alto
            <br />
            de perfil ±{SALA.tolerancia.sinDisco}°
          </p>
        )}
        {!error && (
          <p className="pointer-events-none absolute bottom-2 left-3 text-[9px] uppercase tracking-[0.12em] text-silver-400">
            Arrastra para girar
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setReproduciendo((v) => !v)}
          disabled={reducido}
          className="press flex items-center gap-1.5 rounded-lg border border-ink-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-silver-300 disabled:opacity-40"
        >
          {reproduciendo && !reducido ? (
            <>
              <IconoPausa className="h-[13px] w-[13px]" />
              Pausa
            </>
          ) : (
            <>
              <IconoReproducir className="h-[13px] w-[13px]" />
              Reproducir
            </>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(fase * 100)}
          onChange={(e) => alMoverFase(Number(e.target.value) / 100)}
          aria-label="Fase del movimiento"
          className="h-1 min-w-[110px] flex-1 cursor-pointer appearance-none rounded bg-ink-500 accent-ambar"
        />
        {/* ENTRAR A GRABAR.
            No abre un menú ni explica nada: lleva la cámara EXACTAMENTE a donde va a
            estar el móvil —mismo ángulo, misma distancia, misma altura— y desde ahí se
            ve el encuadre real antes de plantar el trípode. Si el sujeto no cabe o el
            disco queda de canto, se descubre aquí y no con la serie ya hecha.
            Solo aparece cuando hay sala, porque sin sala no hay estación. */}
        {datos && (
          <button
            type="button"
            onClick={() => {
              irAVista.current?.(enGrabacion ? 'patron' : 'grabacion')
              setEnGrabacion((v) => !v)
            }}
            aria-pressed={enGrabacion}
            className={`press rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
              enGrabacion ? 'border-rojo/60 bg-rojo/15 text-rojo' : 'border-ink-500 text-silver-300'
            }`}
          >
            {enGrabacion ? 'Salir' : 'Ver desde la cámara'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setGirando((v) => !v)}
          aria-pressed={girando}
          className="press rounded-lg border border-ink-500 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-silver-300"
        >
          Orbitar
        </button>
        <div className="flex overflow-hidden rounded-lg border border-ink-500">
          {(['ambas', 'musculo', 'hueso'] as Capa[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCapa(c)}
              aria-pressed={capa === c}
              className={`press px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                capa === c ? 'bg-white/10 text-silver-100' : 'text-silver-400'
              }`}
            >
              {c === 'ambas' ? 'Ambas' : c === 'musculo' ? 'Músculo' : 'Hueso'}
            </button>
          ))}
        </div>
      </div>

      {reducido && (
        <p className="text-[10px] leading-snug text-silver-400">
          Tu sistema pide menos movimiento, así que el modelo no se anima solo. Usa el
          deslizador para recorrer el gesto.
        </p>
      )}

      <p className="text-xs leading-snug text-silver-300">{patron.resumen}</p>

      <div>
        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-silver-500">
          Claves de ejecución
        </h4>
        <ul className="flex flex-col gap-1">
          {patron.claves.map((c) => (
            <li key={c} className="pl-3 text-xs leading-snug text-silver-200 before:-ml-3 before:mr-1.5 before:text-ambar before:content-['•']">
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-rojo">
          Errores frecuentes
        </h4>
        <ul className="flex flex-col gap-1">
          {patron.errores.map((c) => (
            <li key={c} className="pl-3 text-xs leading-snug text-silver-300 before:-ml-3 before:mr-1.5 before:text-rojo before:content-['–']">
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-silver-500">
          Musculatura implicada
        </h4>
        <ul className="flex flex-col">
          {musculos.map((m) => {
            const [r, g, b] = colorDeMusculo(m.valor).map((x) => Math.round(x * 255))
            return (
              <li
                key={m.id}
                className="flex items-center gap-2 border-b border-white/5 py-1 text-xs text-silver-200"
              >
                {/* El cuadrado lleva el MISMO color que el modelo: el nombre y
                    lo que se ve en pantalla tienen que ser el mismo dato. */}
                <i
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ background: `rgb(${r},${g},${b})` }}
                />
                <span className="flex-1">{MUSCULO_POR_ID[m.id]?.nombre ?? m.id}</span>
                <b className="cifras text-[10px] font-semibold text-silver-400">
                  {Math.round(m.valor * 100)}%
                </b>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-[10px] leading-snug text-silver-500">
        Ejercicios de este patrón: {patron.ejemplos}. Una repetición dura{' '}
        {DURACION_CICLO.toFixed(1).replace('.', ',')} s con el tempo correcto.
      </p>
    </div>
  )
}
