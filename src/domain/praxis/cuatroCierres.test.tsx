import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { decidirTurno } from './conversacion'
import { decidirTurnoConCharla } from '../../features/praxis/motor/charla'
import { Privacidad } from '../../features/praxis/partes/Privacidad'
import { BLOQUE_CHARLA } from './charla/promptCharla'
import { permisoCubreLaRelectura, VERSION_PERMISOS } from './masGrave'
import type { LoQuePraxisVe } from './plan/listaBlanca'
import { esPregunta, responderDelPlan } from './plan/responder'
import { validarExtraccion } from './registro/esquema'
import { resolverPropuesta } from './registro/resolver'
import type { ContextoRegistro } from './registro/tipos'

const ve: LoQuePraxisVe = { activo: null, cerrados: [], perfil: null, checkins: [], adherencias: [], hidratacionHoyMl: 0, comida: null, falta: ['plan_activo'] }
const contexto: ContextoRegistro = { ahora: '2026-10-05T15:00:00-05:00', microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null }, ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: null } }

describe('conversación: explicar sin prescribir ni perder una corrección', () => {
  it.each(['¿Qué significa RIR?', 'Explícame el RIR', 'Solo explica qué significa RIR', 'No cambies mi rutina, solo dime qué significa RIR.'])('explica «%s» localmente, sin modelo ni plan', (frase) => {
    expect(esPregunta(frase)).toBe(true)
    const r = responderDelPlan(frase, ve, '2026-10-05')
    expect(r.tipo).toBe('respuesta')
    expect(r.texto).toMatch(/repeticiones en reserva/i)
    expect(r.texto).toContain('2')
    expect(r.ofrecePregunta).toBe(false)
    const turno = decidirTurnoConCharla(frase, ve, '2026-10-05', { trato: 'tu', hora: 15, esperaAnimo: false, yaHablo: true })
    expect(turno.paso).toBe('plan')
    expect(turno.vaAlModelo).toBe(false)
  })
  it('mantiene los pedidos de subir carga en manos del coach', () => {
    expect(responderDelPlan('Explícame RIR y súbeme cinco kilos', ve, '2026-10-05').tipo).toBe('pide_cambio')
  })
  it('la salud gana a una explicación de RIR', () => {
    expect(decidirTurno('¿Qué significa RIR? Me duele el pecho.', ve, '2026-10-05').paso).toBe('quieta')
  })
  it.each(['Siento presión en el pecho.', 'En el pecho siento presión.'])('el orden de las palabras no oculta la misma señal: %s', frase => {
    expect(decidirTurno(frase, ve, '2026-10-05').paso).toBe('quieta')
  })
  it('una referencia sin destino pregunta antes de modificar', () => {
    const frase = 'Esa no, la anterior.'
    const { extraccion } = validarExtraccion(frase, { intencion: ['correccion'], correccion: { objetivo: 'no_claro' }, aclaracion: { motivo: 'frase_incompleta' } })
    const p = resolverPropuesta(frase, extraccion, contexto)
    expect(p.accion).toBe('preguntar')
    expect(p.pregunta?.texto).toMatch(/corregir/)
    expect(p.registros).toEqual([])
    expect(p.borrador_pendiente).toEqual({ texto: frase })
  })
})

describe('privacidad: limitar lo que se promete y renovar el consentimiento', () => {
  it('el prompt distingue registros del plan de retención del proveedor', () => {
    expect(BLOQUE_CHARLA).toMatch(/registros del plan/)
    expect(BLOQUE_CHARLA).toMatch(/retención|conservación/)
    expect(BLOQUE_CHARLA).not.toContain('La charla no guarda nada')
  })
  it.each(['tu', 'usted'] as const)('la pantalla dice qué aviso conserva y no promete atención inmediata (%s)', (trato) => {
    const { container } = render(<Privacidad trato={trato} conectada />)
    const t = container.textContent || ''
    expect(t).toMatch(/tipo de señal|tipo de aviso/)
    expect(t).toMatch(/sin (?:guardar |enviar )?(?:la |su |tu )frase/)
    expect(t).not.toContain('Desde aquí todavía no se le avisa a nadie')
    expect(t).toMatch(/no esper|no espere/i)
  })
  it('v2 no cubre el texto nuevo; ambas casillas siguen siendo obligatorias', () => {
    expect(VERSION_PERMISOS).toBe('v3')
    expect(permisoCubreLaRelectura({ version: 'v2', cRiesgo: true, cConversacion: true })).toBe(false)
    expect(permisoCubreLaRelectura({ version: VERSION_PERMISOS, cRiesgo: true, cConversacion: true })).toBe(true)
    expect(permisoCubreLaRelectura({ version: VERSION_PERMISOS, cRiesgo: false, cConversacion: true })).toBe(false)
  })
})
