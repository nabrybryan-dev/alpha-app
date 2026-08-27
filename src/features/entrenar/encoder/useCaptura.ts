import { useEffect, useRef, useState } from 'react'
import {
  GIRO_CALIDAD_GRADOS,
  INCLINACION_CALIDAD_GRADOS,
  INCLINACION_MAX_GRADOS,
  analizarSerie,
  pruebaDeGravedad,
  type Muestra,
  type ResultadoGravedad,
  type ResultadoSerie,
} from './nucleo/analisis'
import { avisoDeDisco } from './avisoDisco'
import { avisoDeEscala, revisarEscala, type RevisionDeEscala } from './escala'
import { nuevoReloj, type Reloj } from './nucleo/reloj-fotograma'
import {
  esDiana,
  esDisco,
  esPareja,
  nuevoSeguimiento,
  type Deteccion,
  type Recuadro,
  type Seguimiento,
} from './seguimiento'
import { gravedadAprobada, leerTanda, type Modo, type Referencia } from './tanda'

/** 640 de ancho basta para un centroide y deja margen de CPU para ir a 60 fps. */
const ANCHO_PROCESO = 640

/** Cuántas muestras del rastro se dibujan. Dibujarlas TODAS costaba un recorrido
 *  de la tanda entera en cada fotograma: al final de una serie de mil muestras
 *  eso son mil segmentos por fotograma, sesenta veces por segundo. Y el precio
 *  no es que se vea peor — es que los fps bajan, y por debajo de 50 la puerta
 *  descarta la toma. El instrumento se estropeaba a sí mismo cuanto más larga
 *  era la serie. Cuatro segundos de rastro bastan para ver si la trayectoria
 *  salta, que es para lo que está. */
