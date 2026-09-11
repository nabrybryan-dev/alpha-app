/**
 * EL INVENTARIO DE `/entrenar`: todo lo que la pantalla pintaba ANTES del salón.
 *
 * Esta lista no es documentación: es la vara de medir. El encargo del salón dice que
 * «ninguna información que hoy muestra la app se puede perder», y una frase así no se
 * puede comprobar leyendo capturas. Aquí está enumerado, dato a dato, lo que la columna
 * con scroll ponía en pantalla, con el archivo del que salía cada cosa. `inventario.test.ts`
 * lo recorre y exige que cada bloque siga apareciendo en el salón.
 *
 * ## De dónde salió
 *
 * Leyendo el `RutaPage.tsx` ANTERIOR al salón —el de `origin/main`, el que montaba
 * `LienzoCinematico` + doce bloques en una columna— y cada uno de sus componentes:
 * `PortadaMicrociclo.tsx`, `NotasDeLaSemana.tsx` y los ocho de `ruta/`. No se ha inventado
 * ningún dato ni se ha adivinado ninguno: cada entrada corresponde a un nodo que ese código
 * escribe en el DOM.
 *
 * ## Qué es cada campo
 *
 * - `bloque` — la unidad de mudanza. Es lo que el salón tiene que poder enseñar entero, y
 *   la clave con la que `inventario.test.ts` lo busca en el salón montado.
 * - `dato` — la pieza concreta de información. Es el grano fino: sirve para que, si alguien
 *   recorta un bloque a la mitad, se vea qué falta y no solo que «el bloque está».
 * - `origen` — la ruta del archivo que lo pintaba. Con ella se puede volver al código y
 *   comprobar la entrada sin fiarse de esta lista.
 *
 * ## Dos bloques ya no viven en `/entrenar`, y siguen en la lista
 *
 * El 29-ago, por decisión de Bryan, «Competencias evaluadas» y «Escala Alfa» se fueron a la
 * pestaña **Progreso**. No se borran de aquí por eso: esta lista dice qué información existe
 * y de dónde venía, no en qué pantalla acabó. Quién la guarda ahora lo dice el mapa
 * `SITIO_EN_EL_SALON` de `inventario.test.ts`, que a esos dos los sigue hasta Progreso y
 * exige verlos ALLÍ —marca propia, mismo componente, mismas cuentas—. Borrarlos habría
 * dejado la suite en verde con la información en ningún sitio, que es justo el fallo contra
 * el que se escribió todo esto.
 *
 * ## Lo que este archivo NO demuestra
 *
 * Que el dato se VEA bien. Un inventario prueba presencia, no legibilidad: si un texto está
 * en el DOM pero tapado por el sujeto, esta lista lo da por bueno. Eso se mira con el
 * teléfono en la mano y está anotado en `informes/verificacion-iphone.md`.
 */

export interface EntradaDeInventario {
  /** La unidad de mudanza: un bloque de la pantalla vieja. */
  bloque: string
  /** La pieza concreta de información que ese bloque ponía en pantalla. */
  dato: string
  /** El archivo que la pintaba, relativo a la raíz del repo. */
  origen: string
}

const PORTADA = 'src/features/entrenar/PortadaMicrociclo.tsx'
const NOTAS = 'src/features/entrenar/NotasDeLaSemana.tsx'
const RUTA_PAGE = 'src/features/entrenar/RutaPage.tsx'
const CABECERA = 'src/features/entrenar/ruta/CabeceraNivel.tsx'
const PROGRESO = 'src/features/entrenar/ruta/TarjetaProgresoNivel.tsx'
const COMO_LLEGAS = 'src/features/entrenar/ruta/ComoLlegas.tsx'
const BLOQUE = 'src/features/entrenar/ruta/BloqueEnCurso.tsx'
const CALENDARIO = 'src/features/entrenar/ruta/CalendarioSemana.tsx'
const COMPETENCIAS = 'src/features/entrenar/ruta/CompetenciasEvaluadas.tsx'
const REQUISITOS = 'src/features/entrenar/ruta/RequisitosNivel.tsx'
const ESCALA = 'src/features/entrenar/ruta/EscalaAlfa.tsx'

/**
 * Los trece bloques de `/entrenar`, dato a dato.
 *
 * El orden es el de la pantalla vieja, de arriba abajo: primero la pieza cinemática, luego
 * el letrero de microciclo, y de ahí hasta la Escala Alfa. El último no es un bloque sino un
 * ESTADO —«sin microciclo activo»— y va aquí porque también es información que la pantalla
 * da, y perderla sería dejar a media cartera mirando una pantalla en blanco.
 */
