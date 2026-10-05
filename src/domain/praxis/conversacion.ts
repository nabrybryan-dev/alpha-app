import type { QueFalto, RespuestaDelPlan, Trato } from './plan/responder'
import { esPregunta, responderDelPlan } from './plan/responder'
import type { LoQuePraxisVe } from './plan/listaBlanca'
import type { Propuesta } from './registro/tipos'
import type { Tarjeta } from './registro/tarjeta'
import type { FiltroClinico } from './registro/filtroClinico'
import { cabeCharla } from './charla/modelo'
import { filtroDeRiesgo, type LineaDeAyuda } from './riesgo'

/**
 * El orden de un turno de Praxis, sin pantalla y sin red.
 *
 *   frase
 *     ├─ 0. SEGURIDAD: filtro de riesgo por reglas. Quieta, pregunta de cuidado o salud. FIN del turno
 *     │      (con el interruptor de `masGrave.ts` encendido, cuidado y salud además se releen con el modelo
 *     │      aparte, sin retrasar esta respuesta, y pueden SUBIR a una marca más grave).
 *     ├─ 1. ¿Es una pregunta? Se contesta del plan con reglas, sin modelo. FIN.
 *     └─ 2. Lo demás va al registrador (la Edge Function `praxis-registro`), que es el
 *            ÚNICO camino que llega a un modelo, y que vuelve a filtrar antes de llamarlo.
 *
 * `vaAlModelo` va escrito en cada salida para que la regla se pueda probar: solo
 * `registrar` lo lleva en `true`.
 */
export type Turno =
  | { paso: 'nada'; vaAlModelo: false }
  | { paso: 'quieta'; linea: LineaDeAyuda; vaAlModelo: false }
  | { paso: 'cuidado'; vaAlModelo: false }
  | { paso: 'salud'; filtro: FiltroClinico; texto: string; vaAlModelo: false }
  | { paso: 'plan'; respuesta: RespuestaDelPlan; vaAlModelo: false }
  | { paso: 'registrar'; vaAlModelo: true }

/**
 * Lo que Praxis dice cuando la frase es de salud. Es un texto OPERATIVO, no clínico: no
 * interpreta, no aconseja y no promete un aviso que hoy no existe (nada le llega a nadie
 * desde aquí todavía). Las fichas clínicas siguen en borrador hasta que las revise un
 * profesional, así que no se usan.
 */
export const SALUD_SIN_REGISTRO: Record<Trato, string> = {
  tu: 'Eso es de salud: no lo anoto como un registro ni lo interpreto. Desde aquí todavía no puedo avisarle a nadie, así que cuéntaselo a tu coach directamente. Si es urgente, llama al 123.',
  usted: 'Eso es de salud: no lo anoto como un registro ni lo interpreto. Desde aquí todavía no puedo avisarle a nadie, así que cuénteselo a su coach directamente. Si es urgente, llame al 123.',
}

export function decidirTurno(frase: string, ve: LoQuePraxisVe, hoy: string, trato: Trato = 'tu'): Turno {
  if (!frase.trim()) return { paso: 'nada', vaAlModelo: false }
  const marca = filtroDeRiesgo(frase)
  if (marca?.tipo === 'quieta') return { paso: 'quieta', linea: marca.linea, vaAlModelo: false }
  if (marca?.tipo === 'cuidado') return { paso: 'cuidado', vaAlModelo: false }
  if (marca?.tipo === 'salud') return { paso: 'salud', filtro: marca.filtro, texto: SALUD_SIN_REGISTRO[trato], vaAlModelo: false }
  if (esPregunta(frase)) return { paso: 'plan', respuesta: responderDelPlan(frase, ve, hoy, trato), vaAlModelo: false }
  return { paso: 'registrar', vaAlModelo: true }
}

/** Los textos del registrador nombran a personas; la pantalla dice el rol (decisión D6). */
export function sinNombres(texto: string, trato: Trato): string {
  const pos = trato === 'usted' ? 'su' : 'tu'
  return texto.replace(/\bBryan\b/g, `${pos} coach`).replace(/\bManuela\b/g, `${pos} nutricionista`)
}

export type FalloDelRegistrador = 'no_desplegada' | 'sin_sesion' | 'red' | 'limite' | 'no_entendi' | 'frase'

export type RespuestaDelRegistrador =
  | { ok: true; propuesta: Propuesta; tarjeta: Tarjeta; mensajeId: string; /** La respuesta de charla del modelo; solo llega cuando no hay nada que guardar. */ charla?: string }
  | { ok: false; motivo: FalloDelRegistrador }

