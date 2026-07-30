/**
 * La base de datos local envuelta para que cada escritura, además de guardarse en
 * el dispositivo, salga hacia Supabase por la cola de sync.
 *
 * Este archivo es la CARA PÚBLICA del sync: el resto de la app importa siempre
 * de aquí, nunca de las piezas internas. Las tres piezas son:
 *
 *   · `cola.ts`       — la cola como estructura de datos. El único que toca
 *                       `localStorage`. Sin red.
 *   · `procesador.ts` — vaciarla contra Supabase. Aquí vive `enVuelo`.
 *   · `fusion.ts`     — el camino de lectura: filas del servidor + pendientes.
 *
 * Se partió el 2026-07-29 (antes eran 507 líneas en un solo archivo). La
 * propiedad que hay que conservar: **una sola cola y un solo procesador.** Si
 * alguna vez alguien duplica las claves de `localStorage` o el `enVuelo`, el
 * fallo no será un error en pantalla: se encolará en una cola y se drenará de la
 * otra, y las series registradas desaparecerán sin aviso.
 */
import type { Db } from '../repos'
import { modoNube } from '../supabase'
import { encolar } from './procesador'

// Superficie pública. Se reexporta desde aquí para que quien la usa no dependa
// de cómo esté repartido por dentro.
export type { OperacionPendiente } from './cola'
export { integrarEnCola, limpiarColasDeSync, pendientesDeSync } from './cola'
export { colaEnReposo, procesarCola, recuperarDescartes } from './procesador'
export { conPendientes } from './fusion'

const CLAVE_TABLA_HIDRATACION = 'alpha-tabla-hidratacion'

/**
 * La tabla `hidratacion` llegó después que el esquema inicial (migración 0003).
 * El interruptor existe para no atascar la cola con upserts imposibles si el
 * despliegue todavía no la tiene.
 *
 * Se da por buena mientras no se demuestre lo contrario, y solo la apaga un
 * error que signifique EXACTAMENTE "esta tabla no existe". Antes la apagaba
 * cualquier fallo de esa lectura: un 500 pasajero o un corte de wifi dejaba de
 * sincronizar el agua para siempre en ese dispositivo, y cada vaso se quedaba
 * encerrado en el móvil hasta que la siguiente descarga con éxito lo borrara.
 */
export function marcarTablaHidratacion(disponible: boolean): void {
  localStorage.setItem(CLAVE_TABLA_HIDRATACION, disponible ? '1' : '0')
}

function tablaHidratacionLista(): boolean {
  return localStorage.getItem(CLAVE_TABLA_HIDRATACION) !== '0'
}

