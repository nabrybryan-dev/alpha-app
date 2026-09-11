/**
 * Pruebas del núcleo de velocidad — se corren sin cámara y sin nadie.
 *
 *   node pruebas-velocidad.mjs
 *
 * Comprueban la ARITMÉTICA sobre trayectorias de velocidad conocida y
 * fotogramas deliberadamente no equiespaciados. No comprueban la medición: eso
 * es la fase 2. Correr SIEMPRE tras tocar `analisis.js`.
 *
 * Umbrales: los mismos criterios de muerte de la rama —≤5 puntos de %PV y
 * ≤0,05 m/s—, para que una prueba en verde signifique lo mismo aquí que en el
 * gimnasio.
 */

import { pruebaSintetica, pruebaDeGravedad, referenciaPlana, valoresSingulares2x2, analizarSerie, calificar, vertice, COBERTURA_CALIDAD, gLocal, G_ESTANDAR } from '../analisis.js'

const TOPE_PV = 5        // puntos
const TOPE_V = 0.05      // m/s

let fallos = 0
const linea = (ok, etq, txt) => {
  if (!ok) fallos++
  console.log(`${ok ? 'VERDE' : 'ROJO '} · ${etq.padEnd(30)} ${txt}`)
}

console.log('=== NÚCLEO DE VELOCIDAD ===')
for (const caso of [
  { nReps: 6, vInicial: 0.6, pvObjetivo: 30, fps: 60 },
  { nReps: 8, vInicial: 0.45, pvObjetivo: 20, fps: 30 },
  { nReps: 4, vInicial: 0.85, pvObjetivo: 40, fps: 60 },
  { nReps: 10, vInicial: 0.7, pvObjetivo: 35, fps: 60 },
  // Serie corta y rápida: el caso donde el sesgo del borde de la concéntrica
  // más se notaba antes de medir los bordes sobre la posición.
  { nReps: 3, vInicial: 1.0, pvObjetivo: 15, fps: 60 },
]) {
  const r = pruebaSintetica(caso)
  if (!r.obtenido) {
    linea(false, `${caso.nReps} reps @ ${caso.fps} fps`, 'NO SEGMENTÓ')
    continue
  }
  const ok =
    Math.abs(r.error.pvPuntos) <= TOPE_PV &&
    Math.abs(r.error.vPrimera) <= TOPE_V &&
    Math.abs(r.error.vUltima) <= TOPE_V &&
    r.error.reps === 0
  linea(ok, `${caso.nReps} reps @ ${caso.fps} fps`,
    `%PV ${caso.pvObjetivo} → ${r.obtenido.pvPct.toFixed(1)} ` +
    `(${r.error.pvPuntos >= 0 ? '+' : ''}${r.error.pvPuntos.toFixed(1)} pts) · ` +
    `v₁ ${r.error.vPrimera >= 0 ? '+' : ''}${r.error.vPrimera.toFixed(3)} · ` +
    `v_últ ${r.error.vUltima >= 0 ? '+' : ''}${r.error.vUltima.toFixed(3)} m/s · ` +
    `reps ${r.obtenido.nReps}/${caso.nReps}`)
}

console.log('\n=== GRAVEDAD (caída perfecta) ===')
for (const fps of [30, 60, 120]) {
  const sepMm = 400, sepPx = 160, mpp = sepMm / 1000 / sepPx
  const muestras = []
  const nFrames = Math.round(0.55 * fps)   // 1,5 m de caída
  for (let k = 0; k <= nFrames; k++) {
    const t = k / fps
    muestras.push({ t, x: 320, y: 50 + (0.5 * 9.81 * t * t) / mpp, sepPx, anguloGrados: 0 })
  }
  const g = pruebaDeGravedad(muestras, sepMm)
  linea(g.ok && Math.abs(g.errorPct) <= 2, `caída a ${fps} fps`,
    g.ok ? `${g.aceleracion.toFixed(3)} m/s² (${g.errorPct >= 0 ? '+' : ''}${g.errorPct.toFixed(2)} %) · ${g.nMuestras} muestras`
         : g.motivo)
}


