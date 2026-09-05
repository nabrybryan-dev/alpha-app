/**
 * MUELLES DE VERDAD, HORNEADOS A CSS.
 *
 * La app tiene que transmitir peso: una tarjeta de entrenamiento pesado debe
 * costar más de mover que un botón secundario. Eso es física —masa, rigidez,
 * amortiguación—, y hasta ahora se fingía con cuatro `cubic-bezier`.
 *
 * Una Bézier cúbica **no puede** describir un muelle: solo tiene dos puntos de
 * control, así que no sabe sobrepasar y volver más de una vez. `--ease-rebote`
 * lo aproxima con un solo sobrepaso y ahí se acaba.
 *
 * La función `linear()` de CSS sí puede: se le dan N muestras de la curva y el
 * navegador interpola entre ellas. Así que se resuelve la ecuación del muelle
 * amortiguado de verdad, se muestrea, y sale movimiento con masa **sin una sola
 * línea de JavaScript en tiempo de ejecución y sin una dependencia**.
 *
 * Soporte: Chrome 113, Firefox 112, **Safari 17.2** (dic. 2023). Donde no esté,
 * el navegador se queda con la curva declarada antes en la misma regla, así que
 * se pierde el matiz y nunca la animación. Ver
 * `cerebro-render/wiki/tecnicas/`.
 *
 * Uso:  node scripts/generar-muelles.mjs          (imprime los tokens)
 *       node scripts/generar-muelles.mjs --check  (falla si tokens.css no cuadra)
 */

import { readFileSync } from 'node:fs'

/**
 * Posición de un muelle amortiguado que va de 0 a 1, en el instante `t`.
 *
 * Solo se modela el caso SUBAMORTIGUADO (zeta < 1), que es el único que
 * sobrepasa y por tanto el único que se siente como materia. Con zeta >= 1 la
 * curva no rebota y para eso ya sirve una Bézier.
 *
 *   x(t) = 1 - e^(-z*w0*t) * ( cos(wd*t) + (z*w0/wd) * sen(wd*t) )
 *
 * con w0 = sqrt(k/m) la frecuencia natural, z = c / (2*sqrt(k*m)) el factor de
 * amortiguación y wd = w0*sqrt(1 - z^2) la frecuencia amortiguada.
 */
function posicion(t, { masa, rigidez, amortiguacion }) {
  const w0 = Math.sqrt(rigidez / masa)
  const z = amortiguacion / (2 * Math.sqrt(rigidez * masa))
  if (z >= 1) throw new Error('muelle sobreamortiguado: para eso usa una Bézier')
  const wd = w0 * Math.sqrt(1 - z * z)
  return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t))
}

/**
 * Cuánto tarda en quedarse quieto, en milisegundos.
 *
 * «Quieto» es estar dentro del 0,4 % del destino y NO volver a salir. Se
 * comprueba hacia atrás justamente por eso: un muelle cruza su destino varias
 * veces, y el primer cruce no es el final — cortar ahí dejaría la animación a
 * medio rebote, que es el fallo clásico al implementar esto.
 */
function duracion(muelle, techo = 4000) {
  const paso = 1 / 240 // 240 Hz: por debajo se pierde el último rebote
  const tolerancia = 0.004
  let ultimoFuera = 0
  for (let t = 0; t < techo / 1000; t += paso) {
    if (Math.abs(posicion(t, muelle) - 1) > tolerancia) ultimoFuera = t
  }
  return Math.ceil((ultimoFuera + paso) * 1000)
}

/** La curva como la escribe CSS: muestras repartidas por igual. */
function comoLinear(muelle, ms, muestras = 34) {
  const puntos = []
  for (let i = 0; i <= muestras; i++) {
    const t = (i / muestras) * (ms / 1000)
    puntos.push(Number(posicion(t, muelle).toFixed(4)))
  }
  // El primero y el último se clavan: el redondeo puede dejar 0.9998 al final y
  // eso deja el elemento un pelo corto de su sitio para siempre.
  puntos[0] = 0
  puntos[puntos.length - 1] = 1
  return `linear(${puntos.join(', ')})`
}