export function crearDbSincronizada(local: Db): Db {
  if (!modoNube) return local

  return {
    ...local,

    perfiles: {
      ...local.perfiles,
      agregarMedida: (usuarioId, medida) => {
        local.perfiles.agregarMedida(usuarioId, medida)
        const perfil = local.perfiles.byUsuario(usuarioId)
        if (!perfil) return
        encolar({
          tabla: 'perfiles',
          tipo: 'upsert',
          payload: { usuario_id: usuarioId, datos: perfil },
        })
      },
    },

    microciclos: {
      ...local.microciclos,
      registrarSerie: (microcicloId, ejercicioId, serie) => {
        local.microciclos.registrarSerie(microcicloId, ejercicioId, serie)
        subirMicrociclo(local, microcicloId)
      },
      guardarTestPost: (microcicloId, sesionId, test) => {
        local.microciclos.guardarTestPost(microcicloId, sesionId, test)
        subirMicrociclo(local, microcicloId)
      },
      marcarParte: (microcicloId, sesionId, parteId) => {
        local.microciclos.marcarParte(microcicloId, sesionId, parteId)
        subirMicrociclo(local, microcicloId)
      },
    },

    bienestar: {
      ...local.bienestar,
      guardar: (checkin) => {
        local.bienestar.guardar(checkin)
        encolar({
          tabla: 'checkins',
          tipo: 'upsert',
          payload: {
            id: checkin.id,
            usuario_id: checkin.usuarioId,
            fecha: checkin.fecha,
            datos: checkin,
          },
        })
      },
    },

    nutricion: {
      ...local.nutricion,
      registrarHidratacion: (usuarioId, fecha, deltaMl) => {
        local.nutricion.registrarHidratacion(usuarioId, fecha, deltaMl)
        if (!tablaHidratacionLista()) return
        encolar({
          tabla: 'hidratacion',
          tipo: 'upsert',
          payload: {
            id: `hid-${usuarioId}-${fecha}`,
            usuario_id: usuarioId,
            fecha,
            ml: local.nutricion.hidratacionDe(usuarioId, fecha),
          },
        })
      },
      marcarAdherencia: (usuarioId, fecha, estado, comentario) => {
        local.nutricion.marcarAdherencia(usuarioId, fecha, estado, comentario)
        encolar({
          tabla: 'adherencias',
          tipo: 'upsert',
          payload: {
            id: `ad-${usuarioId}-${fecha}`,
            usuario_id: usuarioId,
            fecha,
            estado,
            comentario: comentario ?? null,
          },
        })
      },
    },

    mensajes: {
      ...local.mensajes,
      enviar: (mensaje) => {
        local.mensajes.enviar(mensaje)
        const hilo = local.mensajes.hilo(mensaje.deId, mensaje.paraId)
        const ultimo = hilo[hilo.length - 1]
        encolar({
          tabla: 'mensajes',
          tipo: 'upsert',
          payload: {
            id: ultimo.id,
            de_id: ultimo.deId,
            para_id: ultimo.paraId,
            fecha_iso: ultimo.fechaIso,
            texto: ultimo.texto,
            adjunto_url: ultimo.adjuntoUrl ?? null,
            origen: ultimo.origen ?? 'humano',
            leido: false,
          },
        })
      },
      /**
       * ÚNICA escritura de mensajes que NO pasa por la cola, y es a propósito.
       *
       * La fila de la respuesta de Alpha va firmada con el id del coach, y la
       * política RLS de `mensajes` es `with check (de_id = auth.uid())`: el
       * dispositivo de la asesorada NO puede insertarla. Por eso la escribe la
       * Edge Function con `service_role`, que se salta RLS, y cuando llega aquí
       * la fila ya existe en la base.
       *
       * Si además se encolara, ese upsert se rechazaría 8 veces, se descartaría
       * y —lo importante— mientras tanto bloquearía la cabeza de la cola,
       * retrasando la subida de las series y los check-ins que van detrás.
       *
       * Se pinta en local con el MISMO id que devolvió la función para que en
       * la siguiente hidratación coincida y no aparezca duplicada.
       */
      recibirDeAlpha: (mensaje) => {
        local.mensajes.recibirDeAlpha(mensaje)
      },
      marcarLeidos: (paraId, deId) => {
        local.mensajes.marcarLeidos(paraId, deId)
        encolar({
          tabla: 'mensajes',
          tipo: 'update',
          payload: { leido: true },
          filtro: { para_id: paraId, de_id: deId },
        })
      },
    },

    cuestionarios: {
      ...local.cuestionarios,
      responder: (cuestionarioId, usuarioId, valores) => {
        local.cuestionarios.responder(cuestionarioId, usuarioId, valores)
        const respuestas = local.cuestionarios.respuestasDe(usuarioId)
        const ultima = respuestas[respuestas.length - 1]
        encolar({
          tabla: 'respuestas',
          tipo: 'upsert',
          payload: {
            id: ultima.id,
            cuestionario_id: ultima.cuestionarioId,
            usuario_id: ultima.usuarioId,
            fecha_iso: ultima.fechaIso,
            valores: ultima.valores,
          },
        })
      },
    },
  }
}

function subirMicrociclo(local: Db, microcicloId: string): void {
  const duenio = local.usuarios
    .list()
    .find((u) => local.microciclos.byUsuario(u.id).some((m) => m.id === microcicloId))
  if (!duenio) return
  const microciclo = local.microciclos.byUsuario(duenio.id).find((m) => m.id === microcicloId)
  if (!microciclo) return
  encolar({
    tabla: 'microciclos',
    tipo: 'upsert',
    payload: {
      id: microciclo.id,
      usuario_id: microciclo.usuarioId,
      numero: microciclo.numero,
      estado: microciclo.estado,
      datos: microciclo,
    },
  })
}
