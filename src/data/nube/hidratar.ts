import type {
  AdherenciaNutricional,
  CheckinDiario,
  Contenido,
  Cuestionario,
  Mensaje,
  Microciclo,
  Perfil,
  PlanNutricional,
  PremiacionCoach,
  Respuesta,
  Usuario,
} from '../../domain/types'
import type { ItemDespensaDe } from '../../domain/nutricion/despensa'
import type { FilaRanking } from '../../domain/ranking'
import type {
  PerfilNutricion,
  PreferenciaEstado,
  PruebaCalibracion,
  RegistroComida,
  RegistroHidratacion,
  RegistroItem,
  VetoAlimento,
  VisibilidadAsesorado,
} from '../../domain/types'

type EstadoGuardado = VisibilidadAsesorado['estado']
const ESTADOS: readonly EstadoGuardado[] = ['automatico', 'en_espera', 'decidido']
import { aplicarSnapshot, epocaSesion, instantaneaLocal, versionEscrituras } from '../mockDb'
import { pedirFirma, sinCambios } from './firma'
import type { SeedDb } from '../seed'
import { supabase } from '../supabase'
import { sanearMicrociclo, sanearPlan } from './saneado'
import { conPendientes, marcarTablaHidratacion, marcarTablaRegistro } from './sync'

interface FilaUsuario {
  id: string
  nombre: string
  rol: 'asesorado' | 'coach' | 'nutricionista'
  avatar_iniciales: string
}

interface FilaMensaje {
  id: string
  de_id: string
  para_id: string
  fecha_iso: string
  texto: string
  adjunto_path: string | null
  adjunto_tipo: 'imagen' | 'video' | null
  leido: boolean
  /** Columna de la migración 0012: falta mientras no se haya corrido. */
  origen?: 'humano' | 'alpha' | null
}

/**
 * Distingue "esa tabla no existe en este despliegue" de "la lectura falló
 * ahora". Postgres da `42P01` (undefined_table); PostgREST, `PGRST205` cuando
 * no la encuentra en su caché de esquema. Cualquier otra cosa —500, timeout,
 * red -— es pasajera y no debe apagar nada.
 */
function esTablaInexistente(error: { code?: string }): boolean {
  return error.code === '42P01' || error.code === 'PGRST205'
}

type Fila = Record<string, unknown>

/**
 * Los microciclos del servidor, con la COLUMNA `estado` mandando sobre el blob.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POR QUÉ LA COLUMNA Y NO `datos.estado`
 * ────────────────────────────────────────────────────────────────────────────
 * Porque el blob lo escribe el último dispositivo que suba ese microciclo, y quien
 * decide el estado (abrir el siguiente, cerrar el anterior) es solo el staff.
 *
 * El caso que lo obliga: un asesorado entrena sin señal. Cada serie deja en su cola
 * un upsert del microciclo con `estado: 'activo'` dentro. El coach cierra ese
 * microciclo y abre el siguiente. Cuando el móvil recupera cobertura, su cola drena
 * y **reabre el que ya estaba cerrado**: dos activos, y `find(m => m.estado ===
 * 'activo')` devuelve uno cualquiera. Es el estado que ya rompió producción.
 *
 * Con la columna al mando, la escritura del asesorado sigue trayendo sus series
 * —que es lo suyo y hay que conservarlo— pero deja de decidir en qué microciclo
 * está. El servidor lo refuerza con un trigger (migración 0021) para que tampoco
 * pueda tocar la columna una versión vieja de la app que siga cacheada.
 *
 * El `?? datos.estado` cubre las filas que aún no tengan columna leída (una
 * hidratación de un despliegue anterior): sin él, un `undefined` dejaría al
 * microciclo sin estado y desaparecería de todas las pantallas.
 */
export function microciclosDe(filas: readonly Fila[]): Microciclo[] {
  return filas.map((f) => {
    // `as Microciclo` es una promesa al compilador, no una garantia: las cargas
    // por SQL pueden dejar `sesiones` o `ejercicios` en null. Ver `saneado.ts`.
    const datos = sanearMicrociclo(f.datos as Microciclo)
    const estado = f.estado as Microciclo['estado'] | undefined
    return estado ? { ...datos, estado } : datos
  })
}

