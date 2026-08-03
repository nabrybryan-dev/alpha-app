import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { enviosDeSync, esquemaDeLasMigraciones, sqlDeLasMigraciones } from './leerMigraciones'

/**
 * Lo que la app manda al servidor contra lo que la tabla acepta.
 *
 * POR QUÉ EXISTE. Los tests corren siempre en modo demo, sin Supabase, así que
 * un payload con una columna que no existe —o al que le falta una obligatoria—
 * pasa la suite entera y solo falla en producción, donde la cola lo reintenta
 * ocho veces y lo descarta EN SILENCIO. Es la misma familia de fallo que dejó el
 * registro de comidas sin subir nada durante semanas.
 *
 * QUÉ NO ES. No sustituye al Postgres del CI, que sí evalúa RLS, triggers y
 * tipos. Esto atrapa en segundos y sin base de datos los desajustes de nombres,
 * que son los más frecuentes y los más tontos.
 */

const SYNC = join(process.cwd(), 'src', 'data', 'nube', 'sync.ts')

const esquema = esquemaDeLasMigraciones(sqlDeLasMigraciones())
const envios = enviosDeSync(readFileSync(SYNC, 'utf8'))

/**
 * Columnas obligatorias que el cliente NO manda porque las pone la base.
 *
 * Un lector de SQL no puede saber que hay un trigger detrás, y relajar la
 * comprobación para que no moleste dejaría pasar las que sí faltan de verdad.
 * Se declaran una a una, con su motivo.
 *
 * Si alguien quita ese trigger, esta lista deja de ser cierta y el que avisa es
 * el Postgres del CI: `supabase/test/10-escrituras-del-asesorado.sql` comprueba
 * que el alimento acabe atado a su comida.
 */
const LAS_PONE_LA_BASE: Record<string, string> = {
  'registro_item.registro_id':
    'la rellena el trigger de la 0017 a partir de comida_cliente_id: el móvil no ' +
    'conoce el id de la comida, que lo genera el servidor',
}

describe('contrato entre sync.ts y el esquema', () => {
  it('los lectores encuentran algo: si no, el resto pasaría sin comprobar nada', () => {
    // El fallo más peligroso de un test que lee archivos con expresiones
    // regulares es que deje de encontrarlos y se quede verde para siempre.
    expect(esquema.size).toBeGreaterThan(15)
    expect(envios.length).toBeGreaterThan(10)
    expect(envios.every((e) => e.claves.length > 0)).toBe(true)
  })

  it('cada envío apunta a una tabla que existe', () => {
    const huerfanos = envios.filter((e) => !esquema.has(e.tabla))
    expect(huerfanos.map((e) => `${e.tabla} (sync.ts:${e.linea})`)).toEqual([])
  })

  it('ninguna clave del payload es una columna inventada', () => {
    // Una columna que no existe hace fallar el insert entero: no se pierde solo
    // ese campo, se pierde la fila.
    const inventadas: string[] = []
    for (const envio of envios) {
      const columnas = esquema.get(envio.tabla)
      if (!columnas) continue
      for (const clave of envio.claves) {
        if (!columnas.has(clave)) {
          inventadas.push(`${envio.tabla}.${clave} (sync.ts:${envio.linea})`)
        }
      }
    }
    expect(inventadas).toEqual([])
  })

  it('los upsert traen todas las columnas obligatorias sin valor por defecto', () => {
    // `not null` sin `default` es lo único que la base exige de verdad al
    // insertar. Lo demás lo puede rellenar ella.
    const faltantes: string[] = []
    for (const envio of envios) {
      if (envio.tipo !== 'upsert') continue
      // Un `...spread` esconde claves que salen de una función: no se puede
      // afirmar que falten. Se declaran en la prueba de abajo, no se ignoran.
      if (envio.incompleto) continue
      const columnas = esquema.get(envio.tabla)
      if (!columnas) continue
      for (const columna of columnas.values()) {
        const referencia = `${envio.tabla}.${columna.nombre}`
        if (referencia in LAS_PONE_LA_BASE) continue
        if (columna.exigidaAlInsertar && !envio.claves.includes(columna.nombre)) {
          faltantes.push(`${referencia} (sync.ts:${envio.linea})`)
        }
      }
    }
    expect(faltantes).toEqual([])
  })

  it('deja a la vista los payloads que no se pueden comprobar del todo', () => {
    // No es un fallo: es la frontera de lo que este test alcanza. Se escribe
    // para que se sepa, y para que crezca sola la lista si alguien añade otro
    // spread sin darse cuenta.
    const incompletos = envios.filter((e) => e.incompleto).map((e) => e.tabla)
    expect(incompletos).toEqual(['perfil_alimentario'])
  })

  it('los update solo tocan columnas que existen', () => {
    // Un update es parcial por naturaleza: aquí no se exige completitud, solo
    // que lo que toca sea real.
    const malas: string[] = []
    for (const envio of envios) {
      if (envio.tipo !== 'update') continue
      const columnas = esquema.get(envio.tabla)
      for (const clave of envio.claves) {
        if (columnas && !columnas.has(clave)) malas.push(`${envio.tabla}.${clave}`)
      }
    }
    expect(malas).toEqual([])
  })
})
