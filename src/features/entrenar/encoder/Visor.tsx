import { useEffect, useRef } from 'react'
import { useCaptura, type Ajustes } from './useCaptura'
import { puntoDeLaImagen } from './toque'
import { acusarToque } from './acusarToque'
import { AvisoDeCaptura } from './AvisoDeCaptura'
import { COPY } from './copys'

/**
 * El instrumento: la imagen de la cámara, sus lecturas en vivo y el botón de
 * grabar. Vive aparte porque lo usan dos sitios —la hoja que se abre dentro de
 * una serie y la pantalla suelta— y un instrumento duplicado se arregla en un
 * sitio y se queda roto en el otro.
 *
 * Va oscuro siempre, como la pantalla de Entreno: es el aparato que miras a
 * tres metros con el teléfono apoyado en el suelo, no una tarjeta más.
 */

/**
 * Una lectura. Tipografía tabular: si los números bailan de ancho al cambiar de
 * cifra no se leen de reojo, y así es como se leen aquí.
 *
 * `principal` marca las tres que deciden si la toma sirve —fps, marcas y
 * ángulo—. Al mismo tamaño que las demás se perdían entre ellas.
 */
function Medida({
  nombre,
  valorRef,
  inicial = '—',
  principal = false,
}: {
  nombre: string
  valorRef: React.RefObject<HTMLElement | null>
  inicial?: string
  principal?: boolean
}) {
  return (
    <span className={`flex flex-col ${principal ? 'gap-0.5' : 'gap-0'}`}>
      <span
        className={`uppercase tracking-[0.14em] text-white/40 ${
          principal ? 'text-[9px]' : 'text-[8px]'
        }`}
      >
        {nombre}
      </span>
      <b
        ref={valorRef as React.RefObject<HTMLSpanElement>}
        className={`font-mono tabular-nums leading-none text-white ${
          principal ? 'text-lg' : 'text-xs font-normal text-white/70'
        }`}
      >
        {inicial}
      </b>
    </span>
  )
}

export type CapturaDelVisor = ReturnType<typeof useCaptura>

interface VisorProps {
  ajustes: Ajustes
  /** Recibe el mando de la captura para que quien lo pinta pueda leer el
   *  resultado y saber cuántos segundos costó la medición. */
  children?: (captura: CapturaDelVisor) => React.ReactNode
}