/**
 * Junta las comidas del servidor con sus items.
 *
 * EL ID LOCAL ES EL `cliente_id` cuando existe. Es el que puso este dispositivo
 * al crear la comida, y es el que sigue estando en la cola de sync de lo que
 * aun no ha subido: si al bajar se cambiara por el `bigint` del servidor, esas
 * operaciones pendientes apuntarian a un id que ya no existe en local y sus
 * items se quedarian huerfanos. Las filas que entraron por SQL o desde el panel
 * del coach no tienen `cliente_id`, y esas si usan el bigint.
 */
function armarComidas(comidas: Fila[], items: Fila[]): RegistroComida[] {
  const idLocal = (fila: Fila) => (fila.cliente_id as string | null) ?? String(fila.id)

  // Del id del servidor al id local, para poder colgar cada item de su comida.
  const porIdDeServidor = new Map(comidas.map((c) => [String(c.id), idLocal(c)]))

  const itemsDe = new Map<string, RegistroItem[]>()
  for (const item of items) {
    const duenio = porIdDeServidor.get(String(item.registro_id))
    // Un item cuya comida no bajo -borrada, o de otra persona- se descarta: no
    // hay donde colgarlo, y crear una comida fantasma para sostenerlo seria
    // inventar una comida que nadie registro.
    if (!duenio) continue
    const lista = itemsDe.get(duenio) ?? []
    lista.push({
      id: idLocal(item),
      alimentoId: item.alimento_id as string,
      gramos: Number(item.gramos),
      fuePesado: Boolean(item.fue_pesado),
      estadoAsumido: item.estado_asumido as RegistroItem['estadoAsumido'],
    })
    itemsDe.set(duenio, lista)
  }

  return comidas.map((c): RegistroComida => {
    const id = idLocal(c)
    return {
      id,
      usuarioId: c.asesorado_id as string,
      momentoIso: String(c.momento),
      comida: c.comida as RegistroComida['comida'],
      cocinadoPorEl: Boolean(c.cocinado_por_el),
      // `null` sobrevive: significa "no se pregunto", que es distinto de un 0
      // -"no le puse"-. Un `Number(null)` los habria vuelto lo mismo.
      aceiteG: c.aceite_g === null ? null : Number(c.aceite_g),
      salG: c.sal_g === null ? null : Number(c.sal_g),
      confianza: c.confianza as RegistroComida['confianza'],
      items: itemsDe.get(id) ?? [],
    }
  })
}

/** Una fila de la vista `checkins_nutricion` (migraciones 0013 y 0039). */
export interface FilaCheckinNutricion {
  id: string
  usuario_id: string
  fecha: string
  peso_kg: number | string | null
  hambre: string | null
  alimentacion: string | null
  hambre_escala: number | string | null
}

/**
 * Los check-ins enteros con los recortados de la vista rellenando los huecos.
 *
 * Quien puede leer la fila entera la recibe entera: para el asesorado y el coach
 * esto no cambia nada, porque la vista les devuelve las mismas filas que la tabla
 * y la entera gana siempre. Quien NO puede —la nutricionista, desde que la 0013
 * cierre `checkins_lee_staff` a `es_coach()`— solo recibe de la tabla sus propios
 * check-ins, y de la vista los cuatro campos nutricionales de los demás.
 *
 * El orden importa y es el bug fácil: si el recorte se aplicara DESPUÉS, pisaría
 * las filas enteras y dejaría a todo el mundo sin ánimo, sueño ni comentarios.
 * Por eso los recortados van primero al mapa y los enteros encima.
 *
 * Los campos que la vista no trae quedan `undefined`, no vacíos ni en cero:
 * `CheckinDiario` los tiene todos opcionales y «no me lo dieron» no es «lo
 * respondió y salió cero».
 */
export function fusionarCheckins(
  enteros: readonly CheckinDiario[],
  recortados: readonly FilaCheckinNutricion[],
): CheckinDiario[] {
  const porId = new Map<string, CheckinDiario>()

  for (const f of recortados) {
    porId.set(f.id, {
      id: f.id,
      usuarioId: f.usuario_id,
      fecha: f.fecha,
      ...(f.peso_kg === null ? {} : { pesoKg: Number(f.peso_kg) }),
      ...(f.hambre === null ? {} : { hambre: f.hambre as CheckinDiario['hambre'] }),
      ...(f.hambre_escala === null ? {} : { hambreEscala: Number(f.hambre_escala) }),
      ...(f.alimentacion === null
        ? {}
        : { alimentacion: f.alimentacion as CheckinDiario['alimentacion'] }),
    })
  }
  for (const c of enteros) porId.set(c.id, c)

  return [...porId.values()]
}

