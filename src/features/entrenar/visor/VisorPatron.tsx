import { useEffect, useRef, useState } from 'react'
import { M4 } from '../../../domain/patrones/algebra'
import type { Patron } from '../../../domain/patrones/catalogo'
import { accionesPrincipales, fraseDelPatron, NOMBRE_DE_ROL, segmentosDe } from '../../../domain/patrones/acciones'
import { NOMBRE_DE_PLANO, NOMBRE_DE_TIPO } from '../../../domain/patrones/articulaciones'
import {
  CAMPO_VISUAL,
  DURACION_CICLO,
  encuadrar,
  esqueletoEnFase,
  faseDeTiempo,
  guias,
  trazaDelPatron,
} from '../../../domain/patrones/escena'
import { construirHuesos } from '../../../domain/patrones/huesos'
import { BAHIA, construirLaboratorio } from '../../../domain/escenario/laboratorio'
import { Malla } from '../../../domain/patrones/malla'
import { resolver } from '../../../domain/patrones/esqueleto'
import {
  activacionDe,
  colorDeMusculo,
  construirMusculos,
  longitudesEnReposo,
  MUSCULOS,
} from '../../../domain/patrones/musculos'
import { useMovimientoReducido } from '../../../components/ui/movimientoReducido'
import { camaraAbierta } from '../camaraAbierta'
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
let reposoCache: Record<string, number> | null = null
function precalculado() {
  huesosCache ??= construirHuesos()
  reposoCache ??= longitudesEnReposo(resolver({}, [0, 0.95, 0], [0, 0, 0]))
  return { huesos: huesosCache, reposo: reposoCache }
}

interface VisorPatronProps {
  patron: Patron
  /**
   * Si se dibuja la bahía de medida alrededor del sujeto.
   *
   * Se puede apagar para mirar solo el cuerpo. No es un modo de depuración: al
   * estudiar una articulación aislada el escenario es ruido, y en las
   * demostraciones el sujeto ni siquiera se apoya en el suelo.
   */
  conEscenario?: boolean
}

/**
 * Visor 3D de un patrón de movimiento.
 *
 * El asesorado lo gira con el dedo y ve qué músculo se acorta. Es el
 * complemento del vídeo de técnica: el vídeo enseña cómo se hace y esto enseña
 * qué pasa por dentro mientras se hace.
 */
