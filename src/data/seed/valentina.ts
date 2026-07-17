import { diasAtras, fechaIsoAtras } from './fechas'
import type {
  AdherenciaNutricional,
  CheckinDiario,
  EjercicioPrescrito,
  ItemMarcable,
  Microciclo,
  PartePreparacion,
  Perfil,
  PlanNutricional,
  SerieRegistrada,
  Sesion,
  Usuario,
} from '../../domain/types'

export const coach: Usuario = {
  id: 'u-bryan',
  nombre: 'Bryan',
  rol: 'coach',
  avatarIniciales: 'B',
}

export const valentina: Usuario = {
  id: 'u-valentina',
  nombre: 'Valentina Cruz',
  rol: 'asesorado',
  avatarIniciales: 'VC',
}

export const perfilValentina: Perfil = {
  usuarioId: 'u-valentina',
  objetivos:
    'Recomposición corporal / masa muscular en tren inferior / fortalecimiento y densidad en hombros',
  edad: 27,
  diasEntrenamiento: 5,
  tiempoSesionMin: 150,
  somatotipo: 'Mesomorfa',
  volumenSemanal: {
    Isquios: 'Muy Alto',
    Pecho: 'Muy Alto',
    Espalda: 'Muy Alto',
    Glúteo: 'Alto',
    Bíceps: 'Normal',
    Hombros: 'Normal',
    Cuádriceps: 'Bajo',
    Tríceps: 'Bajo',
  },
  medidas: [
    { fecha: diasAtras(48), pesoKg: 60.2, alturaCm: 163, perimetros: { Glúteos: 98.5, Muslos: 56.0, 'Abdomen medio': 68.0, Brazos: 27.5 }, pgPct: 24.1 },
    { fecha: diasAtras(34), pesoKg: 59.8, alturaCm: 163, perimetros: { Glúteos: 98.9, Muslos: 56.3, 'Abdomen medio': 67.2, Brazos: 27.6 }, pgPct: 23.6 },
    { fecha: diasAtras(20), pesoKg: 59.4, alturaCm: 163, perimetros: { Glúteos: 99.2, Muslos: 56.5, 'Abdomen medio': 66.5, Brazos: 27.8 }, pgPct: 23.0 },
    { fecha: diasAtras(3), pesoKg: 59.1, alturaCm: 163, perimetros: { Glúteos: 99.6, Muslos: 56.8, 'Abdomen medio': 66.0, Brazos: 27.9 }, pgPct: 22.5 },
  ],
}

interface EjercicioBase {
  id: string
  categoria: string
  nombre: string
  cues: string
  prescripcion: string
  descansoMin: number
  sets: number
  rango: string
  repsDiana: number
  rirObjetivo: number
  contenidoDemoId?: string
}

function ej(base: EjercicioBase, series: SerieRegistrada[] = []): EjercicioPrescrito {
  return { ...base, series }
}

function seriesDe(cargaKg: number, reps: number, rir: number, n: number): SerieRegistrada[] {
  return Array.from({ length: n }, (_, i) => ({
    orden: i + 1,
    cargaKg,
    reps: i === n - 1 ? Math.max(1, reps - 1) : reps,
    rir: i === n - 1 ? Math.max(0, rir - 1) : rir,
  }))
}

const prep = (
  id: string,
  tipo: PartePreparacion['tipo'],
  titulo: string,
  indicaciones: string,
): PartePreparacion => ({ id, tipo, titulo, indicaciones })

function prepPierna(sufijo: string, letra: string): PartePreparacion[] {
  return [
    prep(`prep-${sufijo}-${letra}-cardio`, 'calentamiento', 'Bici 6 min ritmo conversacional', 'Cadencia alta sin resistencia: temperatura y líquido sinovial antes de cargar.'),
    prep(`prep-${sufijo}-${letra}-9090`, 'movilidad', '90/90 de cadera × 8 por lado', 'Transiciones lentas; hoy la cadera es protagonista.'),
    prep(`prep-${sufijo}-${letra}-tobillo`, 'movilidad', 'Dorsiflexión de tobillo × 10 por lado', 'Rodilla a la pared sin levantar el talón.'),
  ]
}