export async function hidratarDesdeNube(): Promise<void> {
  const sb = supabase()

  // Marca de agua: todo lo que se escriba de aquí en adelante es MÁS NUEVO que
  // la foto que estamos a punto de pedir. Ver la comprobación al aplicarla.
  const versionAlEmpezar = versionEscrituras()
  // Y de qué sesión es esta descarga: si por el medio se cierra o entra otra
  // persona, lo que baje aquí ya no le pertenece a nadie que esté dentro.
  const epocaAlEmpezar = epocaSesion()

  /**
   * Quién está mirando. Decide cuánto historial se baja.
   *
   * Con `?.` y `catch` porque no todos los clientes que llegan aquí traen
   * `auth` —los dobles de las pruebas, sin ir más lejos—. Sin id no se filtra y
   * se baja todo, que es el comportamiento de siempre: fallar aquí tiene que
   * costar tráfico, nunca datos que falten.
   */
  let miId: string | undefined
  try {
    const { data } = await sb.auth.getSession()
    miId = data?.session?.user?.id
  } catch {
    miId = undefined
  }

  /**
   * Antes de bajar nada: preguntar si hay algo que bajar.
   *
   * Las 21 consultas de abajo no llevan `LIMIT`, así que traen todo lo que RLS
   * deje ver. Para un asesorado es poco; para el coach, `es_coach()` es cierto
   * y RLS no acota nada: cada refresco se lleva la cartera entera, cada 45
   * segundos y por pestaña abierta. Y casi siempre para encontrarse lo mismo.
   *
   * La firma cuesta una consulta pequeña y dice si alguna tabla cambió. Si
   * ninguna cambió, esta función NO ESCRIBE NADA: se va antes de construir el
   * snapshot, así que no hay forma de que un salto borre nada. Es todo o nada a
   * propósito; saltarse tablas sueltas exige mezclar con lo local y con la cola
   * de pendientes, y ahí es donde este archivo ya perdió datos dos veces.
   *
   * `pedirFirma` devuelve `undefined` si el RPC no existe -la 0049 sin
   * aplicar-, y entonces se descarga como siempre. Fallar tiene que costar
   * rendimiento, nunca frescura.
   */
  const firmaPrevia = instantaneaLocal().firmaSync
  const firmaPendiente = pedirFirma(sb)

  // Solo se ESPERA la firma cuando hay una previa contra la que compararla. En
  // la primera carga de la sesión no hay nada que comparar, así que esperarla
  // sería un viaje de ida y vuelta de más justo cuando la persona está mirando
  // la pantalla de carga. Sin previa se pide igual -hace falta para guardarla-
  // pero en paralelo con las lecturas, y no cuesta latencia.
  if (firmaPrevia) {
    const firmaAhora = await firmaPendiente
    if (firmaAhora && sinCambios(firmaAhora, firmaPrevia)) return
  }

  const [
    usuarios,
    perfiles,
    microciclos,
    checkins,
    checkinsNutricion,
    adherencias,
    planes,
    mensajes,
    cuestionarios,
    respuestas,
    contenidos,
    premiaciones,
  ] = await Promise.all([
    // Columnas necesarias para UI: id, nombre, rol, avatar
    sb.from('usuarios_app').select('id,nombre,rol,avatar_iniciales'),
    sb.from('perfiles').select('datos'),
    // `id` y `estado` además del blob: ver `microciclosDe` más abajo.
    // El staff NO se baja los cerrados de toda la cartera: hoy son el 78 % del
    // peso y crecen sin freno —cada asesorado cierra uno por semana, para
    // siempre—. Se traen los estados que las pantallas de cartera miran de
    // verdad (`activo` para el semáforo, `propuesto` porque
    // `propuestaPreparada` lo busca) más TODO lo de quien mira, que es lo que
    // necesitan sus propias pantallas de logros y progreso.
    //
    // El historial ajeno se pide a demanda: `db.microciclos.historialDe`.
    // Ver `docs/specs/2026-08-27-donde-truena-a-mil-usuarios.md`.
    miId
      ? sb
          .from('microciclos')
          .select('id, estado, datos')
          .or(`estado.in.(activo,propuesto),usuario_id.eq.${miId}`)
      : sb.from('microciclos').select('id, estado, datos'),
    sb.from('checkins').select('datos'),
    // Migración 0013, ampliada por la 0039. La nutricionista NO lee la tabla de
    // arriba —ahí viven ánimo, estrés, sueño y comentarios libres, que no son
    // asunto de nutrición— y esta vista le da las cuatro columnas que sí lo son.
    //
    // Se piden las DOS a todo el mundo en vez de mirar el rol: saber el rol
    // exigiría una consulta previa, y eso es una cascada en la descarga que abre
    // `SIGNED_IN` cada vez que alguien desbloquea el móvil entre series. Al
    // fusionar gana la fila entera, así que para el asesorado y el coach esto es
    // un no-op: solo cambia lo de quien no puede ver la fila entera.
    sb.from('checkins_nutricion').select('id,usuario_id,fecha,peso_kg,hambre,alimentacion,hambre_escala'),
    sb.from('adherencias').select('id,usuario_id,fecha,estado,comentario'),
    sb.from('planes_nutricionales').select('datos'),
    sb.from('mensajes').select('id,de_id,para_id,fecha_iso,texto,adjunto_path,adjunto_tipo,leido,origen'),
    sb.from('cuestionarios').select('id,datos,asignado_a'),
    sb.from('respuestas').select('id,cuestionario_id,usuario_id,fecha_iso,valores'),
    sb.from('contenidos').select('datos'),
    sb.from('premiaciones').select('id,usuario_id,titulo,fecha,nota'),
  ])

  // `checkinsNutricion` entra en la lista a propósito, aunque para el asesorado y
  // el coach sea redundante: si la vista falla, la nutricionista se queda sin
  // ningún check-in y no lo sabría. Un error a gritos es mejor que una pantalla
  // vacía que parece decir «esta gente no ha registrado nada». La vista existe
  // desde la 0013 y está concedida a `authenticated`, así que fallar aquí
  // significa que algo está roto de verdad.
  const primerError = [usuarios, perfiles, microciclos, checkins, checkinsNutricion, adherencias, planes, mensajes, cuestionarios, respuestas, contenidos, premiaciones].find((r) => r.error)
  if (primerError?.error) {
    throw new Error(`No se pudo descargar tus datos: ${primerError.error.message}`)
  }

  // Tabla posterior al esquema inicial (migración 0003): si aún no existe,
  // la app sigue funcionando y la hidratación queda solo en el dispositivo.
  //
  // Solo un "esta tabla no existe" apaga la sincronización. Un 500 pasajero o
  // un corte de wifi NO son eso, y apagarla por ellos dejaba cada vaso de agua
  // encerrado en el móvil de por vida.
  const hidratacion = await sb.from('hidratacion').select('id,usuario_id,fecha,ml')
  if (!hidratacion.error) marcarTablaHidratacion(true)
  else if (esTablaInexistente(hidratacion.error)) marcarTablaHidratacion(false)

  // Registro de comidas (migraciones 0015 y 0017). Mismo trato que la
  // hidratación: si el despliegue todavía no las tiene, la app sigue andando y
  // lo registrado se queda en el dispositivo hasta que se apliquen.
  const perfilesNutricion = await sb
    .from('perfil_alimentario')
    .select('asesorado_id, respuestas, completada_en')

  const [comidas, items, preferencias, calibraciones, visibilidades, vetos, despensa] =
    await Promise.all([
    sb.from('registro_comida').select('id,cliente_id,asesorado_id,momento,comida,cocinado_por_el,aceite_g,sal_g,confianza').eq('borrado', false),
    sb.from('registro_item').select('id,cliente_id,registro_id,alimento_id,gramos,fue_pesado,estado_asumido').eq('borrado', false),
    sb.from('preferencia_estado').select('asesorado_id,familia,estado'),
    sb.from('prueba_calibracion').select('id,cliente_id,asesorado_id,fecha,alimento_id,gramos_estimados,gramos_reales'),
    // Migración 0018. El asesorado SÍ puede leer los suyos —la política
    // `visibilidad_lee_lo_suyo` existe justo para esto— y sin bajarlos su app no
    // sabe qué pintarle: le enseñaría todo a quien pidió no verlo. Y sin esta
    // línea la decisión desaparecía también del dispositivo del staff, porque
    // `aplicarSnapshot` reemplaza la base local entera.
    sb.from('visibilidad_nutricion').select('asesorado_id,ver_composicion,ver_objetivo_calorico,ver_contador_kcal,estado'),
    // Migración 0016, con el `borrado` de la 0035. La asesorada NO los lee
    // -son criterio clínico sobre ella, no suyo- pero su app SÍ los necesita
    // para no proponerle en 'Mi plan' lo que no puede comer, así que la
    // política de staff-y-dueño de la 0016 los deja bajar a las dos.
    sb.from('perfil_alimentario_veto').select('id,asesorado_id,alimento_id,motivo').eq('borrado', false),
    // Migraciones 0024 y 0042. Solo lo vivo: lo que se sacó de la despensa se
    // conserva arriba —la cola no sabe borrar— pero no vuelve al dispositivo.
    sb.from('despensa').select('id,asesorado_id,alimento_id,texto_pedido,cantidad_g,agregado_en,origen').eq('borrado', false),
  ])

  /**
   * Si las tablas no responden, NO se baja nada: se conserva lo local.
   *
   * `aplicarSnapshot` reemplaza la base del dispositivo entera. Poner aqui una
   * lista vacia porque la migracion aun no esta aplicada borraria el desayuno
   * que la persona acaba de anotar, y en la escritura siguiente la perdida
   * seria definitiva. Es el mismo fallo que ya costo dos veces en este repo.
   */
  const registroDisponible = !comidas.error && !items.error
  if (comidas.error && esTablaInexistente(comidas.error)) marcarTablaRegistro(false)
  else if (registroDisponible) marcarTablaRegistro(true)
  const local = registroDisponible ? undefined : instantaneaLocal()

  // RPC del ranking (migración 0004): también opcional. Devuelve SOLO
  // cumplimiento agregado por asesorado, nunca datos personales.
  const ranking = await sb.rpc('ranking_disciplina')

  const snapshot: SeedDb = {
    // Lo que el servidor decia justo antes de esta descarga. Se guarda DESPUES
    // de pedir los datos y no antes: si algo cambiara en medio, la firma vieja
    // obliga a repetir en el refresco siguiente, que es el lado seguro.
    firmaSync: await firmaPendiente,
    usuarios: ((usuarios.data ?? []) as FilaUsuario[]).map(
      (u): Usuario => ({
        id: u.id,
        nombre: u.nombre,
        rol: u.rol,
        avatarIniciales: u.avatar_iniciales || u.nombre.slice(0, 2).toUpperCase(),
      }),
    ),
    perfiles: conPendientes('perfiles', perfiles.data ?? []).map((f) => f.datos as Perfil),
    microciclos: microciclosDe(conPendientes('microciclos', microciclos.data ?? [])),
    checkins: fusionarCheckins(
      conPendientes('checkins', checkins.data ?? []).map((f) => f.datos as CheckinDiario),
      (checkinsNutricion.data ?? []) as FilaCheckinNutricion[],
    ),
    adherencias: conPendientes('adherencias', adherencias.data ?? []).map(
      (f): AdherenciaNutricional => ({
        id: f.id as string,
        usuarioId: f.usuario_id as string,
        fecha: f.fecha as string,
        estado: f.estado as AdherenciaNutricional['estado'],
        comentario: (f.comentario as string | null) ?? undefined,
      }),
    ),
    hidratacion: conPendientes(
      'hidratacion',
      hidratacion.error ? [] : (hidratacion.data ?? []),
    ).map(
      (f): RegistroHidratacion => ({
        id: f.id as string,
        usuarioId: f.usuario_id as string,
        fecha: f.fecha as string,
        ml: (f.ml as number) ?? 0,
      }),
    ),
    ranking: ranking.error
      ? []
      : ((ranking.data ?? []) as Record<string, unknown>[]).map(
          (f): FilaRanking => ({
            usuarioId: f.usuario_id as string,
            nombre: f.nombre as string,
            iniciales: f.iniciales as string,
            sesionesCompletas: (f.sesiones_completas as number) ?? 0,
            diasCumplidos: (f.dias_cumplidos as number) ?? 0,
            checkins: (f.checkins as number) ?? 0,
            // Columnas de la migración 0005; 0 mientras la RPC vieja siga activa.
            seriesRegistradas: (f.series_registradas as number) ?? 0,
            ejerciciosProgresados: (f.ejercicios_progresados as number) ?? 0,
            preguntas: (f.preguntas as number) ?? 0,
            puntos: (f.puntos as number) ?? 0,
          }),
        ),
    planes: (planes.data ?? []).map((f) => sanearPlan(f.datos as PlanNutricional)),
    mensajes: conPendientes('mensajes', (mensajes.data ?? []) as FilaMensaje[]).map(
      (m): Mensaje => ({
        id: m.id,
        deId: m.de_id,
        paraId: m.para_id,
        fechaIso: m.fecha_iso,
        texto: m.texto,
        adjuntoPath: m.adjunto_path ?? undefined,
        adjuntoTipo: m.adjunto_tipo ?? undefined,
        // Lo que baja de la nube ya subió por definición: `adjuntoEstado` solo
        // describe el archivo que sigue esperando en ESTE teléfono.
        adjuntoEstado: m.adjunto_path ? 'listo' : undefined,
        origen: m.origen ?? 'humano',
        leido: m.leido,
      }),
    ),
    cuestionarios: (cuestionarios.data ?? []).map((f) => ({
      ...(f.datos as Cuestionario),
      id: f.id as string,
      asignadoA: (f.asignado_a as string[]) ?? [],
    })),
    respuestas: conPendientes('respuestas', respuestas.data ?? []).map(
      (f): Respuesta => ({
        id: f.id as string,
        cuestionarioId: f.cuestionario_id as string,
        usuarioId: f.usuario_id as string,
        fechaIso: f.fecha_iso as string,
        valores: f.valores as Record<string, string>,
      }),
    ),
    // Si la tabla no responde -migración sin aplicar- se conserva lo local en
    // vez de escribir una lista vacía encima: es la encuesta que la persona
    // acaba de responder.
    perfilesNutricion: perfilesNutricion.error
      ? (instantaneaLocal().perfilesNutricion ?? [])
      : (perfilesNutricion.data ?? [])
          .filter((f) => f.respuestas)
          .map(
            (f): PerfilNutricion => ({
              usuarioId: f.asesorado_id as string,
              respuestas: f.respuestas as PerfilNutricion['respuestas'],
              completadaEn: (f.completada_en as string | null) ?? undefined,
            }),
          ),
    // Si la tabla no responde se conserva lo local, por lo mismo que arriba: una
    // lista vacía aquí le encendería a alguien las cifras que se le apagaron.
    // Si la tabla no responde se conserva lo local: una lista vacía aquí le
    // propondría a alguien justo lo que su nutricionista le prohibió.
    vetosAlimentarios: vetos.error
      ? (instantaneaLocal().vetosAlimentarios ?? [])
      : (vetos.data ?? []).map(
          (f): VetoAlimento => ({
            usuarioId: f.asesorado_id as string,
            alimentoId: f.alimento_id as string,
            // Vacío, no ausente: el tipo exige el campo, y la pantalla ya pinta
            // «Sin motivo anotado» cuando no hay texto. Así una fila vieja se ve
            // como lo que es -un veto sin explicación- sin inventarle una.
            //
            // Y se CONSERVA, que es lo que importa: descartarla sería lo cómodo
            // y es lo peligroso, porque dice que esta persona no puede comer eso
            // y perderla es volver a proponérselo. La seguridad va primero en la
            // jerarquía; la trazabilidad, después.
            //
            // Hoy no existe ninguna así: la tabla está en 0 filas y con la 0040
            // aplicada no podrá haberla.
            motivo: (f.motivo as string | null) ?? '',
          }),
        ),
    /**
     * Si la tabla no responde, se CONSERVA lo local.
     *
     * `aplicarSnapshot` reemplaza la base del dispositivo entera, así que poner
     * aquí una lista vacía porque la 0024 aún no esté aplicada borraría lo que
     * la persona acaba de meter en su despensa — y con la escritura siguiente,
     * la pérdida sería definitiva. Es el mismo fallo que ya costó dos veces en
     * este repo, y por eso todas las tablas posteriores al esquema inicial
     * bajan con este mismo `error ? local : servidor`.
     *
     * `conPendientes` pone encima lo que este dispositivo escribió y todavía no
     * ha subido: sin ella, la foto del servidor —leída ANTES de que la persona
     * marcara lo que compró— volvería a local y se llevaría por delante esa
     * compra.
     */
    despensa: despensa.error
      ? (instantaneaLocal().despensa ?? [])
      : conPendientes('despensa', despensa.data ?? []).map(
          (f): ItemDespensaDe => ({
            usuarioId: f.asesorado_id as string,
            alimentoId: (f.alimento_id as string | null) ?? null,
            ...(f.texto_pedido === null ? {} : { textoPedido: f.texto_pedido as string }),
            // `null` sobrevive: significa «no dijo cuánto», que no es lo mismo
            // que cero. Un `Number(null)` los habría vuelto lo mismo.
            cantidadG: f.cantidad_g === null ? null : Number(f.cantidad_g),
            agregadoEn: f.agregado_en as string,
            origen: f.origen as ItemDespensaDe['origen'],
          }),
        ),
    visibilidades: visibilidades.error
      ? (instantaneaLocal().visibilidades ?? [])
      : conPendientes('visibilidad_nutricion', visibilidades.data ?? []).map(
          (f): VisibilidadAsesorado => ({
            usuarioId: f.asesorado_id as string,
            verComposicion: Boolean(f.ver_composicion),
            verObjetivoCalorico: Boolean(f.ver_objetivo_calorico),
            verContadorKcal: Boolean(f.ver_contador_kcal),
            // Un estado que no reconocemos -fila corrupta, versión futura- se
            // trata como "nadie ha decidido" en vez de colarse como decisión.
            estado: ESTADOS.includes(f.estado as EstadoGuardado)
              ? (f.estado as EstadoGuardado)
              : 'automatico',
          }),
        ),
    pruebasCalibracion: calibraciones.error
      ? (instantaneaLocal().pruebasCalibracion ?? [])
      : (calibraciones.data ?? []).map(
          (f): PruebaCalibracion => ({
            id: (f.cliente_id as string | null) ?? String(f.id),
            usuarioId: f.asesorado_id as string,
            fecha: String(f.fecha),
            alimentoId: f.alimento_id as string,
            gramosEstimados: Number(f.gramos_estimados),
            gramosReales: Number(f.gramos_reales),
          }),
        ),
    registrosComida: registroDisponible
      ? armarComidas(comidas.data ?? [], items.data ?? [])
      : (local?.registrosComida ?? []),
    preferenciasEstado: preferencias.error
      ? (local?.preferenciasEstado ?? [])
      : (preferencias.data ?? []).map(
      (f): PreferenciaEstado => ({
        usuarioId: f.asesorado_id as string,
        familia: f.familia as string,
        estado: f.estado as PreferenciaEstado['estado'],
      }),
    ),
    contenidos: (contenidos.data ?? []).map((f) => f.datos as Contenido),
    premiaciones: (premiaciones.data ?? []).map(
      (f): PremiacionCoach => ({
        id: f.id as string,
        usuarioId: f.usuario_id as string,
        titulo: f.titulo as string,
        fecha: f.fecha as string,
        nota: (f.nota as string | null) ?? undefined,
      }),
    ),
  }

  // La descarga tardó lo que tardó el wifi del gimnasio, y en ese rato la
  // persona pudo guardar una serie o un check-in. `aplicarSnapshot` REEMPLAZA
  // la base local entera, así que aplicar ahora una foto anterior a esa
  // pulsación la borraría —y en la escritura siguiente la pérdida se volvería
  // definitiva, porque el envío se reconstruye leyendo el estado ya pisado.
  //
  // Se prefiere quedarse un momento desactualizado antes que perder un dato:
  // la hidratación se repite sola (al volver a la pestaña, cada 45 s en el
  // staff, en el siguiente SIGNED_IN).
  if (versionEscrituras() !== versionAlEmpezar) return

  aplicarSnapshot(snapshot, epocaAlEmpezar)
}