/**
 * LOS CINCO PESOS, que son la jerarquía de movimiento de la app.
 *
 * No son cinco valores bonitos: son los cinco niveles que Bryan escribió, de
 * protagonista a microinteracción, convertidos en masa. Cuanto más arriba en la
 * jerarquía, más pesa y más tarda en asentarse — que es exactamente lo que hace
 * que una cosa se sienta importante sin necesidad de escribir que lo es.
 */
export const MUELLES = {
  // 1. PROTAGONISTA — el atleta, la biomecánica. Lo más pesado que se mueve.
  //    Sobrepasa poco y se asienta despacio: la masa se nota en el frenado.
  protagonista: { masa: 1, rigidez: 130, amortiguacion: 20 },
  // 2. INFORMATIVO — carga, RIR, series, descanso. Tiene cuerpo pero responde.
  informativo: { masa: 1, rigidez: 190, amortiguacion: 22 },
  // 3. TRANSICIONAL — cambios de sección. Firme, sin coquetear.
  transicional: { masa: 1, rigidez: 240, amortiguacion: 26 },
  // 4. AMBIENTAL — luces, profundidad. Blando y lento; nunca pide atención.
  // OJO: con amortiguacion 24 este muelle salia en zeta = 1,0 EXACTO -- amortiguado
  //    critico, sin un solo sobrepaso-- y el generador lo rechazo. Es el borde del
  //    modelo, no un capricho: en zeta = 1 la formula se indetermina (wd = 0). 22
  //    deja zeta ~ 0,92: un sobrepaso minimo, que es lo que debe hacer una luz.
  ambiental: { masa: 1.6, rigidez: 90, amortiguacion: 22 },
  // 5. MICROINTERACCIÓN — botones, confirmaciones. Rápido y con chispa.
  microinteraccion: { masa: 1, rigidez: 420, amortiguacion: 24 },
}

export function tokens() {
  const salida = []
  for (const [nombre, muelle] of Object.entries(MUELLES)) {
    const ms = duracion(muelle)
    salida.push({ nombre, ms, curva: comoLinear(muelle, ms), muelle })
  }
  return salida
}

if (process.argv[1]?.endsWith('generar-muelles.mjs')) {
  const t = tokens()
  const comprobar = process.argv.includes('--check')

  if (!comprobar) {
    console.log('/* Generado por scripts/generar-muelles.mjs — no editar a mano. */')
    for (const { nombre, ms, curva, muelle } of t) {
      console.log(`\n  /* ${nombre}: masa ${muelle.masa}, rigidez ${muelle.rigidez}, amortiguacion ${muelle.amortiguacion} */`)
      console.log(`  --dur-${nombre}: ${ms}ms;`)
      console.log(`  --muelle-${nombre}: ${curva};`)
    }
    console.log()
  } else {
    // El generador y la hoja de estilo tienen que decir lo mismo. Si alguien
    // toca un muelle a mano, esto lo caza: si no, la hoja y su origen se
    // separan en silencio y nadie sabe cuál manda.
    const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
    let mal = 0
    for (const { nombre, ms, curva } of t) {
      // Se busca la línea LITERAL y no con una expresión regular por nombre: el
      // token aparece DOS veces —el respaldo en `:root` y el muelle dentro del
      // `@supports`— y una regular cazaría el primero, que es la Bézier, y daría
      // un rojo falso en cada corrida. Ya pasó al montar esto.
      for (const linea of [`--dur-${nombre}: ${ms}ms;`, `--muelle-${nombre}: ${curva};`]) {
        if (!css.includes(linea)) {
          console.error(`  falta o no coincide en tokens.css:
    ${linea}`)
          mal++
        }
      }
    }
    if (mal) {
      console.error(`\n${mal} token(es) fuera de sitio. Regenerar con: node scripts/generar-muelles.mjs`)
      process.exit(1)
    }
    console.log(`los ${t.length} muelles de tokens.css coinciden con su origen`)
  }
}
