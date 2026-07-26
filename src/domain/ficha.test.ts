import { describe, expect, it } from 'vitest'
import { parsearFicha } from './ficha'

// Fixture deliberadamente VÁLIDO: 8 variantes y 81 palabras de cuerpo, dentro
// del rango 70-160. Así `validarFicha(FICHA_MINIMA)` devuelve [] y cada test
// puede afirmar sobre un solo error, sin ruido de fondo.
const FICHA_MINIMA = `---
id: demo-uno
bloque: vocabulario
titulo: ¿Qué es RIR?
variantes:
  - qué es rir
  - que significa rir
  - qué quiere decir rir 2
  - no entiendo lo del rir
  - repeticiones en reserva qué es
  - cómo sé mi rir
  - qué es eso de rir
  - rir 2 qué significa
bandera_salud: false
datos_que_usa: [rir_pautado]
fuentes: [metodo-heracles-anexo]
actualizado: 2026-07-25
---

## respuesta_directa
Son las repeticiones que te quedan en el tanque cuando terminas la serie, sin
llegar al fallo.

## por_que
Sirve para medir cuánto te acercas al fallo sin tener que llegar a él, porque la
cercanía al fallo es lo que determina el estímulo real de la serie.

## tu_caso_hoy
Hoy tienes RIR {{rir_pautado}} en tus series principales.

## que_hago_ahora
Al terminar cada serie, pregúntate cuántas repeticiones más habrías podido hacer
con buena técnica.

## senal_alarma
Si nunca logras estimarlo, avísame y lo calibramos juntos en la próxima sesión.
`

describe('parsearFicha', () => {
  it('extrae el frontmatter tipado', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    expect(ficha.id).toBe('demo-uno')
    expect(ficha.bloque).toBe('vocabulario')
    expect(ficha.titulo).toBe('¿Qué es RIR?')
    expect(ficha.variantes).toHaveLength(8)
    expect(ficha.variantes[0]).toBe('qué es rir')
    expect(ficha.banderaSalud).toBe(false)
    expect(ficha.datosQueUsa).toEqual(['rir_pautado'])
    expect(ficha.fuentes).toEqual(['metodo-heracles-anexo'])
  })

  it('extrae las cinco partes del cuerpo', () => {
    const ficha = parsearFicha(FICHA_MINIMA)
    expect(ficha.cuerpo.respuesta_directa).toContain('repeticiones que te quedan')
    expect(ficha.cuerpo.por_que).toContain('medir cuánto te acercas')
    expect(ficha.cuerpo.tu_caso_hoy).toContain('{{rir_pautado}}')
    expect(ficha.cuerpo.que_hago_ahora).toContain('pregúntate')
    expect(ficha.cuerpo.senal_alarma).toContain('calibramos')
  })

  it('lanza si no hay frontmatter', () => {
    expect(() => parsearFicha('## respuesta_directa\nhola')).toThrow(
      /frontmatter/i,
    )
  })
})
