import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PerfilCalculadoVista } from './PerfilCalculadoVista'
import type { PerfilCalculado } from '../../domain/nutricion/perfilCalculado'
import {
  VISIBILIDAD_EN_ESPERA,
  VISIBILIDAD_POR_DEFECTO,
  type Visibilidad,
} from '../../domain/nutricion/visibilidad'

/**
 * Qué ve el asesorado de sus propias cifras según lo que decidió la
 * nutricionista.
 *
 * Estos tests no existían, y por eso el apagado nunca se probó: la pantalla
 * recibía siempre los tres interruptores encendidos desde su único llamador, así
 * que las ramas de apagado eran código inalcanzable con aspecto de código vivo.
 */

const PERFIL: PerfilCalculado = {
  grasaPct: 24.5,
  masaMagraKg: 46.8,
  imc: 22.8,
  tmb: 1400,
  factorActividad: 1.55,
  tdee: 2170,
  macros: { kcal: 2170, proteinaG: 120, carbosG: 240, grasaG: 62 },
  energia: null,
  incompleto: [],
}

/** Un perfil de alguien que está comiendo por debajo de lo que su cuerpo pide. */
const EN_RIESGO: PerfilCalculado = {
  ...PERFIL,
  energia: { estado: 'problema', disponibilidad: 21, criterio: 'mujer' },
}

const apagado: Visibilidad = {
  verComposicion: false,
  verObjetivoCalorico: false,
  verContadorKcal: false,
  estado: 'decidido',
}

const pintar = (perfil: PerfilCalculado, visibilidad: Visibilidad) =>
  render(<PerfilCalculadoVista perfil={perfil} visibilidad={visibilidad} nombre="Valentina" />)

describe('PerfilCalculadoVista', () => {
  it('con todo encendido se ven la composición y el gasto', () => {
    pintar(PERFIL, VISIBILIDAD_POR_DEFECTO)
    expect(screen.getByText(/tu composición/i)).toBeInTheDocument()
    expect(screen.getByText(/tu gasto estimado/i)).toBeInTheDocument()
  })

  describe('cuando la nutricionista apaga las cifras', () => {
    it('la composición y el gasto desaparecen', () => {
      pintar(PERFIL, apagado)
      expect(screen.queryByText(/tu composición/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/tu gasto estimado/i)).not.toBeInTheDocument()
    })

    it('se explica por qué, en vez de dejar la pantalla vacía', () => {
      pintar(PERFIL, apagado)
      expect(screen.getByText(/prefiere trabajar contigo sin cifras/i)).toBeInTheDocument()
    })

    /**
     * EL TEST QUE MOTIVA TODO ESTO.
     *
     * El módulo de dominio declara en su cabecera que la alerta de
     * disponibilidad energética «funciona igual con los tres interruptores
     * apagados». La vista no lo cumplía: la escondía detrás de
     * `verObjetivoCalorico`.
     *
     * Hoy no se nota porque el interruptor siempre llega encendido. En cuanto se
     * cablee de verdad, la primera persona a la que se le apaguen las cifras
     * -justo la que hay que proteger- dejaría de ver el aviso de que está
     * comiendo por debajo de lo que su cuerpo necesita. Un interruptor de
     * privacidad no puede apagar una alerta de salud.
     */
    it('la alerta de energía SÍ se ve: es de salud, no de privacidad', () => {
      pintar(EN_RIESGO, apagado)
      expect(screen.getByText(/energía disponible/i)).toBeInTheDocument()
      expect(screen.getByText(/menos de lo que tu cuerpo necesita/i)).toBeInTheDocument()
    })
  })

  describe('mientras la nutricionista no ha decidido', () => {
    it('dice que alguien lo está mirando, no que hay una bandera', () => {
      pintar(PERFIL, VISIBILIDAD_EN_ESPERA)
      expect(screen.getByText(/está revisando tus datos/i)).toBeInTheDocument()
    })

    it('y no repite el mensaje del apagado decidido', () => {
      // Son dos situaciones distintas y solo una es cierta a la vez.
      pintar(PERFIL, VISIBILIDAD_EN_ESPERA)
      expect(screen.queryByText(/prefiere trabajar contigo sin cifras/i)).not.toBeInTheDocument()
    })

    it('la alerta de energía tampoco se calla aquí', () => {
      pintar(EN_RIESGO, VISIBILIDAD_EN_ESPERA)
      expect(screen.getByText(/energía disponible/i)).toBeInTheDocument()
    })
  })
})
