import { useEffect, useRef, useState } from 'react'
import {
  INCLINACION_CALIDAD_GRADOS,
  INCLINACION_MAX_GRADOS,
  analizarSerie,
  detectarDianaCuatro,
  pixelesQueCasan,
  pruebaDeGravedad,
  rgbAHsv,
  separarMarcadores,
  unSoloMarcador,
  type DianaCuatro,
  type DosMarcadores,
  type Hsv,
  type MarcadorUnico,
  type Muestra,
  type ResultadoGravedad,
  type ResultadoSerie,
} from './nucleo/analisis'
import { detectarDisco, identificarEstructura, type DiscoVisto } from './nucleo/disco'
import { avisoDeDisco } from './avisoDisco'
import { nuevoReloj, type Reloj } from './nucleo/reloj-fotograma'
import type { Modo, Referencia } from './tanda'

/** 640 de ancho basta para un centroide y deja margen de CPU para ir a 60 fps. */
const ANCHO_PROCESO = 640

export interface Ajustes {
  referencia: Referencia
  /** Entre centros de marca, en mm. Solo con diana. */
  dianaMm: [number, number]
  /** Separación real entre los dos marcadores, en mm. */
  sepMm: number
  diametroMm: number
  tolTono: number
  sentido: 'subir' | 'bajar'
  modo: Modo
  gRef: number
}

export type Resultado =
  | { tipo: 'serie'; datos: ResultadoSerie }
  | { tipo: 'gravedad'; datos: ResultadoGravedad }

/** Los nodos de la barra de medidas. Se escriben por `textContent` en cada
 *  fotograma: pasarlos por estado de React serían 60 renders por segundo, y los
 *  fps no son cosmética aquí — por debajo de 50 la toma se descarta. */
export interface RefsMedidas {
  fps: React.RefObject<HTMLElement | null>
  pixeles: React.RefObject<HTMLElement | null>
  marcas: React.RefObject<HTMLElement | null>
  separacion: React.RefObject<HTMLElement | null>
  angulo: React.RefObject<HTMLElement | null>
  muestras: React.RefObject<HTMLElement | null>
  reloj: React.RefObject<HTMLElement | null>
}

type Deteccion = DianaCuatro | DosMarcadores | MarcadorUnico | DiscoVisto

const esDiana = (d: Deteccion | undefined): d is DianaCuatro =>
  d !== undefined && 'nMarcas' in d && d.nMarcas === 4

const esPareja = (d: Deteccion | undefined): d is DosMarcadores =>
  d !== undefined && 'a' in d && 'b' in d

/** Los nodos del DOM los declara la PANTALLA y se pasan aquí. Al revés —el hook
 *  creándolos y devolviéndolos— el analizador de React marca todo lo que
 *  devuelve el hook como valor de referencia, y deja de poder usarse en el
 *  render. Además así el que pinta el JSX es el dueño de sus nodos. */
export interface Nodos {
  video: React.RefObject<HTMLVideoElement | null>
  capa: React.RefObject<HTMLCanvasElement | null>
  medidas: RefsMedidas
}