export const INVENTARIO_ENTRENAR: readonly EntradaDeInventario[] = [
  // ── Pieza cinemática ──────────────────────────────────────────────────────
  {
    bloque: 'Pieza cinemática',
    dato: 'La secuencia «orbita»: el atleta al que la cámara rodea mientras se baja por la pantalla.',
    origen: RUTA_PAGE,
  },

  // ── Portada del microciclo ────────────────────────────────────────────────
  { bloque: 'Portada del microciclo', dato: 'Rótulo «Empieza tu microciclo»', origen: PORTADA },
  { bloque: 'Portada del microciclo', dato: 'Número del microciclo («MICROCICLO M22»)', origen: PORTADA },
  { bloque: 'Portada del microciclo', dato: 'Cuántas sesiones tiene el microciclo', origen: PORTADA },
  { bloque: 'Portada del microciclo', dato: 'Total de series programadas de la semana', origen: PORTADA },
  { bloque: 'Portada del microciclo', dato: 'Los cinco grupos musculares prioritarios, numerados', origen: PORTADA },
  { bloque: 'Portada del microciclo', dato: 'El foco de la semana: qué grupo manda', origen: PORTADA },
  { bloque: 'Portada del microciclo', dato: 'Series programadas del grupo de foco', origen: PORTADA },
  { bloque: 'Portada del microciclo', dato: 'La frase del microciclo', origen: PORTADA },
  { bloque: 'Portada del microciclo', dato: 'El botón «Empezar la semana», que marca la portada como vista', origen: PORTADA },

  // ── Notas de la semana ────────────────────────────────────────────────────
  { bloque: 'Notas de la semana', dato: 'Encabezado «Notas de la semana / LO QUE HAY QUE SABER ANTES»', origen: NOTAS },
  { bloque: 'Notas de la semana', dato: 'El título de cada nota del coach', origen: NOTAS },
  { bloque: 'Notas de la semana', dato: 'Las indicaciones de cada nota', origen: NOTAS },

  // ── Cabecera de nivel ─────────────────────────────────────────────────────
  { bloque: 'Cabecera de nivel', dato: 'Rótulo «Tu ruta de entrenamiento»', origen: CABECERA },
  { bloque: 'Cabecera de nivel', dato: 'Nivel actual: número y nombre («Nivel 3 · RENDIMIENTO»)', origen: CABECERA },
  { bloque: 'Cabecera de nivel', dato: 'El distintivo cuadrado con el número de nivel', origen: CABECERA },

  // ── Enlace al encoder ─────────────────────────────────────────────────────
  { bloque: 'Enlace al encoder', dato: 'Etiqueta «Encoder · tanda y criterios» con su icono de cámara', origen: RUTA_PAGE },
  { bloque: 'Enlace al encoder', dato: 'El aviso «en pruebas»', origen: RUTA_PAGE },
  { bloque: 'Enlace al encoder', dato: 'El destino: /entrenar/encoder', origen: RUTA_PAGE },

  // ── Progreso al nivel ─────────────────────────────────────────────────────
  { bloque: 'Progreso al nivel', dato: 'Título «Progreso al nivel N» o «Nivel máximo alcanzado»', origen: PROGRESO },
  { bloque: 'Progreso al nivel', dato: 'El porcentaje de progreso', origen: PROGRESO },
  { bloque: 'Progreso al nivel', dato: 'La barra de progreso con su rol accesible', origen: PROGRESO },
  { bloque: 'Progreso al nivel', dato: 'Nombre del nivel actual y del siguiente, a los extremos de la barra', origen: PROGRESO },
  { bloque: 'Progreso al nivel', dato: 'Las tres mini-estadísticas: valor y etiqueta de cada una', origen: PROGRESO },

  // ── Cómo llegas ───────────────────────────────────────────────────────────
  { bloque: 'Cómo llegas', dato: 'Título «Cómo llegas esta semana»', origen: COMO_LLEGAS },
  { bloque: 'Cómo llegas', dato: 'El índice de recuperación (0-100)', origen: COMO_LLEGAS },
  { bloque: 'Cómo llegas', dato: 'El tono: Recuperado / En trabajo / Fatiga acumulada', origen: COMO_LLEGAS },
  { bloque: 'Cómo llegas', dato: 'La barra del índice con su rol accesible', origen: COMO_LLEGAS },
  { bloque: 'Cómo llegas', dato: 'Cuántos check-ins lo sostienen y de qué se compone el índice', origen: COMO_LLEGAS },

  // ── Bloque en curso ───────────────────────────────────────────────────────
  { bloque: 'Bloque en curso', dato: 'Título «Bloque en curso»', origen: BLOQUE },
  { bloque: 'Bloque en curso', dato: 'Nombre del bloque de entrenamiento', origen: BLOQUE },
  { bloque: 'Bloque en curso', dato: 'Detalle del bloque', origen: BLOQUE },
  { bloque: 'Bloque en curso', dato: 'Semana actual sobre semanas totales («3/5»)', origen: BLOQUE },
  { bloque: 'Bloque en curso', dato: 'Los segmentos de semana: cuáles están hechas', origen: BLOQUE },
  { bloque: 'Bloque en curso', dato: 'El botón a la sesión: Continuar / Sesión de hoy / Siguiente sesión, con su nombre', origen: BLOQUE },
  { bloque: 'Bloque en curso', dato: 'El aviso «Sin sesión pendiente esta semana» cuando no la hay', origen: BLOQUE },

  // ── Calendario de la semana ───────────────────────────────────────────────
  { bloque: 'Calendario de la semana', dato: 'Título «Semana N · Microciclo M»', origen: CALENDARIO },
  { bloque: 'Calendario de la semana', dato: 'Sesiones completadas sobre programadas', origen: CALENDARIO },
  { bloque: 'Calendario de la semana', dato: 'Las siete teclas de día: abreviatura, número y punto de estado', origen: CALENDARIO },
  { bloque: 'Calendario de la semana', dato: 'Qué día está seleccionado (arranca en hoy)', origen: CALENDARIO },
  { bloque: 'Calendario de la semana', dato: 'La agenda: título y detalle de cada día', origen: CALENDARIO },
  { bloque: 'Calendario de la semana', dato: 'La etiqueta de estado de cada día: Completada / Hoy / Programada / Descanso', origen: CALENDARIO },
  { bloque: 'Calendario de la semana', dato: 'El enlace a la sesión de cada día que la tiene', origen: CALENDARIO },

  // ── Competencias evaluadas ────────────────────────────────────────────────
  { bloque: 'Competencias evaluadas', dato: 'Título «Competencias evaluadas»', origen: COMPETENCIAS },
  { bloque: 'Competencias evaluadas', dato: 'El nombre de cada competencia', origen: COMPETENCIAS },
  { bloque: 'Competencias evaluadas', dato: 'Su porcentaje y su barra con rol accesible', origen: COMPETENCIAS },
  { bloque: 'Competencias evaluadas', dato: 'La nota que explica de dónde sale el porcentaje', origen: COMPETENCIAS },

  // ── Requisitos de nivel ───────────────────────────────────────────────────
  { bloque: 'Requisitos de nivel', dato: 'Título «Para subir a nivel N»', origen: REQUISITOS },
  { bloque: 'Requisitos de nivel', dato: 'El texto de cada requisito', origen: REQUISITOS },
  { bloque: 'Requisitos de nivel', dato: 'La métrica de cada requisito: cuánto llevas y cuánto hace falta', origen: REQUISITOS },
  { bloque: 'Requisitos de nivel', dato: 'Si está cumplido o pendiente, dicho con materia y no con color', origen: REQUISITOS },

  // ── Escala Alfa ───────────────────────────────────────────────────────────
  { bloque: 'Escala Alfa', dato: 'Título «Escala Alfa»', origen: ESCALA },
  // Siete, no cinco: contados en `src/data/ruta/contenidoRuta.ts` el 29-ago. Aquí decía
  // «los cinco» porque se copió del comentario de cabecera de `EscalaAlfa.tsx`, que dice
  // «los 5 niveles» y lleva tiempo desmentido por el dato. El número no se vuelve a escribir
  // a mano en ningún test: se compara el DOM con la escala que devuelve el repositorio.
  { bloque: 'Escala Alfa', dato: 'Cada peldaño de la escala con su número', origen: ESCALA },
  { bloque: 'Escala Alfa', dato: 'El nombre de cada peldaño', origen: ESCALA },
  { bloque: 'Escala Alfa', dato: 'La descripción de cada peldaño', origen: ESCALA },
  { bloque: 'Escala Alfa', dato: 'El nivel de método: Principiante / Intermedio / Avanzado', origen: ESCALA },
  { bloque: 'Escala Alfa', dato: 'El estado: Superado / Nivel actual / Bloqueado / Reservado · Élite', origen: ESCALA },

  // ── Estado sin microciclo ─────────────────────────────────────────────────
  // No es un bloque de la columna: es lo ÚNICO que se ve cuando la persona no tiene
  // microciclo activo. Y no es una urgencia — parte de la cartera está inactiva a
  // propósito—, así que el mensaje tampoco puede sonar a alarma.
  {
    bloque: 'Estado sin microciclo',
    dato: '«Sin microciclo activo» + «El coach está preparando tu siguiente programación.»',
    origen: RUTA_PAGE,
  },
]

/** Los bloques del inventario, sin repetir y en el orden en que aparecían en pantalla. */
export function bloquesDelInventario(): string[] {
  return [...new Set(INVENTARIO_ENTRENAR.map((e) => e.bloque))]
}

/** Los datos de un bloque concreto. */
export function datosDe(bloque: string): EntradaDeInventario[] {
  return INVENTARIO_ENTRENAR.filter((e) => e.bloque === bloque)
}
