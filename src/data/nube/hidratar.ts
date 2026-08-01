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
import type { FilaRanking } from '../../domain/ranking'
import type {
  PerfilNutricion,
  PreferenciaEstado,
  RegistroComida,
  RegistroHidratacion,
  RegistroItem,
} from '../../domain/types'
import { aplicarSnapshot, epocaSesion, instantaneaLocal, versionEscrituras } from '../mockDb'
import type { SeedDb } from '../seed'
import { supabase } from '../supabase'
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
  adjunto_url: string | null
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

export async function hidratarDesdeNube(): Promise<void> {
  const sb = supabase()

  // Marca de agua: todo lo que se escriba de aquí en adelante es MÁS NUEVO que
  // la foto que estamos a punto de pedir. Ver la comprobación al aplicarla.
  const versionAlEmpezar = versionEscrituras()
  // Y de qué sesión es esta descarga: si por el medio se cierra o entra otra
  // persona, lo que baje aquí ya no le pertenece a nadie que esté dentro.
  const epocaAlEmpezar = epocaSesion()

  const [
    usuarios,
    perfiles,
    microciclos,
    checkins,
    adherencias,
    planes,
    mensajes,
    cuestionarios,
    respuestas,
    contenidos,
    premiaciones,
  ] = await Promise.all([
    sb.from('usuarios_app').select('*'),
    sb.from('perfiles').select('datos'),
    sb.from('microciclos').select('datos'),
    sb.from('checkins').select('datos'),
    sb.from('adherencias').select('*'),
    sb.from('planes_nutricionales').select('datos'),
    sb.from('mensajes').select('*'),
    sb.from('cuestionarios').select('*'),
    sb.from('respuestas').select('*'),
    sb.from('contenidos').select('datos'),
    sb.from('premiaciones').select('*'),
  ])

  const primerError = [usuarios, perfiles, microciclos, checkins, adherencias, planes, mensajes, cuestionarios, respuestas, contenidos, premiaciones].find((r) => r.error)
  if (primerError?.error) {
    throw new Error(`No se pudo descargar tus datos: ${primerError.error.message}`)
  }

  // Tabla posterior al esquema inicial (migración 0003): si aún no existe,
  // la app sigue funcionando y la hidratación queda solo en el dispositivo.
  //
  // Solo un "esta tabla no existe" apaga la sincronización. Un 500 pasajero o
  // un corte de wifi NO son eso, y apagarla por ellos dejaba cada vaso de agua
  // encerrado en el móvil de por vida.
  const hidratacion = await sb.from('hidratacion').select('*')
  if (!hidratacion.error) marcarTablaHidratacion(true)
  else if (esTablaInexistente(hidratacion.error)) marcarTablaHidratacion(false)

  // Registro de comidas (migraciones 0015 y 0017). Mismo trato que la
  // hidratación: si el despliegue todavía no las tiene, la app sigue andando y
  // lo registrado se queda en el dispositivo hasta que se apliquen.
  const perfilesNutricion = await sb
    .from('perfil_alimentario')
    .select('asesorado_id, respuestas, completada_en')

  const [comidas, items, preferencias] = await Promise.all([
    sb.from('registro_comida').select('*').eq('borrado', false),
    sb.from('registro_item').select('*').eq('borrado', false),
    sb.from('preferencia_estado').select('*'),
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
    usuarios: ((usuarios.data ?? []) as FilaUsuario[]).map(
      (u): Usuario => ({
        id: u.id,
        nombre: u.nombre,
        rol: u.rol,
        avatarIniciales: u.avatar_iniciales || u.nombre.slice(0, 2).toUpperCase(),
      }),
    ),
    perfiles: conPendientes('perfiles', perfiles.data ?? []).map((f) => f.datos as Perfil),
    microciclos: conPendientes('microciclos', microciclos.data ?? []).map(
      (f) => f.datos as Microciclo,
    ),
    checkins: conPendientes('checkins', checkins.data ?? []).map((f) => f.datos as CheckinDiario),
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
    planes: (planes.data ?? []).map((f) => f.datos as PlanNutricional),
    mensajes: conPendientes('mensajes', (mensajes.data ?? []) as FilaMensaje[]).map(
      (m): Mensaje => ({
        id: m.id,
        deId: m.de_id,
        paraId: m.para_id,
        fechaIso: m.fecha_iso,
        texto: m.texto,
        adjuntoUrl: m.adjunto_url ?? undefined,
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
