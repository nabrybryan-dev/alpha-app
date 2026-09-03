#!/usr/bin/env node
/**
 * TESTIGO DEL SALÓN — la prueba de que la pantalla existe DE VERDAD.
 *
 * EL ACTA SE LEVANTA SOBRE UN DÍA CON SUJETO, y por eso el script busca el asesorado en
 * vez de aceptar el primero: el salón tiene dos ramas legítimas y en la de cardio no hay
 * sujeto ni cámara A PROPÓSITO —«cardio y cribados abren el salón igual, con paredes y
 * suelo, pero sin sujeto en el centro»—, así que un día de cardio no puede medir el
 * sujeto: daría visible:false por una ausencia CORRECTA y acusaría a la pantalla de un
 * fallo que no tiene. Un acta que mezcla las dos ramas no cierra nada y encima miente.
 *
 * =============================================================================
 * CÓMO SE CORRE (esto es lo que funciona en esta máquina, comprobado)
 * =============================================================================
 *
 *   1. Deja el servidor de Vite corriendo:      npm run dev     (http://localhost:5173)
 *   2. Desde la raíz del repo:                  node testigo/salon-visible.mjs
 *
 * El script arranca ÉL MISMO un Chrome con `--remote-debugging-port`, con perfil
 * propio y aparte (no toca el perfil del usuario), habla con él por el protocolo
 * de DevTools sobre el WebSocket global de Node 24, mide, cierra Chrome y escribe
 * `informes/testigo-salon.json`.
 *
 * NO es headless a propósito. Se abre una ventana de verdad y se trae al frente
 * con `Page.bringToFront`, porque `document.visibilityState` solo vale `visible`
 * con la pestaña delante: medir detrás no da un número malo, da uno falso que
 * parece bueno. Mientras corre (unos 20 s) conviene no tapar la ventana.
 *
 * Opciones:
 *   --url=http://localhost:5173/entrenar   qué se abre (por defecto, eso)
 *   --puerto=9222                          puerto de depuración de Chrome
 *   --chrome="C:/ruta/chrome.exe"          binario, si no está donde se busca
 *   --salida=informes/testigo-salon.json   dónde se escribe el acta
 *   --claves=a,b,c                         qué valores de data-testigo se buscan
 *   --usuario=u-mateo                      en modo demo, con qué asesorado se entra
 *                                          (se escribe `localStorage.alpha-usuario`, que
 *                                          es la misma tecla del selector de la app).
 *                                          Sirve para separar dos cosas que se confunden:
 *                                          que el lienzo del sujeto no pinte, y que HOY no
 *                                          haya sujeto que pintar porque toca cardio.
 *                                          Es el PRIMER candidato, no el único: si su día
 *                                          de hoy sale sin sujeto, el script lo dice y
 *                                          pasa al siguiente de `--candidatos`.
 *   --candidatos=u-valentina,u-mateo       la cola por la que se busca un día con sujeto.
 *                                          Se prueban en orden y se mide el primero cuya
 *                                          rama montada sea `conSujeto`.
 *   --sin-buscar-sujeto                    no busca: mide el asesorado pedido tal cual,
 *                                          caiga en la rama que caiga. Para mirar a
 *                                          propósito un día de cardio.
 *   --sin-informe                          mide e imprime, no escribe el acta
 *   --prueba-negativa                      LA PRUEBA DE QUE EL TESTIGO SABE DECIR NO:
 *                                          busca cinco marcas que no existen y exige
 *                                          que las cinco salgan visible:false y
 *                                          pixeles:0. Sale 1 si alguna sale a true.
 *   --prueba-ciega=sujeto                  LA OTRA, Y LA QUE MÁS VALE: deja esa marca en
 *                                          el DOM, con su rectángulo entero y sin
 *                                          `opacity:0`, pero sin pintar nada. Es la forma
 *                                          exacta del lienzo negro. Sale 1 si el testigo
 *                                          la da por visible.
 *   --sin-congelar                         no pausa las animaciones antes de medir.
 *                                          Sirve para ver de dónde sale el ruido; con
 *                                          la marquesina corriendo la medida empeora.
 *   --conservar                            deja Chrome abierto al terminar
 *
 * =============================================================================
 * QUÉ MIDE, Y POR QUÉ ASÍ
 * =============================================================================
 *
 * La noche del 28 de agosto 3.016 tests en verde convivieron con una pantalla
 * NEGRA en un iPhone. jsdom no tiene WebGL: un lienzo sin pintar mide igual que
 * uno pintado. Por eso aquí nada se da por bueno leyendo el DOM. De cada marca
 * `data-testigo` se sacan CUATRO medidas que no dependen unas de otras:
 *
 *   1. `enDom`      — cuántos nodos llevan la marca.
 *   2. `estilos`    — se sube por la cadena entera de padres mirando `display:none`,
 *                     `visibility:hidden` y `opacity:0`. Basta un padre apagado.
 *   3. `pixeles`    — área de `getBoundingClientRect` RECORTADA al viewport, y no
 *                     el ancho declarado. Si hay varios nodos con la misma marca,
 *                     se rasteriza la unión en una rejilla de 1 px para no contar
 *                     dos veces lo que se solapa.
 *   4. `pintados`   — LA MEDIDA QUE NO SE PUEDE FALSIFICAR. Se hace una captura de
 *                     pantalla real por el protocolo de DevTools, se apaga el nodo
 *                     con `visibility:hidden`, se captura otra vez y se cuentan los
 *                     píxeles QUE CAMBIAN. Un lienzo negro sobre fondo negro no
 *                     cambia ni un píxel al apagarlo: da 0 y sale visible:false.
 *                     Eso es exactamente la trampa en la que caímos. Y no basta con que
 *                     cambie algo: se le exige cambiar MÁS que el `residuo`, que es lo que
 *                     la pantalla se mueve sola en ese mismo rato.
 *
 * Sobre el punto 4 hay tres cautelas metidas en el código, y ninguna sobra: sin
 * ellas el ruido de la propia pantalla llegaba a tapar la señal.
 *
 *   - LO QUE SE MUEVE SOLO. El cronómetro corre y la marquesina se desplaza, así
 *     que hay píxeles que cambian sin que nadie apague nada. Primero se congelan las
 *     animaciones EN SU FOTOGRAMA (`animation-play-state: paused`, que no borra nada:
 *     deja de correrse el suelo bajo los pies), y después se toman cinco capturas
 *     repartidas en 2,4 s para marcar cuanto siga bailando —los dígitos del reloj,
 *     en especial—. Esa máscara se descuenta de cada aporte. Con `--sin-congelar` se
 *     puede ver la diferencia: el ruido se multiplica.
 *   - EL CONTROL. Tras restaurar cada nodo se captura una tercera vez y se compara
 *     con la de partida: dos fotos del MISMO estado, separadas por el mismo rato que
 *     separa a las dos de la medida. Ese `residuo` es el ruido medido en el sitio, y
 *     para dar un nodo por pintado se le exige mover MÁS píxeles que él. Es la
 *     comprobación que cazó el caso límite: con las animaciones sueltas, un
 *     `letras3D` cegado a propósito aportaba 590 píxeles contra 553 de ruido y se
 *     colaba como visible; congelando, la cuenta quedó en 261 contra 698 y salió
 *     falso, que es lo correcto.
 *   - QUE LA PÁGINA QUEDE COMO ESTABA. Ese mismo `residuo` se imprime, así que si
 *     una restauración fallara —React repintando encima, por ejemplo— se vería en la
 *     tabla en vez de contaminar en silencio la medida siguiente.
 *
 * Y para el sujeto, además, se lee el lienzo desde dentro de la página (se dibuja
 * en un 2D y se muestrea) buscando píxeles NO NEGROS. Es un dato de apoyo, no el
 * veredicto: un lienzo WebGL sin `preserveDrawingBuffer` puede devolver negro
 * aunque en pantalla se vea, y por eso quien manda es la captura de pantalla.
 *
 * `visible` sale true solo si: hay nodo, la cadena de estilos está encendida, el
 * área recortada al viewport es mayor que cero, Y la captura demuestra que ese
 * nodo pone píxeles en la pantalla.
 *
 * `pestanaVisible` se lee con `document.visibilityState` DENTRO DE LA MISMA
 * llamada que devuelve las geometrías, no en otra aparte.
 *
 * Y el acta dice SOBRE QUÉ se midió: `usuario`, `sesion` —el nombre del día tal y como
 * cuelga del muro— y `rama` (`conSujeto` | `sinSujeto`), los tres leídos en esa misma
 * llamada. Sin ellos el JSON no se puede releer dentro de un mes: cinco booleanos sueltos
 * no dicen si el día que se midió era uno en el que esos cinco tenían que estar.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  arrancarChrome,
  buscarChrome,
  comoExpresion,
  CONGELAR_EN_PAGINA,
  contarAporte,
  contarNoNegros,
  Devtools,
  esperar,
  mascaraDeCambio,
  objetivoDePagina,
  unirRects,
  UMBRAL_CAMBIO,
  UMBRAL_NO_NEGRO,
} from './comun.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// El viewport: 414 x 736 CSS px. 414 * 16 / 9 = 736 EXACTO, así que el formato es
// 9:16 de verdad y no un redondeo, y además es el tamaño real de un iPhone Plus.
const ANCHO = 414
const ALTO = 736

const CLAVES_POR_DEFECTO = ['sala', 'letras3D', 'sujeto', 'camara', 'implementos']

// LA COLA DE ASESORADOS por la que se busca un día con sujeto. El primero es el que la app
// elige sola cuando nadie ha tocado el selector, así que empezar por él mide lo que ve
// quien abre la app sin más; los otros están detrás porque su semana cae en días
// distintos y basta con que uno de los tres tenga pesas hoy. El orden importa: se mide el
// PRIMERO que monte la rama `conSujeto`, no el que más elementos encienda.
const CANDIDATOS_POR_DEFECTO = ['u-valentina', 'u-mateo', 'u-sara']

// Cuanto se le da al visor para reconstruir la malla y repintar tras cambiar
// `data-sin`. No es holgura de cortesia: con 220 ms la foto de "restaurada" salia con
// la parte todavia fuera, el residuo empataba clavado con el aporte y una pieza que si
// se dibujaba quedaba declarada invisible por un empate.
const ESPERA_DE_ESCENA = 500

// ---------------------------------------------------------------- argumentos

function leerArgumentos(argv) {
  const opciones = {
    url: 'http://localhost:5173/entrenar',
    puerto: 9222,
    chrome: '',
    salida: join(RAIZ, 'informes', 'testigo-salon.json'),
    // El viewport va en las opciones y no lo supone `arrancarChrome`: desde que el motor
    // de medida es común, el tamaño de la ventana es del encargo y no del motor.
    ancho: ANCHO,
    alto: ALTO,
    claves: CLAVES_POR_DEFECTO,
    usuario: '',
    candidatos: CANDIDATOS_POR_DEFECTO,
    buscarSujeto: true,
    ciega: '',
    sinCongelar: false,
    sinInforme: false,
    pruebaNegativa: false,
    conservar: false,
  }
  for (const bruto of argv.slice(2)) {
    const [nombre, ...resto] = bruto.replace(/^--/, '').split('=')
    const valor = resto.join('=')
    if (nombre === 'url') opciones.url = valor
    else if (nombre === 'puerto') opciones.puerto = Number(valor)
    else if (nombre === 'chrome') opciones.chrome = valor
    else if (nombre === 'salida') opciones.salida = resolve(RAIZ, valor)
    else if (nombre === 'claves') opciones.claves = valor.split(',').filter(Boolean)
    else if (nombre === 'usuario') opciones.usuario = valor
    else if (nombre === 'candidatos') opciones.candidatos = valor.split(',').filter(Boolean)
    else if (nombre === 'foto') opciones.foto = valor
    else if (nombre === 'sin-partes') opciones.sinPartes = valor
    else if (nombre === 'sin-buscar-sujeto') opciones.buscarSujeto = false
    else if (nombre === 'prueba-ciega') {
      opciones.ciega = valor
      opciones.sinInforme = true
    }
    else if (nombre === 'sin-informe') opciones.sinInforme = true
    else if (nombre === 'conservar') opciones.conservar = true
    else if (nombre === 'sin-congelar') opciones.sinCongelar = true
    else if (nombre === 'prueba-negativa') opciones.pruebaNegativa = true
    else throw new Error(`opción que no conozco: ${bruto}`)
  }
  if (opciones.pruebaNegativa) {
    // Marcas que NO existen en el DOM. Si alguna de estas saliera visible, el
    // testigo estaría diciendo que sí a cualquier cosa y no valdría para nada.
    opciones.claves = CLAVES_POR_DEFECTO.map((c) => `${c}-que-no-existe`)
    opciones.sinInforme = true
  }
  // LA COLA EFECTIVA. `--usuario` no es «el único», es «el primero»: si su día de hoy cae
  // sin sujeto, detrás quedan los demás y el script se mueve en vez de firmar. Con
  // `--sin-buscar-sujeto` la cola tiene un solo nombre y se mide lo que se pida; la cadena
  // vacía significa «no toques `alpha-usuario`», o sea el asesorado que elige la app sola.
  opciones.cola = opciones.buscarSujeto
    ? [...new Set([opciones.usuario, ...opciones.candidatos].filter(Boolean))]
    : [opciones.usuario]
  if (!opciones.cola.length) opciones.cola = ['']
  return opciones
}

// ------------------------------------------------------------------- Chrome

const MEDIR_EN_PAGINA = (claves) => {
  const ancho = Math.round(window.innerWidth)
  const alto = Math.round(window.innerHeight)

  const cadenaEncendida = (nodo) => {
    let el = nodo
    while (el && el.nodeType === 1) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none') return { ok: false, motivo: 'display:none' }
      if (cs.visibility === 'hidden' || cs.visibility === 'collapse') {
        return { ok: false, motivo: `visibility:${cs.visibility}` }
      }
      if (parseFloat(cs.opacity) === 0) return { ok: false, motivo: 'opacity:0' }
      el = el.parentElement
    }
    return { ok: true, motivo: '' }
  }

  const muestrearLienzo = (c) => {
    const base = { ancho: c.width, alto: c.height, muestreados: 0, noNegros: 0, maximo: 0 }
    try {
      if (!c.width || !c.height) return base
      const t = document.createElement('canvas')
      t.width = Math.min(120, c.width)
      t.height = Math.min(120, c.height)
      const g = t.getContext('2d', { willReadFrequently: true })
      g.drawImage(c, 0, 0, t.width, t.height)
      const datos = g.getImageData(0, 0, t.width, t.height).data
      base.muestreados = t.width * t.height
      for (let i = 0; i < datos.length; i += 4) {
        const l = Math.max(datos[i], datos[i + 1], datos[i + 2])
        if (l > 10) base.noNegros++
        if (l > base.maximo) base.maximo = l
      }
      return base
    } catch (e) {
      return { ...base, error: String(e && e.message ? e.message : e) }
    }
  }

  const elementos = {}
  for (const clave of claves) {
    const nodos = Array.from(document.querySelectorAll(`[data-testigo="${clave}"]`))
    const rects = []
    const motivos = []
    let conEstilosOk = 0
    const lienzos = []
    for (const nodo of nodos) {
      const estado = cadenaEncendida(nodo)
      if (!estado.ok) {
        motivos.push(estado.motivo)
        continue
      }
      conEstilosOk++
      const r = nodo.getBoundingClientRect()
      const x0 = Math.max(0, Math.floor(r.left))
      const y0 = Math.max(0, Math.floor(r.top))
      const x1 = Math.min(ancho, Math.ceil(r.right))
      const y1 = Math.min(alto, Math.ceil(r.bottom))
      if (x1 > x0 && y1 > y0) rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 })
      else motivos.push('el rectángulo cae fuera del viewport')
      for (const c of nodo.querySelectorAll('canvas')) lienzos.push(muestrearLienzo(c))
      if (nodo.tagName === 'CANVAS') lienzos.push(muestrearLienzo(nodo))
    }
    elementos[clave] = { enDom: nodos.length, conEstilosOk, rects, motivos, lienzos }
  }

  // Qué rama del salón se ha montado. `SalonEntrenar` tiene dos excluyentes: con
  // sujeto en el centro, o el hueco `sinPatron` cuando el ejercicio de hoy no tiene
  // patrón de movimiento reconocido. Saberlo cambia por completo la lectura de un
  // `sujeto` ausente: no es lo mismo que el lienzo no pinte a que hoy no haya cuerpo
  // que pintar.
  const rama = document.querySelector('[data-hueco="sinPatron"]') ? 'sinSujeto' : 'conSujeto'

  // SOBRE QUÉ DÍA SE LEVANTA EL ACTA. El nombre de la sesión no tiene marca propia: cuelga
  // del muro izquierdo, en el párrafo que va justo debajo del rótulo «Microciclo Mn». Se
  // lee de ahí —de lo que se ve, que es lo que este script mide— y no de ningún estado
  // interno. El asesorado se relee de `localStorage`, no se da por supuesto el que se
  // escribió: si la app lo hubiera cambiado, el acta tiene que decir el que valió.
  let sesion = ''
  for (const p of document.querySelectorAll('p')) {
    if (/^\s*Microciclo\s+M/i.test(p.textContent || '')) {
      const debajo = p.nextElementSibling
      if (debajo) sesion = (debajo.textContent || '').replace(/\s+/g, ' ').trim()
      break
    }
  }
  let usuario = ''
  try {
    usuario = localStorage.getItem('alpha-usuario') || ''
  } catch (e) {
    usuario = ''
  }

  const desplazamiento = {
    y: Math.round(window.scrollY),
    alcanzable: Math.max(0, document.documentElement.scrollHeight - alto),
  }

  return {
    estadoDeLaPestana: document.visibilityState,
    conFoco: document.hasFocus(),
    ancho,
    alto,
    tituloDeRuta: location.pathname,
    haySalon: !!document.querySelector('[data-salon="entrenar"]'),
    rama,
    sesion,
    usuario,
    desplazamiento,
    texto: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 400),
    elementos,
  }
}

/**
 * LA SEGUNDA PRUEBA DE QUE EL TESTIGO SABE DECIR NO, y la que de verdad importa.
 *
 * Buscar una marca inventada solo demuestra que el `querySelector` funciona. Esto
 * demuestra que funciona EL CONTADOR DE PÍXELES: deja el elemento en el DOM, con su
 * rectángulo entero dentro del viewport y con una cadena de estilos que pasa todas
 * las comprobaciones baratas —`opacity: 0.002` no es `opacity: 0`—, y aun así en
 * pantalla no pone nada. Es la forma exacta de la trampa del lienzo negro: presente,
 * medible, y sin pintar un solo píxel. Si el testigo lo diera por visible, no serviría.
 */
