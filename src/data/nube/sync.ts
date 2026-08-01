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
      guardarPropuesta: (micro) => {
        local.microciclos.guardarPropuesta(micro)
        // Se sube leyendo de local y no `micro` a secas, para que viaje con el
        // `estado: 'propuesto'` que fuerza la capa local y no con el que llegara.
        subirMicrociclo(local, micro.id)
      },
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

  return {
    asesorado_id: usuarioId,
    alergias: comoLista(respuestas.alergias),
    condiciones_medicas: comoLista(respuestas.condicionesMedicas),
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