function prepTorso(sufijo: string, letra: string): PartePreparacion[] {
  return [
    prep(`prep-${sufijo}-${letra}-cardio`, 'calentamiento', 'Remo o elíptica 6 min suave', 'Ritmo conversacional; involucra brazos para irrigar el tren superior.'),
    prep(`prep-${sufijo}-${letra}-banda`, 'movilidad', 'Dislocaciones con banda × 12', 'Agarre ancho; hombro, codo y muñeca listos para empujar y traccionar.'),
    prep(`prep-${sufijo}-${letra}-pullapart`, 'movilidad', 'Band pull-apart × 15', 'Aprieta escápulas 1 s: activación de espalda alta y sistema nervioso.'),
  ]
}

function sesionesBloque(sufijo: string, conRegistro: boolean): Sesion[] {
  const r = (carga: number, reps: number, rir: number, n: number) =>
    conRegistro ? seriesDe(carga, reps, rir, n) : []
  const conMarca = (partes: PartePreparacion[]): PartePreparacion[] =>
    conRegistro ? partes.map((p) => ({ ...p, hechoEn: fechaIsoAtras(10, '17:02:00') })) : partes
  const testPost = conRegistro
    ? { duracionMin: 135, rpeSesion: 8, prsEntrada: 7 }
    : undefined

  return [
    {
      id: `s-lega-${sufijo}`,
      nombre: 'LEG A',
      orden: 1,
      preparacion: conMarca(prepPierna(sufijo, 'la')),
      testPost,
      ejercicios: [
        ej({ id: `e-hip-${sufijo}`, categoria: 'DOMINANTE DE CADERA', nombre: 'Hip thrust con barra', cues: 'Mentón abajo, pelvis en retroversión al bloquear, pausa 1s arriba', prescripcion: '85KG A 10 REPS; 3 SERIES (RIR 2). PROGRESA +5KG VS M21. PAUSA ARRIBA', descansoMin: 3, sets: 3, rango: '(8-12)', repsDiana: 10, rirObjetivo: 2, contenidoDemoId: 'c-bisagra' }, r(85, 10, 2, 3)),
        ej({ id: `e-rdl-${sufijo}`, categoria: 'DOMINANTE DE CADERA', nombre: 'Peso muerto rumano con barra', cues: 'Cadera atrás, barra pegada al muslo, espalda neutra, estira isquios', prescripcion: '52.5KG A 9 REPS; 3 SERIES (RIR 2). PROGRESA +2.5KG VS M21. RANGO COMPLETO', descansoMin: 3, sets: 3, rango: '(8-10)', repsDiana: 9, rirObjetivo: 2, contenidoDemoId: 'c-bisagra' }, r(52.5, 9, 2, 3)),
        ej({ id: `e-curlfem-${sufijo}`, categoria: 'AISLAMIENTO', nombre: 'Curl femoral sentado', cues: 'Cadera fija al asiento, controla 3s la excéntrica', prescripcion: '40KG A 12 REPS; 3 SERIES (RIR 1). MISMO PESO VS M21, +1 REP. EXCÉNTRICA LENTA', descansoMin: 2, sets: 3, rango: '(10-14)', repsDiana: 12, rirObjetivo: 1 }, r(40, 12, 1, 3)),
        ej({ id: `e-bulgara-${sufijo}`, categoria: 'DOMINANTE DE RODILLA', nombre: 'Sentadilla búlgara con mancuernas', cues: 'Torso ligeramente inclinado, rodilla viaja sobre el pie', prescripcion: '14KG A 10 REPS; 2 SERIES (RIR 2). MANTIENE VS M21. GLÚTEO DOMINANTE', descansoMin: 2, sets: 2, rango: '(8-12)', repsDiana: 10, rirObjetivo: 2, contenidoDemoId: 'c-zancada' }, r(14, 10, 2, 2)),
        ej({ id: `e-abd-${sufijo}`, categoria: 'AISLAMIENTO', nombre: 'Abducción de cadera en máquina', cues: 'Tronco inclinado adelante, apertura máxima controlada', prescripcion: '55KG A 15 REPS; 3 SERIES (RIR 1). PROGRESA +5KG VS M21. PICO 1S', descansoMin: 2, sets: 3, rango: '(12-15)', repsDiana: 15, rirObjetivo: 1 }, r(55, 15, 1, 3)),
      ],
    },
    {
      id: `s-uppera-${sufijo}`,
      nombre: 'UPPER A',
      orden: 2,
      preparacion: conMarca(prepTorso(sufijo, 'ua')),
      testPost: conRegistro ? { duracionMin: 128, rpeSesion: 7, prsEntrada: 8 } : undefined,
      ejercicios: [
        ej({ id: `e-press-${sufijo}`, categoria: 'EMPUJE HORIZONTAL', nombre: 'Press plano con mancuernas', cues: 'Escápulas atrás y abajo, codos 45°, toca pecho sin rebote', prescripcion: '22.5KG A 9 REPS; 3 SERIES (RIR 2). PROGRESA +2.5KG VS M21. CONTROLA BAJADA', descansoMin: 3, sets: 3, rango: '(8-10)', repsDiana: 9, rirObjetivo: 2, contenidoDemoId: 'c-empuje-h' }, r(22.5, 9, 2, 3)),
        ej({ id: `e-remo-${sufijo}`, categoria: 'TRACCIÓN HORIZONTAL', nombre: 'Remo en máquina con pecho apoyado', cues: 'Lleva codos atrás y abajo, sin encoger hombros', prescripcion: '45KG A 10 REPS; 3 SERIES (RIR 2). PROGRESA +2.5KG VS M21. PAUSA ATRÁS', descansoMin: 3, sets: 3, rango: '(8-12)', repsDiana: 10, rirObjetivo: 2, contenidoDemoId: 'c-traccion' }, r(45, 10, 2, 3)),
        ej({ id: `e-militar-${sufijo}`, categoria: 'EMPUJE VERTICAL', nombre: 'Press militar sentada con mancuernas', cues: 'Core firme, sube en línea vertical, no arquees lumbar', prescripcion: '12.5KG A 10 REPS; 3 SERIES (RIR 2). MANTIENE VS M21, BUSCA +1 REP', descansoMin: 3, sets: 3, rango: '(8-12)', repsDiana: 10, rirObjetivo: 2, contenidoDemoId: 'c-empuje-v' }, r(12.5, 10, 2, 3)),
        ej({ id: `e-jalon-${sufijo}`, categoria: 'TRACCIÓN VERTICAL', nombre: 'Jalón al pecho agarre supino', cues: 'Pecho arriba, lleva la barra a la clavícula, controla el regreso', prescripcion: '42.5KG A 11 REPS; 3 SERIES (RIR 1). PROGRESA +2.5KG VS M21', descansoMin: 2, sets: 3, rango: '(10-12)', repsDiana: 11, rirObjetivo: 1, contenidoDemoId: 'c-traccion' }, r(42.5, 11, 1, 3)),
        ej({ id: `e-lateral-${sufijo}`, categoria: 'AISLAMIENTO', nombre: 'Elevaciones laterales con mancuernas', cues: 'Codos ligeramente flexionados, sube hasta la horizontal', prescripcion: '7KG A 14 REPS; 3 SERIES (RIR 1). MISMO PESO, TÉCNICA ESTRICTA', descansoMin: 2, sets: 3, rango: '(12-15)', repsDiana: 14, rirObjetivo: 1 }, r(7, 14, 1, 3)),
      ],
    },
    {
      id: `s-legb-${sufijo}`,
      nombre: 'LEG B',
      orden: 3,
      preparacion: conMarca(prepPierna(sufijo, 'lb')),
      testPost: conRegistro ? { duracionMin: 140, rpeSesion: 9, prsEntrada: 6 } : undefined,
      ejercicios: [
        ej({ id: `e-prensa-${sufijo}`, categoria: 'DOMINANTE DE RODILLA', nombre: 'Prensa 45° pies altos', cues: 'Pies altos y anchos para sesgo de glúteo e isquio, baja profundo', prescripcion: '140KG A 12 REPS; 3 SERIES (RIR 2). PROGRESA +10KG VS M21', descansoMin: 3, sets: 3, rango: '(10-14)', repsDiana: 12, rirObjetivo: 2, contenidoDemoId: 'c-sentadilla' }, r(140, 12, 2, 3)),
        ej({ id: `e-pmr-${sufijo}`, categoria: 'DOMINANTE DE CADERA', nombre: 'Peso muerto rumano con mancuernas', cues: 'Mancuernas pegadas a la pierna, cadera muy atrás', prescripcion: '20KG A 12 REPS; 3 SERIES (RIR 2). MANTIENE VS M21. ESTIRAMIENTO MÁXIMO', descansoMin: 2, sets: 3, rango: '(10-12)', repsDiana: 12, rirObjetivo: 2, contenidoDemoId: 'c-bisagra' }, r(20, 12, 2, 3)),
        ej({ id: `e-curltumb-${sufijo}`, categoria: 'AISLAMIENTO', nombre: 'Curl femoral tumbado', cues: 'Cadera pegada a la máquina, no impulses con lumbar', prescripcion: '35KG A 12 REPS; 3 SERIES (RIR 1). PROGRESA +2.5KG VS M21', descansoMin: 2, sets: 3, rango: '(10-14)', repsDiana: 12, rirObjetivo: 1 }, r(35, 12, 1, 3)),
        ej({ id: `e-patada-${sufijo}`, categoria: 'AISLAMIENTO', nombre: 'Patada de glúteo en polea', cues: 'Extiende desde el glúteo, aprieta 1s arriba', prescripcion: '15KG A 14 REPS; 3 SERIES (RIR 1). MISMO PESO, +1 REP VS M21', descansoMin: 2, sets: 3, rango: '(12-15)', repsDiana: 14, rirObjetivo: 1 }, r(15, 14, 1, 3)),
        ej({ id: `e-gemelo-${sufijo}`, categoria: 'AISLAMIENTO', nombre: 'Elevación de gemelo de pie', cues: 'Pausa abajo en estiramiento, sube al máximo', prescripcion: '60KG A 15 REPS; 3 SERIES (RIR 1). MANTIENE. PAUSA ABAJO 2S', descansoMin: 2, sets: 3, rango: '(12-15)', repsDiana: 15, rirObjetivo: 1 }, r(60, 15, 1, 3)),
      ],
    },
    {
      id: `s-upperb-${sufijo}`,
      nombre: 'UPPER B',
      orden: 4,
      preparacion: conMarca(prepTorso(sufijo, 'ub')),
      testPost: conRegistro ? { duracionMin: 125, rpeSesion: 8, prsEntrada: 7 } : undefined,
      ejercicios: [
        ej({ id: `e-inclinado-${sufijo}`, categoria: 'EMPUJE HORIZONTAL', nombre: 'Press inclinado en multipower', cues: 'Banco a 30°, baja a la parte alta del pecho', prescripcion: '35KG A 9 REPS; 3 SERIES (RIR 2). PROGRESA +2.5KG VS M21', descansoMin: 3, sets: 3, rango: '(8-10)', repsDiana: 9, rirObjetivo: 2, contenidoDemoId: 'c-empuje-h' }, r(35, 9, 2, 3)),
        ej({ id: `e-remobarra-${sufijo}`, categoria: 'TRACCIÓN HORIZONTAL', nombre: 'Remo con barra torso inclinado', cues: 'Torso 45°, tira al ombligo, sin balanceo', prescripcion: '40KG A 10 REPS; 3 SERIES (RIR 2). MANTIENE VS M21, TÉCNICA', descansoMin: 3, sets: 3, rango: '(8-12)', repsDiana: 10, rirObjetivo: 2, contenidoDemoId: 'c-traccion' }, r(40, 10, 2, 3)),
        ej({ id: `e-facepull-${sufijo}`, categoria: 'TRACCIÓN HORIZONTAL', nombre: 'Face pull en polea alta', cues: 'Tira hacia la frente, rota externo al final', prescripcion: '25KG A 15 REPS; 3 SERIES (RIR 2). SALUD DE HOMBRO, CONTROLADO', descansoMin: 2, sets: 3, rango: '(12-15)', repsDiana: 15, rirObjetivo: 2 }, r(25, 15, 2, 3)),
        ej({ id: `e-curl-${sufijo}`, categoria: 'AISLAMIENTO', nombre: 'Curl de bíceps en banco inclinado', cues: 'Hombro atrás, estira abajo por completo', prescripcion: '8KG A 12 REPS; 2 SERIES (RIR 1). PROGRESA +1KG VS M21', descansoMin: 2, sets: 2, rango: '(10-12)', repsDiana: 12, rirObjetivo: 1 }, r(8, 12, 1, 2)),
        ej({ id: `e-triceps-${sufijo}`, categoria: 'AISLAMIENTO', nombre: 'Extensión de tríceps en polea con cuerda', cues: 'Codos fijos al torso, abre la cuerda abajo', prescripcion: '20KG A 12 REPS; 2 SERIES (RIR 2). MANTIENE VS M21', descansoMin: 2, sets: 2, rango: '(10-14)', repsDiana: 12, rirObjetivo: 2 }, r(20, 12, 2, 2)),
      ],
    },
    {
      id: `s-fullc-${sufijo}`,
      nombre: 'FULL C',
      orden: 5,
      testPost: conRegistro ? { duracionMin: 110, rpeSesion: 7, prsEntrada: 8 } : undefined,
      ejercicios: [
        ej({ id: `e-goblet-${sufijo}`, categoria: 'DOMINANTE DE RODILLA', nombre: 'Sentadilla goblet', cues: 'Codos dentro de las rodillas abajo, torso erguido', prescripcion: '20KG A 12 REPS; 3 SERIES (RIR 2). MANTIENE. PROFUNDIDAD COMPLETA', descansoMin: 2, sets: 3, rango: '(10-14)', repsDiana: 12, rirObjetivo: 2, contenidoDemoId: 'c-sentadilla' }, r(20, 12, 2, 3)),
        ej({ id: `e-pressmaq-${sufijo}`, categoria: 'EMPUJE HORIZONTAL', nombre: 'Press de pecho en máquina', cues: 'Ajusta asiento a la mitad del pecho, recorrido completo', prescripcion: '35KG A 12 REPS; 3 SERIES (RIR 2). PROGRESA +2.5KG VS M21', descansoMin: 2, sets: 3, rango: '(10-12)', repsDiana: 12, rirObjetivo: 2, contenidoDemoId: 'c-empuje-h' }, r(35, 12, 2, 3)),
        ej({ id: `e-jalonneutro-${sufijo}`, categoria: 'TRACCIÓN VERTICAL', nombre: 'Jalón agarre neutro', cues: 'Codos hacia el bolsillo, sin balanceo del torso', prescripcion: '40KG A 12 REPS; 3 SERIES (RIR 2). MANTIENE VS M21', descansoMin: 2, sets: 3, rango: '(10-12)', repsDiana: 12, rirObjetivo: 2, contenidoDemoId: 'c-traccion' }, r(40, 12, 2, 3)),
        ej({ id: `e-lateralpolea-${sufijo}`, categoria: 'AISLAMIENTO', nombre: 'Elevación lateral en polea', cues: 'Cable por detrás del cuerpo, sube al plano escapular', prescripcion: '5KG A 15 REPS; 2 SERIES (RIR 1). TENSIÓN CONTINUA', descansoMin: 2, sets: 2, rango: '(12-15)', repsDiana: 15, rirObjetivo: 1 }, r(5, 15, 1, 2)),
        ej({ id: `e-core-${sufijo}`, categoria: 'CORE', nombre: 'Plancha con carga', cues: 'Glúteo apretado, no dejes caer la cadera, respira', prescripcion: '40 SEG; 3 SERIES. +5KG EN ESPALDA VS M21', descansoMin: 1, sets: 3, rango: '(30-45s)', repsDiana: 40, rirObjetivo: 2 }, r(5, 40, 2, 3)),
      ],
    },
  ]
}

