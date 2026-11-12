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

describe('filtroProvisional: remisión al coach no es prescripción (afinado con el examen A, 11-nov)', () => {
  const pasa = (t: string) => expect(filtrarProvisional(t, 'pregunta sin cifras'), t).toEqual({ ok: true })
  const bloquea = (t: string) => expect(filtrarProvisional(t, 'pregunta sin cifras'), t).toEqual({ ok: false, motivo: 'prescripcion' })
  it('pasa: «depende de / según / ajuste de tu …»', () => {
    pasa('Cuánto encaja depende de tu objetivo y tu fatiga; eso lo ajusta tu coach.')
    pasa('La técnica y el rango los ajusta tu coach según tu objetivo.')
    pasa('No hay cantidad fija: depende de tu cuerpo, tu actividad y tu entrenamiento.')
    pasa('Cualquier ajuste concreto de tu rutina lo decide tu coach.')
  })
  it('controles positivos: sin la fórmula de remisión sigue bloqueando', () => {
    bloquea('Tu dieta debería cambiar.')
    bloquea('Tu rutina necesita más volumen.')
    bloquea('Lo mejor es tu objetivo de volumen alto.')
    bloquea('Depende de tu nivel, y tu plan es comer más.')
    bloquea('Según tu nivel, haz series de pecho.')
    bloquea('Según tu plan, te recomiendo descansar.')
  })
})

describe('filtroProvisional: frases rotundas y «es normal / se van solas» (decisión del dueño, 11-nov)', () => {
  const rotunda = (t: string, pregunta = 'pregunta sin cifras') => expect(filtrarProvisional(t, pregunta), t).toEqual({ ok: false, motivo: 'rotunda' })
  const pasa = (t: string, pregunta = 'pregunta sin cifras') => expect(filtrarProvisional(t, pregunta), t).toEqual({ ok: true })

  it('positivos sembrados: uno por cada expresión', () => {
    rotunda('Nunca es tarde para empezar a entrenar.') // examen B
    rotunda('Eso no vuelve masculina a nadie.') // examen B
    rotunda('Jamás se pierde el músculo por descansar.')
    rotunda('Hay que entrenar siempre con la misma técnica.')
    rotunda('Siempre ayuda dormir bien.')
    rotunda('Tranquilo, no pasa nada si fallas una sesión.')
    rotunda('Eso se hace sin problema en cualquier día.')
    rotunda('Entrenar así es sin ningún riesgo.')
    rotunda('Ese ejercicio es seguro para todos.')
    rotunda('Es normal sentir cansancio después.')
    rotunda('Es totalmente adecuado hacerlo así.')
    rotunda('Las agujetas se van solas con el tiempo.')
    rotunda('Eso se pasa solo en unos días.')
    rotunda('Rinde al 100 % de su capacidad.', 'rinde al 100 % de su capacidad?')
    rotunda('En este caso no hay riesgo de perder músculo.')
    rotunda('Seguro que mejoras con constancia.')
    rotunda('Nunca es tarde para mejorar.')
    rotunda('Eso no te vuelve voluminosa de golpe.')
  })
  it('variantes de mayúscula y tilde no la esquivan', () => {
    rotunda('JAMÁS pasa eso.')
    rotunda('Sin ningun riesgo de nada.')
    rotunda('NO PASA NADA con eso.')
  })
  it('negativos: los matices NO se bloquean («a veces», «no siempre», «depende»)', () => {
    pasa('A veces conviene bajar un poco el ritmo; tu coach lo ajusta.')
    pasa('No siempre hace falta subir la carga cada semana.')
    pasa('Depende de tu nivel y de cómo te recuperes; tu coach lo ajusta.')
    pasa('Casi siempre ayuda calentar antes; depende de cada persona.')
    pasa('Puede ser útil descansar entre sesiones, siempre que la técnica se mantenga.')
  })
  it('control positivo del matiz: la misma frase sin «no» sí se bloquea', () => {
    pasa('No siempre hace falta subir la carga.')
    rotunda('Siempre hace falta subir la carga.')
  })
  it('los demás motivos tienen prioridad y siguen igual (no se pisan)', () => {
    expect(filtrarProvisional('Según Schoenfeld 2016 nunca falla.', '')).toEqual({ ok: false, motivo: 'autores_estudios' })
    expect(filtrarProvisional('Te recomiendo descansar siempre.', '')).toEqual({ ok: false, motivo: 'prescripcion' })
  })
})
