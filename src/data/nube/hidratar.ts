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
import { aplicarSnapshot } from '../mockDb'
import type { SeedDb } from '../seed'
import { supabase } from '../supabase'
import { marcarTablaHidratacion } from './sync'

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
}

export async function hidratarDesdeNube(): Promise<void> {
  const sb = supabase()

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
  const hidratacion = await sb.from('hidratacion').select('*')
  marcarTablaHidratacion(!hidratacion.error)

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
    perfiles: (perfiles.data ?? []).map((f) => f.datos as Perfil),
    microciclos: (microciclos.data ?? []).map((f) => f.datos as Microciclo),
    checkins: (checkins.data ?? []).map((f) => f.datos as CheckinDiario),
    adherencias: (adherencias.data ?? []).map(
      (f): AdherenciaNutricional => ({
        id: f.id as string,
        usuarioId: f.usuario_id as string,
        fecha: f.fecha as string,
        estado: f.estado as AdherenciaNutricional['estado'],
        comentario: (f.comentario as string | null) ?? undefined,
      }),
    ),
    hidratacion: hidratacion.error
      ? []
      : (hidratacion.data ?? []).map(
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
    mensajes: ((mensajes.data ?? []) as FilaMensaje[]).map(
      (m): Mensaje => ({
        id: m.id,
        deId: m.de_id,
        paraId: m.para_id,
        fechaIso: m.fecha_iso,
        texto: m.texto,
        adjuntoUrl: m.adjunto_url ?? undefined,
        leido: m.leido,
      }),
    ),
    cuestionarios: (cuestionarios.data ?? []).map((f) => ({
      ...(f.datos as Cuestionario),
      id: f.id as string,
      asignadoA: (f.asignado_a as string[]) ?? [],
    })),
    respuestas: (respuestas.data ?? []).map(
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

  aplicarSnapshot(snapshot)
}