function conLegARegistrada(sesiones: Sesion[]): Sesion[] {
  return sesiones.map((s) => {
    if (s.nombre !== 'LEG A') return s
    return {
      ...s,
      testPost: { duracionMin: 132, rpeSesion: 8, prsEntrada: 8 },
      preparacion: s.preparacion?.map((p) => ({ ...p, hechoEn: fechaIsoAtras(2, '17:02:00') })),
      ejercicios: s.ejercicios.map((e) => ({
        ...e,
        series: seriesDe(
          Number(e.prescripcion.split('KG')[0].replace(',', '.')) || 20,
          e.repsDiana,
          e.rirObjetivo,
          e.sets,
        ),
      })),
    }
  })
}

function sesionMetabolica(sufijo: string): Sesion {
  const bloque = (id: string, titulo: string, indicaciones: string, duracionMin: number): ItemMarcable =>
    ({ id, titulo, indicaciones, duracionMin })
  return {
    id: `s-metab-${sufijo}`,
    nombre: 'METABÓLICO A',
    orden: 6,
    tipo: 'metabolica',
    ejercicios: [],
    preparacion: [
      prep(`prep-${sufijo}-met-tobillo`, 'movilidad', 'Tobillos y balanceos de pierna × 10', 'Círculos de tobillo y balanceos frontales antes de correr.'),
    ],
    bloquesCardio: [
      bloque(`bc-${sufijo}-1`, 'Calentamiento: 5 min trote suave', 'Ritmo conversacional, zancada corta.', 5),
      bloque(`bc-${sufijo}-2`, '10 × 1 min fuerte / 1 min suave', 'El minuto fuerte a RPE 8: palabras sueltas, no frases. El suave es trote, no caminata.', 20),
      bloque(`bc-${sufijo}-3`, 'Enfriamiento: 5 min caminata', 'Baja pulsaciones caminando, respira por la nariz.', 5),
    ],
  }
}

