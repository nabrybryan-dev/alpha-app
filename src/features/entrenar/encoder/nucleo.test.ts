import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import huellas from './nucleo/huellas.json'

/* El núcleo de `nucleo/` entra verbatim desde el repo de las herramientas, donde
 * lo validan 56 casos de prueba que aquí no existen. Un parche hecho en esta
 * copia no lo ve ninguna de esas pruebas: compilaría, pasaría el linter y
 * mediría mal.
 *
 * Esto no puede comparar contra el original —son dos repos distintos— pero sí
 * detecta que alguien tocó la copia. Ver `nucleo/ORIGEN.md`. */

const aqui = dirname(fileURLToPath(import.meta.url))

describe('el nucleo vendorizado', () => {
  it.each(Object.keys(huellas))('%s sigue siendo el original', (archivo) => {
    // Los saltos de línea se normalizan ANTES de la huella. Esta máquina tiene
    // `core.autocrlf=true`, así que el mismo archivo sale con CRLF en Windows y
    // con LF en el CI de Linux: sin normalizar, el guardián se pondría rojo en
    // CI aunque nadie hubiera tocado nada, que es la peor clase de guardián.
    const texto = readFileSync(join(aqui, 'nucleo', archivo), 'utf8').replace(/\r\n/g, '\n')
    const huella = createHash('sha256').update(texto).digest('hex')
    expect(
      huella,
      `${archivo} cambio en la app. Los arreglos van en herramientas/encoder-camara, ` +
        'se corren alli pruebas-velocidad.mjs y pruebas-disco.mjs, y luego se vuelve a ' +
        'copiar. Si la copia es correcta, actualiza nucleo/huellas.json.',
    ).toBe(huellas[archivo as keyof typeof huellas])
  })
})
