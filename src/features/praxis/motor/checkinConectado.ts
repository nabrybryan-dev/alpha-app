import { conectarMensaje } from '../../../domain/praxis/registro/conectores'
import { aplicarLexico, aprendizajeDeEleccion } from '../../../domain/praxis/registro/lexicoPersona'
import type { CampoCheckin } from '../../../domain/praxis/registro/mensajeLargo'
import { normalizarTexto } from '../../../domain/praxis/registro/numeros'
import { OBLIGATORIOS, armarTarjeta, siguientePregunta, type Confirmado, type Eleccion, type TarjetaCheckin } from '../../../domain/praxis/registro/tarjetaCheckin'
import type { ResultadoGuardarCheckin } from '../../../data/praxis/checkin'
import { limpiarControles } from './cabecera'
import type { ConexionPraxis } from './conexion'
import { decir, decirCorto } from './frase'
import { S } from './sesion'
import { mostrarTarjetaCheckin } from './tarjetaCheckin'

/**
 * El check-in desde lo que la persona cuenta, en la conversación de Praxis (conectores, pasos 2 a 5). Solo actúa si la
 * conexión trae `checkin` (bandera `CONECTORES_EN_TARJETA` encendida); si no, devuelve `false` y la frase sigue el camino
 * de siempre. Por reglas, en el teléfono: no llama al modelo.
 *
 *  - Si la frase tiene riesgo, NO se toma: sigue el camino de siempre (filtro, derivación, aviso al coach).
 *  - Si habla de series, kilos o agua, la deja al registrador de siempre, salvo que conteste una pregunta del check-in.
 *  - Tras anotar, pregunta UNA cosa de lo que falta y recuerda de qué preguntó, para leer la respuesta con eso.
 */
const DE_OTRO_REGISTRO = /\b(series?|reps?|repeticiones|kg|kilos?|vasos?|litros?|agua|ml|botellas?)\b/

let preguntaPendiente: CampoCheckin | null = null
let turno = 0

/** Solo para las pruebas: vuelve al estado inicial. */
export function reiniciarCheckinConectado(): void { preguntaPendiente = null; turno = 0 }

export const FRASES = {
  entendi: 'Esto entendí de tu día. Toca lo que quieras anotar.',
  anotadoCompleto: 'Listo, tu check-in de hoy quedó completo.',
  anotadoParcial: 'Anotado.',
  sinMigracion: 'Todavía no puedo guardar tu check-in desde aquí. Anótalo en el formulario.',
  noSePudo: 'No pude guardarlo. No anoté nada; inténtalo en el formulario.',
} as const

function aprendizajes(t: TarjetaCheckin, elecciones: Eleccion[]) {
  return elecciones.flatMap((e) => {
    const fila = t.filas.find((f) => f.campo === e.campo)
    const a = fila && 'valor' in e ? aprendizajeDeEleccion(fila, e.valor) : null
    return a ? [a] : []
  })
}

async function trasGuardar(c: ConexionPraxis, r: ResultadoGuardarCheckin, tok: number): Promise<void> {
  if (!r.ok) { decirCorto(r.motivo === 'sin_migracion' ? FRASES.sinMigracion : FRASES.noSePudo); return }
  if (!r.parcial) { await decir(FRASES.anotadoCompleto, tok); return }
  const llenos = c.checkin?.yaHoy() ?? []
  const sig = siguientePregunta(OBLIGATORIOS.filter((campo) => !llenos.includes(campo)), turno++)
  if (!sig) { await decir(FRASES.anotadoParcial, tok); return }
  preguntaPendiente = sig.campo
  await decir(`${FRASES.anotadoParcial} ${sig.texto}`, tok)
}

/** ¿La frase se atendió como check-in? `false` = siga el camino de siempre. Nunca lanza. */
export async function intentarCheckin(c: ConexionPraxis, frase: string, tok: number, nuevoMensaje: () => string): Promise<boolean> {
  const ck = c.checkin
  if (!ck) return false
  const pregunta = preguntaPendiente
  preguntaPendiente = null
  if (!pregunta && DE_OTRO_REGISTRO.test(normalizarTexto(frase))) return false
  const r = conectarMensaje(frase, { preguntaAnterior: pregunta })
  if (r.tipo === 'riesgo') return false
  const yaHoy = ck.yaHoy()
  const base = armarTarjeta(r, yaHoy)
  if (!base || base.filas.length === 0) return false
  const t = aplicarLexico(base, await ck.lexico().catch(() => []))
  if (tok !== S.tok) return true
  await decir(FRASES.entendi, tok)
  const mensajeId = nuevoMensaje()
  mostrarTarjetaCheckin(t, yaHoy, (confirmado: Confirmado, elecciones: Eleccion[]) => {
    limpiarControles()
    void ck.guardar({ mensajeId, confirmado, aprendizajes: aprendizajes(t, elecciones) })
      .then((res) => (tok === S.tok ? trasGuardar(c, res, tok) : undefined))
      .catch(() => decirCorto(FRASES.noSePudo))
  })
  return true
}
