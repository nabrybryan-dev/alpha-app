/**
 * Radar Alfa: el ticker de ciencia y fitness que cierra la pantalla de Hoy.
 *
 * Contenido curado por el equipo. Mientras no tenga su tabla en Supabase vive
 * aquí, y por eso cada noticia lleva `id`: cuando se alimente desde la nube,
 * la pantalla no cambia.
 *
 * Regla al escribir una entrada: una afirmación por noticia, en el lenguaje del
 * asesorado, y que se pueda sostener. Nada de titulares que prometan resultados.
 */

export type CategoriaRadar = 'Estudio' | 'Nutrición' | 'Recuperación' | 'Método'

export interface NoticiaRadar {
  id: string
  categoria: CategoriaRadar
  texto: string
}

export const NOTICIAS_RADAR: NoticiaRadar[] = [
  {
    id: 'volumen-semanal',
    categoria: 'Estudio',
    texto:
      'Un metaanálisis reciente confirma que 12–20 series semanales por grupo cubren casi toda la hipertrofia posible: más volumen rinde poco y cuesta recuperación.',
  },
  {
    id: 'reparto-proteina',
    categoria: 'Nutrición',
    texto:
      'Repartir la proteína en 4 tomas de 0,4 g/kg supera a 2 tomas grandes para la síntesis muscular en mujeres entrenadas.',
  },
  {
    id: 'sueno-y-fuerza',
    categoria: 'Recuperación',
    texto:
      'Dormir menos de 6 h baja hasta un 20% la fuerza en multiarticulares al día siguiente. Tu registro de sueño ya alimenta el ajuste de cargas.',
  },
  {
    id: 'rir-vs-fallo',
    categoria: 'Método',
    texto:
      'Entrenar con RIR 1–3 iguala al fallo muscular en ganancias y acumula menos fatiga. Por eso lo usamos en tus bloques de acumulación.',
  },
]