/**
 * CONGELA LO QUE SE MUEVE SOLO, y solo eso.
 *
 * La marquesina de avisos se desplaza sin parar. Entre la captura de antes y la de
 * después de apagar un nodo pasa cerca de un segundo, y en ese segundo la marquesina
 * ya ha recorrido lo suyo: esos píxeles cambian sin que nadie los haya apagado, y
 * enturbian la medida hasta el punto de que un elemento CIEGO puede parecer que
 * aporta algo. Con `animation-play-state: paused` la animación se queda quieta EN EL
 * FOTOGRAMA QUE TOCA —no desaparece, no se salta al final—, así que lo que se mide
 * sigue siendo la pantalla que se ve; solo deja de correrse debajo del pie.
 *
 * Las transiciones se anulan por lo mismo: apagar un nodo puede disparar una y
 * teñir de cambio a los vecinos.
 */
const CEGAR_EN_PAGINA = (clave) => {
  const hoja = document.createElement('style')
  hoja.textContent = `[data-testigo="${clave}"]{opacity:0.002 !important}`
  document.head.appendChild(hoja)
  return document.querySelectorAll(`[data-testigo="${clave}"]`).length
}

const APAGAR_EN_PAGINA = (clave) => {
  const nodos = Array.from(document.querySelectorAll(`[data-testigo="${clave}"]`))
  window.__testigoApagado = nodos.map((n) => ({ n, previo: n.style.visibility }))
  for (const nodo of nodos) nodo.style.visibility = 'hidden'
  return nodos.length
}