export const microciclosValentina: Microciclo[] = [
  {
    id: 'm21-valentina',
    usuarioId: 'u-valentina',
    numero: 21,
    cadenciaDias: 8,
    estado: 'cerrado',
    fechaInicio: diasAtras(22),
    sesiones: sesionesBloque('m21', true),
  },
  {
    id: 'm22-valentina',
    usuarioId: 'u-valentina',
    numero: 22,
    cadenciaDias: 8,
    estado: 'activo',
    fechaInicio: diasAtras(7),
    sesiones: [...conLegARegistrada(sesionesBloque('m22', false)), sesionMetabolica('m22')],
  },
]

const checkinBase = {
  usuarioId: 'u-valentina',
  rendimiento: 'BUENA' as const,
  motivacion: 'MUCHO' as const,
  hambre: 'REGULAR' as const,
  cansancio: 'REGULAR' as const,
  estres: 'POCO' as const,
  calidadSueno: 'BUENA' as const,
  alimentacion: 'BUENA' as const,
}

export const checkinsValentina: CheckinDiario[] = [
  { id: 'ck-01', fecha: diasAtras(12), pesoKg: 59.6, pasos: 9500, entreno: 'LEG A', horasSueno: 7.5, ...checkinBase },
  { id: 'ck-02', fecha: diasAtras(11), pesoKg: 59.5, pasos: 8200, entreno: 'UPPER A', horasSueno: 7, ...checkinBase },
  { id: 'ck-03', fecha: diasAtras(10), pesoKg: 59.4, pasos: 11200, entreno: 'Descanso', horasSueno: 8, ...checkinBase, cansancio: 'POCO' },
  { id: 'ck-04', fecha: diasAtras(9), pesoKg: 59.5, pasos: 7800, entreno: 'LEG B', horasSueno: 6.5, ...checkinBase, cansancio: 'MUCHO', comentarios: 'La prensa se sintió pesada, dormí poco' },
  { id: 'ck-05', fecha: diasAtras(8), pesoKg: 59.3, pasos: 9100, entreno: 'UPPER B', horasSueno: 7.5, ...checkinBase },
  { id: 'ck-06', fecha: diasAtras(7), pesoKg: 59.2, pasos: 10400, entreno: 'FULL C', horasSueno: 8, ...checkinBase },
  { id: 'ck-07', fecha: diasAtras(6), pesoKg: 59.3, pasos: 8900, entreno: 'Descanso', horasSueno: 7, ...checkinBase },
  { id: 'ck-08', fecha: diasAtras(5), pesoKg: 59.2, pasos: 9700, entreno: 'LEG A', horasSueno: 7.5, ...checkinBase, comentarios: 'Hip thrust progresó, me sentí fuerte' },
  { id: 'ck-09', fecha: diasAtras(4), pesoKg: 59.1, pasos: 8600, entreno: 'Descanso', horasSueno: 8, ...checkinBase, estres: 'REGULAR' },
  { id: 'ck-10', fecha: diasAtras(3), pesoKg: 59.1, pasos: 10100, entreno: 'Descanso', horasSueno: 7, ...checkinBase },
  { id: 'ck-11', fecha: diasAtras(2), pesoKg: 59.0, pasos: 9300, entreno: 'Descanso', horasSueno: 7.5, ...checkinBase },
  { id: 'ck-12', fecha: diasAtras(1), pesoKg: 59.0, pasos: 8800, entreno: 'Descanso', horasSueno: 8, ...checkinBase },
]

