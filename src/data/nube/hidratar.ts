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
import type { RegistroHidratacion } from '../../domain/types'
import { aplicarSnapshot, epocaSesion, versionEscrituras } from '../mockDb'
import type { SeedDb } from '../seed'
import { supabase } from '../supabase'
import { conPendientes, marcarTablaHidratacion } from './sync'

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