const ENCENDER_EN_PAGINA = () => {
  const guardados = window.__testigoApagado || []
  for (const { n, previo } of guardados) n.style.visibility = previo
  window.__testigoApagado = []
  return guardados.length
}

/** Convierte una función de arriba en la expresión que se manda a la página. */
/**
 * LAS PARTES DE LA ESCENA, que no son nodos y por eso se apagan de otra forma.
 *
 * La sala, la estación, el hierro y el cuerpo son geometría dentro de UN solo
 * `<canvas>`: no hay nodo que esconder, así que el apagado de siempre —poner
 * `visibility: hidden` a un elemento— no puede tocarlas. Antes esto se disimulaba
 * midiendo las capas SVG/HTML que se dibujan encima, y por eso el acta del 29-ago daba
 * `sala` e `implementos` en verde mientras `construirSala` y `construirImplementos` no
 * tenían una sola llamada: certificaba el cartel y no la sala.
 *
 * Ahora se le pide al visor que deje esa parte fuera del dibujo —atributo `data-sin` en
 * el lienzo— y se cuenta la diferencia. Es la misma resta, aplicada donde hacía falta.
 */
const PARTES_DE_ESCENA = ['sala', 'implementos', 'sujeto', 'bahia']

/**
 * `camara` SALIÓ DE ESTA LISTA EL 2026-09-03, y no por comodidad.
 *
 * Medía el trípode del lienzo, y el trípode está en el PERFIL del sujeto —180°, el ángulo
 * con el que el encoder mide, que no se mueve por motivos de encuadre—. El salón entra por
 * delante, así que el trípode queda a la espalda de quien abre: se plantó un cebo de once
 * cajas blancas a lo largo de su eje, de 1,2 m a 4,6 m, y no se ve ni una. Con la cámara
 * ahí dentro, el acta iba a decir «falta la cámara» en cada corrida, para siempre, por algo
 * que se decidió no dibujar. Un rojo permanente no es rigor: se vuelve ruido y se acaba
 * ignorando, que es como se cuela el rojo de verdad.
 *
 * Bryan decidió el 2026-09-03 —viendo la captura de entrar por el perfil, que mete el
 * trípode en cuadro y pone el multipower delante de la persona— **representar** la
 * estación en vez de enseñarla: el reflector (silueta, rótulo, testigo rojo y el mando de
 * medir) bajó al muro de enfrente. Eso es un NODO, y lleva su `data-testigo="camara"`
 * puesto desde que se construyó, así que el acta lo mide como mide las letras del muro.
 *
 * Lo que ya NO certifica esta acta: que el trípode 3D se vea. No se ve, a propósito, y
 * quien lo mueva tiene enfrente `geometriaDeCuadro.test.ts`, que exige que el reflector sí.
 */

