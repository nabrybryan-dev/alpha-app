import { describe, expect, it } from 'vitest'
import { MAX_PALABRAS_PROVISIONAL, filtrarProvisional, type MotivoFiltro } from './filtroProvisional.ts'

const PREGUNTA = '¿cuántas series por semana para el pecho? tengo 3 días y una hora'

const bloquea = (texto: string, motivo: MotivoFiltro, pregunta = PREGUNTA): void => {
  const r = filtrarProvisional(texto, pregunta)
  expect(r.ok, `debía bloquear: ${texto}`).toBe(false)
  if (!r.ok) expect(r.motivo, texto).toBe(motivo)
}

describe('filtroProvisional: positivos sembrados, uno por bloqueo', () => {
  it('cifras y porcentajes en dígitos', () => {
    bloquea('Suele subir un 40 % con el tiempo.', 'cifras')
    bloquea('Hay 9871 casos descritos.', 'cifras')
    bloquea('Rinde mejor al 40%.', 'cifras')
  })
  it('cifras y porcentajes en letras', () => {
    bloquea('Suele subir cuarenta por ciento con el tiempo.', 'cifras')
    bloquea('Lo ideal es el doble de trabajo.', 'cifras')
    bloquea('Con doce semanas basta.', 'cifras')
  })
  it('autores, años y «estudio»', () => {
    bloquea('Según Schoenfeld 2016 el volumen importa.', 'autores_estudios')
    bloquea('Un estudio reciente lo muestra.', 'autores_estudios')
    bloquea('Un metaanálisis lo confirma.', 'autores_estudios')
    bloquea('Los estudios muestran que más trabajo ayuda.', 'autores_estudios')
    bloquea('Esto lo propone Schoenfeld en sus textos.', 'autores_estudios')
    bloquea('Ver Pérez et al. sobre el tema.', 'autores_estudios')
  })
  it('prescripción personal', () => {
    bloquea('Haz 4 series de 8 con 60 kg.', 'cifras')
    bloquea('Te recomiendo descansar más entre sesiones.', 'prescripcion')
    bloquea('Debes entrenar con más frecuencia.', 'prescripcion')
    bloquea('Tu dieta debería cambiar.', 'prescripcion')
    bloquea('Tu plan necesita más volumen.', 'prescripcion')
    bloquea('Haz series de pecho y luego repeticiones lentas.', 'prescripcion')
    bloquea('Usa pocos kilos al empezar.', 'prescripcion')
    bloquea('Come muchas calorías esa semana.', 'prescripcion')
    bloquea('Cuenta los gramos de proteína.', 'prescripcion')
  })
  it('salud, diagnóstico y medicación', () => {
    bloquea('Eso suena a una lesión del hombro.', 'salud')
    bloquea('Puede ser un síntoma de algo mayor.', 'salud')
    bloquea('Revisa qué medicación existe para eso.', 'salud')
    bloquea('Es el diagnóstico más probable.', 'salud')
  })
  it('más de 120 palabras', () => {
    const largo = Array.from({ length: MAX_PALABRAS_PROVISIONAL + 1 }, () => 'palabra').join(' ')
    bloquea(largo, 'largo')
    expect(filtrarProvisional(Array.from({ length: MAX_PALABRAS_PROVISIONAL }, () => 'palabra').join(' '), PREGUNTA).ok).toBe(true)
  })
  it('vacío o no texto', () => {
    bloquea('   ', 'vacio')
    expect(filtrarProvisional(undefined as unknown as string, PREGUNTA)).toEqual({ ok: false, motivo: 'vacio' })
  })
})

describe('filtroProvisional: negativos', () => {
  it('una explicación general corta, sin cifras ni autores, pasa', () => {
    const r = filtrarProvisional(
      'El volumen es la cantidad de trabajo que haces sobre un músculo en la semana. Más trabajo suele dar más adaptación, hasta un punto que depende de cada persona. Tu coach puede ajustarlo con tu caso.',
      PREGUNTA,
    )
    expect(r).toEqual({ ok: true })
  })
  it('una cifra que ya estaba en la pregunta (en dígito o en letra) no cuenta como ajena', () => {
    expect(filtrarProvisional('Con tres días y 3 sesiones a la semana hay margen.', PREGUNTA).ok).toBe(true)
    expect(filtrarProvisional('Con una hora alcanza para organizarlo.', PREGUNTA).ok).toBe(true)
    expect(filtrarProvisional('Reparte el trabajo en 3 días.', '¿cómo reparto en tres días?').ok).toBe(true)
  })
  it('los artículos un, una, uno no cuentan como cifra; una sigla corta no es un autor', () => {
    expect(filtrarProvisional('Un grupo, una serie, uno por día. El RIR sirve de guía.', '').ok).toBe(true)
  })
  it('una frase con mayúscula al abrir no se toma por autor, pero un nombre a mitad de frase sí', () => {
    expect(filtrarProvisional('Descansar entre sesiones ayuda a recuperar.', '').ok).toBe(true)
    expect(filtrarProvisional('Eso lo dice Fulano en su libro.', '').ok).toBe(false)
  })
})

describe('filtroProvisional: tasa de bloqueo medida con 12 salidas escritas a mano (6 buenas, 6 malas)', () => {
  const BUENAS = [
    'El volumen es la cantidad de trabajo que haces sobre un músculo. Más trabajo suele dar más adaptación, hasta un punto que depende de cada persona.',
    'Entrenar cerca del fallo hace que cada serie cuente más. Cuánto acercarte depende de tu experiencia y de cómo te recuperas.',
    'El descanso entre series permite repetir el esfuerzo con buena técnica. Si notas que la técnica se cae, descansar más suele ayudar.',
    'Un buen calentamiento prepara las articulaciones y el sistema nervioso. Lo habitual es empezar suave y subir poco a poco.',
    'La progresión es hacer un poco más con el tiempo: más peso, más repeticiones o mejor técnica. Tu coach decide el ritmo para ti.',
    'La técnica importa porque reparte la carga sobre el músculo que buscas trabajar. Mirarla con calma y sin prisa ayuda más que apurarse.',
  ]
  const MALAS = [
    'Lo ideal es un 20 % más de volumen cada semana.',
    'Según Schoenfeld 2016, el volumen manda.',
    'Haz 4 series de 8 con 60 kg y descansa dos minutos.',
    'Te recomiendo subir las calorías y revisar tu dieta.',
    'Un metaanálisis muestra que los estudios coinciden.',
    'Eso puede ser una lesión; consulta el diagnóstico con un médico.',
  ]
  it('las 6 buenas pasan y las 6 malas se bloquean (bloqueo 6 de 12 = 50 %, por construcción: no es una tasa real)', () => {
    const pasanBuenas = BUENAS.filter((t) => filtrarProvisional(t, PREGUNTA).ok)
    const bloqueadasMalas = MALAS.filter((t) => !filtrarProvisional(t, PREGUNTA).ok)
    expect(pasanBuenas.length, 'buenas que pasan').toBe(BUENAS.length)
    expect(bloqueadasMalas.length, 'malas bloqueadas').toBe(MALAS.length)
  })
})
