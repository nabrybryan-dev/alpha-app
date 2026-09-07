import { BAHIA } from '../../../../domain/escenario/laboratorio'
import { grados, V, type Vec3 } from '../../../../domain/patrones/algebra'
import { CAMPO_VISUAL } from '../../../../domain/patrones/escena'
import { ENCUADRE_SALA, SALA, vistaDeGrabacion } from '../../escena/sala'

/**
 * EL TRAZADO DE LA SALA VACÍA: la misma habitación, proyectada a mano.
 *
 * El encargo dice que un ejercicio sin patrón de movimiento **abre el salón igual**, con
 * sus paredes y su suelo, y que lo único que falta es el sujeto. La pantalla no puede
 * cambiar de naturaleza según el día: un día un espacio y otro día una lista de tarjetas
 * sobre negro.
 *
 * ## Por qué no se monta `VisorPatron`
 *
 * Porque no acepta construir la escena sin patrón, y se ve en una línea:
 *
 *     VisorPatron.tsx:157  export function VisorPatron({ patron, datos, conEscenario = true, w }: VisorPatronProps) {
 *
 * `patron` es obligatorio —`VisorPatron.tsx:118`, `patron: Patron`— y no como formalidad
 * del tipo: el efecto que monta la escena lo consume seis veces antes de dibujar nada.
 * `trazaDelPatron(patron)` y `encuadrar(patron)` en las líneas 239-240, `patron.camara`
 * en 244-245, `esqueletoEnFase(patron, …)` en 262, `patron.apoyo` en 270 y
 * `faseDeTiempo(…, patron)` en 340. Sin patrón no hay traza, ni encuadre, ni fase, ni
 * esqueleto. `visor/` es de la capa motor y no se fuerza desde aquí, así que la sala
 * vacía se dibuja en la capa de interfaz, que es la mía.
 *
 * ## Y por qué en trazos y no en un segundo lienzo WebGL
 *
 * Un contexto WebGL entero para una habitación sin nadie dentro es justo el gasto que el
 * propio visor evita: su bucle se aparta mientras el encoder graba —`camaraAbierta()`,
 * `VisorPatron.tsx:329`— porque por debajo de 50 fps la toma se descarta. La sala vacía
 * no se orbita ni se anima: es una imagen fija. Se proyecta una vez y se pinta con
 * trazos.
 *
 * ## Lo que sí comparte con la sala de verdad
 *
 * Todos los números. El radio, el alto y la altura del panel salen de `SALA`; el disco
 * del suelo, el paso de la retícula y el bordillo, de `BAHIA`; el campo visual, de
 * `CAMPO_VISUAL`; y el encuadre, de `ENCUADRE_SALA` y `vistaDeGrabacion()` —el mismo par
 * que el visor usa cuando hay sala que enmarcar—. Aquí no se escribe ni una medida.
 */

/**
 * El cuadro en el que se traza, en unidades de dibujo.
 *
 * Cuadrado a propósito: la caja del visor es `h-[46vh] max-h-[420px] min-h-[240px]
 * w-full`, que en un teléfono de 390 × 844 sale de 390 × 388 —un cuadrado con dos
 * píxeles de sobra—. El SVG se sirve con `slice`, así que en cualquier otra proporción
 * recorta en vez de destapar: nunca hace falta trazar más ancho del que se dibuja.
 */
export const LIENZO = { ancho: 360, alto: 360 } as const

/**
 * La cámara de la sala vacía.
 *
 * El ángulo es el de la estación de grabación —`vistaDeGrabacion()`, el único punto de
 * vista que la sala tiene declarado— y la distancia es la de `ENCUADRE_SALA`, que es la
 * que el visor usa **precisamente cuando hay sala**: a la distancia del cuerpo el borde
 * de abajo del cuadro cae por encima del suelo y la habitación se queda fuera.
 *
 * Sin sujeto no hay `encuadrar()` que valga, porque no hay cuerpo que enmarcar.
 */
const CAMARA = {
  ...vistaDeGrabacion(ENCUADRE_SALA.centro),
  distancia: ENCUADRE_SALA.distancia,
}

const CENTRO: Vec3 = [...ENCUADRE_SALA.centro]

/** El ojo, colocado como lo coloca la órbita del motor: azimut, elevación y distancia. */
const OJO: Vec3 = (() => {
  const a = grados(CAMARA.azimut)
  const e = grados(CAMARA.elevacion)
  return [
    CENTRO[0] + Math.sin(a) * Math.cos(e) * CAMARA.distancia,
    CENTRO[1] + Math.sin(e) * CAMARA.distancia,
    CENTRO[2] + Math.cos(a) * Math.cos(e) * CAMARA.distancia,
  ]
})()