const PARTES_EN_PAGINA = () => {
  const c = document.querySelector('[data-salon="entrenar"] canvas')
  if (!c) return '(sin lienzo)'
  return c.dataset.partes || '(sin dato)'
}

const LIENZO_EN_PAGINA = () => {
  const c = document.querySelector('[data-salon="entrenar"] canvas')
  if (!c) return null
  const r = c.getBoundingClientRect()
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}

const OMITIR_EN_PAGINA = (parte) => {
  const c = document.querySelector('[data-salon="entrenar"] canvas')
  if (!c) return 0
  c.dataset.sin = parte
  return 1
}

const RESTAURAR_ESCENA_EN_PAGINA = () => {
  const c = document.querySelector('[data-salon="entrenar"] canvas')
  if (c) delete c.dataset.sin
  return 1
}

/** En qué escalón del eje W está el salón ahora mismo. */
const CAPA_W_EN_PAGINA = () => {
  const s = document.querySelector('[data-salon="entrenar"]')
  const v = s && s.getAttribute('data-w')
  return v === null || v === undefined ? -1 : Number(v)
}

/**
 * Pulsa el peldaño `w` de la escalera, por el mismo camino que un dedo.
 *
 * Se pulsa el botón y no se sintetiza un arrastre a propósito: el arrastre depende del
 * umbral de `gestoVertical.ts`, de la altura del viewport y de que el navegador entregue
 * los tres eventos en orden. El botón llama al MISMO `setW`, y lo que se quiere probar
 * es que el eje mueva el cuerpo, no que el reconocedor de gestos acierte.
 */
