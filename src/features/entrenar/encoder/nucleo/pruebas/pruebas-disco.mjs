/**
 * Pruebas de la detección del disco — se corren sin cámara y sin nadie.
 *
 *   node pruebas-disco.mjs
 *
 * Fotogramas sintéticos con un círculo de posición y tamaño conocidos: se
 * comprueba que se identifica, que la elipse da el ángulo, que aguanta oclusión
 * sin mentir y que no deriva en 1.500 fotogramas. Correr SIEMPRE tras tocar
 * `disco.js`.
 */

import {
  identificarEstructura, detectarDisco, ajusteRobusto, bordesPorRayos, anguloDeCamara, romPlausible,
  escalaDeLaBarra, brazoEnMm,
} from '../disco.js'

const W = 400, H = 300

/** Fotograma sintético: fondo claro, elipse oscura, ruido, oclusión opcional. */
function marco({ cx, cy, a, b, fondo = 180, disco = 45, ruido = 6, ocluir = null, giro = 0 }) {
  const d = new Uint8ClampedArray(W * H * 4)
  let semilla = 7
  const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648 - 0.5 }
  const cosG = Math.cos(giro), sinG = Math.sin(giro)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy
      const u = dx * cosG + dy * sinG, v = -dx * sinG + dy * cosG
      const dentro = (u * u) / (a * a) + (v * v) / (b * b) <= 1
      let val = dentro ? disco : fondo
      if (ocluir && x >= ocluir.x0 && x <= ocluir.x1 && y >= ocluir.y0 && y <= ocluir.y1) val = 120
      val += azar() * ruido
      const i = (y * W + x) * 4
      d[i] = d[i + 1] = d[i + 2] = val
      d[i + 3] = 255
    }
  }
  return d
}

const linea = (etq, ok, txt) => console.log(`${ok ? 'VERDE' : 'ROJO '} · ${etq.padEnd(34)} ${txt}`)

console.log('=== IDENTIFICAR ESTRUCTURA ===')
{
  const d = marco({ cx: 200, cy: 150, a: 60, b: 60 })
  // El usuario nunca toca el centro exacto: se simula 9 px desviado.
  const r = identificarEstructura(d, W, H, { x: 209, y: 143 }, { radioMax: 140 })
  linea('disco perfecto', r.tipo === 'disco' && Math.abs(r.ajuste.r - 60) < 2,
    `tipo=${r.tipo} r=${r.ajuste?.r.toFixed(1)} centro=(${r.ajuste?.x.toFixed(1)}, ${r.ajuste?.y.toFixed(1)}) cobertura=${(r.cobertura * 100).toFixed(0)}%`)
}
{
  // Rectángulo: no debe pasar por disco.
  const d = new Uint8ClampedArray(W * H * 4).fill(255)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dentro = x > 150 && x < 250 && y > 110 && y < 190
    const i = (y * W + x) * 4
    d[i] = d[i + 1] = d[i + 2] = dentro ? 40 : 180
    d[i + 3] = 255
  }
  const r = identificarEstructura(d, W, H, { x: 200, y: 150 }, { radioMax: 140 })
  linea('rectángulo NO es disco', r.tipo !== 'disco', `tipo=${r.tipo} redondez=${r.redondez?.toFixed(3) ?? '—'}`)
}

console.log('\n=== PERSPECTIVA: la elipse mide el ángulo ===')
for (const grados of [0, 10, 20, 30]) {
  const a = 60, b = 60 * Math.cos((grados * Math.PI) / 180)
  const d = marco({ cx: 200, cy: 150, a, b, giro: Math.PI / 2 }) // aplastado en vertical
  const r = identificarEstructura(d, W, H, { x: 200, y: 150 }, { radioMax: 140 })
  const est = r.anguloCamara
  linea(`cámara a ${grados}°`, Math.abs(est - grados) <= 5,
    `estimado ${est?.toFixed(1)}° (relación ejes ${r.relacionEjes?.toFixed(3)})`)
}

