import type { ItemDespensa } from '../domain/nutricion/despensa'
import type { FilaRanking } from '../domain/ranking'
import type { RutaAsesorado } from '../domain/rutaEntrenamiento'
import type { StickerAlbum } from './contenido/albumAlfa'
import type { NoticiaRadar } from './contenido/radarAlfa'
import type {
  AdherenciaNutricional,
  CheckinDiario,
  Contenido,
  Cuestionario,
  EstadoAdherencia,
  MedidaCorporal,
  Mensaje,
  Microciclo,
  Perfil,
  PlanNutricional,
  PerfilNutricion,
  PreferenciaEstado,
  PruebaCalibracion,
  PremiacionCoach,
  RegistroComida,
  RegistroItem,
  Respuesta,
  SerieRegistrada,
  TestPostSesion,
  Usuario,
  ValoracionCompetencia,
  VetoAlimento,
  VisibilidadAsesorado,
} from '../domain/types'

export interface UsuariosRepo {
  list(): Usuario[]
  byId(id: string): Usuario | undefined
  /** Solo rol asesorado (para el ranking y conteos de cartera pura). */
  asesorados(): Usuario[]
  /** Todos los que entrenan (asesorados + staff que entrena, p. ej. la nutricionista). */
  entrenan(): Usuario[]
}

export interface PerfilesRepo {
  byUsuario(usuarioId: string): Perfil | undefined
  /** Registra una medición corporal del propio asesorado (reemplaza la de la misma fecha). */
  agregarMedida(usuarioId: string, medida: MedidaCorporal): void
  /**
   * Guarda la nota del coach a una competencia (reemplaza la anterior del mismo
   * id). SOLO STAFF: el trigger `proteger_perfil` de la migración 0008 deja al
   * asesorado tocar únicamente sus medidas.
   */
  guardarValoracion(usuarioId: string, valoracion: ValoracionCompetencia): void
  /**
   * Guarda el peldaño de la Escala Alfa. **SOLO STAFF**, y no por comodidad: el
   * trigger `proteger_perfil` de la 0008 impide que el asesorado escriba en su
   * propio perfil nada que no sean sus medidas, y esa migración existe porque
   * una política mal escrita dejó que alguien se auto-promoviera a coach.
   *
   * Por eso el nivel se calcula y se guarda al generar el microciclo siguiente,
   * que es una acción del coach, y no en el teléfono del asesorado.
   */
  guardarPeldano(usuarioId: string, peldano: number, ascensoIso: string): void
}

export interface MicrociclosRepo {
  byUsuario(usuarioId: string): Microciclo[]
  /**
   * El historial COMPLETO de una persona, pedido a demanda.
   *
   * Existe porque la hidratación del staff ya no se baja los microciclos
   * cerrados de toda la cartera: son el 78 % del peso hoy y crecen sin freno
   * -cada asesorado cierra uno por semana, para siempre-. Ver
   * `docs/specs/2026-08-27-donde-truena-a-mil-usuarios.md`.
   *
   * DEVUELVE los datos en vez de meterlos en la instantánea, y eso es
   * deliberado: quien llama los guarda en su propio estado. Escribirlos en el
   * snapshot obligaría a que la hidratación siguiente supiera conservarlos, y
   * ese es exactamente el camino en el que este repo ya perdió datos dos veces.
   */
  historialDe(usuarioId: string): Promise<Microciclo[]>
  /**
   * Guarda una propuesta del coach. Entra SIEMPRE con `estado: 'propuesto'`, y esa
   * es la salvaguarda: las pantallas del asesorado (`HoyPage`, `RutaPage`)
   * solo miran el microciclo `activo`, así que una propuesta no le llega a nadie
   * hasta que alguien decida activarla.
   *
   * No sustituye a ninguno existente: si ya hay una propuesta con ese número, se
   * reemplaza; el activo y los cerrados no se tocan.
   */
  guardarPropuesta(micro: Microciclo): void
  /**
   * Pone en marcha una propuesta: cierra lo que estuviera activo de esa persona y
   * activa esta, **en una sola operación**.
   *
   * Que sea indivisible no es elegancia: si se hiciera en dos pasos y algo fallara
   * en medio —se va la señal, se cierra la app—, el asesorado se quedaría con dos
   * microciclos activos o con ninguno. Lo primero ya pasó de verdad con dos
   * asesoradas, y cuando pasa, `find(m => m.estado === 'activo')` devuelve uno
   * cualquiera: la persona ve un programa u otro según el orden de guardado.
   *
   * Cierra TODOS los activos que encuentre, no solo uno. Así, si alguien ya está en
   * ese estado roto, activar el siguiente lo repara en vez de heredarlo.
   *
   * No borra nada: el microciclo cerrado conserva sus sesiones y sus series.
   */
  activarPropuesta(propuestaId: string): void
  registrarSerie(microcicloId: string, ejercicioId: string, serie: SerieRegistrada): void
  guardarTestPost(microcicloId: string, sesionId: string, test: TestPostSesion): void
  marcarParte(microcicloId: string, sesionId: string, parteId: string): void
}