export function useCaptura(ajustes: Ajustes, nodos: Nodos) {
  const videoRef = nodos.video
  const capaRef = nodos.capa
  const medidas = nodos.medidas

  // El lienzo de proceso no se pinta: es donde se lee la imagen a 640 px.
  const procesoRef = useRef<HTMLCanvasElement | null>(null)
  const colorRef = useRef<Hsv | null>(null)
  const discoRef = useRef<{ r: number } | null>(null)
  const ultimoDiscoRef = useRef<{ x: number; y: number } | null>(null)
  const grabandoRef = useRef(false)
  const muestrasRef = useRef<Muestra[]>([])
  const relojRef = useRef<Reloj>(nuevoReloj())
  const ventanaFpsRef = useRef<number[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  // Los ajustes se leen del ref y no del cierre: el bucle se monta una vez y
  // tiene que ver el valor de AHORA, no el del render en que arrancó.
  const ajustesRef = useRef(ajustes)
  useEffect(() => {
    ajustesRef.current = ajustes
  })

  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const [listoParaGrabar, setListoParaGrabar] = useState(false)
  const [grabando, setGrabando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [nMuestras, setNMuestras] = useState(0)
  /** El cronómetro de la puerta 2: de «Parar» a «Guardar». */
  const tPararRef = useRef<number | undefined>(undefined)
  const tListoRef = useRef<number | undefined>(undefined)

  const escribir = (ref: React.RefObject<HTMLElement | null>, texto: string) => {
    if (ref.current) ref.current.textContent = texto
  }

  function pintar(det: Deteccion | undefined, nPix: number | null) {
    const capa = capaRef.current
    const ctx = capa?.getContext('2d')
    if (!capa || !ctx) return
    ctx.clearRect(0, 0, capa.width, capa.height)
    escribir(medidas.pixeles, nPix === null ? '—' : String(nPix))

    if (esDiana(det)) {
      // Con diana se enseña la INCLINACIÓN, que es lo que dos marcadores no
      // pueden medir y lo que se coló como +14 % en el intento 2.
      escribir(medidas.marcas, det.ambiguo ? '4 (ambiguo)' : '4')
      escribir(medidas.separacion, `${det.escalaPxM.toFixed(0)} px/m`)
      const inc = det.inclinacionGrados
      const torcida = inc > INCLINACION_CALIDAD_GRADOS
      const rota = inc > INCLINACION_MAX_GRADOS
      // El que manda es el umbral de CALIDAD, no el de geometría: enseñar solo
      // el de 35° fue lo que dejó grabar en verde una sesión entera de tomas
      // que la puerta descartaba después.
      escribir(
        medidas.angulo,
        `${inc.toFixed(0)}° incl.${rota ? ' ✕ endereza' : torcida ? ' ⚠ se descartará' : ''}`,
      )
      // setProperty y no `style.color =`: aquí sí valen las variables CSS
      // —esto es CSS de verdad, no canvas— y el analizador de React no admite
      // asignar a una propiedad anidada de algo que llega por argumento.
      medidas.angulo.current?.style.setProperty(
        'color',
        rota ? 'var(--rojo)' : torcida ? 'var(--ambar)' : null,
      )
      ctx.lineWidth = 2
      // Hexadecimales y no var(--rojo): el canvas no resuelve variables CSS,
      // se queda en negro y no avisa. Son los mismos valores de tokens.css.
      ctx.strokeStyle = rota ? '#ff1e1e' : det.ambiguo || torcida ? '#f5a623' : '#c2c8cf'
      for (const m of det.marcas) {
        ctx.beginPath()
        ctx.arc(m.x, m.y, 9, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.beginPath()
      det.marcas.forEach((m, i) => (i ? ctx.lineTo(m.x, m.y) : ctx.moveTo(m.x, m.y)))
      ctx.closePath()
      ctx.stroke()
      rastro(ctx)
      return
    }

    medidas.angulo.current?.style.setProperty('color', null)

    if (det && 'cobertura' in det) {
      escribir(medidas.marcas, det.fiable ? 'disco' : 'disco (dudoso)')
      escribir(medidas.pixeles, `${(det.cobertura * 100).toFixed(0)} % contorno`)
      escribir(medidas.separacion, `${det.sepPx.toFixed(1)} px`)
      escribir(medidas.angulo, '—')
      ctx.lineWidth = 2
      ctx.strokeStyle = det.fiable ? '#c2c8cf' : '#f5a623'
      ctx.beginPath()
      ctx.arc(det.x, det.y, det.r, 0, Math.PI * 2)
      ctx.stroke()
      rastro(ctx)
      return
    }

    escribir(medidas.marcas, !det ? '0' : esPareja(det) ? '2' : '1')
    escribir(
      medidas.separacion,
      det && Number.isFinite(det.sepPx) ? `${det.sepPx!.toFixed(1)} px` : '—',
    )
    escribir(
      medidas.angulo,
      det && Number.isFinite(det.anguloGrados) ? `${det.anguloGrados!.toFixed(1)}°` : '—',
    )
    if (!det) return
    ctx.lineWidth = 2
    ctx.strokeStyle = esPareja(det) ? '#c2c8cf' : '#f5a623'
    if (esPareja(det)) {
      ctx.beginPath()
      ctx.moveTo(det.a.x, det.a.y)
      ctx.lineTo(det.b.x, det.b.y)
      ctx.stroke()
      for (const m of [det.a, det.b]) {
        ctx.beginPath()
        ctx.arc(m.x, m.y, 9, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else {
      ctx.beginPath()
      ctx.arc(det.x, det.y, 11, 0, Math.PI * 2)
      ctx.stroke()
    }
    rastro(ctx)
  }

  /** El rastro de la trayectoria mientras graba. Es lo que hace creíble el
   *  número: si el rastro salta, el número no vale aunque parezca razonable. */
  function rastro(ctx: CanvasRenderingContext2D) {
    if (!grabandoRef.current || muestrasRef.current.length < 2) return
    ctx.strokeStyle = 'rgba(59,157,255,.85)'
    ctx.beginPath()
    let primero = true
    for (const m of muestrasRef.current) {
      if (!Number.isFinite(m.y) || m.x === undefined) continue
      if (primero) ctx.moveTo(m.x, m.y)
      else ctx.lineTo(m.x, m.y)
      primero = false
    }
    ctx.stroke()
  }

  async function abrirCamara() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          frameRate: { ideal: 60 },
        },
        audio: false,
      })
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      streamRef.current = stream
      await video.play()

      const escala = ANCHO_PROCESO / video.videoWidth
      const proceso = document.createElement('canvas')
      proceso.width = ANCHO_PROCESO
      proceso.height = Math.round(video.videoHeight * escala)
      procesoRef.current = proceso
      if (capaRef.current) {
        capaRef.current.width = proceso.width
        capaRef.current.height = proceso.height
      }
      setCamaraAbierta(true)
      setAviso(null)
      bucle()
    } catch (e) {
      const nombre = e instanceof Error ? e.name : 'Error'
      setAviso(
        `No se pudo abrir la cámara (${nombre}). El navegador solo la entrega en ` +
          'https o en localhost, y en el móvil hay que darle permiso al sitio.',
      )
    }
  }

  /** Fija el objetivo tocando la imagen: el color de la marca, o el disco. */
  function fijarEn(x: number, y: number) {
    const proceso = procesoRef.current
    const pctx = proceso?.getContext('2d', { willReadFrequently: true })
    if (!proceso || !pctx) return
    const { referencia } = ajustesRef.current

    if (referencia === 'disco') {
      const img = pctx.getImageData(0, 0, proceso.width, proceso.height)
      const r = identificarEstructura(img.data, proceso.width, proceso.height, { x, y }, {
        radioMax: Math.round(proceso.height * 0.45),
      })
      if (r.tipo !== 'disco') {
        discoRef.current = null
        setListoParaGrabar(false)
        setAviso(avisoDeDisco(r))
        return
      }
      discoRef.current = { r: r.ajuste.r }
      ultimoDiscoRef.current = { x: r.ajuste.x, y: r.ajuste.y }
      setListoParaGrabar(true)
      setAviso(
        `Disco detectado: radio ${r.ajuste.r.toFixed(0)} px, contorno visto ` +
          `${(r.cobertura * 100).toFixed(0)} %. Cámara a ${r.anguloCamara.toFixed(0)}° de la ` +
          `perpendicular${r.anguloCamara > 10 ? ' — demasiado torcida, muévete hasta bajar de 10°.' : '.'}`,
      )
      return
    }

    // Media de 7x7 para que un píxel raro no fije el tono de toda la tanda.
    const d = pctx.getImageData(Math.max(0, x - 3), Math.max(0, y - 3), 7, 7).data
    let sr = 0
    let sg = 0
    let sb = 0
    for (let i = 0; i < d.length; i += 4) {
      sr += d[i]
      sg += d[i + 1]
      sb += d[i + 2]
    }
    const n = d.length / 4
    colorRef.current = rgbAHsv(sr / n, sg / n, sb / n)
    setListoParaGrabar(true)
    const cuantas = referencia === 'diana4' ? 'cuatro' : 'dos'
    setAviso(
      `Color fijado (tono ${colorRef.current.h.toFixed(0)}°). Comprueba que las ${cuantas} ` +
        'marcas salen marcadas en TODO el recorrido, no solo en reposo.',
    )
  }

  function bucle() {
    const video = videoRef.current
    if (!video) return
    const paso = (ahora: number, meta: VideoFrameCallbackMetadata | null) => {
      const proceso = procesoRef.current
      const pctx = proceso?.getContext('2d', { willReadFrequently: true })
      if (!proceso || !pctx || !videoRef.current) return
      pctx.drawImage(videoRef.current, 0, 0, proceso.width, proceso.height)

      // El instante se pide SIEMPRE, no solo grabando: el selector necesita ver
      // unos cuantos fotogramas para saber qué reloj de este aparato avanza, y
      // ese aprendizaje tiene que estar hecho antes de que nadie pulse grabar.
      const t = relojRef.current.instante(meta, ahora)
      const { referencia, dianaMm, tolTono } = ajustesRef.current
      let det: Deteccion | undefined
      let nPix: number | null = null

      if (referencia === 'disco' && discoRef.current) {
        const img = pctx.getImageData(0, 0, proceso.width, proceso.height)
        // Acotar la búsqueda a la última posición no es solo velocidad: es la
        // reja que impide guardar un salto imposible.
        const prev = ultimoDiscoRef.current ?? { x: proceso.width / 2, y: proceso.height / 2 }
        const d = detectarDisco(img.data, proceso.width, proceso.height, prev, discoRef.current.r, {
          radioMax: Math.round(discoRef.current.r * 1.35),
        })
        if (d.ok) {
          det = d
          ultimoDiscoRef.current = { x: d.x, y: d.y }
        }
        if (grabandoRef.current) {
          muestrasRef.current.push(
            d.ok ? { t, x: d.x, y: d.y, sepPx: d.sepPx, fiable: d.fiable } : { t, y: NaN },
          )
        }
      } else if (colorRef.current) {
        const img = pctx.getImageData(0, 0, proceso.width, proceso.height)
        // paso 1 con diana: cada marca aporta cuatro veces más píxeles. Medido:
        // con paso 2 y marcas pequeñas la detección cae al 36 % de fotogramas.
        const nube = pixelesQueCasan(img.data, proceso.width, proceso.height, colorRef.current, {
          tolTono,
          paso: referencia === 'diana4' ? 1 : 2,
        })
        nPix = nube.n
        det =
          referencia === 'diana4'
            ? detectarDianaCuatro(nube, dianaMm[0], dianaMm[1]) ?? unSoloMarcador(nube)
            : separarMarcadores(nube) ?? unSoloMarcador(nube)
        if (grabandoRef.current) {
          muestrasRef.current.push(det ? { t, ...det } : { t, y: NaN })
        }
      }

      pintar(det, nPix)
      if (grabandoRef.current) escribir(medidas.muestras, String(muestrasRef.current.length))
      medirFps(ahora)
      if (relojRef.current.decidido && medidas.reloj.current) {
        const nombre = relojRef.current.nombre ?? '—'
        if (medidas.reloj.current.textContent !== nombre) {
          medidas.reloj.current.textContent = nombre
        }
      }
      pedir(paso)
    }
    pedir(paso)
  }

  const pedir = (fn: (ahora: number, meta: VideoFrameCallbackMetadata | null) => void) => {
    const video = videoRef.current
    if (!video) return
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(fn)
    else requestAnimationFrame((t) => fn(t, null))
  }

  function medirFps(ahora: number) {
    const v = ventanaFpsRef.current
    v.push(ahora)
    if (v.length > 30) v.shift()
    if (v.length > 5) {
      const fps = (v.length - 1) / ((v[v.length - 1] - v[0]) / 1000)
      escribir(medidas.fps, fps.toFixed(0))
    }
  }

  function empezar() {
    muestrasRef.current = []
    grabandoRef.current = true
    setGrabando(true)
    setResultado(null)
    setNMuestras(0)
  }

  function parar(): Resultado | null {
    grabandoRef.current = false
    setGrabando(false)
    // De aquí a «Guardar» es el tiempo que la medición le roba a la serie: el
    // asesorado está de pie esperando. Es el criterio que el README pedía medir
    // «con cronómetro en mano», y eso es un criterio que no se mide.
    tPararRef.current = performance.now()
    tListoRef.current = undefined

    const { modo, referencia, dianaMm, sepMm, diametroMm, sentido, gRef } = ajustesRef.current
    const escalaMm =
      referencia === 'disco' ? diametroMm : referencia === 'diana4' ? dianaMm[0] : sepMm
    const muestras = muestrasRef.current
    setNMuestras(muestras.length)

    const r: Resultado =
      modo === 'gravedad'
        ? { tipo: 'gravedad', datos: pruebaDeGravedad(muestras, escalaMm, { gRef }) }
        : { tipo: 'serie', datos: analizarSerie(muestras, { sepMm: escalaMm, sentido }) }
    setResultado(r)
    // Al llegar aquí el resultado ya está calculado: lo que va de aquí a
    // «Guardar» es humano (teclear reps y referencia), no máquina.
    tListoRef.current = performance.now()
    return r
  }

  /** Segundos que la medición añadió a la serie, y cuántos fueron máquina. */
  function cronometro() {
    const tParar = tPararRef.current
    const tListo = tListoRef.current
    return {
      sAnadidos: tParar ? Math.round((performance.now() - tParar) / 10) / 100 : undefined,
      sMaquina: tParar && tListo ? Math.round((tListo - tParar) / 10) / 100 : undefined,
    }
  }

  // Al salir de la pantalla se sueltan las pistas de vídeo. Sin esto, el piloto
  // de la cámara del teléfono se queda encendido al cambiar de pestaña.
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      grabandoRef.current = false
    },
    [],
  )

  return {
    camaraAbierta,
    listoParaGrabar,
    grabando,
    resultado,
    aviso,
    nMuestras,
    abrirCamara,
    fijarEn,
    empezar,
    parar,
    cronometro,
  }
}