console.log('\n=== OCLUSIÓN: un arco todavía define la circunferencia ===')
for (const pct of [0, 25, 40, 60]) {
  const d = marco({
    cx: 200, cy: 150, a: 60, b: 60,
    ocluir: pct > 0 ? { x0: 140, x1: 140 + Math.round(120 * (pct / 100)), y0: 0, y1: H } : null,
  })
  const r = detectarDisco(d, W, H, { x: 202, y: 148 }, 60, { radioMax: 140 })
  const errorCentro = r.ok ? Math.hypot(r.x - 200, r.y - 150) : NaN
  // Se detecta hasta el 60 % tapado, pero solo se considera fiable con el
  // contorno casi entero. Y «casi entero» es el 90 % del canto DE VERDAD: hasta
  // el 5-sep el 25 % tapado salía fiable porque la cobertura contaba rayos que
  // habían visto algún borde, y los bordes del propio tapón contaban como canto.
  // Con la cobertura medida sobre el canto encontrado, un cuarto tapado es un
  // 80 % de canto, y eso no es fiable: es exactamente lo que el aviso vigila.
  const esperado = pct === 0 ? (r.ok && r.fiable && errorCentro < 1) : (r.ok ? (!r.fiable && errorCentro < 3) : true)
  linea(`${pct}% tapado`, esperado,
    r.ok ? `centro err ${errorCentro.toFixed(2)} px · cobertura ${(r.cobertura * 100).toFixed(0)}% · fiable=${r.fiable}`
         : `rechazado: ${r.motivo} (cobertura ${(r.cobertura * 100).toFixed(0)}%)`)
}

console.log('\n=== SIN DERIVA: 1.500 fotogramas de una serie ===')
{
  // Sube y baja 8 veces. Cada fotograma se detecta desde cero.
  let pred = { x: 200, y: 150 }, peor = 0, perdidos = 0
  let peorRadio = 0
  for (let f = 0; f < 1500; f++) {
    const cy = 150 + 55 * Math.sin((f / 1500) * 8 * 2 * Math.PI)
    const d = marco({ cx: 200, cy, a: 60, b: 60 })
    const r = detectarDisco(d, W, H, pred, 60, { radioMax: 140 })
    if (!r.ok) { perdidos++; continue }
    peor = Math.max(peor, Math.hypot(r.x - 200, r.y - cy))
    // El RADIO también, y no estaba. Este check solo medía la posición, así que
    // no podía ver la deriva de escala que sí ocurre en vídeo real (ver el
    // contrato de `detectarDisco`). Aquí no puede dispararse —el disco sintético
    // mide 60 siempre— pero deja de ser un check ciego a la mitad del problema.
    peorRadio = Math.max(peorRadio, Math.abs(r.r - 60) / 60)
    pred = { x: r.x, y: r.y }
  }
  linea('error máximo en 1.500 fotogramas', peor < 2 && perdidos === 0,
    `${peor.toFixed(2)} px · ${perdidos} fotogramas perdidos`)
  linea('y el radio tampoco deriva', peorRadio < 0.02,
    `peor desvío ${(peorRadio * 100).toFixed(1)} %`)
}
{
  // La referencia del radio es el ARRANQUE, no el fotograma anterior.
  //
  // Encadenarla es lo natural y se dispara: medido sobre tres series reales, el
  // radio pasa de 94 a 220 px en menos de un segundo y se queda ahí, estable y
  // equivocado. Este check fija la semántica que lo evita: `radioEsperado` es la
  // vara de medir, y un ajuste que se aleje de ELLA más del 25 % se rechaza.
  const d = marco({ cx: 200, cy: 150, a: 60, b: 60 })
  const conBuena = detectarDisco(d, W, H, { x: 200, y: 150 }, 60, { radioMax: 140 })
  const conVieja = detectarDisco(d, W, H, { x: 200, y: 150 }, 100, { radioMax: 140 })
  linea('con la referencia buena, mide', conBuena.ok && Math.abs(conBuena.r - 60) < 3,
    `r=${conBuena.ok ? conBuena.r.toFixed(1) : '—'}`)
  // Rechaza, y lo hace ANTES de llegar a `radio_incoherente`: con la referencia
  // en 100, los rayos solo miran entre 75 y 125, así que el canto real —que está
  // en 60— queda fuera de la ventana y no se encuentra contorno. Da igual por
  // cuál de las dos puertas salga; lo que este check fija es que la referencia
  // MANDA, y por eso se comprueba que no devuelve un número.
  linea('y contra una referencia lejana, rechaza',
    !conVieja.ok && ['radio_incoherente', 'marcador_perdido'].includes(conVieja.motivo),
    `motivo=${conVieja.motivo ?? '(aceptó ' + conVieja.r?.toFixed(1) + ')'}`)
}