export interface BienestarRepo {
  byUsuario(usuarioId: string): CheckinDiario[]
  guardar(checkin: CheckinDiario): void
}

export interface NutricionRepo {
  planByUsuario(usuarioId: string): PlanNutricional | undefined
  adherenciasByUsuario(usuarioId: string): AdherenciaNutricional[]
  marcarAdherencia(usuarioId: string, fecha: string, estado: EstadoAdherencia, comentario?: string): void
  /** Mililitros de agua registrados en la fecha (0 si no hay registro). */
  hidratacionDe(usuarioId: string, fecha: string): number
  /** Suma deltaMl (puede ser negativo para corregir) al total del día, con piso en 0. */
  registrarHidratacion(usuarioId: string, fecha: string, deltaMl: number): void
}

export interface PerfilNutricionRepo {
  byUsuario(usuarioId: string): PerfilNutricion | undefined
  /** Guarda lo respondido. `completada` marca que ya no hay que preguntar más. */
  guardar(usuarioId: string, respuestas: PerfilNutricion['respuestas'], completada: boolean): void
}

/**
 * Los interruptores de visibilidad. SOLO STAFF.
 *
 * El asesorado los LEE -la app necesita saber qué pintarle- pero no los
 * escribe: si pudiera, encendería los suyos y toda la protección sobraría. Esa
 * asimetría la impone la migración 0018 en la base; aquí solo se refleja.
 */
export interface VisibilidadRepo {
  byUsuario(usuarioId: string): VisibilidadAsesorado | undefined
  decidir(decision: VisibilidadAsesorado): void
}

export interface VetadosRepo {
  /**
   * Lo que la nutricionista marcó que esta persona no debe comer.
   *
   * El `motivo` viene opcional AL LEER porque las filas anteriores a la 0040
   * pueden no tenerlo. Al escribir es obligatorio: ver `vetar`.
   */
  byUsuario(usuarioId: string): VetoAlimento[]
  /**
   * El motivo es obligatorio AQUÍ, en el tipo, y no solo en la pantalla.
   *
   * Es lo que impide que vuelva a pasar lo de la 0040: se comprobó que nadie
   * leía la tabla desde `src/` y se dio por hecho que nadie la escribía. Con
   * esta firma, cualquier sitio nuevo que intente grabar un veto sin decir por
   * qué no compila — no hace falta que nadie se acuerde de la regla.
   *
   * Mínimo 3 caracteres con contenido, que es exactamente lo que exige el
   * `check` de la 0040. Si la pantalla fuera más permisiva que la base, la
   * escritura pasaría la validación y moriría en la cola de sincronización.
   */
  vetar(veto: VetoAlimento & { motivo: string }): void
  quitar(usuarioId: string, alimentoId: string): void
}

/**
 * Lo que el asesorado tiene en casa (migraciones 0024 y 0042).
 *
 * PRESENCIA, NO SALDO. Aquí no se descuenta nada comida a comida: `cantidadG`
 * es una foto al empezar el ciclo de compra. Un inventario que se descuenta se
 * desincroniza en tres días —nadie anota el pollo que se comió su pareja— y a
 * partir de ahí el motor recomienda comida que no está. Ver la cabecera de
 * `domain/nutricion/despensa.ts`.
 *
 * `quitar` recibe la CLAVE, no el id del alimento: los pedidos —lo que la
 * persona escribió porque no estaba en el catálogo— no tienen id y se
 * identifican por su texto normalizado. Ver `claveDe()`.
 */
export interface DespensaRepo {
  byUsuario(usuarioId: string): ItemDespensa[]
  /** Mete un alimento, o lo refresca si ya estaba. Comprar dos veces no duplica. */
  agregar(usuarioId: string, item: ItemDespensa): void
  quitar(usuarioId: string, clave: string): void
}

export interface CalibracionRepo {
  byUsuario(usuarioId: string): PruebaCalibracion[]
  /** Cuántos días distintos lleva pesando. Es la otra mitad del criterio. */
  diasPesando(usuarioId: string): number
  registrar(prueba: Omit<PruebaCalibracion, 'id'>): void
}