console.log('\n=== GRAVEDAD (caída REAL: grabar → soltar → parar) ===')
// La caída perfecta de arriba arranca cayendo. Ninguna grabación real lo hace:
// el protocolo es «grabar → soltar → parar», así que siempre hay titubeo antes
// y rebote después. Medido sobre IMG_6436, meter eso dentro de la parábola movía
// el veredicto entre VERDE y ROJO según cuánto tardara la persona en soltar.
function caidaConTitubeoYRebote({ fps = 60, reposo = 0, rebote = 0, sepPx = 160 }) {
  const sepMm = 400, mpp = sepMm / 1000 / sepPx
  const muestras = [], yTop = 50
  const nCaida = Math.round(0.55 * fps)
  for (let k = 0; k < reposo; k++) {
    muestras.push({ t: k / fps, x: 320, y: yTop + Math.sin(k * 1.7) * 0.4, sepPx, anguloGrados: 0 })
  }
  for (let k = 0; k <= nCaida; k++) {
    const t = k / fps
    muestras.push({ t: (reposo + k) / fps, x: 320, y: yTop + (0.5 * 9.81 * t * t) / mpp, sepPx, anguloGrados: 0 })
  }
  const yFinal = yTop + (0.5 * 9.81 * (nCaida / fps) ** 2) / mpp
  for (let k = 1; k <= rebote; k++) {
    muestras.push({ t: (reposo + nCaida + k) / fps, x: 320, y: yFinal - Math.max(0, 40 - k * 12), sepPx, anguloGrados: 0 })
  }
  return { muestras, sepMm }
}
for (const caso of [
  { nombre: 'sin titubeo ni rebote', reposo: 0, rebote: 0 },
  { nombre: '2 fotogramas quieto antes', reposo: 2, rebote: 0 },
  { nombre: '30 fotogramas quieto antes', reposo: 30, rebote: 0 },
  { nombre: '90 fotogramas quieto antes (1,5 s)', reposo: 90, rebote: 0 },
  { nombre: 'rebote de 5 fotogramas después', reposo: 0, rebote: 5 },
  { nombre: 'titubeo Y rebote juntos', reposo: 45, rebote: 8 },
]) {
  const { muestras, sepMm } = caidaConTitubeoYRebote(caso)
  const g = pruebaDeGravedad(muestras, sepMm)
  linea(g.ok && Math.abs(g.errorPct) <= 2, caso.nombre,
    g.ok ? `${g.aceleracion.toFixed(3)} m/s² (${g.errorPct >= 0 ? '+' : ''}${g.errorPct.toFixed(2)} %) · ${g.nMuestras} muestras · tira ${g.descartadasInicio}/${g.descartadasFinal}`
         : g.motivo)
}

console.log('\n=== GRAVEDAD: la escala se mide en la caída, no en el agarre ===')
{
  const { muestras, sepMm } = caidaConTitubeoYRebote({ reposo: 40, rebote: 4 })
  // la mano tapa media referencia mientras la sostiene: 45 px en vez de 160
  const conManoEncima = muestras.map((m, i) => (i < 40 ? { ...m, sepPx: 45 } : m))
  const g = pruebaDeGravedad(conManoEncima, sepMm)
  linea(g.ok && Math.abs(g.errorPct) <= 2, 'referencia tapada durante el reposo',
    g.ok ? `${g.aceleracion.toFixed(3)} m/s² (${g.errorPct >= 0 ? '+' : ''}${g.errorPct.toFixed(2)} %) · usa sepPx ${g.sepPx.toFixed(0)} de los 160 buenos`
         : g.motivo)
}

console.log('\n=== GRAVEDAD: una toma que no determina nada NO puede salir verde ===')
{
  // Dos parábolas distintas pegadas. El promedio da +0,87 % — DENTRO del ±2 % —
  // así que sin el aviso de estabilidad esto saldría VERDE y nadie miraría más.
  const fps = 60, sepMm = 400, sepPx = 160, mpp = sepMm / 1000 / sepPx
  const muestras = []; let y = 50, v = 0
  for (let k = 0; k <= 33; k++) {
    const a = k < 17 ? 9.81 * 0.80 : 9.81 * 1.10
    muestras.push({ t: k / fps, x: 320, y, sepPx, anguloGrados: 0 })
    v += a / fps; y += (v / fps) / mpp
  }
  const g = pruebaDeGravedad(muestras, sepMm)
  linea(g.ok && g.veredicto !== 'VERDE', 'dos aceleraciones pegadas',
    g.ok ? `${g.aceleracion.toFixed(3)} m/s² (${g.errorPct >= 0 ? '+' : ''}${g.errorPct.toFixed(2)} %) · ${g.veredicto} · mitades difieren ${(g.estabilidad * 100).toFixed(0)} %`
         : g.motivo)
}


