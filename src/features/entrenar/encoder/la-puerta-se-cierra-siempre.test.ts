import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Quien abre la cámara, cierra la puerta.
 *
 * `marcarCamaraAbierta()` enciende `[data-camara-abierta]` en el `<body>`, y de ese
 * atributo cuelga toda la puerta de `tokens.css`: aplana la profundidad, **pausa todas
 * las animaciones** y quita todos los `backdrop-filter`. Es la única defensa que tiene
 * el presupuesto de fotogramas de la captura.
 *
 * ESTUVO MUERTA EN LA MITAD DE LOS SITIOS. Hasta el 27/08 la llamaba **un solo
 * archivo** de toda la app —`RegistroSerie`—, así que `EncoderPage`, que es la pantalla
 * cuyo trabajo *es* capturar, grababa con la interfaz entera moviéndose y con
 * `GraficaBrazo` corriendo su propio `requestAnimationFrame` al lado.
 *
 * Y es un fallo que no se ve. En un escritorio se comporta idéntico; el precio se paga
 * en un móvil, en fotogramas, y sale por el otro lado convertido en un dato malo: el
 * bucle pide 60 fps y la toma se descarta por debajo de 50, porque a 30 fps el error de
 * %PV se va 5 puntos. Un fallo deja la toma en `dudosa`, dos la matan. O sea que la
 * consecuencia real de olvidar esta llamada es **que el asesorado repita la serie**.
 *
 * Este guardián es estático a propósito, y aquí sí funciona: la regla es «este archivo
 * usa aquel», que se lee del código sin renderizar nada.
 */

// Vitest corre desde la raíz del proyecto. Se usa `cwd` y no `import.meta.url` porque
// en Windows ese devuelve una ruta con prefijo `/@fs/` que `node:fs` no abre.
const RAIZ = process.cwd()
const ENTRENAR = join(RAIZ, 'src', 'features', 'entrenar')

function fuentes(dir: string, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name)
    if (entrada.isDirectory()) fuentes(ruta, acc)
    else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) acc.push(ruta)
  }
  return acc
}

const ARCHIVOS = fuentes(ENTRENAR).map((ruta) => ({
  ruta,
  nombre: ruta.slice(ENTRENAR.length + 1).replace(/\\/g, '/'),
  texto: readFileSync(ruta, 'utf8'),
}))

/**
 * Quien MONTA el bucle de captura. Se excluye el propio hook: ahí `useCaptura(` es la
 * declaración, no una llamada, y pedirle que encienda la puerta sería pedirle que
 * decida por sus dos pantallas.
 */
const MONTAN_LA_CAPTURA = ARCHIVOS.filter(
  (a) => a.nombre !== 'encoder/useCaptura.ts' && /\buseCaptura\s*\(/.test(a.texto),
)

/**
 * LA ÚNICA EXCEPCIÓN, y va comprobada en vez de creída.
 *
 * `Visor` monta la captura pero NO enciende la puerta, y está bien: vive dentro de
 * `HojaMedicion`, que abre `RegistroSerie`, y es esa la que la enciende al empezar a
 * medir. Encenderla también aquí sería un segundo dueño del mismo atributo — y el
 * atributo es un booleano global: dos dueños significa que el primero que se desmonte
 * la apaga con el otro todavía grabando.
 *
 * La excepción nombra a su cubridor y el test comprueba que ese cubridor la enciende de
 * verdad. Si mañana `RegistroSerie` la pierde, esto se pone rojo aquí también — que es
 * el punto: una excepción que no se verifica es un agujero con un comentario al lado.
 */
const CUBIERTOS_DESDE_ARRIBA: Record<string, string> = {
  'encoder/Visor.tsx': 'RegistroSerie.tsx',
}

const DEBEN_ENCENDER = MONTAN_LA_CAPTURA.filter((a) => !(a.nombre in CUBIERTOS_DESDE_ARRIBA))

describe('la puerta de cámara', () => {
  it('hay pantallas de captura que vigilar', () => {
    // Si esto baja a cero, o el hook se renombró o el barrido dejó de mirar donde
    // debe — y en los dos casos el resto de este archivo estaría pasando en vacío.
    expect(MONTAN_LA_CAPTURA.length).toBeGreaterThan(0)
    expect(DEBEN_ENCENDER.length).toBeGreaterThan(0)
  })

  it.each(Object.entries(CUBIERTOS_DESDE_ARRIBA))(
    '%s está cubierto de verdad por %s, no solo declarado',
    (cubierto, cubridor) => {
      const padre = ARCHIVOS.find((a) => a.nombre === cubridor)
      expect(padre, `\`${cubierto}\` dice estar cubierto por \`${cubridor}\`, que no existe`).toBeDefined()
      expect(
        /marcarCamaraAbierta\s*\(/.test(padre!.texto),
        `\`${cubierto}\` no enciende la puerta porque dice que lo hace \`${cubridor}\` — ` +
          'y `' + cubridor + '` ya no la enciende. La excepción se quedó sin fundamento.',
      ).toBe(true)
    },
  )

  it.each(DEBEN_ENCENDER.map((a) => [a.nombre, a] as const))(
    '%s monta la captura y enciende la puerta',
    (nombre, archivo) => {
      expect(
        /marcarCamaraAbierta\s*\(/.test(archivo.texto),
        `\`${nombre}\` monta \`useCaptura\` y nunca llama a \`marcarCamaraAbierta()\`. ` +
          'Mientras grabe, la app entera seguirá animándose y desenfocando, y por debajo ' +
          'de 50 fps la toma se descarta.',
      ).toBe(true)
    },
  )

  it.each(DEBEN_ENCENDER.map((a) => [a.nombre, a] as const))(
    '%s cuelga la puerta del estado de la cámara, no del montaje',
    (nombre, archivo) => {
      // La marca devuelve su limpieza, así que va DENTRO de un efecto y con una
      // condición: puesta mientras se captura y ni un segundo más. Colgarla del
      // montaje de la pantalla dejaría la app sin animaciones desde que se entra,
      // aunque la cámara esté cerrada — y eso sí se nota, en la dirección contraria.
      const efecto = /useEffect\(\s*\(\)\s*=>\s*\{[^}]*marcarCamaraAbierta\s*\(\s*\)/s.test(
        archivo.texto,
      )
      expect(
        efecto,
        `\`${nombre}\` llama a \`marcarCamaraAbierta()\` fuera de un \`useEffect\`: ` +
          'la limpieza que devuelve es obligatoria, o el atributo se queda pegado y la ' +
          'app se queda sin animaciones hasta recargar.',
      ).toBe(true)
    },
  )

  it('nadie escribe el atributo a mano, esquivando el módulo', () => {
    // El nombre del atributo vive en tres sitios —`tokens.css`, y el escribir y el
    // leer de `camaraAbierta.ts`— y el CSS no puede importar del TS. Escribirlo a
    // mano en una pantalla añade un cuarto sitio que nadie recordará renombrar.
    //
    // Se miran los comentarios FUERA. Este mismo guardián y el efecto que arregló
    // `EncoderPage` citan el atributo en su documentación —explicar la puerta pide
    // nombrarla— y sin quitarlos el test se ponía rojo por su propia prosa. Un
    // guardián que caza a quien lo explica no vigila: estorba.
    const sinComentarios = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

    const aMano = ARCHIVOS.filter(
      (a) =>
        a.nombre !== 'camaraAbierta.ts' &&
        /dataset\.camaraAbierta|data-camara-abierta/.test(sinComentarios(a.texto)),
    ).map((a) => a.nombre)

    expect(aMano).toEqual([])
  })
})
