import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const RUTA_EVIDENCIA_POR_DEFECTO = 'pruebas/salon-cuadridimensional/evidencia-iphone-15-pro-max.json'

export function evaluarEvidencia(evidencia) {
  const errores = []
  if (!evidencia || typeof evidencia !== 'object') return { ok: false, errores: ['evidencia JSON ausente o inválida'] }
  if (evidencia.dispositivo?.modelo !== 'iPhone 15 Pro Max') errores.push('el dispositivo no es iPhone 15 Pro Max')
  if (evidencia.dispositivo?.fisico !== true) errores.push('la evidencia no declara un dispositivo físico')
  if (!Array.isArray(evidencia.fps?.muestras) || evidencia.fps.muestras.length === 0) {
    errores.push('faltan muestras de FPS')
  } else if (!evidencia.fps.muestras.every((n) => Number.isFinite(n) && n >= 30)) {
    errores.push('hay una muestra de FPS por debajo de 30')
  }
  if (!Number.isFinite(evidencia.aperturaSegundos) || evidencia.aperturaSegundos > 5 || evidencia.aperturaSegundos < 0) {
    errores.push('la apertura no está entre 0 y 5 segundos')
  }
  if (typeof evidencia.medidaEn !== 'string' || Number.isNaN(Date.parse(evidencia.medidaEn))) errores.push('falta fecha de medición válida')
  if (typeof evidencia.url !== 'string' || !/^https:\/\//.test(evidencia.url)) errores.push('falta URL https medida')
  if (typeof evidencia.metodo !== 'string' || evidencia.metodo.trim().length < 10) errores.push('falta método reproducible')
  if (evidencia.soloAutoprueba === true) errores.push('una autoprueba no es evidencia física')
  return { ok: errores.length === 0, errores }
}

export async function medirSalon(ruta = RUTA_EVIDENCIA_POR_DEFECTO) {
  let evidencia
  try {
    evidencia = JSON.parse(await readFile(resolve(ruta), 'utf8'))
  } catch (error) {
    const motivo = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'
      ? `no existe evidencia física en ${ruta}`
      : `no se pudo leer ${ruta}: ${error instanceof Error ? error.message : String(error)}`
    return { ok: false, errores: [motivo] }
  }
  return evaluarEvidencia(evidencia)
}

async function principal() {
  const ruta = process.argv[2] ?? RUTA_EVIDENCIA_POR_DEFECTO
  const resultado = await medirSalon(ruta)
  if (!resultado.ok) {
    console.error(`MEDICION SALON: FALLO (${resultado.errores.join('; ')})`)
    process.exitCode = 1
    return
  }
  console.log(`MEDICION SALON: OK (FPS mínimo >=30, apertura <=5s, evidencia=${ruta})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await principal()
