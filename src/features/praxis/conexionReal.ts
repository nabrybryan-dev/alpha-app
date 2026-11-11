import { db } from '../../data/dbInstance'
import { leerLoQuePraxisVe } from '../../data/praxis/fuente'
import { dejarPreguntaEnEspera, preguntasEnEsperaDe } from '../../data/praxis/preguntasEnEspera'
import { LECTURA_DEL_MODELO_SOBRE_MARCADAS } from '../../domain/praxis/masGrave'
import { deshacerRegistro, elegirParaDeshacer } from '../../data/praxis/deshacer'
import { aplicarAguaDePraxis, fijarTotalDelDia } from '../../data/praxis/agua'
import { guardarRegistro, proponerRegistro, releerRiesgo } from '../../data/praxis/registrador'
import { anotarPatron, camposLlenosHoy, guardarCheckinDePraxis, leerMiLexico } from '../../data/praxis/checkin'
import type { Anotacion } from '../../domain/praxis/registro/anotaciones'
import { CONECTORES_EN_TARJETA } from '../../domain/praxis/registro/tarjetaCheckin'
import { sesionDeFunciones } from '../../data/supabase'
import { hoyIso, horaLocalIso } from '../../lib/fecha'
import type { ConexionPraxis } from './motor/conexion'

/**
 * La conexión real de Praxis: une la escena con la capa de datos.
 *
 *   leer       → el almacén local de la persona con sesión, por la lista blanca. Solo lectura.
 *   proponer   → la Edge Function `praxis-registro`, con el JWT de la persona. No guarda.
 *   guardar    → la misma función, ruta /guardar: solo lo que la persona confirmó.
 *   deshacer   → la misma función, ruta /deshacer: propone y quita SOLO con el toque en «Sí, quitar».
 *   preguntar  → la bandeja de «pregunta en espera» (migración 0105).
 *
 * AL REGISTRADOR VIAJA LO MÍNIMO: la frase, la hora, el agua de hoy y si la persona ve sus
 * cifras de comida. Ni el plan (el servidor lo lee él mismo con el JWT, filtrando el
 * `propuesto`), ni el check-in, ni el usuario (lo saca del token).
 *
 * Nada de aquí cambia cargas ni el plan: no hay una sola llamada a `db.microciclos` que escriba.
 */

export { horaLocalIso }

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
        ...(contexto?.memoria ? { memoria: contexto.memoria } : {}),
        horaLocal: horaLocalIso(),
        hidratacionHoyMl: ve.hidratacionHoyMl,
        verComposicion: ve.comida ? ve.comida.verCifras : false,
      })
    },
    // Apagado, NO existe y la frase marcada no sale del teléfono. Encendido, la pantalla solo la usa si el permiso guardado es de la versión que la cubre.
    ...(lecturaDelModeloSobreMarcadas ? { releerRiesgo: async (frase: string) => releerRiesgo(await sesionDeFunciones(), frase) } : {}),
    guardar: async (p) => {
      const r = await guardarRegistro(await sesionDeFunciones(), { ...p, horaLocal: horaLocalIso() })
      if (!r.ok) return r
      // Agua por la RPC (`PRAXIS_AGUA_POR_RPC`, encendida desde el 7-nov-2026): fija el total que devuelve la base. Ver `data/praxis/agua.ts`.
      return { ok: true, resultados: await aplicarAguaDePraxis({ usuarioId, mensajeId: p.mensajeId, registros: p.registros, resultados: r.resultados }) }
    },
    deshacer: {
      elegir: async (registroId) => elegirParaDeshacer(await sesionDeFunciones(), registroId),
      // Agua deshecha: el teléfono fija el total que quedó en la base (ver `data/praxis/deshacer.ts`).
      confirmar: async (p) => deshacerRegistro(await sesionDeFunciones(), p, (fecha, ml) => fijarTotalDelDia(db.nutricion, usuarioId, fecha, ml)),
    },
    // Check-in desde lo que la persona cuenta: SOLO con la bandera encendida (hoy lo está; apagada = no existe y nada cambia).
    ...(CONECTORES_EN_TARJETA ? {
      checkin: {
        yaHoy: () => camposLlenosHoy(db.bienestar.byUsuario(usuarioId).find((c) => c.fecha === hoy)),
        lexico: () => leerMiLexico(),
        guardar: (p: Parameters<NonNullable<ConexionPraxis['checkin']>['guardar']>[0]) => guardarCheckinDePraxis({ usuarioId, ...p }),
        anotar: (p: { mensajeId: string; anotaciones: Anotacion[] }) => anotarPatron({ usuarioId, ...p }),
      },
    } : {}),
    preguntar: (p) => dejarPreguntaEnEspera({ usuarioId, ...p }),
    preguntas: () => preguntasEnEsperaDe(usuarioId),
    irAlFormulario,
  }
}