export function Visor({ ajustes, children }: VisorProps) {
  // Los nodos vivos son de quien los pinta. El bucle solo los escribe.
  const videoRef = useRef<HTMLVideoElement>(null)
  const capaRef = useRef<HTMLCanvasElement>(null)
  const fpsRef = useRef<HTMLElement>(null)
  const pixelesRef = useRef<HTMLElement>(null)
  const marcasRef = useRef<HTMLElement>(null)
  const escalaRef = useRef<HTMLElement>(null)
  const anguloRef = useRef<HTMLElement>(null)
  const muestrasRef = useRef<HTMLElement>(null)
  const relojRef = useRef<HTMLElement>(null)

  const captura = useCaptura(ajustes, {
    video: videoRef,
    capa: capaRef,
    medidas: {
      fps: fpsRef,
      pixeles: pixelesRef,
      marcas: marcasRef,
      separacion: escalaRef,
      angulo: anguloRef,
      muestras: muestrasRef,
      reloj: relojRef,
    },
  })

  /**
   * Abre la cámara sola al montar, y **solo si el permiso ya está concedido**.
   *
   * Bajaba a tres los dos toques que la doctrina fija para una medición: la
   * secuencia real era abrir cámara + tocar el disco + grabar. El primero no
   * decide nada —nadie abre la hoja de medición para no medir—, así que sobra.
   *
   * La condición del permiso no es una precaución de más: llamar a
   * `getUserMedia` sin gesto de la persona dispara el diálogo del navegador
   * nada más abrirse la hoja, y un permiso que se pide sin contexto se deniega.
   * Denegado, además, no se vuelve a pedir. Así que la primera medición sigue
   * pasando por el botón, y de la segunda en adelante ya no hay tercer toque.
   *
   * Si `permissions` no existe —Firefox no expone la cámara ahí— se queda el
   * botón, que es el comportamiento de siempre.
   */
  const yaSeIntento = useRef(false)
  useEffect(() => {
    if (yaSeIntento.current) return
    yaSeIntento.current = true
    let vivo = true
    void (async () => {
      try {
        const permiso = await navigator.permissions?.query({
          name: 'camera' as PermissionName,
        })
        if (!vivo || permiso?.state !== 'granted') return
        await captura.abrirCamara()
      } catch {
        // Sin `permissions` o con un nombre que el navegador no conoce: queda el
        // botón. No se toca el aviso, que aquí no significaría nada.
      }
    })()
    return () => {
      vivo = false
    }
    // Solo al montar: `abrirCamara` se recrea en cada render y meterla en las
    // dependencias reabriría la cámara sin parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function alTocar(ev: React.MouseEvent<HTMLCanvasElement>) {
    const capa = ev.currentTarget
    // El acuse va PRIMERO, antes de decidir si el punto vale. El caso que se
    // quedaba mudo era justamente el toque que no vale: en la banda negra se
    // salia por un `return` sin decir nada.
    acusarToque(capa, ev.clientX, ev.clientY)
    const r = capa.getBoundingClientRect()
    const punto = puntoDeLaImagen(
      ev.clientX - r.left,
      ev.clientY - r.top,
      r.width,
      r.height,
      capa.width,
      capa.height,
    )
    // Fuera de la imagen no hay nada que fijar: en la banda negra no hay disco,
    // y dejarlo pasar devolvería «no veo un disco» culpando al encuadre.
    if (!punto) return
    captura.fijarEn(punto.x, punto.y)
  }

  return (
    <>
      <section className="overflow-hidden rounded-panel border border-white/10 bg-[#0a0a0a] shadow-lg">
        <div className="relative bg-black" style={{ aspectRatio: '4 / 3' }}>
          {/* SOLO opacidad: ni escala ni desenfoque sobre el video. Escalar o
              difuminar la imagen de un instrumento, aunque sean 240 ms, es
              enseñar una imagen que NO es la que se esta midiendo.
              El fundido es asimetrico a proposito: la imagen tarda 240 ms en
              llegar y el cartel se va en 160. Lo que entra puede tomarse su
              tiempo; lo que sobra se quita de en medio. */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-contain"
            style={{
              opacity: captura.camaraAbierta ? 1 : 0,
              transition: 'opacity var(--dur-base) var(--ease-salida)',
            }}
          />
          <canvas
            ref={capaRef}
            onClick={alTocar}
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div
            className="absolute inset-0 grid place-items-center"
            style={{
              opacity: captura.camaraAbierta ? 0 : 1,
              transition: 'opacity var(--dur-toque) var(--ease-salida)',
              pointerEvents: captura.camaraAbierta ? 'none' : undefined,
            }}
          >
            <p className="px-8 text-center text-sm text-white/50">
              Abre la cámara y toca el disco de la barra para fijarlo.
            </p>
          </div>

          {/* El estado de la referencia, sobre la imagen y en la esquina donde ya
              estaba el punto de grabar. Son TRES y no los cinco del entregable:
              `referencia_perdida` y `procesando` no tienen señal en `useCaptura`
              —la pérdida solo se ve en el lienzo, cuando la ventana de búsqueda se
              queda atrás, y en `marcador_perdido` del resultado—. Deducirlos aquí
              sería una pastilla que afirma lo que nadie ha medido, y esta es la
              pantalla donde la persona decide si repetir la toma. */}
          {captura.camaraAbierta && (
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5">
              <span
                className={
                  captura.grabando
                    ? 'h-2.5 w-2.5 rounded-full bg-rojo motion-safe:animate-pulse'
                    : captura.listoParaGrabar
                      ? 'h-2.5 w-2.5 rounded-full bg-[var(--placa)]'
                      : 'h-2.5 w-2.5 rounded-full bg-[var(--gris-marca)]'
                }
              />
              <span className="font-mono text-[11px] uppercase tracking-widest text-white">
                {captura.grabando
                  ? 'grabando'
                  : captura.listoParaGrabar
                    ? 'disco fijado'
                    : 'buscando la referencia'}
              </span>
            </div>
          )}

          {/* Cómo se enseña el toque: una pastilla en la base, que se va en cuanto
              hay disco fijado y no vuelve. Sin tutorial y sin overlay modal —esta
              pantalla se usa con la barra en las manos—. */}
          {captura.camaraAbierta && !captura.aviso && !captura.listoParaGrabar && !captura.grabando && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center">
              <p className="rounded-full bg-black/70 px-3 py-1.5 text-[12.5px] text-white">
                {COPY.hoja_senalar}
              </p>
            </div>
          )}

          {/* El aviso vive AQUI, sobre la imagen, y no debajo del boton: alli
              empujaba el boton de grabar hacia abajo justo cuando la mano iba a
              pulsarlo. Ver `AvisoDeCaptura`. */}
          <AvisoDeCaptura aviso={captura.aviso} />
        </div>

        {/* Se escriben por textContent desde el bucle: 60 renders por segundo
            hundirían los fps, y los fps son uno de los criterios. */}
        <div className="flex items-end gap-5 border-t border-white/10 px-4 pt-3">
          <Medida nombre="fps" valorRef={fpsRef} principal />
          <Medida nombre="marcas" valorRef={marcasRef} principal />
          <Medida nombre="ángulo" valorRef={anguloRef} principal />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 pb-3 pt-2">
          <Medida nombre="escala" valorRef={escalaRef} />
          <Medida nombre="píxeles" valorRef={pixelesRef} />
          <Medida nombre="muestras" valorRef={muestrasRef} inicial="0" />
          <Medida nombre="reloj" valorRef={relojRef} />
        </div>

        <div className="border-t border-white/10 p-3">
          {!captura.camaraAbierta ? (
            <button
              type="button"
              onClick={captura.abrirCamara}
              className="press min-h-14 w-full rounded-xl bg-rojo px-4 text-base font-bold text-white active:opacity-90"
            >
              Abrir cámara
            </button>
          ) : (
            <button
              type="button"
              disabled={!captura.listoParaGrabar}
              onClick={() => (captura.grabando ? captura.parar() : captura.empezar())}
              className={`press min-h-14 w-full rounded-xl px-4 text-base font-bold transition-colors disabled:opacity-40 ${
                captura.grabando
                  ? 'bg-rojo text-white'
                  : 'border border-white/15 bg-white/10 text-white'
              }`}
            >
              {captura.grabando ? 'Parar y analizar' : 'Grabar'}
            </button>
          )}
        </div>
      </section>
      {children?.(captura)}
    </>
  )
}