const PULSAR_W_EN_PAGINA = (w) => {
  const grupo = document.querySelector('[role="group"][aria-label="Capa del cuerpo"]')
  if (!grupo) return -1
  const botones = grupo.querySelectorAll('button')
  if (!botones[w]) return -2
  botones[w].click()
  return botones.length
}

const SONDEO_EN_PAGINA = () => ({
  salon: !!document.querySelector('[data-salon="entrenar"]'),
  marcas: document.querySelectorAll('[data-testigo]').length,
  lienzos: document.querySelectorAll('canvas').length,
  texto: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 160),
})

// Qué rama montó el salón, y nada más: es lo único que hace falta para decidir si este
// asesorado sirve para levantar el acta. El nombre del día y el resto se leen después, en
// la misma llamada que las geometrías, y no aquí.
const RAMA_EN_PAGINA = () =>
  document.querySelector('[data-hueco="sinPatron"]') ? 'sinSujeto' : 'conSujeto'

async function esperarAlSalon(dt) {
  const limite = Date.now() + 45_000
  let ultimo = null
  while (Date.now() < limite) {
    ultimo = await dt.evaluar(comoExpresion(SONDEO_EN_PAGINA))
    if (ultimo.salon && ultimo.marcas > 0) return ultimo
    await esperar(500)
  }
  return ultimo
}