console.log('\n=== REFERENCIA INCLINADA: el fallo del intento 2, reproducido ===')
// Una diana plana de 4 marcas pegada al objeto que cae, con la cara girada un
// angulo theta respecto a la camara. Es exactamente lo que paso en IMG_6436:
// ~29 grados de inclinacion metieron un +14 % en la gravedad.
function caidaConDianaInclinada({ thetaGrados, fiGrados = 0, fps = 60, escalaPxM = 1555,
                                  anchoMm = 200, altoMm = 150, nFrames = 24 }) {
  const th = (thetaGrados * Math.PI) / 180, fi = (fiGrados * Math.PI) / 180
  const cT = Math.cos(th), cF = Math.cos(fi), sF = Math.sin(fi)
  // bloque 2x2 de Roty(theta)·Rotz(fi), por el que se proyecta el plano
  const M = [[escalaPxM * cT * cF, -escalaPxM * cT * sF],
             [escalaPxM * sF,       escalaPxM * cF]]
  const W = anchoMm / 2000, H = altoMm / 2000
  const esquinas = [[-W, -H], [+W, -H], [+W, +H], [-W, +H]]
  const muestras = [], dosMarcadores = []
  for (let k = 0; k <= nFrames; k++) {
    const t = k / fps
    const yc = 200 + 0.5 * 9.81 * t * t * escalaPxM
    // la primera marca es la grande: rompe la simetria del rectangulo
    const centros = esquinas.map(([u, v], idx) => ({
      x: 900 + M[0][0] * u + M[0][1] * v,
      y: yc + M[1][0] * u + M[1][1] * v,
      n: idx === 0 ? 420 : 200,
    }))
    const ref = referenciaPlana(centros, anchoMm, altoMm)
    muestras.push({ t, x: ref.x, y: ref.y, escalaPxM: ref.escalaPxM,
                    cosInclinacion: ref.cosInclinacion, sepPx: NaN })
    // lo que habria visto la version de dos marcadores: el lado de arriba
    const sep = Math.hypot(centros[1].x - centros[0].x, centros[1].y - centros[0].y)
    dosMarcadores.push({ t, x: ref.x, y: ref.y, sepPx: sep })
  }
  return { muestras, dosMarcadores, anchoMm }
}
for (const caso of [
  { thetaGrados: 0,  fiGrados: 0 },
  { thetaGrados: 15, fiGrados: 0 },
  { thetaGrados: 29, fiGrados: 0 },
  { thetaGrados: 29, fiGrados: 24 },
  { thetaGrados: 20, fiGrados: -40 },
]) {
  const { muestras, dosMarcadores, anchoMm } = caidaConDianaInclinada(caso)
  const g4 = pruebaDeGravedad(muestras, anchoMm)
  const g2 = pruebaDeGravedad(dosMarcadores, anchoMm)
  const etq = `theta ${String(caso.thetaGrados).padStart(2)}° · giro ${String(caso.fiGrados).padStart(3)}°`
  linea(g4.ok && Math.abs(g4.errorPct) <= 0.5, `4 marcas · ${etq}`,
    g4.ok ? `${g4.aceleracion.toFixed(3)} m/s² (${g4.errorPct >= 0 ? '+' : ''}${g4.errorPct.toFixed(2)} %)`
          + ` · inclinación leída ${g4.inclinacionGrados.toFixed(1)}°` : g4.motivo)
  // el contraste: con dos marcadores el mismo dato falla, y ese fallo es el punto
  const esperado = caso.thetaGrados === 0
  linea(g2.ok && (Math.abs(g2.errorPct) <= 0.5) === esperado, `  └ 2 marcadores, mismo dato`,
    g2.ok ? `${g2.aceleracion.toFixed(3)} m/s² (${g2.errorPct >= 0 ? '+' : ''}${g2.errorPct.toFixed(2)} %)`
          + (esperado ? ' · sin inclinación no hay error' : ' · ciego a la inclinación') : g2.motivo)
}

