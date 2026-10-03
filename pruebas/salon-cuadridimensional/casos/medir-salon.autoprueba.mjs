import assert from 'node:assert/strict'
import { evaluarEvidencia } from '../../../scripts/medir-salon.mjs'

const valida = {
  dispositivo: { modelo: 'iPhone 15 Pro Max', fisico: true },
  fps: { muestras: [30, 34, 41] },
  aperturaSegundos: 5,
  medidaEn: '2026-09-01T12:00:00-05:00',
  url: 'https://preview.invalid/solo-autoprueba',
  metodo: 'fixture sintética que prueba exclusivamente el gate',
}

const aceptada = evaluarEvidencia(valida)
if (process.argv.includes('--sabotaje')) aceptada.ok = false
assert.equal(aceptada.ok, true, `el caso límite válido fue rechazado: ${aceptada.errores.join('; ')}`)

for (const [nombre, cambio, error] of [
  ['fps', { fps: { muestras: [29.9, 45] } }, 'hay una muestra de FPS por debajo de 30'],
  ['apertura', { aperturaSegundos: 5.01 }, 'la apertura no está entre 0 y 5 segundos'],
  ['simulador', { dispositivo: { modelo: 'iPhone 15 Pro Max', fisico: false } }, 'la evidencia no declara un dispositivo físico'],
  ['autoprueba', { soloAutoprueba: true }, 'una autoprueba no es evidencia física'],
]) {
  const resultado = evaluarEvidencia({ ...valida, ...cambio })
  assert.equal(resultado.ok, false, `${nombre}: el gate aceptó evidencia inválida`)
  assert.ok(resultado.errores.includes(error), `${nombre}: no explicó el rechazo: ${resultado.errores.join('; ')}`)
}

console.log('AUTOPRUEBA MEDICION: OK (límites 30 FPS/5 s y evidencia física distinguidos)')
