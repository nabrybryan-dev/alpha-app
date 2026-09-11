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
  // Se detecta hasta el 60 % tapado, pero solo se considera fiable con el contorno casi entero.
  const esperado = pct <= 25 ? (r.ok && r.fiable && errorCentro < 1) : (r.ok ? !r.fiable : true)
  linea(`${pct}% tapado`, esperado,
    r.ok ? `centro err ${errorCentro.toFixed(2)} px · cobertura ${(r.cobertura * 100).toFixed(0)}% · fiable=${r.fiable}`
         : `rechazado: ${r.motivo} (cobertura ${(r.cobertura * 100).toFixed(0)}%)`)
}

console.log('\n=== SIN DERIVA: 1.500 fotogramas de una serie ===')
{
  // Sube y baja 8 veces. Cada fotograma se detecta desde cero.
  let pred = { x: 200, y: 150 }, peor = 0, perdidos = 0
  for (let f = 0; f < 1500; f++) {
    const cy = 150 + 55 * Math.sin((f / 1500) * 8 * 2 * Math.PI)
    const d = marco({ cx: 200, cy, a: 60, b: 60 })
    const r = detectarDisco(d, W, H, pred, 60, { radioMax: 140 })
    if (!r.ok) { perdidos++; continue }
    peor = Math.max(peor, Math.hypot(r.x - 200, r.y - cy))
    pred = { x: r.x, y: r.y }
  }
  linea('error máximo en 1.500 fotogramas', peor < 2 && perdidos === 0,
    `${peor.toFixed(2)} px · ${perdidos} fotogramas perdidos`)
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
  linea('brazo de cadera con los dos discos', Math.abs(bien - 177) < 8, `${bien.toFixed(0)} mm`)
  linea('y con uno solo, cuánto se pierde', error > 0.2,
    `${conUnDisco.toFixed(0)} mm · ${(error * 100).toFixed(0)} % corto`)

  // La rodilla del peso muerto, que es la regla de la doctrina hecha número.
  const rodilla = brazoEnMm(e, X_RODILLA, X_MANO)
  linea('la rodilla neutralizada no reclama', rodilla < bien / 4,
    `rodilla ${rodilla.toFixed(0)} mm contra cadera ${bien.toFixed(0)} mm`)

  // Un disco solo no sabe que le falta el otro, y tiene que decirlo.
  const solo = escalaDeLaBarra(CERCA)
  linea('un disco solo se declara no fiable', solo.fiable === false && !!solo.motivo, solo.motivo)
}
