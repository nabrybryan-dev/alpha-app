/** Ayudas compartidas de las pruebas de «duros» (8-nov-2026): una extracción hecha a mano, resuelta con `resolverVida`. */
import { resolverVida, type ResultadoVida } from './vida.ts'
import type { ContextoRegistro, RegistroCheckin, RegistroHidratacion, VidaExtraida } from './tipos.ts'

const ctx = (): ContextoRegistro => ({
  ahora: '2026-11-07T12:00:00-05:00', microciclo: null, sesionHoyId: null, sesiones: [], pantalla: { ejercicioId: null },
  ultimoTocado: null, semanaAnterior: {}, perfil: { pesoBarraKg: null },
} as unknown as ContextoRegistro)

const vacio = (): VidaExtraida => ({
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: null, escalas: [], senales: [],
})

export const correr = (extra: Partial<VidaExtraida>, frase = ''): ResultadoVida => resolverVida({ ...vacio(), ...extra }, ctx(), frase)
export const parche = (r: ResultadoVida): Record<string, string | number> =>
  (r.registros.find((x) => x.campo === 'checkin') as RegistroCheckin | undefined)?.parche ?? {}
export const aguaMl = (r: ResultadoVida): number =>
  r.registros.filter((x): x is RegistroHidratacion => x.campo === 'hidratacion').reduce((s, h) => s + h.delta_ml, 0)
/** La lectura dudosa quedó a la vista: una pregunta, un seguimiento o una nota de «no se guardó». */
export const visible = (r: ResultadoVida): boolean => !!(r.pregunta || r.seguimiento || r.descartado.length)
export const opciones = (r: ResultadoVida): string[] => (r.seguimiento ?? r.pregunta)?.opciones ?? []