export type PasoTrasProponer =
  | { paso: 'confirmar'; tarjeta: Tarjeta; propuesta: Propuesta; mensajeId: string }
  | { paso: 'aclarar'; texto: string; opciones: string[] }
  | { paso: 'salud'; texto: string }
  | { paso: 'quieta'; linea: LineaDeAyuda }
  | { paso: 'cuidado' }
  | { paso: 'no_se'; texto: string; queFalto: QueFalto }
  | { paso: 'dicho'; texto: string }
  | { paso: 'charla'; texto: string }
  | { paso: 'fallo'; texto: string }

const FALLOS: Record<FalloDelRegistrador, Record<Trato, string>> = {
  no_desplegada: {
    tu: 'Todavía no puedo anotar lo que me cuentas: mi registrador todavía no está encendido. Usa el formulario de siempre.',
    usted: 'Todavía no puedo anotar lo que me cuenta: mi registrador todavía no está encendido. Use el formulario de siempre.',
  },
  sin_sesion: {
    tu: 'No pude comprobar tu sesión, así que no anoté nada. Entra de nuevo a la app y vuelve a intentarlo.',
    usted: 'No pude comprobar su sesión, así que no anoté nada. Entre de nuevo a la app y vuelva a intentarlo.',
  },
  red: {
    tu: 'Se cayó la conexión y no anoté nada. Inténtalo otra vez o usa el formulario.',
    usted: 'Se cayó la conexión y no anoté nada. Inténtelo otra vez o use el formulario.',
  },
  limite: {
    tu: 'Van muchos mensajes en la última hora. No anoté este; por ahora usa el formulario.',
    usted: 'Van muchos mensajes en la última hora. No anoté este; por ahora use el formulario.',
  },
  // 502 = algo falló de MI lado (el modelo no contestó o su respuesta no se pudo leer): no es que la persona se explicara mal.
  no_entendi: { tu: 'Se me enredó algo de mi lado y no anoté nada. ¿Me lo repites o lo pasas por el formulario?', usted: 'Se me enredó algo de mi lado y no anoté nada. ¿Me lo repite o lo pasa por el formulario?' },
  frase: { tu: 'Esa frase es muy larga para anotarla de una vez. Dímela por partes.', usted: 'Esa frase es muy larga para anotarla de una vez. Dígamela por partes.' },
}

/** Qué se muestra con lo que devolvió el registrador. Nada de aquí guarda. */
export function pasoTrasProponer(r: RespuestaDelRegistrador, trato: Trato): PasoTrasProponer {
  if (!r.ok) return { paso: 'fallo', texto: FALLOS[r.motivo][trato] }
  const { propuesta, tarjeta } = r
  const t = (tu: string, usted: string) => (trato === 'usted' ? usted : tu)

  // La charla del modelo solo se dice cuando NO hay nada que guardar, preguntar ni derivar: nunca tapa una tarjeta.
  if (r.charla && cabeCharla(propuesta, { intencionCharla: true }) && tarjeta.tipo !== 'confirmacion' && tarjeta.tipo !== 'pregunta' && tarjeta.tipo !== 'derivacion') {
    return { paso: 'charla', texto: r.charla }
  }

  if (propuesta.accion === 'derivar' || tarjeta.tipo === 'derivacion') {
    // El servidor filtra con el MISMO filtro que la pantalla y dice qué marcó: se respeta tal
    // cual, para que una frase de pareja lleve a la 155 y una ambigua a la pregunta de cuidado.
    if (propuesta.riesgo?.tipo === 'quieta') return { paso: 'quieta', linea: propuesta.riesgo.linea }
    if (propuesta.riesgo?.tipo === 'cuidado') return { paso: 'cuidado' }
    // El servidor filtró algo que la pantalla dejó pasar: gana el más protector.
    if (propuesta.filtro === 'crisis' || (propuesta.urgencia === 'alta' && propuesta.filtro === 'sintoma')) return { paso: 'quieta', linea: 'vida' }
    return { paso: 'salud', texto: SALUD_SIN_REGISTRO[trato] }
  }

  if (tarjeta.tipo === 'pregunta' && tarjeta.pregunta) {
    return { paso: 'aclarar', texto: sinNombres(tarjeta.pregunta.texto, trato), opciones: tarjeta.pregunta.opciones.map((o) => sinNombres(o, trato)) }
  }

  if (tarjeta.tipo === 'confirmacion' && tarjeta.guardable && tarjeta.lineas.length > 0) {
    return { paso: 'confirmar', tarjeta, propuesta, mensajeId: r.mensajeId }
  }

  const noSe = t('Eso no lo sé con lo que tengo, y no quiero adivinar.', 'Eso no lo sé con lo que tengo, y no quiero adivinar.')
  switch (propuesta.motivo) {
    case 'consulta':
      return { paso: 'no_se', texto: noSe, queFalto: 'sin_dato' }
    case 'charla':
      return { paso: 'dicho', texto: t('Aquí estoy para tu entreno, tu comida y tu día a día. Cuéntame qué anoto o pregúntame por tu plan.', 'Aquí estoy para su entreno, su comida y su día a día. Cuénteme qué anoto o pregúnteme por su plan.') }
    case 'microciclo_vencido':
      return { paso: 'dicho', texto: t('Tu bloque de entrenamiento ya venció y el nuevo todavía no está aprobado. No lo anoto en el bloque viejo.', 'Su bloque de entrenamiento ya venció y el nuevo todavía no está aprobado. No lo anoto en el bloque viejo.') }
    case 'omitidos':
      return { paso: 'dicho', texto: 'Listo, no los marco.' }
    default:
      if (tarjeta.tipo === 'informativa' && tarjeta.mensaje) return { paso: 'dicho', texto: sinNombres(tarjeta.mensaje, trato) }
      // Sin registro y sin respuesta del modelo: no se dice «no entendí»; se pregunta por lo que sí se puede anotar.
      return { paso: 'dicho', texto: t('Eso no me quedó como algo para anotar. ¿Fue de entreno, de comida, de agua o de sueño?', 'Eso no me quedó como algo para anotar. ¿Fue de entreno, de comida, de agua o de sueño?') }
  }
}

