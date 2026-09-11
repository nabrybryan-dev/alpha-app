import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PIEZAS_DEL_SALON } from '../src/features/entrenar/visor/piezas'
import { TEXTURAS_DEL_SALON } from '../src/features/entrenar/visor/texturas'

/**
 * EL GIMNASIO TIENE QUE SEGUIR ESTANDO CON EL MÓVIL SIN COBERTURA.
 *
 * El salón son 1,1 MB entre la sala 3D y sus cinco texturas, y el service worker no los
 * tocaba: precargaba los 74 archivos de la app —código, estilos, iconos— y nada más. En un
 * sótano con una raya de cobertura eso deja la sala sin aparecer, que es justo donde se usa.
 *
 * Lo que esto vigila no se ve en pantalla ni falla en rojo cuando se rompe: quitar la regla
 * de `vite.config.ts` no rompe ni un test ni una pantalla. Simplemente, un día, alguien
 * abre el salón en un gimnasio con mala señal y no hay gimnasio.
 *
 * ## Por qué se lee el fuente y no el `sw.js` construido
 *
 * El service worker de verdad lo genera Workbox al construir, y construir aquí serían
 * treinta segundos por cada vuelta de los tests. La regla vive en `vite.config.ts` y es una
 * decisión escrita: si está ahí, Workbox la mete. Que la mete de verdad se comprobó a mano
 * el 2026-09-06 — construyendo, sirviendo el `dist`, cargando la sala, **matando el
 * servidor** y volviendo a pedirla: los seis archivos siguieron respondiendo 200 desde la
 * copia guardada, con la pieza intacta (empieza por `PIEZ`), mientras una URL cualquiera
 * daba «Failed to fetch». Eso último importa: sin ese testigo, la prueba no distingue una
 * copia guardada de un servidor que seguía vivo.
 */

const CONFIG = readFileSync('vite.config.ts', 'utf8')

describe('el gimnasio guardado en el teléfono', () => {
  it('hay una regla que guarda las piezas y las texturas', () => {
    expect(CONFIG).toContain('runtimeCaching')
    // Las dos carpetas por su nombre: si el patrón deja de cubrir una, esa mitad del
    // gimnasio se queda dependiendo de la red y la otra no. Se vería como «a veces sí».
    const patron = CONFIG.match(/urlPattern:\s*(\S+)/)?.[1] ?? ''
    expect(patron).toContain('piezas')
    expect(patron).toContain('texturas')
  })

  it('se sirve la copia PERO se comprueba por detrás, o el gimnasio se congela', () => {
    // `CacheFirst` sería la elección obvia y sería un error: el nombre del archivo no
    // cambia al reexportar la sala —siempre `sala-gimnasio.pieza.br`—, así que quien ya
    // entró una vez se quedaría con el gimnasio viejo para siempre, sin forma de enterarse.
    // Con `StaleWhileRevalidate` se ve al instante y se actualiza sola para la próxima.
    expect(CONFIG).toContain("handler: 'StaleWhileRevalidate'")
    expect(CONFIG).not.toContain("handler: 'CacheFirst'")
  })

  it('no guarda un error como si fuera la sala', () => {
    // Sin acotar los estados, un 404 en mitad de un despliegue se guardaría igual y el
    // salón se quedaría sin sala hasta que caducara la copia.
    expect(CONFIG).toMatch(/cacheableResponse:\s*\{\s*statuses:\s*\[0,\s*200\]/)
  })

  it('caben todos los archivos que el salón pide de verdad', () => {
    // El límite de entradas no es un número redondo puesto a ojo: si un día el salón pide
    // más archivos de los que caben, Workbox empieza a soltar los más viejos y la sala
    // vuelve a depender de la red sin que nadie lo note.
    const pedidos = Object.keys(PIEZAS_DEL_SALON).length + Object.keys(TEXTURAS_DEL_SALON).length
    const tope = Number(CONFIG.match(/maxEntries:\s*(\d+)/)?.[1])
    expect(tope, 'no hay tope declarado').toBeGreaterThan(0)
    expect(tope, `el salón pide ${pedidos} archivos y solo caben ${tope}`).toBeGreaterThanOrEqual(pedidos)
  })

  it('lo pesado NO se precarga: se guarda al abrir el salón, no al abrir la app', () => {
    // Precargar obligaría a bajar 1,1 MB a quien entra a mirar la comida o el chat. La
    // marca de que no se hace es que nadie haya metido `piezas` ni `texturas` en los
    // patrones de precarga de Workbox.
    const precarga = CONFIG.match(/globPatterns:[\s\S]{0,200}/)?.[0] ?? ''
    expect(precarga).not.toMatch(/piezas|texturas|pieza|\.br/)
  })
})