export function VisorPatron({ patron, conEscenario = true }: VisorPatronProps) {
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
        // La malla del músculo se reutiliza cuadro a cuadro: la topología no
        // cambia y reservarla de nuevo cada vez costaba el doble de tiempo.
        const mallaMusculo = new Malla(16384)
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
          const partes = conEscenario ? [laboratorio()] : []
          if (estado.current.capa !== 'musculo') partes.push(huesos)
          if (estado.current.capa !== 'hueso')
            partes.push(construirMusculos(esq, patron.activacion, reposo, mallaMusculo))
          partes.push(guias(traza, estado.current.fase, orbita.centro, mostrarEsfera))
          motor.subir(partes)
        }

        const pintar = () => {
          const aspecto = motor.ajustarTamano()
          motor.dibujar(
            matrices,
            orbita.vista(),
            M4.perspectiva(CAMPO_VISUAL, aspecto, 0.05, 40),
            orbita.ojo(),
            conEscenario && patron.apoyo !== 'ninguno',
          )
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
          // Mientras el encoder captura, este bucle se aparta. No es cuestión de
          // que se vea peor: por debajo de 50 fps la toma se DESCARTA, y a 30 el
          // error de pérdida de velocidad se va cinco puntos. Un bucle WebGL al
          // lado de la captura hace que el asesorado repita la serie.
          if (camaraAbierta()) {
            cuadro = requestAnimationFrame(bucle)
            return
          }
          const ahora = performance.now() / 1000
          let cambia = false
          if (estado.current.reproduciendo) {
            const { fase: f, sentido } = faseDeTiempo(ahora - arranque, patron)
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
  }, [patron, conEscenario])

  // El deslizador manda sobre la reproducción: si alguien lo mueve es porque
  // quiere mirar un punto concreto del recorrido.
  const alMoverFase = (v: number) => {
    estado.current.fase = v
    estado.current.sentido = 1
    setFase(v)
    setReproduciendo(false)
    redibujar.current?.()
  }

  // La musculatura se agrupa por músculo y dentro por porción. Un músculo no es
  // un bloque: la cabeza larga del bíceps nace en la escápula y la corta en la
  // coracoides, y esa diferencia es la que explica por qué un ejercicio carga
  // una y no la otra.
  const musculos = MUSCULOS.map((musculo) => {
    const porciones = musculo.porciones
      .map((porcion) => ({
        porcion,
        valor: Math.max(
          activacionDe(patron.activacion, musculo.id, porcion.id, 'D'),
          activacionDe(patron.activacion, musculo.id, porcion.id, 'I'),
        ),
      }))
      .filter((p) => p.valor >= 0.2)
      .sort((a, b) => b.valor - a.valor)
    return { musculo, porciones, valor: porciones[0]?.valor ?? 0 }
  })
    .filter((m) => m.valor >= 0.25)
    .sort((a, b) => b.valor - a.valor)

  // Qué hace cada articulación: se calcula de las poses, no está escrito.
  const acciones = accionesPrincipales(patron)
  const frase = fraseDelPatron(patron)

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
        {!error && conEscenario && (
          <p className="pointer-events-none absolute bottom-2 right-3 text-right font-mono text-[9px] uppercase tracking-[0.1em] text-white/35">
            retícula {BAHIA.pasoMenor * 100} cm
            <span className="mx-1 text-white/20">·</span>
            {BAHIA.pasoMayor * 100} cm
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
          Qué hace cada articulación
        </h4>
        {/* La frase corta primero: es lo que hay que poder leer de un vistazo
            antes de entrar en el desglose. */}
        <p className="mb-2 text-xs leading-snug text-silver-200">{frase}.</p>
        <ul className="flex flex-col">
          {acciones.map((r) => (
            <li key={r.articulacion.id} className="border-b border-white/5">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-baseline gap-2 py-1.5 text-xs">
                  <span
                    className={`w-[52px] shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] ${
                      r.rol === 'motor' ? 'text-ambar' : 'text-silver-500'
                    }`}
                  >
                    {NOMBRE_DE_ROL[r.rol]}
                  </span>
                  <span className="flex-1 text-silver-200">{r.articulacion.nombre}</span>
                  <span className="text-[10px] text-silver-500">
                    {r.acciones.length > 0
                      ? r.acciones.map((a) => a.accion.toLowerCase()).join(' · ')
                      : 'isometría'}
                  </span>
                </summary>
                <div className="pb-2 pl-[60px] pr-1">
                  {r.acciones.map((a) => (
                    <p key={a.eje.canal} className="text-[10px] leading-snug text-silver-400">
                      {a.accion} de {Math.round(a.desde)}° a {Math.round(a.hasta)}°, en el{' '}
                      {NOMBRE_DE_PLANO[a.eje.plano].toLowerCase()}.
                    </p>
                  ))}
                  {r.acciones.length === 0 && (
                    <p className="text-[10px] leading-snug text-silver-400">
                      No recorre nada: aguanta la posición contra la carga.
                    </p>
                  )}
                  {/* Qué se mueve sobre qué, EN ESTE ejercicio. En cadena
                      cerrada se invierte: en una sentadilla el pie está clavado
                      en el suelo, así que baja el fémur sobre la tibia y no al
                      revés. Con la relación de manual, la sentadilla se leía
                      como un curl femoral. */}
                  <p className="mt-1 text-[10px] leading-snug text-silver-500">
                    {NOMBRE_DE_TIPO[r.articulacion.tipo]}.{' '}
                    {segmentosDe(patron, r.articulacion.id).movil} sobre{' '}
                    {segmentosDe(patron, r.articulacion.id).fijo.toLowerCase()}.
                  </p>
                  {/* Lo que NO puede hacer es la mitad de entender una
                      articulación, y es lo que evita forzarla. */}
                  {r.articulacion.noPuede.map((n) => (
                    <p key={n} className="mt-1 text-[10px] leading-snug text-silver-500">
                      {n}
                    </p>
                  ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>

      {patron.claves.length > 0 && (
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
      )}

      {patron.errores.length > 0 && (
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
      )}

      <div>
        <h4 className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-silver-500">
          Musculatura implicada
        </h4>
        <ul className="flex flex-col">
          {musculos.map(({ musculo, porciones, valor }) => {
            const color = (v: number) => {
              const [r, g, b] = colorDeMusculo(v).map((x) => Math.round(x * 255))
              return `rgb(${r},${g},${b})`
            }
            // Un solo vientre no necesita desplegable: la porción y el músculo
            // son la misma cosa y abrirlo repetiría el nombre.
            const desglosa = musculo.porciones.length > 1
            return (
              <li key={musculo.id} className="border-b border-white/5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-2 py-1.5 text-xs text-silver-200">
                    {/* El cuadrado lleva el MISMO color que el modelo: el nombre
                        y lo que se ve en pantalla tienen que ser el mismo dato. */}
                    <i
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: color(valor) }}
                    />
                    <span className="flex-1">{musculo.nombre}</span>
                    {desglosa && (
                      <span className="text-[9px] uppercase tracking-[0.1em] text-silver-500 group-open:hidden">
                        {porciones.length} de {musculo.porciones.length}
                      </span>
                    )}
                    <b className="cifras text-[10px] font-semibold text-silver-400">
                      {Math.round(valor * 100)}%
                    </b>
                  </summary>

                  <div className="pb-2 pl-[18px] pr-1">
                    <ul className="mb-2 flex flex-col gap-0.5">
                      {musculo.acciones.map((a) => (
                        <li key={a} className="text-[11px] leading-snug text-silver-400">
                          {a}
                        </li>
                      ))}
                    </ul>
                    {porciones.map(({ porcion, valor: v }) => (
                      <div key={porcion.id} className="mb-1.5">
                        <p className="flex items-center gap-2 text-[11px] text-silver-200">
                          <i
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: color(v) }}
                          />
                          <span className="flex-1">{porcion.nombre}</span>
                          {porcion.biarticular && (
                            <span className="text-[9px] uppercase tracking-[0.08em] text-ambar">
                              Cruza dos articulaciones
                            </span>
                          )}
                          <b className="cifras text-[10px] text-silver-500">
                            {Math.round(v * 100)}%
                          </b>
                        </p>
                        <p className="pl-[14px] text-[10px] leading-snug text-silver-500">
                          Desde {porcion.origen.toLowerCase()} hasta {porcion.insercion.toLowerCase()}.
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-[10px] leading-snug text-silver-500">
        {patron.ejemplos && <>Ejercicios de este patrón: {patron.ejemplos}. </>}
        Una repetición dura {DURACION_CICLO.toFixed(1).replace('.', ',')} s con el tempo
        correcto.
      </p>
    </div>
  )
}