export interface ResultadoDeRegistro { indice: number; campo: string; estado: 'guardado' | 'rechazado' | 'pendiente_prerrequisito'; motivo?: string }
export type RespuestaDeGuardar = { ok: true; resultados: ResultadoDeRegistro[] } | { ok: false; motivo: FalloDelRegistrador }

const NOMBRE_DE_CAMPO: Record<string, [string, string]> = {
  checkin: ['Tu check-in', 'Su check-in'],
  hidratacion: ['El agua', 'El agua'],
  comida: ['La comida', 'La comida'],
}

/**
 * Lo que de verdad quedó guardado, registro por registro. «Guardado» solo lo dice de lo que
 * la base aceptó: lo pendiente y lo rechazado se nombran como lo que son.
 */
export function resumenDeGuardado(r: RespuestaDeGuardar, trato: Trato): { todoGuardado: boolean; lineas: string[] } {
  if (!r.ok) return { todoGuardado: false, lineas: [`No se guardó nada. ${FALLOS[r.motivo][trato]}`] }
  if (r.resultados.length === 0) return { todoGuardado: false, lineas: ['No se guardó nada: el registrador no devolvió ningún resultado.'] }
  const usted = trato === 'usted'
  const lineas = r.resultados.map((x) => {
    if (x.estado === 'guardado') return `Guardado: ${x.campo}.`
    if (x.estado === 'pendiente_prerrequisito') {
      const nombre = NOMBRE_DE_CAMPO[x.campo]?.[usted ? 1 : 0] ?? (x.campo.startsWith('bloquesCardio') ? 'El cardio' : x.campo.startsWith('preparacion') ? 'La preparación' : 'Eso')
      return `${nombre} todavía no se puede guardar desde Praxis: ${usted ? 'anótelo' : 'anótalo'} en el formulario.`
    }
    return `No se guardó (${x.campo}): ${x.motivo ?? 'la base no lo aceptó'}.`
  })
  // M2 (revisión del PR #331): la app sube su copia local entera de las series de un
  // ejercicio y no sabe de lo que Praxis acaba de guardar. Si la persona anota otra serie de
  // ese ejercicio sin recargar, la copia vieja pisa la de Praxis. Hasta que la
  // sincronización lo resuelva, se avisa.
  if (r.resultados.some((x) => x.campo === 'series' && x.estado === 'guardado')) {
    lineas.push(`Antes de anotar más series de ese ejercicio en la pantalla de la sesión, ${usted ? 'recargue' : 'recarga'} la app: todavía no sabe de esta.`)
  }
  return { todoGuardado: r.resultados.every((x) => x.estado === 'guardado'), lineas }
}