console.log('\n=== La escala es sigma_max, y eso es lo que la hace inmune ===')
{
  const M = [[1200, 0], [0, 1555]]          // achatada en horizontal
  const vs = valoresSingulares2x2(M)
  linea(Math.abs(vs.mayor - 1555) < 1e-9 && Math.abs(vs.menor - 1200) < 1e-9,
    'valores singulares de una matriz achatada', `mayor ${vs.mayor.toFixed(1)} · menor ${vs.menor.toFixed(1)}`)
  const cos = vs.menor / vs.mayor
  linea(Math.abs(cos - 1200 / 1555) < 1e-9, 'el cociente es el coseno de la inclinación',
    `cos = ${cos.toFixed(4)} → ${(Math.acos(cos) * 180 / Math.PI).toFixed(1)}°`)
}


console.log('\n=== CON RUIDO EN LOS CENTROS: ¿aguanta lo del gimnasio? ===')
{
  // ruido pseudoaleatorio determinista, para que la prueba no parpadee
  let semilla = 12345
  const ruido = (amp) => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
    return ((semilla / 0x7fffffff) - 0.5) * 2 * amp
  }
  for (const px of [0.5, 1.0, 2.0]) {
    semilla = 12345
    const th = (29 * Math.PI) / 180, s = 1555
    const M = [[s * Math.cos(th), 0], [0, s]]
    const W = 0.1, H = 0.075
    const esquinas = [[-W, -H], [W, -H], [W, H], [-W, H]]
    const muestras = []
    for (let k = 0; k <= 24; k++) {
      const t = k / 60
      const yc = 200 + 0.5 * 9.81 * t * t * s
      const centros = esquinas.map(([u, v], idx) => ({
        x: 900 + M[0][0] * u + M[0][1] * v + ruido(px),
        y: yc + M[1][0] * u + M[1][1] * v + ruido(px),
        n: idx === 0 ? 420 : 200,
      }))
      const ref = referenciaPlana(centros, 200, 150)
      muestras.push({ t, x: ref.x, y: ref.y, escalaPxM: ref.escalaPxM,
                      cosInclinacion: ref.cosInclinacion, sepPx: NaN })
    }
    const g = pruebaDeGravedad(muestras, 200)
    linea(g.ok && Math.abs(g.errorPct) <= 2, `±${px.toFixed(1)} px de ruido en cada centro`,
      g.ok ? `${g.aceleracion.toFixed(3)} m/s² (${g.errorPct >= 0 ? '+' : ''}${g.errorPct.toFixed(2)} %)`
           + ` · inclinación ${g.inclinacionGrados.toFixed(1)}° (real 29,0°)` : g.motivo)
  }
}

console.log('\n=== Marcas iguales: el sistema DEBE avisar de que es ambiguo ===')
{
  const s = 1555, W = 0.1, H = 0.075
  const esq = [[-W, -H], [W, -H], [W, H], [-W, H]]
  const centros = esq.map(([u, v]) => ({ x: 900 + s * u, y: 500 + s * v }))  // sin n: sin ancla
  const ref = referenciaPlana(centros, 200, 150)
  linea(ref && ref.ambiguo === true && ref.conAncla === false,
    'cuatro marcas idénticas en un rectángulo',
    ref ? `ambiguo=${ref.ambiguo} · conAncla=${ref.conAncla} · escala leída ${ref.escalaPxM.toFixed(0)} px/m` : 'sin resultado')
}



