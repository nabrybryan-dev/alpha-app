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
import type { Mensaje, Microciclo } from '../../domain/types'
import {
  condicionesDeclaradas,
  type RespuestasDeEmbarazo,
} from '../../domain/nutricion/embarazo'
import { claveDe, type ItemDespensa } from '../../domain/nutricion/despensa'
import { aIso } from '../../domain/nutricion/semana'
import { borrar as borrarDeposito, leer as leerDeposito } from '../../lib/depositoAdjuntos'
import { modoNube } from '../supabase'
import { encolar } from './procesador'

// Superficie pública. Se reexporta desde aquí para que quien la usa no dependa
// de cómo esté repartido por dentro.
export type { OperacionPendiente } from './cola'
export {
  descartesPendientes,
  integrarEnCola,
  limpiarColasDeSync,
  pendientesDeSync,
} from './cola'
export { colaEnReposo, procesarCola, recuperarDescartes } from './procesador'
export { conPendientes } from './fusion'

/** La fila de `mensajes` tal como viaja a Supabase. */
function encolarFilaDeMensaje(mensaje: Mensaje): void {
  encolar({
    tabla: 'mensajes',
    tipo: 'upsert',
    payload: {
      id: mensaje.id,
      de_id: mensaje.deId,
      para_id: mensaje.paraId,
      fecha_iso: mensaje.fechaIso,
      texto: mensaje.texto,
      adjunto_path: mensaje.adjuntoPath ?? null,
      adjunto_tipo: mensaje.adjuntoTipo ?? null,
      origen: mensaje.origen ?? 'humano',
      leido: false,
    },
  })
}

/**
 * Sube el archivo y SOLO ENTONCES encola la fila del mensaje.
 *
 * Nunca lanza: que falle aquí significa "todavía no", no "se perdió". El archivo
 * se queda en el depósito y lo retoma el intento siguiente. Y no se borra hasta
 * que la fila está encolada — el mismo principio que protege las series de quien
 * entrena sin señal en un sótano.
 */
export async function subirAdjuntoPendiente(
  mensaje: Mensaje,
  subir: (path: string, blob: Blob) => Promise<unknown>,
): Promise<boolean> {
  if (!mensaje.adjuntoPath) return false
  const blob = await leerDeposito(mensaje.id)
  if (!blob) return false
  try {
    await subir(mensaje.adjuntoPath, blob)
  } catch {
    return false
  }
  encolarFilaDeMensaje(mensaje)
  await borrarDeposito(mensaje.id)
  return true
}

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

const CLAVE_TABLAS_REGISTRO = 'alpha-tablas-registro'

/**
 * Mismo interruptor que el de hidratación, para las tablas del registro de
 * comidas (migraciones 0015 y 0017).
 *
 * Sin él, en un despliegue que aún no las tenga cada alimento anotado se
 * encolaría, fallaría ocho veces y acabaría descartado. El asesorado no vería
 * ningún error: seguiría registrando con normalidad mientras su día se
 * evapora en la cola.
 *
 * Solo lo apaga un error que signifique EXACTAMENTE "esta tabla no existe".
 */
export function marcarTablaRegistro(disponible: boolean): void {
  localStorage.setItem(CLAVE_TABLAS_REGISTRO, disponible ? '1' : '0')
}

function tablasRegistroListas(): boolean {
  return localStorage.getItem(CLAVE_TABLAS_REGISTRO) !== '0'
}

/**
 * Cómo sube el registro de comidas (migración 0017).
 *
 * El id de las dos tablas lo genera el servidor, así que el móvil no lo conoce
 * hasta que la fila existe arriba — y sin conexión no existe nunca. Por eso
 * cada comida y cada ítem llevan un `cliente_id` que pone el dispositivo, y el
 * upsert resuelve el conflicto sobre ESA columna y no sobre la clave primaria.
 * Un ítem apunta a su comida por `comida_cliente_id`, y un trigger de la base
 * lo traduce al id real al insertar.
 *
 * El ORDEN importa y la cola lo respeta: la comida va antes que sus ítems. Si
 * llegara primero un ítem, el trigger no encontraría su comida y lo rechazaría.
 * Como la cola drena de una en una y se para en el primer fallo, ese orden se
 * mantiene también cuando la conexión se cae a la mitad.
 *
 * Quitar no borra: marca `borrado`. La cola no sabe hacer `delete`, y añadírselo
 * obliga a tocar el procesador, que es donde un fallo no da error en pantalla.
 */