async function medir(opciones) {
  const { proceso, perfil } = await arrancarChrome(opciones)
  let dt = null
  let idObjetivo = ''
  try {
    const objetivo = await objetivoDePagina(opciones.puerto)
    idObjetivo = objetivo.id
    dt = await Devtools.conectar(objetivo.webSocketDebuggerUrl)
    await dt.pedir('Page.enable')
    await dt.pedir('Runtime.enable')
    await dt.pedir('Emulation.setDeviceMetricsOverride', {
      width: ANCHO,
      height: ALTO,
      deviceScaleFactor: 1,
      mobile: true,
      screenWidth: ANCHO,
      screenHeight: ALTO,
    })
    await dt.pedir('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
    // SE MIDE CON EL MOVIMIENTO REDUCIDO, y esto no es un atajo: es la unica forma de
    // que la resta signifique algo.
    //
    // El congelador de la pagina para las animaciones CSS, pero el sujeto no se mueve
    // por CSS: lo mueve un bucle de `requestAnimationFrame` dentro del lienzo. Con el
    // gesto corriendo, TODOS los pixeles del cuerpo cambian solos entre dos capturas, se
    // van a la mascara de inquietos y quedan descontados — asi que apagar el sujeto no
    // cambiaba nada medible y el acta del 2-sep lo daba por invisible teniendolo delante.
    //
    // `prefers-reduced-motion: reduce` es un ajuste de persona, no un interruptor de
    // pruebas: el visor ya lo respeta y deja el modelo quieto en su fotograma. Se emula
    // ANTES de navegar porque el hook lo lee al montar.
    await dt.pedir('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    // La pestaña, delante. Sin esto `visibilityState` puede valer 'hidden', y
    // lo que se mida después es un número falso con buena cara.
    await dt.pedir('Page.bringToFront')

    // ------------------------------------------------ SOBRE QUÉ DÍA SE VA A MEDIR
    //
    // El salón tiene dos ramas legítimas y la de cardio no monta sujeto ni cámara a
    // propósito. Medir ahí no mide la pantalla: mide el calendario. Así que se entra con
    // cada candidato de la cola, se mira QUÉ RAMA montó, y se mide el primero que traiga
    // `conSujeto`. Los descartados se dicen en voz alta —no se tapan— para que quien lea
    // la corrida sepa por qué el acta lleva el nombre que lleva.
    const entrar = async (id) => {
      if (id) {
        // En modo demo la app elige el asesorado por `localStorage.alpha-usuario`. Para
        // escribirlo hay que estar ya en el mismo origen, así que se carga la raíz, se
        // deja la marca y luego se va a la ruta pedida. Esto NO toca código de la app:
        // es la misma tecla que da su propio selector de usuario.
        const raiz = new URL(opciones.url).origin
        const primera = new Promise((r) => dt.al('Page.loadEventFired', r))
        await dt.pedir('Page.navigate', { url: raiz })
        await Promise.race([primera, esperar(30_000)])
        await dt.evaluar(comoExpresion((u) => localStorage.setItem('alpha-usuario', u), id))
      }
      const cargada = new Promise((r) => dt.al('Page.loadEventFired', r))
      await dt.pedir('Page.navigate', { url: opciones.url })
      await Promise.race([cargada, esperar(30_000)])
      return await esperarAlSalon(dt)
    }

    let arranque = null
    let usuarioMedido = ''
    const descartados = []
    for (const id of opciones.cola) {
      arranque = await entrar(id)
      usuarioMedido = id
      if (!opciones.buscarSujeto) break
      const rama = await dt.evaluar(comoExpresion(RAMA_EN_PAGINA))
      if (rama === 'conSujeto') break
      descartados.push(id || '(el que elige la app sola)')
      console.log(
        `   ${id || '(el que elige la app sola)'} monta la rama sinSujeto: hoy le toca ` +
          'cardio o cribado, y ahí no hay sujeto ni cámara A PROPÓSITO. No sirve para ' +
          'esta medida; se prueba el siguiente.',
      )
    }
    if (descartados.length) {
      console.log(`   se mide con ${usuarioMedido || '(el que elige la app sola)'}.`)
    }

    // Un respiro para que el visor pinte su primer fotograma y las transiciones
    // de entrada terminen: medir a mitad de una animación no mide la pantalla.
    await esperar(3000)
    await dt.pedir('Page.bringToFront')

    if (opciones.ciega) {
      const cegados = await dt.evaluar(comoExpresion(CEGAR_EN_PAGINA, opciones.ciega))
      console.log(`   se han dejado ciegos ${cegados} nodos de "${opciones.ciega}"`)
      await esperar(600)
    }

    // --- LO QUE SE MUEVE SOLO. Primero se congela lo animado; después se toman cinco
    // capturas repartidas en 2,4 s y se marca cuanto siga bailando. El tramo es largo a
    // propósito: el cronómetro cambia de segundo una vez por segundo, y una ventana más
    // corta podía no pillar ni un tic y dejar los dígitos sin enmascarar.
    if (!opciones.sinCongelar) {
      const animaciones = await dt.evaluar(comoExpresion(CONGELAR_EN_PAGINA))
      console.log(`   animaciones congeladas en su fotograma (había ${animaciones})`)
      await esperar(400)
    }
    const churn = new Uint8Array(ANCHO * ALTO)
    let churnCuenta = 0
    let previa = await dt.captura()
    for (let i = 0; i < 4; i++) {
      await esperar(600)
      const siguiente = await dt.captura()
      const { mascara } = mascaraDeCambio(previa, siguiente)
      for (let k = 0; k < churn.length; k++) if (mascara[k]) churn[k] = 1
      previa = siguiente
    }
    for (let k = 0; k < churn.length; k++) if (churn[k]) churnCuenta++

    // --- LA LECTURA DEL DOM Y EL ESTADO DE LA PESTAÑA, en la MISMA llamada.
    const lectura = await dt.evaluar(comoExpresion(MEDIR_EN_PAGINA, opciones.claves))

    const detalle = {}
    for (const clave of opciones.claves) {
      const bruto = lectura.elementos[clave]
      const { mascara, area } = unirRects(bruto.rects, ANCHO, ALTO)

      const esEscena = PARTES_DE_ESCENA.includes(clave)

      // Una parte de la escena no tiene rectángulo propio: su máscara es el lienzo
      // entero, que es donde puede aparecer o desaparecer un píxel suyo.
      let mascaraUsada = mascara
      let areaUsada = area
      if (esEscena) {
        const r = await dt.evaluar(comoExpresion(LIENZO_EN_PAGINA))
        if (r) {
          const x0 = Math.max(0, Math.floor(r.left))
          const y0 = Math.max(0, Math.floor(r.top))
          const x1 = Math.min(ANCHO, Math.ceil(r.right))
          const y1 = Math.min(ALTO, Math.ceil(r.bottom))
          const u = unirRects(x1 > x0 && y1 > y0 ? [{ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }] : [], ANCHO, ALTO)
          mascaraUsada = u.mascara
          areaUsada = u.area
        } else {
          mascaraUsada = new Uint8Array(ANCHO * ALTO)
          areaUsada = 0
        }
      }

      const antes = await dt.captura()
      const apagados = esEscena
        ? await dt.evaluar(comoExpresion(OMITIR_EN_PAGINA, clave))
        : await dt.evaluar(comoExpresion(APAGAR_EN_PAGINA, clave))
      // El visor repinta al ver el atributo, pero lo hace en su propio fotograma: sin
      // esta espera la foto de después sale con la escena todavía entera.
      if (esEscena) await esperar(ESPERA_DE_ESCENA)
      // Que la malla haya cambiado de verdad. Una parte puede pedirse fuera y seguir
      // dentro —el atributo se pone, nadie reconstruye— y desde fuera eso se ve igual
      // que una pieza que no se dibuja: cero pixeles. Son dos fallos distintos.
      const partesTrasApagar = esEscena ? await dt.evaluar(comoExpresion(PARTES_EN_PAGINA)) : null
      const despues = await dt.captura()
      if (esEscena) await dt.evaluar(comoExpresion(RESTAURAR_ESCENA_EN_PAGINA))
      else await dt.evaluar(comoExpresion(ENCENDER_EN_PAGINA))
      if (esEscena) await esperar(ESPERA_DE_ESCENA)
      const restaurada = await dt.captura()

      const aporte = contarAporte(antes, despues, churn, mascaraUsada)
      const residuo = contarAporte(antes, restaurada, churn, mascaraUsada)

      // SEGUNDA LECTURA, con el cuerpo fuera. Una pieza puede estar en la escena y no
      // aportar un pixel porque el sujeto la tapa entera: apagarla no cambia nada, y sin
      // esta lectura el acta no distingue "no se dibuja" de "se dibuja detras del
      // cuerpo". Son dos fallos distintos y se arreglan en sitios distintos.
      let aporteSinCuerpo = null
      if (esEscena && clave !== 'sujeto' && aporte.total <= residuo.total) {
        await dt.evaluar(comoExpresion(OMITIR_EN_PAGINA, 'sujeto'))
        await esperar(ESPERA_DE_ESCENA)
        const soloEscena = await dt.captura()
        await dt.evaluar(comoExpresion(OMITIR_EN_PAGINA, `sujeto,${clave}`))
        await esperar(ESPERA_DE_ESCENA)
        const sinLosDos = await dt.captura()
        await dt.evaluar(comoExpresion(RESTAURAR_ESCENA_EN_PAGINA))
        await esperar(ESPERA_DE_ESCENA)
        aporteSinCuerpo = contarAporte(soloEscena, sinLosDos, churn, mascaraUsada).dentro
      }
      const noNegros = contarNoNegros(antes, mascaraUsada)

      // EL CONTROL. `residuo` compara la captura de partida con la de después de
      // restaurar: dos fotos del MISMO estado, separadas por lo mismo que separa a las
      // dos de la medida. Es cuánto se mueve la pantalla ella sola en ese rato, con la
      // máscara de inquietos ya descontada. Para dar un elemento por pintado se le exige
      // mover MÁS píxeles que eso. Sin este control, el reloj corriendo bastaría para
      // que cualquier cosa saliera visible.
      const pintaAlgo = aporte.total > residuo.total
      // Una parte de la escena no pasa por `cadenaEncendida`: no tiene cadena de
      // estilos que revisar porque no tiene nodo. Lo que la da por pintada es lo mismo
      // de siempre —mover más píxeles que el ruido de fondo—, que era lo que importaba.
      const visible = esEscena ? areaUsada > 0 && pintaAlgo : bruto.conEstilosOk > 0 && area > 0 && pintaAlgo

      detalle[clave] = {
        visible,
        enLienzo: esEscena,
        pixeles: visible ? (esEscena ? aporte.dentro : area) : 0,
        enDom: bruto.enDom,
        conEstilosOk: bruto.conEstilosOk,
        apagados,
        areaRecortada: areaUsada,
        aportePintado: aporte.total,
        aporteDentroDelRect: aporte.dentro,
        noNegrosEnRect: noNegros.cuenta,
        canalMaximoEnRect: noNegros.maximo,
        residuoTrasRestaurar: residuo.total,
        aporteSinCuerpo,
        partesTrasApagar,
        lienzos: bruto.lienzos,
        motivos: bruto.motivos,
      }
    }

    // ── EL EJE W ────────────────────────────────────────────────────────────
    // Que la escalera de cinco peldaños se pinte no prueba nada: los botones pueden
    // estar perfectos y el eje muerto —es exactamente el fallo que ya convivió con
    // 3.016 pruebas en verde—. Lo único que lo prueba es que al pasar de la piel al
    // hueso CAMBIEN píxeles dentro del cuerpo. Se mide como todo lo demás: dos fotos,
    // el ruido de fondo descontado, y la máscara puesta donde está el sujeto.
    console.log('  vertices por parte de la malla: ' + (await dt.evaluar(comoExpresion(PARTES_EN_PAGINA))))

    // La foto, cuando se pide. Un numero dice si una pieza aporta pixeles; no dice si
    // lo que aporta se PARECE a un implemento. Para eso hay que mirarla.
    // Para mirar una pieza sola: se apaga el resto de la escena antes del retrato. Un
    // numero dice cuantos pixeles pone; solo la foto dice si eso PARECE lo que dice ser.
    if (opciones.sinPartes) {
      await dt.evaluar(comoExpresion(OMITIR_EN_PAGINA, opciones.sinPartes))
      await esperar(ESPERA_DE_ESCENA)
    }
    if (opciones.foto) {
      const png = await dt.pedir('Page.captureScreenshot', { format: 'png' })
      writeFileSync(opciones.foto, Buffer.from(png.data, 'base64'))
      console.log('  foto en ' + opciones.foto)
    }

    const ejeW = { desde: -1, hasta: -1, cambioEnSujeto: 0, ruido: 0, botones: 0 }
    {
      const rectSujeto = unirRects(lectura.elementos.sujeto ? lectura.elementos.sujeto.rects : [], ANCHO, ALTO)
      ejeW.desde = await dt.evaluar(comoExpresion(CAPA_W_EN_PAGINA))
      const antes = await dt.captura()
      ejeW.botones = await dt.evaluar(comoExpresion(PULSAR_W_EN_PAGINA, 4))
      await esperar(320)
      const despues = await dt.captura()
      ejeW.hasta = await dt.evaluar(comoExpresion(CAPA_W_EN_PAGINA))
      // El control, igual que en los elementos: se vuelve a la piel y se compara la
      // foto de partida con la de después de volver. Es cuánto se mueve la pantalla
      // sola en ese rato; para dar el eje por vivo hay que superarlo.
      await dt.evaluar(comoExpresion(PULSAR_W_EN_PAGINA, 0))
      await esperar(320)
      const vuelta = await dt.captura()
      const cambio = contarAporte(antes, despues, churn, rectSujeto.mascara)
      const ruido = contarAporte(antes, vuelta, churn, rectSujeto.mascara)
      ejeW.ruido = ruido.dentro
      ejeW.cambioEnSujeto = cambio.dentro > ruido.dentro ? cambio.dentro : 0
    }

    return {
      arranque,
      lectura,
      detalle,
      ejeW,
      churnCuenta,
      capturaAncho: previa.ancho,
      capturaAlto: previa.alto,
    }
  } finally {
    if (dt) dt.cerrar()
    if (!opciones.conservar) {
      // Se cierra la pestaña por el endpoint del propio Chrome —así se va con su
      // ceremonia— y solo después se mata el proceso, con el árbol entero: Chrome
      // deja procesos de render sueltos si se mata únicamente al padre.
      if (idObjetivo) {
        await fetch(`http://127.0.0.1:${opciones.puerto}/json/close/${idObjetivo}`).catch(() => {})
        await esperar(600)
      }
      proceso.kill()
      if (process.platform === 'win32' && proceso.pid) {
        spawn('taskkill', ['/pid', String(proceso.pid), '/T', '/F'], { stdio: 'ignore' })
      }
    } else {
      console.log(`\nChrome sigue abierto (perfil en ${perfil}). Ciérralo tú.`)
    }
  }
}

// ------------------------------------------------------------------ salida

function imprimir(resultado, opciones) {
  const { lectura, detalle, churnCuenta } = resultado
  console.log('')
  console.log(`  url               ${opciones.url}`)
  console.log(`  ruta servida      ${lectura.tituloDeRuta}`)
  console.log(`  viewport          ${lectura.ancho} x ${lectura.alto}`)
  console.log(`  estado pestaña    ${lectura.estadoDeLaPestana} (foco: ${lectura.conFoco})`)
  console.log(`  salón en el DOM   ${lectura.haySalon}`)
  console.log(`  asesorado         ${lectura.usuario || '(el que elige la app sola)'}`)
  console.log(`  sesión de hoy     ${lectura.sesion || '(el muro no rotula día)'}`)
  console.log(`  rama montada      ${lectura.rama}`)
  console.log(
    `  scroll            y=${lectura.desplazamiento.y}, ` +
      `alcanzable=${lectura.desplazamiento.alcanzable}px (lo medido es sin tocar nada)`,
  )
  console.log(`  texto en pantalla ${lectura.texto}`)
  console.log(
    `  píxeles inquietos ${churnCuenta} de ${ANCHO * ALTO} ` +
      `(${((100 * churnCuenta) / (ANCHO * ALTO)).toFixed(2)}%) — descontados de cada aporte`,
  )
  console.log('')
  console.log(
    '  marca         visible  píxeles   nodos  aporte   dentro   no-negros  máx  residuo  sinCuerpo',
  )
  for (const [clave, d] of Object.entries(detalle)) {
    console.log(
      `  ${clave.padEnd(13)} ${String(d.visible).padEnd(8)} ${String(d.pixeles).padStart(7)}` +
        `  ${String(d.enDom).padStart(5)} ${String(d.aportePintado).padStart(7)}` +
        ` ${String(d.aporteDentroDelRect).padStart(8)} ${String(d.noNegrosEnRect).padStart(11)}` +
        ` ${String(d.canalMaximoEnRect).padStart(4)} ${String(d.residuoTrasRestaurar).padStart(8)}` +
        ` ${String(d.aporteSinCuerpo === null || d.aporteSinCuerpo === undefined ? '-' : d.aporteSinCuerpo).padStart(10)}`,
    )
    for (const l of d.lienzos) {
      console.log(
        `      lienzo ${l.ancho}x${l.alto}: ${l.noNegros}/${l.muestreados} muestras no negras, ` +
          `canal máximo ${l.maximo}${l.error ? ` — el 2D no lo dejó leer: ${l.error}` : ''}`,
      )
    }
    if (d.partesTrasApagar) console.log(`      malla con la parte fuera: ${d.partesTrasApagar}`)
    for (const m of d.motivos) console.log(`      apagado por: ${m}`)
  }
  console.log('')
}

function actaDe(resultado, opciones) {
  const elementos = {}
  for (const clave of opciones.claves) {
    elementos[clave] = {
      visible: resultado.detalle[clave].visible,
      pixeles: resultado.detalle[clave].pixeles,
      // Sobre QUE se midio. Sin este campo el acta no distingue haber certificado la
      // sala del motor de haber certificado la capa que se pinta encima, y esa
      // diferencia es la que dejo pasar `construirSala` sin una sola llamada.
      enLienzo: resultado.detalle[clave].enLienzo === true,
    }
  }
  const { ancho, alto } = resultado.lectura
  const divisor = (a, b) => {
    const mcd = (x, y) => (y === 0 ? x : mcd(y, x % y))
    const g = mcd(a, b)
    return `${a / g}:${b / g}`
  }
  // SOBRE QUÉ SE MIDIÓ, dentro del acta y no en la memoria de quien la corrió. Los tres
  // salen de la misma llamada que las geometrías: el asesorado con el que se entró, el
  // nombre del día tal y como cuelga del muro, y cuál de las dos ramas del salón se montó.
  // Un `sujeto: false` sobre `rama: "sinSujeto"` no es un fallo de la pantalla —es el
  // comportamiento decidido— y sin este trío el JSON no deja distinguir una cosa de la otra.
  return {
    pestanaVisible: resultado.lectura.estadoDeLaPestana === 'visible',
    formato: divisor(ancho, alto),
    viewport: { ancho, alto },
    cuando: new Date().toISOString(),
    usuario: resultado.lectura.usuario || '(el que elige la app sola)',
    sesion: resultado.lectura.sesion || '(el muro no rotula día)',
    rama: resultado.lectura.rama,
    elementos,
    ejeW: resultado.ejeW,
  }
}

async function principal() {
  const opciones = leerArgumentos(process.argv)
  console.log(
    opciones.pruebaNegativa
      ? '\n== PRUEBA NEGATIVA: buscando marcas que NO existen =='
      : '\n== TESTIGO DEL SALÓN ==',
  )
  console.log(`   marcas buscadas: ${opciones.claves.join(', ')}`)

  const resultado = await medir(opciones)
  imprimir(resultado, opciones)

  const acta = actaDe(resultado, opciones)

  if (opciones.ciega) {
    const bajoPrueba = acta.elementos[opciones.ciega]
    if (!bajoPrueba) {
      console.error(`  "${opciones.ciega}" no estaba entre las marcas medidas.`)
      process.exitCode = 1
      return
    }
    if (bajoPrueba.visible !== false || bajoPrueba.pixeles !== 0) {
      console.error(
        `  EL TESTIGO NO SIRVE: "${opciones.ciega}" estaba en el DOM sin pintar nada y ` +
          'lo ha dado por visible. Es justo la trampa que este script existe para cazar.',
      )
      process.exitCode = 1
      return
    }
    console.log(
      `  El contador de píxeles funciona: "${opciones.ciega}" seguía en el DOM, con su ` +
        'rectángulo entero y sin opacity:0, y aun así ha salido visible:false con 0 píxeles.',
    )
    return
  }

  if (opciones.pruebaNegativa) {
    const chivatos = Object.entries(acta.elementos).filter(
      ([, v]) => v.visible !== false || v.pixeles !== 0,
    )
    if (chivatos.length) {
      console.error(
        `  EL TESTIGO NO SIRVE: dio por buenas ${chivatos.length} marcas inventadas ` +
          `(${chivatos.map(([k]) => k).join(', ')}).`,
      )
      process.exitCode = 1
      return
    }
    console.log('  El testigo sabe decir que no: las cinco marcas inventadas dan visible:false y 0.')
    return
  }

  // EL ACTA NO SE FIRMA SOBRE UN DÍA DE CARDIO. Si se llegó aquí en la rama `sinSujeto`
  // —o ningún candidato tenía pesas hoy, o se pidió a mano con `--sin-buscar-sujeto`— el
  // acta diría `sujeto: false` y `camara: false` por una ausencia CORRECTA, y eso no es
  // una medida de la pantalla. Se imprime, se dice por qué, y NO se pisa el acta buena.
  if (acta.rama === 'sinSujeto' && !opciones.sinInforme) {
    console.error(
      `  El salón montó la rama sinSujeto con ${acta.usuario} (${acta.sesion}): hoy le toca ` +
        'cardio o cribado, y ahí el sujeto y la cámara faltan A PROPÓSITO.',
    )
    console.error(
      `  Probados sin encontrar día con sujeto: ${opciones.cola.join(', ')}. El acta NO se ` +
        'escribe: medir aquí mide el calendario, no la pantalla. Prueba con otro asesorado ' +
        '(--usuario=) o amplía la cola (--candidatos=).',
    )
    console.log(JSON.stringify(acta, null, 2))
    process.exitCode = 1
    return
  }

  if (!opciones.sinInforme) {
    mkdirSync(dirname(opciones.salida), { recursive: true })
    writeFileSync(opciones.salida, `${JSON.stringify(acta, null, 2)}\n`, 'utf8')
    console.log(`  acta escrita en ${opciones.salida}`)
  }
  console.log(JSON.stringify(acta, null, 2))

  const faltan = Object.entries(acta.elementos).filter(([, v]) => !v.visible)
  if (!acta.pestanaVisible) {
    console.error('  La pestaña no estaba delante: el acta no vale como prueba.')
    process.exitCode = 1
  } else if (faltan.length) {
    console.error(`  Faltan en pantalla: ${faltan.map(([k]) => k).join(', ')}`)
    process.exitCode = 1
  }
}

principal().catch((e) => {
  console.error(`\n  el testigo se paró: ${e.message}`)
  process.exitCode = 2
})
