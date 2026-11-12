/**
 * La tarjeta del check-in en la pantalla de Praxis (paso 2). Se prueba el árbol, sin la escena entera.
 *
 * ESCRITOS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO. Frases inventadas.
 */
import { describe, expect, it, vi } from 'vitest'
import { conectarMensaje } from '../../../domain/praxis/registro/conectores'
import { armarTarjeta, confirmarTarjeta, type TarjetaCheckin } from '../../../domain/praxis/registro/tarjetaCheckin'
import { BOTON_ANOTAR, nodoTarjetaCheckin, type EstadoTarjeta } from './tarjetaCheckin'

function preparar(texto: string) {
  const t = armarTarjeta(conectarMensaje(texto)) as TarjetaCheckin
  const estado: EstadoTarjeta = { elecciones: new Map(), anotaciones: new Set() }
  const alAnotar = vi.fn()
  let nodo = nodoTarjetaCheckin(t, estado, () => { nodo = nodoTarjetaCheckin(t, estado, () => {}, alAnotar) }, alAnotar)
  const boton = (k: string) => nodo.querySelector(`[data-k="${k}"]`) as HTMLButtonElement
  return { t, estado, alAnotar, nodo: () => nodo, boton }
}

describe('tarjeta del check-in en pantalla', () => {
  it('P01 enseña cada pregunta con su cita; lo propuesto se distingue pero no cuenta como elegido', () => {
    const { nodo, boton } = preparar('Dormí fatal y el entreno no tan bien')
    expect(nodo().textContent).toContain('Calidad del sueño')
    expect(nodo().textContent).toContain('«Dormí fatal»')
    expect(boton('ck-calidadSueno-MALA').dataset.propuesto).toBe('si')
    expect(boton('ck-calidadSueno-MALA').getAttribute('aria-pressed')).toBe('false')
    // La fila vaga solo ofrece sus dos candidatos.
    expect(boton('ck-rendimiento-REGULAR')).not.toBeNull()
    expect(boton('ck-rendimiento-MALA')).not.toBeNull()
    expect(boton('ck-rendimiento-BUENA')).toBeNull()
  })

  it('P02 sin ningún toque, «Anotar» está bloqueado', () => {
    const { boton } = preparar('Dormí fatal')
    expect(boton('ck-anotar').disabled).toBe(true)
    expect(boton('ck-anotar').textContent).toBe(BOTON_ANOTAR)
  })

  it('P03 tocar una opción la guarda en el estado y la marca; tocar «No anotar» la deja fuera', () => {
    const { t, estado, boton, nodo } = preparar('Dormí fatal y comí bien')
    boton('ck-calidadSueno-REGULAR').click()
    nodo().querySelector<HTMLButtonElement>('[data-k="ck-alimentacion-no"]')?.click()
    const c = confirmarTarjeta(t, [...estado.elecciones.values()])
    expect(c.parche).toEqual({ calidadSueno: 'REGULAR' })
    expect(nodo().querySelector('[data-k="ck-calidadSueno-REGULAR"]')?.getAttribute('aria-pressed')).toBe('true')
    expect(nodo().querySelector<HTMLButtonElement>('[data-k="ck-anotar"]')?.disabled).toBe(false)
  })
})