console.log('\n=== EL CENTRO ES EL DE LA CARA, NO EL DE LA PILA ===')
{
  // Lo que pasa en el gimnasio (medido en n07, 5-sep): detrás del disco que se
  // ve hay OTRO igual, medio asomado. La silueta de los dos juntos es una
  // salchicha, y un ajuste libre de circunferencia se pone en medio de la
  // salchicha: 70-90 px a un lado del buje, un 0,75 del radio, y estable ahí
  // durante toda la serie. De ese centro sale la altura, y de la altura la
  // velocidad.
  //
  // El disco de detrás se pinta PRIMERO y el de delante encima, como en la vida.
  // Y el de delante lleva BUJE: el extremo de la barra asoma por su centro,
  // metálico y claro. Es lo único que distingue físicamente a la cara de
  // delante, porque de canto enseñan lo mismo los dos (medido: 64 puntos
  // contra 69 sin buje, y el voto se iba al de detrás).
  const d = marco({ cx: 200, cy: 150, a: 60, b: 60 })
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const detras = Math.hypot(x - 150, y - 150) <= 60
    const delante = Math.hypot(x - 200, y - 150) <= 60
    const buje = Math.hypot(x - 200, y - 150) <= 7
    if ((detras && !delante) || buje) { const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = buje ? 200 : 45 }
  }
  // La predicción viene de donde el ajuste viejo se quedaba: en medio de la pila.
  const r = detectarDisco(d, W, H, { x: 172, y: 150 }, 60, { radioMax: 140 })
  const err = r.ok ? Math.hypot(r.x - 200, r.y - 150) : NaN
  linea('con otro disco detrás, el centro es el de delante', r.ok && err < 3,
    r.ok ? `centro (${r.x.toFixed(1)}, ${r.y.toFixed(1)}) · err ${err.toFixed(1)} px · r=${r.r.toFixed(1)}` : `rechazado: ${r.motivo}`)
}
{
  // Y el enganche de n05: la predicción viene medio radio abajo-izquierda, y en
  // la ventana de búsqueda hay bordes de decorado justo a la distancia que los
  // rayos esperan. El ajuste libre reparte entre el arco real y el decorado y se
  // queda ahí para siempre, porque la predicción del siguiente fotograma sale de
  // él mismo. Se simula con cuatro tacos oscuros a ~65 px de la predicción.
  const d = marco({ cx: 200, cy: 150, a: 60, b: 60 })
  const pred = { x: 165, y: 185 }
  for (const ang of [Math.PI * 0.6, Math.PI * 0.8, Math.PI * 1.0, Math.PI * 1.2]) {
    const tx = pred.x + Math.cos(ang) * 66, ty = pred.y + Math.sin(ang) * 66
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (Math.abs(x - tx) < 9 && Math.abs(y - ty) < 9) { const i = (y * W + x) * 4; d[i] = d[i + 1] = d[i + 2] = 50 }
    }
  }
  const r = detectarDisco(d, W, H, pred, 60, { radioMax: 140 })
  const err = r.ok ? Math.hypot(r.x - 200, r.y - 150) : NaN
  linea('con decorado en la ventana, no se engancha', r.ok && err < 3,
    r.ok ? `centro (${r.x.toFixed(1)}, ${r.y.toFixed(1)}) · err ${err.toFixed(1)} px · cobertura ${(r.cobertura * 100).toFixed(0)}%` : `rechazado: ${r.motivo}`)
}