const RASTRO_MAX = 240

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
  /** Para qué ejercicio es la toma. No se usa para medir: se usa para saber si
   *  el recorrido medido es posible, que es lo único que delata un diámetro de
   *  disco mal elegido. Ver `escala.ts`. */
  ejercicio: string
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
  // Dónde mirar en cada fotograma lo decide `seguimiento.ts`, que no toca el
  // DOM y por eso se puede correr con `node` en `scripts/banco-encoder.mjs`.
  const seguimientoRef = useRef<Seguimiento>(nuevoSeguimiento())
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
  const [revisionEscala, setRevisionEscala] = useState<RevisionDeEscala | null>(null)
  /** El cronómetro de la puerta 2: de «Parar» a «Guardar». */
  const tPararRef = useRef<number | undefined>(undefined)
  const tListoRef = useRef<number | undefined>(undefined)

  const escribir = (ref: React.RefObject<HTMLElement | null>, texto: string) => {
    if (ref.current) ref.current.textContent = texto
  }

  /**
   * El color de la lectura del angulo, escrito SOLO cuando cambia de verdad.
   *
   * Antes se llamaba a `setProperty('color', ...)` en cada fotograma, hubiera
   * cambiado o no. Escribir una propiedad en linea invalida el estilo del elemento
   * aunque el valor sea identico, y eso es recalculo de estilo mas repintado del
   * nodo en el mismo hilo donde el bucle acaba de hacer un `getImageData` de todo
   * el lienzo de proceso. Es barato en absoluto —un nodo de texto diminuto— pero
   * es gratis quitarlo y esta en el sitio donde nada es gratis.
   *
   * El patron no es nuevo: la escritura del reloj ya compara antes de escribir.
   * A las cifras (fps, muestras, pixeles) NO se les pone este guardian a proposito:
   * esos valores si cambian casi todos los fotogramas y comparar no ahorraria nada.
   */
  const colorAnguloRef = useRef<string | null>(null)
  const pintarColorAngulo = (color: string | null) => {
    if (colorAnguloRef.current === color) return
    colorAnguloRef.current = color
    medidas.angulo.current?.style.setProperty('color', color)
  }

  function pintar(det: Deteccion | undefined, nPix: number | null, ventana?: Recuadro) {
    const capa = capaRef.current
    const ctx = capa?.getContext('2d')
    if (!capa || !ctx) return
    ctx.clearRect(0, 0, capa.width, capa.height)
    escribir(medidas.pixeles, nPix === null ? '—' : String(nPix))
    dibujarVentana(ctx, ventana)

    if (esDiana(det)) {
      // Con diana se enseña la INCLINACIÓN, que es lo que dos marcadores no
      // pueden medir y lo que se coló como +14 % en el intento 2.
      escribir(medidas.marcas, det.ambiguo ? '4 (ambiguo)' : '4')
      escribir(medidas.separacion, `${det.escalaPxM.toFixed(0)} px/m`)
      const inc = det.inclinacionGrados
      const giro = Math.abs(det.anguloGrados)
      const torcida = inc > INCLINACION_CALIDAD_GRADOS
      const rota = inc > INCLINACION_MAX_GRADOS
      // El giro es LO OTRO, y es la segunda vez que esto cuesta una sesión. La
      // inclinación es escorzo —la diana mirada de canto— y el giro es la diana
      // torcida como un cuadro mal colgado. `calificar` tumba la toma por
      // cualquiera de los dos, y aquí solo se enseñaba la inclinación: la tanda
      // del 22 de agosto de 2026 salió con `angulo` en las diez tomas mientras
      // la barra de medidas iba en verde porque el escorzo estaba bien.
      const girada = giro > GIRO_CALIDAD_GRADOS
      // El que manda es el umbral de CALIDAD, no el de geometría: enseñar solo
      // el de 35° fue lo que dejó grabar en verde una sesión entera de tomas
      // que la puerta descartaba después.
      escribir(
        medidas.angulo,
        `${inc.toFixed(0)}° incl.${rota ? ' ✕ endereza' : torcida ? ' ⚠ se descartará' : ''}` +
          ` · ${giro.toFixed(0)}° giro${girada ? ' ⚠ endereza la diana' : ''}`,
      )
      // setProperty y no `style.color =`: aquí sí valen las variables CSS
      // —esto es CSS de verdad, no canvas— y el analizador de React no admite
      // asignar a una propiedad anidada de algo que llega por argumento.
      pintarColorAngulo(rota ? 'var(--rojo)' : torcida || girada ? 'var(--ambar)' : null)
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

    pintarColorAngulo(null)

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

  /** La ventana donde se buscó. Enseñarla no es adorno: cuando la referencia se
   *  pierde, ver que la ventana se quedó atrás dice en qué dirección falló el
   *  seguimiento, y un contador de fotogramas perdidos no dice eso. */
  function dibujarVentana(ctx: CanvasRenderingContext2D, v?: Recuadro) {
    if (!v) return
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,.22)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.strokeRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0)
    ctx.restore()
  }

  /** El rastro de la trayectoria mientras graba. Es lo que hace creíble el
   *  número: si el rastro salta, el número no vale aunque parezca razonable. */
  function rastro(ctx: CanvasRenderingContext2D) {
    const todas = muestrasRef.current
    if (!grabandoRef.current || todas.length < 2) return
    ctx.strokeStyle = 'rgba(59,157,255,.85)'
    ctx.beginPath()
    let primero = true
    for (let i = Math.max(0, todas.length - RASTRO_MAX); i < todas.length; i++) {
      const m = todas[i]
      if (!Number.isFinite(m.y) || m.x === undefined) continue
      if (primero) ctx.moveTo(m.x, m.y)
      else ctx.lineTo(m.x, m.y)
      primero = false
    }
    ctx.stroke()
  }

  /** Espera a que el vídeo diga de qué tamaño es. Con tope: si el aparato no lo
   *  dice nunca, es mejor seguir y fallar con un aviso que quedarse colgado. */
  function medidasDelVideo(video: HTMLVideoElement): Promise<void> {
    if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve()
    return new Promise((listo) => {
      const fin = () => {
        video.removeEventListener('loadedmetadata', fin)
        video.removeEventListener('resize', fin)
        clearTimeout(temporizador)
        listo()
      }
      const temporizador = setTimeout(fin, 3000)
      video.addEventListener('loadedmetadata', fin)
      video.addEventListener('resize', fin)
    })
  }

  /** Los dos lienzos al tamaño del vídeo de AHORA.
   *
   *  Se vuelve a llamar desde el bucle cuando el vídeo cambia de tamaño, que es
   *  lo que pasa al girar el teléfono: la cámara entrega 1280×720 y pasa a
   *  720×1280. Con el lienzo congelado en la proporción anterior, `drawImage`
   *  aplasta la imagen — y una imagen aplastada mide mal la escala en píxeles
   *  por metro sin dar ningún síntoma. Los números salen, y salen torcidos. */
  function ajustarLienzos(video: HTMLVideoElement) {
    const ancho = video.videoWidth
    const alto = video.videoHeight
    if (!(ancho > 0 && alto > 0)) return false
    const proceso = procesoRef.current ?? document.createElement('canvas')
    const nuevoAlto = Math.max(1, Math.round((alto * ANCHO_PROCESO) / ancho))
    if (proceso.width === ANCHO_PROCESO && proceso.height === nuevoAlto) return false
    proceso.width = ANCHO_PROCESO
    proceso.height = nuevoAlto
    procesoRef.current = proceso
    if (capaRef.current) {
      capaRef.current.width = proceso.width
      capaRef.current.height = proceso.height
    }
    return true
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
      // `play()` resuelve cuando empieza a reproducir, y eso NO garantiza que
      // las dimensiones estén: en un móvil lento `videoWidth` sigue a cero unos
      // fotogramas. La escala salía Infinity, la altura del lienzo NaN —que el
      // canvas convierte en 0 sin quejarse— y la herramienta se quedaba viva,
      // con la cámara encendida, sin detectar nada nunca. El fallo no decía que
      // era esto: decía «no veo la marca».
      await medidasDelVideo(video)

      ajustarLienzos(video)
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
    const { referencia, dianaMm, tolTono } = ajustesRef.current
    const seg = seguimientoRef.current
    const img = pctx.getImageData(0, 0, proceso.width, proceso.height)

    if (referencia === 'disco') {
      const r = seg.fijarDisco(img.data, proceso.width, proceso.height, x, y, {
        radioMax: Math.round(proceso.height * 0.45),
      })
      if (r.tipo !== 'disco') {
        setListoParaGrabar(false)
        setAviso(avisoDeDisco(r))
        return
      }
      setListoParaGrabar(true)
      // El aviso dice lo que se sabe Y lo que no. Sobre los 60 fotogramas reales
      // del banco de las herramientas, la escala del disco cae dentro del ±5 %
      // en **13** de ellos: cuatro de cada cinco veces el radio sale mal, y no
      // hay forma de saberlo desde aquí —se probó, y ni la cobertura, ni la
      // redondez, ni lo cerca que cayó el toque separan los buenos de los malos.
      // El %PV sí sobrevive a eso, porque es un cociente entre dos velocidades
      // medidas con la misma regla equivocada. Los m/s no.
      // El aviso se APAGA cuando hay prueba de gravedad aprobada en la tanda.
      // Uno que no se puede apagar nunca es ruido, y el ruido se ignora justo
      // el día que importa — es la misma razón por la que la reja del ROM se
      // dejó gruesa. La caída valida escala y tiempos a la vez contra una
      // constante que nadie discute, así que es lo único que puede levantar la
      // sospecha sobre una escala que falla cuatro de cada cinco veces.
      const validada = gravedadAprobada(leerTanda())
      setAviso(
        `Disco detectado: radio ${r.ajuste.r.toFixed(0)} px, contorno visto ` +
          `${(r.cobertura * 100).toFixed(0)} %. Cámara a ${r.anguloCamara.toFixed(0)}° de la ` +
          `perpendicular${r.anguloCamara > 10 ? ' — demasiado torcida, muévete hasta bajar de 10°.' : '.'}` +
          (validada
            ? ' La prueba de gravedad de esta tanda aprobó, así que la escala de este montaje está validada.'
            : ' Con disco, fíate del %PV y no de los m/s: la escala del disco falla más de lo' +
              ' que parece, y aquí no hay ninguna prueba de gravedad aprobada que la respalde.'),
      )
      return
    }

    const v = seg.fijarColor(img.data, proceso.width, proceso.height, x, y, {
      referencia,
      dianaMm,
      tolTono,
    })
    const cuantas = referencia === 'diana4' ? 'cuatro' : 'dos'

    // Fijar el color no era fijar nada: se daba «listo para grabar» sin haber
    // comprobado que con ese color se ve algo. El fallo aparecía DESPUÉS de la
    // serie —«menos de 10 fotogramas con marcador»— con el asesorado ya
    // sentado, y la toma se perdía entera. Ahora se mira en el acto.
    if (!v.ok) {
      setListoParaGrabar(false)
      setAviso(
        v.esFondo
          ? 'Ese color está por casi todo el encuadre: es el fondo, no una marca. Toca justo ' +
            'encima de la marca — si la marca y el fondo son parecidos, la medición no va a ' +
            'salir por mucho que se ajuste la tolerancia: hace falta otro color de marca.'
          : v.nPix < 24
            ? `Con ese color solo casan ${v.nPix} píxeles: no basta para una marca. Toca en el ` +
              'centro de la marca, no en su borde, y si la marca es pálida sube la tolerancia de tono.'
            : `Casan ${v.nPix} píxeles pero no salen ${cuantas} marcas separadas. O hay algo más ` +
              'del mismo color en el encuadre, o las marcas se tocan: sepáralas o cambia de color.',
      )
      return
    }

    setListoParaGrabar(true)
    const soloUna = !esPareja(v.det) && !esDiana(v.det)
    setAviso(
      `Color fijado (tono ${v.color.h.toFixed(0)}°, ${v.nPix} píxeles). ` +
        (soloUna
          ? `Solo se ve UNA marca: sin dos no hay escala, y la velocidad saldrá en píxeles. ` +
            `Comprueba que las ${cuantas} marcas se ven.`
          : `Se ven las ${cuantas} marcas. Comprueba que siguen viéndose en TODO el recorrido, ` +
            'no solo en reposo.'),
    )
  }

  function bucle() {
    if (!videoRef.current) return
    const paso = (ahora: number, meta: VideoFrameCallbackMetadata | null) => {
      const video = videoRef.current
      if (!video) return
      // El vídeo puede cambiar de tamaño en marcha: girar el teléfono lo hace.
      // Y si pasa GRABANDO, las muestras de antes y las de después están en
      // sistemas de coordenadas distintos: la escala en píxeles por metro cambia
      // a mitad de la serie y el resultado sale de mezclar dos reglas. Eso no se
      // puede arreglar por dentro, solo se puede decir.
      if (ajustarLienzos(video) && grabandoRef.current) {
        setAviso(
          'La cámara ha cambiado de tamaño a mitad de la grabación (¿se giró el teléfono?). ' +
            'Las muestras de antes y las de después no están a la misma escala: descarta esta ' +
            'toma y repítela sin girar.',
        )
      }
      const proceso = procesoRef.current
      const pctx = proceso?.getContext('2d', { willReadFrequently: true })
      if (!proceso || !pctx) return
      pctx.drawImage(video, 0, 0, proceso.width, proceso.height)

      // El instante se pide SIEMPRE, no solo grabando: el selector necesita ver
      // unos cuantos fotogramas para saber qué reloj de este aparato avanza, y
      // ese aprendizaje tiene que estar hecho antes de que nadie pulse grabar.
      const t = relojRef.current.instante(meta, ahora)
      const { referencia, dianaMm, tolTono } = ajustesRef.current
      const seg = seguimientoRef.current

      let det: Deteccion | undefined
      let nPix: number | null = null
      let ventana: Recuadro | undefined

      if (seg.fijado) {
        const img = pctx.getImageData(0, 0, proceso.width, proceso.height)
        // El instante va también al seguimiento, no solo a la muestra: sin él la
        // predicción no sabe cuánto tiempo lleva sin ver la referencia, y una
        // racha de fotogramas caídos la deja apuntando adonde ya no está.
        const paso = seg.paso(
          img.data,
          proceso.width,
          proceso.height,
          { referencia, dianaMm, tolTono },
          t,
        )
        det = paso.det
        nPix = paso.nPix
        ventana = paso.ventana
        if (grabandoRef.current) {
          muestrasRef.current.push(
            det
              ? esDisco(det)
                ? { t, x: det.x, y: det.y, sepPx: det.sepPx, fiable: det.fiable }
                : { t, ...det }
              : { t, y: NaN },
          )
        }
      }

      pintar(det, nPix, ventana)
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

    const { modo, referencia, dianaMm, sepMm, diametroMm, sentido, gRef, ejercicio } =
      ajustesRef.current
    const escalaMm =
      referencia === 'disco' ? diametroMm : referencia === 'diana4' ? dianaMm[0] : sepMm
    const muestras = muestrasRef.current
    setNMuestras(muestras.length)

    const r: Resultado =
      modo === 'gravedad'
        ? { tipo: 'gravedad', datos: pruebaDeGravedad(muestras, escalaMm, { gRef }) }
        : { tipo: 'serie', datos: analizarSerie(muestras, { sepMm: escalaMm, sentido }) }
    setResultado(r)

    // La reja de la escala. Va aquí y no en la pantalla porque hay DOS pantallas
    // que miden —el panel del coach y la hoja de dentro de la serie— y el
    // arreglo del toque del #86 ya se quedó una vez en una sola de las dos.
    const revision = r.tipo === 'serie' ? revisarEscala(r.datos, ejercicio) : null
    setRevisionEscala(revision)
    const avisoEscala = avisoDeEscala(revision)
    if (avisoEscala) setAviso(avisoEscala)

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
    revisionEscala,
    abrirCamara,
    fijarEn,
    empezar,
    parar,
    cronometro,
  }
}