/**
 * Sube el perfil entero tras tocarlo. Se relee de local a propósito: así viaja
 * con lo que la capa local dejó, no con lo que creyó quien llamó.
 */
/**
 * El `cliente_id` de un item de despensa: dueño + clave del dominio.
 *
 * No es aleatorio a propósito. `claveDe` devuelve el id del catálogo, o
 * `pedido:<texto normalizado>` para lo que la persona escribió a mano, así que
 * dos compras del mismo alimento —o dos veces «kefir» escrito distinto— caen en
 * el mismo id y el upsert las funde. Que el `unique (cliente_id)` de la 0024 no
 * sea parcial es lo que permite arbitrar sobre él (ver 0023).
 */
function idDeDespensa(usuarioId: string, item: ItemDespensa): string {
  return `${usuarioId}:${claveDe(item)}`
}

function subirPerfil(local: Db, usuarioId: string): void {
  const perfil = local.perfiles.byUsuario(usuarioId)
  if (!perfil) return
  encolar({
    tabla: 'perfiles',
    tipo: 'upsert',
    payload: { usuario_id: usuarioId, datos: perfil },
  })
}

export function crearDbSincronizada(local: Db): Db {
  if (!modoNube) return local

  return {
    ...local,

    perfiles: {
      ...local.perfiles,
      agregarMedida: (usuarioId, medida) => {
        local.perfiles.agregarMedida(usuarioId, medida)
        subirPerfil(local, usuarioId)
      },
      guardarValoracion: (usuarioId, valoracion) => {
        local.perfiles.guardarValoracion(usuarioId, valoracion)
        subirPerfil(local, usuarioId)
      },
      guardarPeldano: (usuarioId, peldano, ascensoIso) => {
        local.perfiles.guardarPeldano(usuarioId, peldano, ascensoIso)
        subirPerfil(local, usuarioId)
      },
    },

    microciclos: {
      ...local.microciclos,
      guardarPropuesta: (micro) => {
        local.microciclos.guardarPropuesta(micro)
        // Se sube leyendo de local y no `micro` a secas, para que viaje con el
        // `estado: 'propuesto'` que fuerza la capa local y no con el que llegara.
        subirMicrociclo(local, micro.id)
      },
      activarPropuesta: (propuestaId) => {
        // Qué microciclos estaban activos ANTES de activar: después ya no se
        // pueden distinguir de los que llevaban cerrados meses, y hay que subir su
        // cierre igual que la activación. Si solo se subiera la propuesta, el
        // servidor se quedaría con dos activos.
        const duenio = local.usuarios
          .list()
          .find((u) => local.microciclos.byUsuario(u.id).some((m) => m.id === propuestaId))
        const activosPrevios = duenio
          ? local.microciclos.byUsuario(duenio.id).filter((m) => m.estado === 'activo')
          : []

        local.microciclos.activarPropuesta(propuestaId)

        // Primero abrir, después cerrar. Si la cola se drena a medias —se corta la
        // señal justo entre las dos— este orden deja una ventana con DOS activos:
        // malo, pero el asesorado tiene algo que entrenar y la pasada siguiente lo
        // repara. Al revés la ventana tendría CERO: abriría la app sin programación.
        cambiarEstadoEnNube(propuestaId, 'activo')
        for (const m of activosPrevios) cambiarEstadoEnNube(m.id, 'cerrado')
      },
      // Las tres escrituras del asesorado suben SOLO su rama, nunca el blob.
      // Subir el microciclo entero desde el móvil pisó una migración del coach
      // el 2026-08-15: ver `subirRama` y el spec del 15 de agosto.
      registrarSerie: (microcicloId, ejercicioId, serie) => {
        local.microciclos.registrarSerie(microcicloId, ejercicioId, serie)
        subirSeries(local, microcicloId, ejercicioId)
      },
      guardarTestPost: (microcicloId, sesionId, test) => {
        local.microciclos.guardarTestPost(microcicloId, sesionId, test)
        encolar({
          tabla: 'microciclos',
          tipo: 'rpc',
          funcion: 'fijar_test_post',
          claveRpc: `${microcicloId}:${sesionId}`,
          payload: { p_microciclo_id: microcicloId, p_sesion_id: sesionId, p_test: test },
        })
      },
      marcarParte: (microcicloId, sesionId, parteId) => {
        local.microciclos.marcarParte(microcicloId, sesionId, parteId)
        subirPreparacion(local, microcicloId, sesionId)
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

    perfilNutricion: {
      ...local.perfilNutricion,
      guardar: (usuarioId, respuestas, completada) => {
        local.perfilNutricion.guardar(usuarioId, respuestas, completada)
        // Solo se sube cuando termina. A medias no vale la pena: el perfil que
        // lee la nutricionista tiene que estar entero o no estar.
        if (!completada) return
        const perfil = local.perfilNutricion.byUsuario(usuarioId)
        if (!perfil) return
        encolar({
          tabla: 'perfil_alimentario',
          tipo: 'upsert',
          payload: {
            ...aPerfilAlimentario(usuarioId, perfil.respuestas),
            // El crudo es la fuente de verdad; lo de arriba es su proyección
            // para poder consultar sin abrir el jsonb de cada uno.
            respuestas: perfil.respuestas,
            completada_en: perfil.completadaEn ?? null,
          },
        })
      },
    },

    /**
     * Lo que la nutricionista marca que alguien no debe comer.
     *
     * SUBE SIEMPRE, no solo al terminar algo: cada veto es una decisión suelta
     * y completa. Es lo contrario del perfil, que se sube entero o no se sube.
     *
     * QUITAR ES UN UPSERT CON `borrado`, no un delete: la cola solo sabe hacer
     * upsert y update (`cola.ts`). Sin la columna de la migración 0035, la
     * nutricionista quitaría un veto, lo vería desaparecer, y volvería en la
     * siguiente hidratación.
     */
    vetados: {
      ...local.vetados,
      vetar: (veto) => {
        local.vetados.vetar(veto)
        encolar({
          tabla: 'perfil_alimentario_veto',
          tipo: 'upsert',
          onConflict: 'asesorado_id,alimento_id',
          payload: {
            asesorado_id: veto.usuarioId,
            alimento_id: veto.alimentoId,
            // NUNCA null y nunca cadena vacía: son los dos valores que la base
            // rechaza, cada uno por su lado. `motivo is null or length > 0` es
            // de la 0016; el `not null` con mínimo de 3 llega con la 0040.
            //
            // El tipo obliga a traer motivo y `porQueNoValeElMotivo` lo valida
            // en la pantalla, así que llegar aquí en blanco es un error de
            // programación. Ante eso se conserva el veto con el hueco escrito,
            // no se descarta: la fila dice que esta persona no puede comer eso,
            // y perderla es volver a proponérselo.
            motivo: veto.motivo.trim() || '(sin motivo)',
            borrado: false,
          },
        })
      },
      quitar: (usuarioId, alimentoId) => {
        local.vetados.quitar(usuarioId, alimentoId)
        encolar({
          tabla: 'perfil_alimentario_veto',
          tipo: 'upsert',
          onConflict: 'asesorado_id,alimento_id',
          payload: {
            asesorado_id: usuarioId,
            alimento_id: alimentoId,
            borrado: true,
          },
        })
      },
    },

    /**
     * La despensa (migraciones 0024 y 0042).
     *
     * EL `cliente_id` SALE DE LA CLAVE DEL DOMINIO, y no es un detalle: es lo que
     * hace que volver a comprar algo REFRESQUE su fila en vez de crear otra. El
     * dominio ya decide eso en `agregar()` —«volver a comprar algo no es tenerlo
     * dos veces, es tenerlo otra vez»— y con el id derivado de `claveDe()` la
     * base aplica exactamente la misma regla a través de su unique.
     *
     * Si el id fuera aleatorio, cada compra insertaría una fila nueva y la
     * despensa crecería sola: el mismo pollo cinco veces, cinco fechas
     * distintas, y ninguna forma de saber cuál manda.
     */
    despensa: {
      ...local.despensa,
      agregar: (usuarioId, item) => {
        local.despensa.agregar(usuarioId, item)
        encolar({
          tabla: 'despensa',
          tipo: 'upsert',
          onConflict: 'cliente_id',
          payload: {
            cliente_id: idDeDespensa(usuarioId, item),
            asesorado_id: usuarioId,
            alimento_id: item.alimentoId,
            texto_pedido: item.alimentoId ? null : (item.textoPedido ?? null),
            cantidad_g: item.cantidadG,
            origen: item.origen,
            agregado_en: item.agregadoEn,
            borrado: false,
          },
        })
      },
      quitar: (usuarioId, clave) => {
        local.despensa.quitar(usuarioId, clave)
        // `update` y no `upsert`: un upsert que no encuentre la fila la
        // INSERTARÍA, y sin `alimento_id` ni `texto_pedido` chocaría contra el
        // check `despensa_alimento_o_pedido`. El update solo toca lo que existe.
        encolar({
          tabla: 'despensa',
          tipo: 'update',
          payload: { borrado: true },
          filtro: { cliente_id: `${usuarioId}:${clave}` },
        })
      },
    },

    visibilidad: {
      ...local.visibilidad,
      decidir: (decision) => {
        local.visibilidad.decidir(decision)
        encolar({
          tabla: 'visibilidad_nutricion',
          tipo: 'upsert',
          payload: {
            asesorado_id: decision.usuarioId,
            ver_composicion: decision.verComposicion,
            ver_objetivo_calorico: decision.verObjetivoCalorico,
            ver_contador_kcal: decision.verContadorKcal,
            estado: decision.estado,
            actualizado_en: new Date().toISOString(),
          },
        })
        // La nota va en su propia tabla y en su propia operación: es clínica y
        // el asesorado puede leer sus interruptores pero no esto. Separarlas en
        // la base es lo que lo garantiza -RLS es por fila, no por columna-, así
        // que aquí viajan por separado también.
        if (decision.nota === undefined) return
        encolar({
          tabla: 'visibilidad_nutricion_nota',
          tipo: 'upsert',
          payload: {
            asesorado_id: decision.usuarioId,
            motivo: decision.nota || null,
            decidido_por: decision.decididoPor ?? null,
            decidido_en: decision.decididoEn ?? null,
            actualizado_en: new Date().toISOString(),
          },
        })
      },
    },

    calibracion: {
      ...local.calibracion,
      registrar: (prueba) => {
        local.calibracion.registrar(prueba)
        if (!tablasRegistroListas()) return
        // Se lee de local para que viaje con el id que le acaba de poner la
        // capa local: ese id es su `cliente_id`, y es lo que hace que un
        // reintento no la duplique. Una prueba duplicada pesa el doble en la
        // mediana del sesgo y puede mover el veredicto entero.
        const suyas = local.calibracion.byUsuario(prueba.usuarioId)
        const nueva = suyas[suyas.length - 1]
        if (!nueva) return
        encolar({
          tabla: 'prueba_calibracion',
          tipo: 'upsert',
          onConflict: 'cliente_id',
          payload: {
            cliente_id: nueva.id,
            asesorado_id: nueva.usuarioId,
            fecha: nueva.fecha,
            alimento_id: nueva.alimentoId,
            gramos_estimados: nueva.gramosEstimados,
            gramos_reales: nueva.gramosReales,
          },
        })
      },
    },

    registroComidas: {
      ...local.registroComidas,
      abrirComida: (comida) => {
        const id = local.registroComidas.abrirComida(comida)
        if (tablasRegistroListas()) subirComida(local, comida.usuarioId, id)
        return id
      },
      editarComida: (usuarioId, comidaId, cambios) => {
        local.registroComidas.editarComida(usuarioId, comidaId, cambios)
        if (tablasRegistroListas()) subirComida(local, usuarioId, comidaId)
      },
      agregarItem: (usuarioId, comidaId, item) => {
        local.registroComidas.agregarItem(usuarioId, comidaId, item)
        if (!tablasRegistroListas()) return
        // Se lee de local en vez de usar `item`: así viaja con el id que le
        // acaba de poner la capa local, que es el `cliente_id` de la fila.
        const guardada = comidaDe(local, usuarioId, comidaId)
        const nuevo = guardada?.items[guardada.items.length - 1]
        if (!guardada || !nuevo) return
        encolar({
          tabla: 'registro_item',
          tipo: 'upsert',
          onConflict: 'cliente_id',
          payload: {
            cliente_id: nuevo.id,
            comida_cliente_id: guardada.id,
            alimento_id: nuevo.alimentoId,
            gramos: nuevo.gramos,
            fue_pesado: nuevo.fuePesado,
            estado_asumido: nuevo.estadoAsumido,
            borrado: false,
          },
        })
      },
      quitarItem: (usuarioId, comidaId, itemId) => {
        local.registroComidas.quitarItem(usuarioId, comidaId, itemId)
        if (!tablasRegistroListas()) return
        encolar({
          tabla: 'registro_item',
          tipo: 'update',
          payload: { borrado: true },
          filtro: { cliente_id: itemId },
        })
      },
      borrarComida: (usuarioId, comidaId) => {
        local.registroComidas.borrarComida(usuarioId, comidaId)
        if (!tablasRegistroListas()) return
        encolar({
          tabla: 'registro_comida',
          tipo: 'update',
          payload: { borrado: true },
          filtro: { cliente_id: comidaId },
        })
      },
      recordarPreferencia: (preferencia) => {
        local.registroComidas.recordarPreferencia(preferencia)
        if (!tablasRegistroListas()) return
        encolar({
          tabla: 'preferencia_estado',
          tipo: 'upsert',
          payload: {
            asesorado_id: preferencia.usuarioId,
            familia: preferencia.familia,
            estado: preferencia.estado,
          },
        })
      },
    },

    mensajes: {
      ...local.mensajes,
      /**
       * Un mensaje de solo texto se encola al momento. Uno CON adjunto no:
       * espera a que el archivo esté arriba.
       *
       * El orden importa. Si la fila subiera primero, el coach vería en su hilo
       * un mensaje con foto y al tocarlo no habría nada —el archivo todavía
       * estaría en el teléfono de la otra persona, o no llegaría nunca—. Quien
       * encola esa fila es `encolarFilaDeMensaje`, ya con el path.
       */
      enviar: (mensaje) => {
        local.mensajes.enviar(mensaje)
        if (mensaje.adjuntoTipo) return
        const hilo = local.mensajes.hilo(mensaje.deId, mensaje.paraId)
        encolarFilaDeMensaje(hilo[hilo.length - 1])
      },
      anotarPath: (mensajeId, path) => {
        local.mensajes.anotarPath(mensajeId, path)
      },
      marcarAdjuntoListo: (mensajeId) => {
        local.mensajes.marcarAdjuntoListo(mensajeId)
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

/** La comida guardada, buscándola por el día al que pertenece su id. */
function comidaDe(local: Db, usuarioId: string, comidaId: string) {
  // El id del cliente lleva dentro el momento, pero no la fecha: se busca en el
  // día de la comida, que es lo que `delDia` sabe filtrar.
  for (const fecha of fechasCercanas()) {
    const encontrada = local.registroComidas
      .delDia(usuarioId, fecha)
      .find((c) => c.id === comidaId)
    if (encontrada) return encontrada
  }
  return undefined
}

/** Ayer, hoy y mañana. Una comida se registra el día que se come o el siguiente
 *  de madrugada; más lejos no hace falta mirar. */
function fechasCercanas(): string[] {
  const hoy = new Date()
  return [-1, 0, 1].map((delta) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + delta)
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    return `${d.getFullYear()}-${mes}-${String(d.getDate()).padStart(2, '0')}`
  })
}

/** Lo que se responde en la encuesta, en las columnas de la migración 0016. */
function aPerfilAlimentario(
  usuarioId: string,
  respuestas: Record<string, string | number | string[]>,
): Record<string, unknown> {
  /**
   * Un texto libre entra como lista de un elemento.
   *
   * `sin_acceso` y `no_le_gustan` son `text[]` en la base porque nacieron para
   * casillas. La encuesta los pregunta abiertos —"¿qué no consigues?"— y meter
   * la frase entera como un elemento conserva lo que la persona escribió sin
   * inventarse una separación por comas que ella no hizo.
   */
  const comoLista = (valor: unknown): string[] | null => {
    if (Array.isArray(valor)) return valor.length > 0 ? valor : null
    if (typeof valor === 'string' && valor.trim()) return [valor.trim()]
    return null
  }

  const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor : null)

  /**
   * Lo que declaró de su puño y letra, MÁS las condiciones que se deducen.
   *
   * EL HUECO QUE ESTO CIERRA. El motor de recomendaciones veta el hígado en
   * embarazo leyendo `PerfilAlimentario.condiciones_medicas`
   * (`topes_nutrientes.py` → `VETO_POR_CONDICION`). Esta columna se llenaba solo
   * con el texto libre de «¿tienes alguna condición médica?», así que la
   * respuesta de la pregunta de embarazo se quedaba en el jsonb y no llegaba
   * nunca: la asesorada podía declarar que estaba embarazada y el motor le
   * seguía pudiendo proponer hígado. Es el mismo fallo que el módulo de
   * embarazo vino a arreglar —lógica escrita que no protegía a nadie—, una
   * capa más abajo.
   *
   * SE RESUELVE AL SUBIR Y NO EN EL MOTOR porque la marca CADUCA: pasada la
   * fecha probable de parto deja de aplicar, y una columna no caduca sola. Al
   * escribirla aquí, cada vez que ella toca su perfil la lista se rehace con la
   * fecha de ese día. Si nunca vuelve a tocarlo se queda como estaba, que es el
   * lado prudente: sigue protegida de más, nunca de menos.
   */
  const escritasPorElla = comoLista(respuestas.condicionesMedicas) ?? []
  const condiciones = [
    ...escritasPorElla,
    ...condicionesDeclaradas(respuestas as RespuestasDeEmbarazo, aIso(new Date())),
  ]

  return {
    asesorado_id: usuarioId,
    alergias: comoLista(respuestas.alergias),
    condiciones_medicas: condiciones.length > 0 ? condiciones : null,
    excluye: comoLista(respuestas.excluye),
    no_le_gustan: comoLista(respuestas.noLeGustan),
    sin_acceso: comoLista(respuestas.sinAcceso),
    come_visceras: texto(respuestas.comeVisceras),
    lugar_compra: texto(respuestas.lugarCompra),
    frecuencia_cocina: texto(respuestas.frecuenciaCocina),
    tiene_bascula: texto(respuestas.tieneBascula),
    ciclo_menstrual: texto(respuestas.cicloMenstrual),
    actualizado_en: new Date().toISOString(),
  }
}

function subirComida(local: Db, usuarioId: string, comidaId: string): void {
  const comida = comidaDe(local, usuarioId, comidaId)
  if (!comida) return
  encolar({
    tabla: 'registro_comida',
    tipo: 'upsert',
    onConflict: 'cliente_id',
    payload: {
      cliente_id: comida.id,
      asesorado_id: comida.usuarioId,
      momento: comida.momentoIso,
      comida: comida.comida,
      cocinado_por_el: comida.cocinadoPorEl,
      aceite_g: comida.aceiteG,
      sal_g: comida.salG,
      confianza: comida.confianza,
      borrado: false,
    },
  })
}

/**
 * Cambia SOLO la columna `estado` de un microciclo en el servidor.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO ES UN `subirMicrociclo`
 * ────────────────────────────────────────────────────────────────────────────
 * Porque `subirMicrociclo` manda `datos: microciclo` —el blob entero— leído de la
 * copia LOCAL de quien lo llama. En el móvil del asesorado eso es correcto: su
 * copia es la autoridad sobre sus propias series. En el del coach no: su copia de
 * lo del asesorado es la de la última hidratación, que ocurre cada 45 s y solo con
 * la pestaña visible.
 *
 * Cerrar un microciclo con un upsert del blob significaba, entonces, mandar al
 * servidor la foto que el coach tenía en la mano. Las series que el asesorado
 * hubiera registrado después **desaparecían de la fila del servidor**, y de ahí de
 * todos los dispositivos en la siguiente hidratación. Sin error y sin aviso: el
 * upsert de Supabase reemplaza la columna entera, no fusiona.
 *
 * Un cambio de estado es una TRANSICIÓN, no una foto. Mandar solo la columna es lo
 * único que hace falta y es lo único que no puede pisar el trabajo de nadie.
 *
 * Contrapartida asumida: el `estado` que queda dentro del blob se vuelve viejo. Por
 * eso `hidratar.ts` lee la columna y le da prioridad. **Las dos mitades van juntas:
 * si alguien vuelve a leer el estado desde `datos`, esto deja de funcionar.**
 */
function cambiarEstadoEnNube(microcicloId: string, estado: 'activo' | 'cerrado'): void {
  encolar({
    tabla: 'microciclos',
    tipo: 'update',
    payload: { estado },
    filtro: { id: microcicloId },
  })
}

/**
 * El microciclo local, o `undefined` si no se encuentra a su dueño.
 *
 * Los repos son por usuario, así que para llegar a un microciclo por id hay que
 * pasar por la lista de usuarios. Lo hacían las cuatro subidas por su cuenta.
 */
function microcicloLocal(local: Db, microcicloId: string): Microciclo | undefined {
  const duenio = local.usuarios
    .list()
    .find((u) => local.microciclos.byUsuario(u.id).some((m) => m.id === microcicloId))
  if (!duenio) return undefined
  return local.microciclos.byUsuario(duenio.id).find((m) => m.id === microcicloId)
}

/**
 * Sube las series de UN ejercicio, no el microciclo.
 *
 * Manda el array completo de ese ejercicio, ya resuelto por la capa local
 * —reemplazar por `orden` y reordenar—. El servidor solo lo coloca en su sitio.
 * La regla vive en un solo lado a propósito: dos copias de una regla divergen, y
 * eso es exactamente lo que este cambio arregla.
 */
function subirSeries(local: Db, microcicloId: string, ejercicioId: string): void {
  const microciclo = microcicloLocal(local, microcicloId)
  if (!microciclo) return
  const ejercicio = microciclo.sesiones
    .flatMap((s) => s.ejercicios)
    .find((e) => e.id === ejercicioId)
  if (!ejercicio) return
  encolar({
    tabla: 'microciclos',
    tipo: 'rpc',
    funcion: 'fijar_series_ejercicio',
    claveRpc: `${microcicloId}:${ejercicioId}`,
    payload: {
      p_microciclo_id: microcicloId,
      p_ejercicio_id: ejercicioId,
      p_series: ejercicio.series,
    },
  })
}

/**
 * Sube el calentamiento y el cardio de UNA sesión, no el microciclo.
 *
 * `marcarParte` es un interruptor que además materializa la plantilla de
 * calentamiento si la sesión no la traía, así que se manda el resultado ya
 * calculado en local en vez de repetir esa lógica en SQL.
 */
function subirPreparacion(local: Db, microcicloId: string, sesionId: string): void {
  const sesion = microcicloLocal(local, microcicloId)?.sesiones.find((s) => s.id === sesionId)
  if (!sesion) return
  encolar({
    tabla: 'microciclos',
    tipo: 'rpc',
    funcion: 'fijar_preparacion_sesion',
    claveRpc: `${microcicloId}:${sesionId}`,
    payload: {
      p_microciclo_id: microcicloId,
      p_sesion_id: sesionId,
      p_preparacion: sesion.preparacion ?? null,
      p_bloques_cardio: sesion.bloquesCardio ?? null,
    },
  })
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