export const planValentina: PlanNutricional = {
  id: 'plan-valentina',
  usuarioId: 'u-valentina',
  analisis:
    'TDEE estimado en 2050 kcal con NEAT medio (9-10k pasos). Objetivo: recomposición con déficit ligero ondulado. Proteína alta constante (1.9 g/kg), carbohidrato ondulado según día de entrenamiento. Peso bajando ~0.15 kg/semana con perímetro de glúteo subiendo: la recomposición va en la dirección correcta.',
  macrosPorDia: {
    ALTO: { kcal: 2100, proteinaG: 115, carbosG: 240, grasaG: 62 },
    BAJO: { kcal: 1750, proteinaG: 115, carbosG: 160, grasaG: 60 },
    CHEAT: { kcal: 2400, proteinaG: 110, carbosG: 300, grasaG: 75 },
  },
  menus: [
    {
      nombre: 'Menú 1 · Día ALTO (entreno fuerte)',
      tipoDia: 'ALTO',
      comidas: [
        { hora: '6:30', titulo: 'Desayuno · overnight oats', alimentos: ['70 g avena', '200 ml leche semidescremada', '1 scoop proteína', '100 g fresas', '10 g mantequilla de maní'], nota: 'Prepáralo la noche anterior' },
        { hora: '10:00', titulo: 'Media mañana', alimentos: ['1 banano', '30 g almendras'] },
        { hora: '13:00', titulo: 'Almuerzo · meal prep', alimentos: ['150 g pechuga de pollo', '200 g arroz cocido', 'Ensalada verde con 1 cdta aceite de oliva', '100 g plátano maduro'] },
        { hora: '16:30', titulo: 'Pre-entreno', alimentos: ['40 g arepa de maíz', '2 claras + 1 huevo'], nota: '60-90 min antes de entrenar' },
        { hora: '20:30', titulo: 'Post-entreno / cena', alimentos: ['150 g tilapia', '250 g papa criolla', 'Verduras salteadas'], nota: 'La comida más grande del día después de entrenar' },
      ],
    },
    {
      nombre: 'Menú 2 · Día BAJO (descanso)',
      tipoDia: 'BAJO',
      comidas: [
        { hora: '7:00', titulo: 'Desayuno', alimentos: ['3 huevos revueltos', '50 g arepa', '1/2 aguacate pequeño'] },
        { hora: '12:30', titulo: 'Almuerzo · ensalada potente', alimentos: ['150 g atún en agua', 'Base de espinaca y lechuga', '100 g quinua cocida', '1 cda aceite de oliva'] },
        { hora: '16:00', titulo: 'Snack', alimentos: ['1 yogur griego natural', '80 g arándanos'] },
        { hora: '20:00', titulo: 'Cena ligera', alimentos: ['150 g pechuga a la plancha', 'Crema de verduras sin crema de leche'] },
      ],
    },
    {
      nombre: 'Menú 3 · Día CHEAT controlado',
      tipoDia: 'CHEAT',
      comidas: [
        { hora: '7:30', titulo: 'Desayuno normal', alimentos: ['Igual al día BAJO'], nota: 'El cheat es UNA comida, no un día entero' },
        { hora: '13:00', titulo: 'Comida libre', alimentos: ['Lo que elijas: hamburguesa, pizza, bandeja paisa...'], nota: 'Disfrútala sin culpa y sin repetir' },
        { hora: '20:00', titulo: 'Cena de vuelta al plan', alimentos: ['150 g proteína magra', 'Verduras al gusto'] },
      ],
    },
  ],
  equivalencias: [
    { grupo: 'Proteínas', base: '150 g pechuga de pollo', opciones: ['150 g tilapia o basa', '140 g lomo de cerdo magro', '150 g atún', '3 huevos + 3 claras', '1.5 scoop de proteína'] },
    { grupo: 'Carbohidratos', base: '200 g arroz cocido', opciones: ['250 g papa cocida', '220 g pasta cocida', '150 g plátano maduro', '80 g avena en seco', '100 g arepa de maíz'] },
    { grupo: 'Grasas', base: '1 cda aceite de oliva', opciones: ['30 g almendras o maní', '1/2 aguacate pequeño', '15 g mantequilla de maní'] },
  ],
  listaCompras: ['Pechuga de pollo (1.5 kg)', 'Tilapia (1 kg)', 'Huevos (30)', 'Avena (1 kg)', 'Arroz (2 kg)', 'Papa y papa criolla (2 kg)', 'Plátano y banano', 'Fresas y arándanos', 'Espinaca, lechuga, brócoli, zanahoria', 'Yogur griego natural (4)', 'Leche semidescremada (2 L)', 'Almendras y maní (500 g)', 'Aceite de oliva', 'Proteína en polvo (si queda poca)'],
  suplementacion: ['Creatina monohidrato 5 g diarios (cualquier hora, todos los días)', 'Omega-3 (EPA+DHA) 2 g con el almuerzo', 'Vitamina D 2000 UI con el desayuno', 'Cafeína 150-200 mg pre-entreno opcional (no después de las 5 pm)'],
  seccionesEspeciales: [
    {
      titulo: 'Ciclo menstrual y entrenamiento',
      contenido: 'En fase lútea tardía es normal más hambre, más retención y menos fuerza: no es pérdida de progreso. Esa semana prioriza el sueño, sube pasos suaves y usa las equivalencias para mantener adherencia sin rigidez. El peso de la báscula puede subir 0.5-1 kg por agua: mira la tendencia de 2 semanas, no el día.',
    },
  ],
}