/** La base de la cámara: adelante, derecha y encima. */
const ADELANTE = V.normalizar(V.restar(CENTRO, OJO))
const DERECHA = V.normalizar(V.cruz(ADELANTE, [0, 1, 0]))
const ENCIMA = V.cruz(DERECHA, ADELANTE)

/**
 * De campo visual a unidades de dibujo.
 *
 * `CAMPO_VISUAL` es el campo VERTICAL, igual que en `M4.perspectiva`, así que la escala
 * sale del alto; en un cuadro cuadrado sirve también para el ancho, y con `slice` lo que
 * sobra se recorta.
 */
const ESCALA = LIENZO.alto / 2 / Math.tan(CAMPO_VISUAL / 2)

/**
 * El guardia que impide proyectar lo que está detrás del ojo.
 *
 * No es el plano cercano de la proyección —ese lo pone el motor— sino el corte que evita
 * dividir por una profundidad nula: un punto justo en el plano del ojo se va al infinito
 * y arrastra el trazo entero al lado contrario de la pantalla.
 */
const DELANTE_MINIMO = 0.01

interface EnVista {
  x: number
  y: number
  z: number
}

interface Punto {
  x: number
  y: number
}

function aVista(p: Vec3): EnVista {
  const d = V.restar(p, OJO)
  return { x: V.punto(d, DERECHA), y: V.punto(d, ENCIMA), z: V.punto(d, ADELANTE) }
}

function aPantalla(v: EnVista): Punto {
  return {
    x: LIENZO.ancho / 2 + (v.x / v.z) * ESCALA,
    y: LIENZO.alto / 2 - (v.y / v.z) * ESCALA,
  }
}

/** Un punto del mundo dentro del cuadro, o `null` si cae detrás del ojo. */
function proyectar(p: Vec3): Punto | null {
  const v = aVista(p)
  return v.z <= DELANTE_MINIMO ? null : aPantalla(v)
}

/**
 * Un segmento recto, recortado por delante del ojo.
 *
 * Recortar en el espacio de la vista y no en el del cuadro es lo que hace que una línea
 * que empieza detrás de la cámara se dibuje desde donde entra al campo, en vez de saltar
 * al lado contrario de la pantalla. Un segmento recto sigue siendo recto al proyectarlo,
 * así que con los dos extremos basta.
 */
function segmento(a: Vec3, b: Vec3): [Punto, Punto] | null {
  const va = aVista(a)
  const vb = aVista(b)
  if (va.z <= DELANTE_MINIMO && vb.z <= DELANTE_MINIMO) return null
  let va2 = va
  let vb2 = vb
  if (va.z <= DELANTE_MINIMO) {
    const t = (DELANTE_MINIMO - va.z) / (vb.z - va.z)
    va2 = { x: va.x + (vb.x - va.x) * t, y: va.y + (vb.y - va.y) * t, z: DELANTE_MINIMO }
  } else if (vb.z <= DELANTE_MINIMO) {
    const t = (DELANTE_MINIMO - vb.z) / (va.z - vb.z)
    vb2 = { x: vb.x + (va.x - vb.x) * t, y: vb.y + (va.y - vb.y) * t, z: DELANTE_MINIMO }
  }
  return [aPantalla(va2), aPantalla(vb2)]
}

/** Fuera del cuadro con margen de sobra: no hay nada que dibujar y sí bytes que ahorrar. */
function seVe(p: Punto, q: Punto): boolean {
  const izq = Math.min(p.x, q.x)
  const der = Math.max(p.x, q.x)
  const arr = Math.min(p.y, q.y)
  const aba = Math.max(p.y, q.y)
  return (
    der >= -LIENZO.ancho &&
    izq <= LIENZO.ancho * 2 &&
    aba >= -LIENZO.alto &&
    arr <= LIENZO.alto * 2
  )
}

const cifra = (v: number): string => (Math.round(v * 10) / 10).toString()