console.log('\n=== REJA DE PLAUSIBILIDAD ===')
{
  const d = marco({ cx: 340, cy: 150, a: 60, b: 60 })
  const r = detectarDisco(d, W, H, { x: 200, y: 150 }, 60, { radioMax: 140 })
  linea('salto imposible rechazado', !r.ok, `motivo=${r.motivo}`)
}
{
  const a = romPlausible(1.4, 'sentadilla')
  const b = romPlausible(0.55, 'sentadilla')
  linea('ROM de 1,40 m en sentadilla', !a.ok, a.motivo ?? '')
  linea('ROM de 0,55 m en sentadilla', b.ok, 'aceptado')
}

console.log('\n=== LAS DOS REJAS QUE NO MIRAN LA FORMA ===')
{
  // El marco es 400x300, asi que el lado corto son 300 y el tope de
  // FRACCION_MARCO_MAX = 0,75 cae en un radio de 112 px.
  //
  // Estas dos rejas existen porque las de forma NO separan: una pila de discos
  // coaxiales es redonda y se ajusta de maravilla, asi que el peor fallo del
  // banco (+247 % de escala) pasa cobertura, redondez y esquinas con los tres
  // indicadores dentro de lo normal. Ver `banco/calidad-vs-error.mjs`.

  // 1. Justo por debajo del tope: tiene que SEGUIR pasando. Este es el check que
  //    protege contra el falso rojo, que es peor que el falso verde.
  const cabeJusto = identificarEstructura(marco({ cx: 200, cy: 150, a: 110, b: 110 }),
    W, H, { x: 205, y: 145 }, { radioMax: 160 })
  linea('un disco grande PERO plausible pasa',
    cabeJusto.tipo === 'disco',
    `tipo=${cabeJusto.tipo} r=${cabeJusto.ajuste?.r.toFixed(0)} · ocupa ${((cabeJusto.ajuste?.r * 2 / 300) * 100).toFixed(0)} % del lado corto`)

  // 2. Por encima del tope: se come el encuadre, no cabria la serie.
  const seLoCome = identificarEstructura(marco({ cx: 200, cy: 150, a: 125, b: 125 }),
    W, H, { x: 205, y: 145 }, { radioMax: 160 })
  linea('un disco que se come el encuadre, fuera',
    seLoCome.tipo !== 'disco' && /encuadre/.test(seLoCome.motivo ?? ''),
    `tipo=${seLoCome.tipo} · ${seLoCome.motivo ?? ''}`)

  // 3. Un ajuste que se sale de la imagen. Es la comprobacion mas tonta posible
  //    y por eso vale: no depende del contraste ni de la luz.
  //
  //    Ojo con el caso que se elige aqui. El primer intento se salia tanto que
  //    el detector ni llegaba a ajustar —devolvia «no se ve un contorno cerrado»
  //    y el check pasaba por el motivo equivocado, que es un falso verde—. Este
  //    ajusta de verdad (r=120 centrado en y=200, o sea 80..320 en un alto de
  //    300) y es la reja la que lo para. Se comprueba el MOTIVO, no solo que no
  //    sea un disco.
  const noCabe = identificarEstructura(marco({ cx: 200, cy: 200, a: 120, b: 120 }),
    W, H, { x: 205, y: 195 }, { radioMax: 200 })
  linea('un ajuste que se sale de la imagen, fuera',
    noCabe.tipo !== 'disco' && /no cabe en el encuadre/.test(noCabe.motivo ?? ''),
    `tipo=${noCabe.tipo} · ${noCabe.motivo ?? ''} · r=${noCabe.ajuste?.r.toFixed(0)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// La escala de la barra: el caso que trajo el corpus de gimnasio
// ─────────────────────────────────────────────────────────────────────────────
//
// Los números no son inventados: son los dos discos del vídeo 004 del corpus
// —peso muerto, 1080×1920 a 60 fps, móvil en el suelo a un metro— medidos a
// mano sobre el fotograma del fondo del recorrido. Ver CORPUS.md §2.
console.log('\n=== ESCALA DE LA BARRA: dos discos, no uno ===')
{
  const CERCA = { x: 109, semiMayor: 98.5, semiMenor: 84 }
  const LEJOS = { x: 424, semiMayor: 62.5, semiMenor: 56 }
  const X_MANO = 305, X_CADERA = 255, X_RODILLA = 295

  const e = escalaDeLaBarra(CERCA, LEJOS)
  linea('salto entre los dos extremos', Math.abs(e.saltoRelativo - 0.58) < 0.03,
    `${(e.saltoRelativo * 100).toFixed(0)} % · exigeInterpolar=${e.exigeInterpolar}`)

  linea('la cámara NO estaba de lado', Math.abs(e.fiGrados - 29) < 3,
    `${e.fiGrados.toFixed(0)}° fuera del eje de la barra`)

  // La comprobación que importa: la escala en el plano del atleta queda ENTRE
  // las de los dos extremos, no en ninguna de ellas.
  const enLaMano = e.mmPorPxEn(X_MANO)
  const soloCerca = escalaDeLaBarra(CERCA).mmPorPxEn(X_MANO)
  const soloLejos = escalaDeLaBarra(LEJOS).mmPorPxEn(X_MANO)
  linea('la escala del atleta está en medio', enLaMano > soloCerca && enLaMano < soloLejos,
    `${soloCerca.toFixed(2)} < ${enLaMano.toFixed(2)} < ${soloLejos.toFixed(2)} mm/px`)

  // Y lo que cuesta equivocarse: el mismo brazo, medido con un disco o con dos.
  const bien = brazoEnMm(e, X_CADERA, X_MANO)
  const conUnDisco = brazoEnMm(escalaDeLaBarra(CERCA), X_CADERA, X_MANO)
  const error = Math.abs(conUnDisco / bien - 1)
  linea('brazo de cadera con los dos discos', Math.abs(bien - 169) < 5, `${bien.toFixed(0)} mm`)
  linea('y con uno solo, cuánto se pierde', error > 0.2,
    `${conUnDisco.toFixed(0)} mm · ${(error * 100).toFixed(0)} % corto`)

  // La rodilla del peso muerto, que es la regla de la doctrina hecha número.
  const rodilla = brazoEnMm(e, X_RODILLA, X_MANO)
  linea('la rodilla neutralizada no reclama', rodilla < bien / 4,
    `rodilla ${rodilla.toFixed(0)} mm contra cadera ${bien.toFixed(0)} mm`)

  // La interpolacion es del INVERSO, y esto lo fija con numeros redondos.
  //
  // Dos discos a 2 y 4 mm/px separados 100 px. En el punto medio, trazar una
  // recta entre las dos escalas da 3,00. Pero mm/px es proporcional a la
  // profundidad Z, y en una camara pinhole lo afin en x es 1/Z: el valor exacto
  // es 1/((1/2 + 1/4)/2) = 2,667. Un 12,5 % de diferencia, y siempre por arriba.
  //
  // Este check existe porque la version anterior devolvia 3,00 y pasaba todo lo
  // demas: el sesgo se colaba entero por la unica puerta que no habia.
  {
    const medio = escalaDeLaBarra(
      { x: 0, semiMayor: 112.5, semiMenor: 112.5 },
      { x: 100, semiMayor: 56.25, semiMenor: 56.25 },
    ).mmPorPxEn(50)
    linea('en el medio interpola el inverso, no la escala', Math.abs(medio - 8 / 3) < 0.01,
      `${medio.toFixed(3)} mm/px (la recta daria 3.000)`)
  }

  // Un disco solo no sabe que le falta el otro, y tiene que decirlo.
  const solo = escalaDeLaBarra(CERCA)
  linea('un disco solo se declara no fiable', solo.fiable === false && !!solo.motivo, solo.motivo)
}
