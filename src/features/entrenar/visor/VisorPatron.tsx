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
import { resolver } from '../../../domain/patrones/esqueleto'
import { colorDeMusculo, construirMusculos, longitudesEnReposo, MUSCULO_POR_ID } from '../../../domain/patrones/musculos'
import { useMovimientoReducido } from '../../../components/ui/movimientoReducido'
import { IconoPausa, IconoReproducir } from '../../../components/ui/Icono'
import { FONDO_ESTUDIO } from './motor'

type Capa = 'ambas' | 'musculo' | 'hueso'

/**
 * Se calculan una sola vez para toda la vida de la app: el esqueleto es
 * geometría fija —la mueve el shader— y las longitudes en reposo son la línea
 * base contra la que se mide cuánto se acorta cada músculo.
 */
let huesosCache: ReturnType<typeof construirHuesos> | null = null
let reposoCache: Record<string, number> | null = null
function precalculado() {
  huesosCache ??= construirHuesos()
  reposoCache ??= longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0]))
  return { huesos: huesosCache, reposo: reposoCache }
}

interface VisorPatronProps {
  patron: Patron
}

/**
 * Visor 3D de un patrón de movimiento.
 *
 * El asesorado lo gira con el dedo y ve qué músculo se acorta. Es el
 * complemento del vídeo de técnica: el vídeo enseña cómo se hace y esto enseña
 * qué pasa por dentro mientras se hace.
 */
export function VisorPatron({ patron }: VisorPatronProps) {
  const lienzoRef = useRef<HTMLCanvasElement>(null)
  const [fase, setFase] = useState(0)
  const [reproduciendo, setReproduciendo] = useState(true)
  const [capa, setCapa] = useState<Capa>('ambas')
  const [girando, setGirando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reducido = useMovimientoReducido()

  // Todo lo que cambia sesenta veces por segundo va por referencia y no por
  // estado: meterlo en `useState` volvería a renderizar el árbol en cada cuadro.
  const estado = useRef({ fase: 0, sentido: 1, reloj: 0, reproduciendo: true, girando: false, capa: 'ambas' as Capa })
  /** La rellena el efecto que monta la escena; sirve para repintar desde fuera. */
  const redibujar = useRef<(() => void) | null>(null)

  // Los controles se copian al ref en un efecto y no durante el render: tocar
  // `ref.current` mientras se renderiza es justo lo que prohíbe `react-hooks/refs`.
  // Y hay que repintar aquí, porque en pausa no corre el bucle: sin esto,
  // cambiar de capa con el modelo parado no se veía hasta volver a darle a play.
  useEffect(() => {
    estado.current.reproduciendo = reproduciendo && !reducido
    estado.current.girando = girando
    estado.current.capa = capa
    redibujar.current?.()
  }, [reproduciendo, reducido, girando, capa])

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
          const partes = []
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