console.log('\n=== %PV CONTRA m/s: qué sobrevive a una escala equivocada ===')
// Es la pregunta que decide qué se puede meter YA en la app. El %PV es un
// cociente entre dos velocidades de la MISMA serie, así que la escala se
// cancela; los m/s no. Aquí se mide sobre analizarSerie, no se argumenta.
{
  const fps = 60, sepPx = 160, sepMm = 400
  const mpp = sepMm / 1000 / sepPx
  const muestras = []
  let t = 0, y = 0
  // seis repeticiones con la velocidad cayendo un 30 % de la primera a la última
  for (let rep = 0; rep < 6; rep++) {
    const vRep = 0.60 * (1 - 0.30 * (rep / 5))
    const pasos = Math.round(0.5 / vRep * fps)
    for (let k = 0; k <= pasos; k++) {           // concéntrica: sube
      muestras.push({ t, x: 320, y: y - (0.5 * k / pasos) / mpp, sepPx, anguloGrados: 0 })
      t += 1 / fps
    }
    y -= 0.5 / mpp
    for (let k = 0; k <= pasos; k++) {           // excéntrica: baja
      muestras.push({ t, x: 320, y: y + (0.5 * k / pasos) / mpp, sepPx, anguloGrados: 0 })
      t += 1 / fps
    }
    y += 0.5 / mpp
  }
  const factor = 1 / Math.cos((29 * Math.PI) / 180)   // el escorzo del intento 2
  const bien = analizarSerie(muestras, { sepMm, sentido: 'subir' })
  const mal = analizarSerie(muestras, { sepMm: sepMm / factor, sentido: 'subir' })
  if (!bien.ok || !mal.ok) {
    linea(false, 'escala buena vs escala torcida', `${bien.motivo || ''} ${mal.motivo || ''}`)
  } else {
    const dPv = Math.abs(mal.pvPct - bien.pvPct)
    const dV = Math.abs(mal.vPrimera - bien.vPrimera)
    linea(dPv < 0.01, '%PV con la escala un 14,3 % equivocada',
      `${bien.pvPct.toFixed(2)} → ${mal.pvPct.toFixed(2)} puntos · diferencia ${dPv.toExponential(1)} · umbral 5 puntos`)
    linea(dV > TOPE_V, 'v₁ con la MISMA escala equivocada',
      `${bien.vPrimera.toFixed(3)} → ${mal.vPrimera.toFixed(3)} m/s · error ${((mal.vPrimera / bien.vPrimera - 1) * 100).toFixed(1)} % · umbral 0,050 m/s`)
    linea(bien.reps.length === mal.reps.length && bien.reps.length === 6,
      'y las repeticiones detectadas no cambian', `${bien.reps.length} en los dos casos`)
  }
}


console.log('\n=== GRAVEDAD LOCAL: 9,81 no es una constante ===')
{
  const casos = [['Bogotá', 4.71, 2640, 9.7755], ['Medellín', 6.24, 1495, 9.7780],
                 ['Barranquilla', 10.96, 18, 9.7822], ['polo (lat 90, nivel del mar)', 90, 0, 9.8322]]
  for (const [n, la, al, esp] of casos) {
    const g = gLocal(la, al)
    linea(Math.abs(g - esp) < 0.001, `g en ${n}`,
      `${g.toFixed(4)} m/s² · ${((g - 9.81) / 9.81 * 100).toFixed(3)} % respecto a 9,81`)
  }
  linea(Math.abs(gLocal(45, 0) - G_ESTANDAR) < 0.0006, 'a 45° y nivel del mar sale la g estándar',
    `${gLocal(45, 0).toFixed(5)} vs ${G_ESTANDAR}`)
  // el sesgo entra directo en el veredicto
  const fps = 60, sepMm = 400, sepPx = 160, mpp = sepMm / 1000 / sepPx
  const gReal = gLocal(4.71, 2640)
  const ms = []
  for (let k = 0; k <= 33; k++) {
    const t = k / fps
    ms.push({ t, x: 320, y: 50 + (0.5 * gReal * t * t) / mpp, sepPx, anguloGrados: 0 })
  }
  const con = pruebaDeGravedad(ms, sepMm, { gRef: gReal })
  const sin = pruebaDeGravedad(ms, sepMm)
  linea(Math.abs(con.errorPct) < 0.01 && Math.abs(sin.errorPct) > 0.3,
    'una caída PERFECTA en Bogotá, medida contra cada referencia',
    `contra la g local ${con.errorPct.toFixed(3)} % · contra 9,80665 ${sin.errorPct.toFixed(3)} %`)
}