export const adherenciasValentina: AdherenciaNutricional[] = [
  { id: 'ad-01', usuarioId: 'u-valentina', fecha: diasAtras(12), estado: 'si' },
  { id: 'ad-02', usuarioId: 'u-valentina', fecha: diasAtras(11), estado: 'si' },
  { id: 'ad-03', usuarioId: 'u-valentina', fecha: diasAtras(10), estado: 'si' },
  { id: 'ad-04', usuarioId: 'u-valentina', fecha: diasAtras(9), estado: 'parcial', comentario: 'Salí a almorzar por cumpleaños, elegí bien pero sin medir' },
  { id: 'ad-05', usuarioId: 'u-valentina', fecha: diasAtras(8), estado: 'si' },
  { id: 'ad-06', usuarioId: 'u-valentina', fecha: diasAtras(7), estado: 'si' },
  { id: 'ad-07', usuarioId: 'u-valentina', fecha: diasAtras(6), estado: 'no', comentario: 'Día complicado en el trabajo, pedí domicilio' },
  { id: 'ad-08', usuarioId: 'u-valentina', fecha: diasAtras(5), estado: 'si' },
  { id: 'ad-09', usuarioId: 'u-valentina', fecha: diasAtras(4), estado: 'si' },
  { id: 'ad-10', usuarioId: 'u-valentina', fecha: diasAtras(3), estado: 'parcial', comentario: 'Cheat planificado, una sola comida' },
  { id: 'ad-11', usuarioId: 'u-valentina', fecha: diasAtras(2), estado: 'si' },
  { id: 'ad-12', usuarioId: 'u-valentina', fecha: diasAtras(1), estado: 'si' },
]
