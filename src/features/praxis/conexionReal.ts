import { db } from '../../data/dbInstance'
import { leerLoQuePraxisVe } from '../../data/praxis/fuente'
import { dejarPreguntaEnEspera, preguntasEnEsperaDe } from '../../data/praxis/preguntasEnEspera'
import { LECTURA_DEL_MODELO_SOBRE_MARCADAS } from '../../domain/praxis/masGrave'
import { guardarRegistro, proponerRegistro, releerRiesgo } from '../../data/praxis/registrador'
import { sesionDeFunciones } from '../../data/supabase'
import { hoyIso } from '../../lib/fecha'
import type { ConexionPraxis } from './motor/conexion'

/**
 * La conexión real de Praxis: une la escena con la capa de datos.
 *
 *   leer       → el almacén local de la persona con sesión, por la lista blanca. Solo lectura.
 *   proponer   → la Edge Function `praxis-registro`, con el JWT de la persona. No guarda.
 *   guardar    → la misma función, ruta /guardar: solo lo que la persona confirmó.
 *   preguntar  → la bandeja de «pregunta en espera» (migración 0105).
 *
 * AL REGISTRADOR VIAJA LO MÍNIMO: la frase, la hora, el agua de hoy y si la persona ve sus
 * cifras de comida. Ni el plan (el servidor lo lee él mismo con el JWT, filtrando el
 * `propuesto`), ni el check-in, ni el usuario (lo saca del token).
 *
 * Nada de aquí cambia cargas ni el plan: no hay una sola llamada a `db.microciclos` que escriba.
 */

/** `2026-10-01T18:40:05-05:00`: la hora del teléfono con su zona. */
export function horaLocalIso(d: Date = new Date()): string {
  const p = (n: number) => String(Math.abs(n)).padStart(2, '0')
  const desfase = -d.getTimezoneOffset()
  return `${hoyIso(d)}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${desfase >= 0 ? '+' : '-'}${p(Math.trunc(desfase / 60))}:${p(desfase % 60)}`
}

export function crearConexionPraxis(
  usuarioId: string, irAlFormulario: (() => void) | null, nombre: string | null = null,
  /** El interruptor de consentimiento (`masGrave.ts`). Solo las pruebas lo cambian. */
  lecturaDelModeloSobreMarcadas: boolean = LECTURA_DEL_MODELO_SOBRE_MARCADAS,
): ConexionPraxis {
  const hoy = hoyIso()
  const leer = () => leerLoQuePraxisVe(db, usuarioId, hoy)
  return {
    usuarioId,
    nombre,
    hoy,
    leer,
    proponer: async (frase, mensajeId, contexto) => {
      const ve = leer()
      return proponerRegistro(await sesionDeFunciones(), {
        frase,
        mensajeId,
        // Solo cuando la persona eligió un ejercicio con un toque: si no, no viaja.
        ...(contexto?.pantallaEjercicioId ? { pantallaEjercicioId: contexto.pantallaEjercicioId } : {}),
        ...(contexto?.charla ? { charla: contexto.charla } : {}),
        horaLocal: horaLocalIso(),
        hidratacionHoyMl: ve.hidratacionHoyMl,
        verComposicion: ve.comida ? ve.comida.verCifras : false,
      })
    },
    // Apagado, NO existe y la frase marcada no sale del teléfono. Encendido, la pantalla solo la usa si el permiso guardado es de la versión que la cubre.
    ...(lecturaDelModeloSobreMarcadas ? { releerRiesgo: async (frase: string) => releerRiesgo(await sesionDeFunciones(), frase) } : {}),
    guardar: async (p) => guardarRegistro(await sesionDeFunciones(), { ...p, horaLocal: horaLocalIso() }),
    preguntar: (p) => dejarPreguntaEnEspera({ usuarioId, ...p }),
    preguntas: () => preguntasEnEsperaDe(usuarioId),
    irAlFormulario,
  }
}