// ─────────────────────────────────────────────────────────────────────────────
// El ajuste del disco: un contorno a medias da una escala plausible y falsa
// ─────────────────────────────────────────────────────────────────────────────
//
// El corpus de 168 vídeos de gimnasio (CORPUS.md §2.1) lo enseñó en el mejor
// fotograma que había: `medirDisco` ajustó una circunferencia a la PILA de
// discos, devolvió un semieje un 50 % grande, y bajó su propia `cobertura` a
// 0,70 sin que eso llegara a ninguna parte. El motivo `contorno_parcial` estaba
// en el contrato desde agosto y `calificar` no lo emitía nunca.
{
  console.log('\n=== AJUSTE DEL DISCO: cobertura a medias, escala falsa ===')
  const base = {
    fpsReal: 60, deteccion: 1, anguloMediana: 2, nReps: 5,
    hayEscala: true, inclinacionGrados: 3, conDiana: true,
  }
  const sinDisco = calificar(base)
  linea(sinDisco.nivel === 'buena' && sinDisco.motivos.length === 0,
    'sin disco no aplica y no estorba', `${sinDisco.nivel}`)

  const buena = calificar({ ...base, coberturaDisco: 0.97 })
  linea(buena.nivel === 'buena', 'contorno entero', `${buena.nivel}`)

  const parcial = calificar({ ...base, coberturaDisco: 0.7 })
  linea(parcial.motivos.includes('contorno_parcial') && parcial.nivel === 'dudosa',
    'el caso real del corpus: cobertura 0,70',
    `${parcial.nivel} · ${parcial.motivos.join(', ')}`)

  const justo = calificar({ ...base, coberturaDisco: COBERTURA_CALIDAD })
  linea(justo.nivel === 'buena', 'justo en el umbral no dispara', `${justo.nivel}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// La velocidad de PICO: lo que el muestreo se lleva
// ─────────────────────────────────────────────────────────────────────────────
//
// La literatura mide que los aparatos ópticos subestiman la velocidad de pico
// (ESTADO-DEL-ARTE.md §3). No es defecto de una marca: es aritmética. El pico
// casi nunca cae encima de un fotograma, así que el máximo de las muestras se
// queda por debajo del real — y cuantos menos fps, más se queda.
{
  console.log('\n=== VELOCIDAD DE PICO: cuánto se lleva el muestreo ===')
  const A = 1.0, T = 0.8            // media onda de seno: pico A exacto en t = T/2

  // Con desfase, para que el máximo NUNCA caiga justo encima del pico: es lo que
  // pasa siempre en la práctica y lo que hace que el crudo salga corto.
  const muestrear = (fps, desfase) => {
    const v = []
    for (let k = 0; ; k++) {
      const t = desfase + k / fps
      if (t > T) break
      v.push(A * Math.sin((Math.PI * t) / T))
    }
    return v
  }
  // El PEOR caso sobre veinte desfases, no uno afortunado: el error depende de
  // dónde caiga la rejilla, y en el gimnasio la rejilla cae donde quiere.
  const peorDe = (fps, medir) => {
    let peor = 0
    for (let d = 0; d < 20; d++) {
      const v = muestrear(fps, (d / 20) * (1 / fps))
      let i = 0
      for (let k = 0; k < v.length; k++) if (v[k] > v[i]) i = k
      peor = Math.max(peor, medir(v, i))
    }
    return peor
  }
  const crudo = (fps) => peorDe(fps, (v, i) => (A - v[i]) / A)
  const conVertice = (fps) => peorDe(fps, (v, i) => Math.abs(A - vertice(v, i, 0, v.length - 1)) / A)

  for (const fps of [30, 60, 120]) {
    linea(conVertice(fps) < crudo(fps), `a ${fps} fps el vértice gana al máximo crudo`,
      `crudo se queda ${(100 * crudo(fps)).toFixed(2)} % corto · vértice ${(100 * conVertice(fps)).toFixed(2)} %`)
  }

  // Y la razón aritmética de la puerta de fps, ahora medida aquí y no supuesta.
  linea(crudo(30) > 3 * crudo(60), 'a 30 fps se pierde mucho más pico que a 60',
    `${(100 * crudo(30)).toFixed(2)} % contra ${(100 * crudo(60)).toFixed(2)} %`)

  // Y no debe inventar: si los tres puntos no dibujan un pico, se queda con lo
  // medido en vez de extrapolar por encima de cualquier muestra.
  linea(vertice([0, 1, 2, 3, 4], 4, 0, 4) === 4, 'en el borde no extrapola', 'devuelve el máximo medido')
  linea(vertice([1, 1, 1], 1, 0, 2) === 1, 'sin curvatura no inventa vértice', 'devuelve el máximo medido')
}

// ─────────────────────────────────────────────────────────────────────────────
// VELOCIDAD MEDIA PROPULSIVA: la que usan las tablas
// ─────────────────────────────────────────────────────────────────────────────
//
// motor-decision/03-vbt §«VMP vs VM» dice que las tablas de %1RM están en
// velocidad media PROPULSIVA, y que un aparato que solo da velocidad media lee
// por debajo en cargas ligeras. Aquí se comprueba que la implementación
// reproduce ese comportamiento, porque si no, nuestro número no es comparable
// con la tabla que el entrenador tiene delante.
{
  console.log('\n=== VELOCIDAD MEDIA PROPULSIVA ===')

  /**
   * Una repetición con dos tramos de aceleración constante: empuja y frena.
   * `frenado` es la magnitud del segundo tramo, en m/s². Por encima de g hay
   * fase de frenado de verdad; por debajo, la carga cae sola y no la hay.
   */
  const repeticion = ({ frenado, fps = 120, sepMm = 400, sepPx = 160 }) => {
    const mpp = sepMm / 1000 / sepPx
    // Tres tramos, que es la forma de una barra de verdad: tirón, meseta y
    // frenada. La primera versión de esta prueba usaba un triángulo —acelerar y
    // decelerar sin más— y con esa forma las dos fases tienen la MISMA media por
    // construcción, así que la prueba no podía distinguirlas. Con meseta, la
    // fase propulsiva promedia por encima de la de frenado, que es lo que pasa
    // en el gimnasio.
    const tTiron = 0.18, tMeseta = 0.30, empuje = 18
    const vPico = empuje * tTiron
    const tFrena = vPico / frenado
    const muestras = []
    let y = 900, v = 0
    const paso = 1 / fps
    for (let t = 0; t <= tTiron + tMeseta + tFrena + 0.25; t += paso) {
      const a = t < tTiron ? empuje : t < tTiron + tMeseta ? 0 : (v > 0 ? -frenado : 0)
      v = Math.max(0, v + a * paso)
      y -= (v * paso) / mpp                       // sube: y decrece
      muestras.push({ t, x: 320, y, sepPx, anguloGrados: 0 })
    }
    // Tres repeticiones seguidas, que es lo que la segmentación necesita.
    const todas = []
    for (let r = 0; r < 3; r++) {
      const dt = r * (muestras[muestras.length - 1].t + 0.4)
      const dy = r * 0.0001
      for (const m of muestras) todas.push({ ...m, t: m.t + dt, y: m.y + 260 * r + dy })
    }
    return { muestras: todas, sepMm }
  }

  const analiza = (frenado) => {
    const { muestras, sepMm } = repeticion({ frenado })
    const r = analizarSerie(muestras, { sepMm, sentido: 'subir' })
    return r.ok ? r.reps[0] : undefined
  }

  // Carga ligera: el sujeto tira hacia abajo al final y frena más que g. Se
  // compara contra `vMediaCompleta`, que es la media del libro; `vMedia` está
  // recortada al 5–95 % del recorrido y ya se deja fuera parte del frenado.
  const ligera = analiza(30)
  linea(ligera && ligera.vMediaPropulsiva > ligera.vMediaCompleta * 1.05,
    'carga ligera: la propulsiva es MAYOR que la media',
    ligera ? `VMP ${ligera.vMediaPropulsiva.toFixed(3)} vs VM ${ligera.vMediaCompleta.toFixed(3)} m/s · ` +
      `frenado ${ligera.frenadoPct.toFixed(0)} % de la concéntrica` : 'no segmentó')

  // Y el aviso que este banco destapó: nuestra `vMedia` no es ninguna de las
  // dos. Queda escrito en una prueba para que nadie la compare con una tabla.
  linea(ligera && ligera.vMedia > ligera.vMediaCompleta,
    'y nuestra vMedia no es la del libro: va recortada',
    ligera ? `vMedia ${ligera.vMedia.toFixed(3)} > completa ${ligera.vMediaCompleta.toFixed(3)} m/s` : '')

  // Carga pesada: ya no hay fase de frenado, así que son la misma cosa. Es lo
  // que la doctrina dice que pasa por encima del 80-85 % del 1RM.
  const pesada = analiza(6)
  linea(pesada && Math.abs(pesada.vMediaPropulsiva - pesada.vMediaCompleta) < 0.02,
    'carga pesada: sin frenado, VMP y VM coinciden',
    pesada ? `VMP ${pesada.vMediaPropulsiva.toFixed(3)} vs VM ${pesada.vMediaCompleta.toFixed(3)} m/s · ` +
      `frenado ${pesada.frenadoPct.toFixed(0)} %` : 'no segmentó')

  // La fase de frenado dura más cuanto más SUAVE es la desaceleración, que es
  // lo que pasa al bajar la carga. La primera versión de esta prueba equiparaba
  // «más ligera» con «frena más fuerte», que es justo al revés: una carga ligera
  // frena durante más tiempo, no con más aceleración.
  const f = [30, 15, 10].map((x) => analiza(x)?.frenadoPct ?? NaN)
  linea(f[0] <= f[1] && f[1] <= f[2], 'frenado más largo cuanto más suave la desaceleración',
    f.map((x) => `${x.toFixed(0)} %`).join(' → '))

  // Sin escala no hay metros, y sin metros el umbral de −g no significa nada.
  // Devolver ahí una VMP sería inventarse el número.
  const { muestras } = repeticion({ frenado: 30 })
  const sinEscala = analizarSerie(muestras, { sentido: 'subir' })
  linea(sinEscala.ok && sinEscala.reps[0].vMediaPropulsiva === undefined,
    'sin escala no se inventa una propulsiva', `unidad ${sinEscala.unidad}`)
}

// == INDICE DE ESFUERZO (Rodriguez-Rosell 2018) ==============================
// El campo `ie` llevaba en contrato-datos.md desde que se escribio y NADIE lo
// calculaba. Estas pruebas fijan lo unico que puede romperse: que sea el
// producto, que use la VMP y no la VM, y que no exista sin escala.
console.log('')
console.log('=== INDICE DE ESFUERZO ===')
{
  const fps = 60, sepPx = 160, sepMm = 400
  const mpp = sepMm / 1000 / sepPx
  const muestras = []
  let t = 0, y = 0
  for (let rep = 0; rep < 6; rep++) {
    const vRep = 0.60 * (1 - 0.30 * (rep / 5))
    const pasos = Math.round(0.5 / vRep * fps)
    for (let k = 0; k <= pasos; k++) {
      muestras.push({ t, x: 320, y: y - (0.5 * k / pasos) / mpp, sepPx, anguloGrados: 0 })
      t += 1 / fps
    }
    y -= 0.5 / mpp
    for (let k = 0; k <= pasos; k++) {
      muestras.push({ t, x: 320, y: y + (0.5 * k / pasos) / mpp, sepPx, anguloGrados: 0 })
      t += 1 / fps
    }
    y += 0.5 / mpp
  }
  const con = analizarSerie(muestras, { sepMm, sentido: 'subir' })
  if (!con.ok) {
    linea(false, 'la serie del IE segmenta', con.motivo ?? '-')
  } else {
    const vmps = con.reps.slice(0, 2).map((r) => r.vMediaPropulsiva).filter(Number.isFinite)
    const vmp = vmps.length ? Math.max(...vmps) : NaN
    linea(Number.isFinite(con.ie) && Math.abs(con.ie - vmp * con.pvPct) < 1e-9,
      'IE es el producto VMP1 x %PV',
      Number.isFinite(con.ie) ? con.ie.toFixed(2) + ' = ' + vmp.toFixed(3) + ' x ' + con.pvPct.toFixed(1) : 'NaN')
    linea(con.ie > 0, 'IE positivo si la serie pierde velocidad',
      Number.isFinite(con.ie) ? con.ie.toFixed(2) : 'NaN')
  }
  const sin = analizarSerie(muestras, { sentido: 'subir' })
  linea(sin.ok && Number.isNaN(sin.ie) && Number.isFinite(sin.pvPct),
    'sin escala no hay IE pero si %PV', 'unidad ' + sin.unidad)
}

console.log(`\n${fallos === 0 ? 'TODO EN VERDE' : `${fallos} EN ROJO`}`)
process.exit(fallos === 0 ? 0 : 1)