function trazo(puntos: Punto[]): string {
  return puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${cifra(p.x)} ${cifra(p.y)}`).join('')
}

function tramos(pares: [Punto, Punto][]): string {
  return pares.map(([a, b]) => `M${cifra(a.x)} ${cifra(a.y)}L${cifra(b.x)} ${cifra(b.y)}`).join('')
}

/**
 * El arco de muro que se muestrea, medio grado a medio grado a los dos lados de la
 * mirada. ±45° es holgura de sobra: con el campo visual de la app y el ojo dentro del
 * recinto, el muro que entra en el cuadro no pasa de ±22°.
 */
const ARCO = 45
const PASO_ARCO = 0.5

/** Los puntos de un anillo horizontal que caen delante del ojo, ya en el cuadro. */
function anillo(radio: number, altura: number): Punto[] {
  const salida: Punto[] = []
  for (let g = -ARCO; g <= ARCO; g += PASO_ARCO) {
    const a = grados(g)
    const q = proyectar([Math.cos(a) * radio, altura, Math.sin(a) * radio])
    if (q) salida.push(q)
  }
  return salida
}

/** Todo lo que hay que pintar de la sala vacía, ya en coordenadas del cuadro. */
export interface TrazadoDeSala {
  /** El muro, del suelo a `SALA.alto`, como una sola figura rellena. */
  muro: string
  /** El encuentro del muro con el suelo. */
  rodapie: string
  /** El riel del panel, a `SALA.altoPanel`. */
  riel: string
  /** El remate de arriba, a `SALA.alto`. */
  remate: string
  /** El disco del suelo, cerrado por abajo contra el borde del cuadro. */
  suelo: string
  /** La retícula fina, de paso `BAHIA.pasoMenor`. */
  reticulaMenor: string
  /** La retícula gruesa, de paso `BAHIA.pasoMayor`. */
  reticulaMayor: string
  /** El bordillo de la bahía de medida. */
  bordillo: string
}

/**
 * Traza la sala vacía.
 *
 * Función pura y sin argumentos: la cámara no se mueve —no hay sujeto al que dar la
 * vuelta— así que el resultado es siempre el mismo y se calcula una vez.
 */
export function trazarSalaVacia(): TrazadoDeSala {
  const base = anillo(SALA.radio, 0)
  const cima = anillo(SALA.radio, SALA.alto)
  const panel = anillo(SALA.radio, SALA.altoPanel)
  const bastan = base.length > 1 && cima.length > 1

  // El muro es una sola figura: se sube por el anillo del suelo y se vuelve por el de
  // arriba al revés. La `M` del segundo trazo se cambia por una `L` — dejarla partiría
  // la figura en dos y el relleno se cerraría por donde no debe.
  const muro = bastan ? `${trazo(base)}L${trazo([...cima].reverse()).slice(1)}Z` : ''

  const rimSuelo = anillo(BAHIA.radioSuelo, 0)
  // El disco se cierra contra el borde de abajo del cuadro y no contra su propio anillo
  // cercano: el suelo sigue por debajo del encuadre, hacia los pies de quien mira, así
  // que cerrarlo por el anillo dejaría una franja sin pintar justo delante.
  const suelo =
    rimSuelo.length > 1
      ? `${trazo(rimSuelo)}L${LIENZO.ancho * 2} ${LIENZO.alto * 2}L${-LIENZO.ancho} ${LIENZO.alto * 2}Z`
      : ''

  // La retícula, con el mismo recorte al disco que lleva el suelo de verdad: cada línea
  // se acorta a su cuerda, así que el suelo acaba en redondo y no en un cuadrado con
  // esquinas asomando.
  const menor: [Punto, Punto][] = []
  const mayor: [Punto, Punto][] = []
  const pasos = Math.floor(BAHIA.radioSuelo / BAHIA.pasoMenor)
  for (let i = -pasos; i <= pasos; i++) {
    const d = i * BAHIA.pasoMenor
    if (Math.abs(d) > BAHIA.radioSuelo) continue
    const resto = Math.abs(d % BAHIA.pasoMayor)
    const esMayor = resto < 1e-9 || Math.abs(resto - BAHIA.pasoMayor) < 1e-9
    const media = Math.sqrt(Math.max(0, BAHIA.radioSuelo * BAHIA.radioSuelo - d * d))
    if (media < BAHIA.pasoMenor) continue
    const donde = esMayor ? mayor : menor
    for (const par of [
      segmento([-media, 0, d], [media, 0, d]),
      segmento([d, 0, -media], [d, 0, media]),
    ]) {
      if (par && seVe(par[0], par[1])) donde.push(par)
    }
  }

  const rimBordillo = anillo(BAHIA.radioBahia, 0)

  return {
    muro,
    rodapie: base.length > 1 ? trazo(base) : '',
    riel: panel.length > 1 ? trazo(panel) : '',
    remate: cima.length > 1 ? trazo(cima) : '',
    suelo,
    reticulaMenor: tramos(menor),
    reticulaMayor: tramos(mayor),
    bordillo: rimBordillo.length > 1 ? trazo(rimBordillo) : '',
  }
}