export interface RegistroComidasRepo {
  /** Las comidas de una fecha (`YYYY-MM-DD`), ordenadas por hora. */
  delDia(usuarioId: string, fecha: string): RegistroComida[]
  /**
   * Crea la comida y devuelve su id. Nace sin ítems: se añaden uno a uno según
   * el asesorado los va buscando, que es como funciona la hoja de cantidad.
   */
  abrirComida(comida: Omit<RegistroComida, 'id' | 'items'>): string
  /** Cambia lo que ya se guardó de una comida sin tocar sus ítems. */
  editarComida(usuarioId: string, comidaId: string, cambios: Partial<Omit<RegistroComida, 'id' | 'usuarioId' | 'items'>>): void
  agregarItem(usuarioId: string, comidaId: string, item: Omit<RegistroItem, 'id'>): void
  quitarItem(usuarioId: string, comidaId: string, itemId: string): void
  /** Borra la comida entera con sus ítems. */
  borrarComida(usuarioId: string, comidaId: string): void
  /** Qué estado eligió para esa familia, o `undefined` si nunca se le preguntó. */
  preferencia(usuarioId: string, familia: string): PreferenciaEstado | undefined
  recordarPreferencia(preferencia: PreferenciaEstado): void
}

export interface MensajesRepo {
  hilo(usuarioA: string, usuarioB: string): Mensaje[]
  enviar(mensaje: {
    deId: string
    paraId: string
    texto: string
    adjuntoTipo?: 'imagen' | 'video'
    adjuntoEstado?: 'subiendo' | 'listo'
    /** 'alpha' marca la respuesta del Centro de Respuestas. Por defecto, humano. */
    origen?: 'humano' | 'alpha'
  }): void
  /**
   * Deja anotado dónde quedó el archivo. Va aparte de `enviar` porque el path
   * lleva el id del mensaje, y ese id no existe hasta haberlo creado.
   */
  anotarPath(mensajeId: string, path: string): void
  /** El archivo terminó de subir: deja de mostrarse como pendiente. */
  marcarAdjuntoListo(mensajeId: string): void
  marcarLeidos(paraId: string, deId: string): void
  noLeidosPara(usuarioId: string): number
  noLeidosDe(paraId: string, deId: string): number
  /**
   * Mete en el hilo una respuesta del Centro de Respuestas que la Edge Function
   * YA escribió en la base. Solo pinta en local: no sincroniza, a propósito.
   * El `id` es el que devolvió la función, para que al rehidratar coincida.
   */
  recibirDeAlpha(mensaje: { id: string; deId: string; paraId: string; texto: string }): void
}

export interface CuestionariosRepo {
  asignadosA(usuarioId: string): Cuestionario[]
  respuestasDe(usuarioId: string): Respuesta[]
  responder(cuestionarioId: string, usuarioId: string, valores: Record<string, string>): void
}

export interface ContenidosRepo {
  list(): Contenido[]
  byId(id: string): Contenido | undefined
}

export interface PremiacionesRepo {
  byUsuario(usuarioId: string): PremiacionCoach[]
}

export interface RankingRepo {
  /** Ranking de disciplina del equipo: solo cumplimiento, sin datos personales. */
  list(): FilaRanking[]
}

export interface RutaRepo {
  /** Nivel, competencias y requisitos que pinta la vista Ruta de Entrenar. */
  byUsuario(usuarioId: string): RutaAsesorado
}

export interface ContenidoAlfaRepo {
  /** Fichas coleccionables del Álbum Alfa (Hoy). */
  album(): StickerAlbum[]
  /** Ticker de ciencia y fitness del Radar Alfa (Hoy). */
  radar(): NoticiaRadar[]
}

export interface Db {
  usuarios: UsuariosRepo
  perfiles: PerfilesRepo
  microciclos: MicrociclosRepo
  bienestar: BienestarRepo
  nutricion: NutricionRepo
  perfilNutricion: PerfilNutricionRepo
  visibilidad: VisibilidadRepo
  vetados: VetadosRepo
  despensa: DespensaRepo
  registroComidas: RegistroComidasRepo
  calibracion: CalibracionRepo
  mensajes: MensajesRepo
  cuestionarios: CuestionariosRepo
  contenidos: ContenidosRepo
  premiaciones: PremiacionesRepo
  ranking: RankingRepo
  ruta: RutaRepo
  contenidoAlfa: ContenidoAlfaRepo
}
