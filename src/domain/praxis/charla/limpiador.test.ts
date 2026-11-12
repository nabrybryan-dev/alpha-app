import { describe, expect, it } from 'vitest'
import { limpiarFrase } from './limpiador.ts'

describe('limpiador de la charla', () => {
  it('CONTROL POSITIVO: un nombre sembrado desaparece, con o sin mayúsculas y tildes', () => {
    for (const f of ['Marcela dice que cuántas series por músculo', 'cuantas series por musculo, soy MARCELA', 'hola Mónica, ¿cuántas series?']) {
      const r = limpiarFrase(f)
      expect(r.texto).not.toMatch(/marcela|monica|mónica/i)
      expect(r.texto).toContain('[NOMBRE]')
      expect(r.tipos).toContain('nombre')
    }
  })

  it('LÍMITE CONOCIDO: un nombre suelto que ABRE la frase y no está en la lista pasa, salvo que se pase aparte', () => {
    expect(limpiarFrase('Zacarías pregunta por el descanso').texto).toContain('Zacarías')
    expect(limpiarFrase('Zacarías pregunta por el descanso', ['Zacarias']).texto).not.toContain('Zacar')
  })

  it('«me llamo X» quita el nombre aunque no esté en la lista', () => {
    expect(limpiarFrase('me llamo Anselmo Ruiz y quiero saber del descanso').texto).toBe('me llamo [NOMBRE] y quiero saber del descanso')
  })

  it('no toca palabras que contienen un nombre dentro', () => {
    expect(limpiarFrase('la sarampión y la analogía').texto).toBe('la sarampión y la analogía')
    expect(limpiarFrase('sarita no es Sara').texto).toBe('sarita no es [NOMBRE]')
  })

  it('quita correos y teléfonos', () => {
    const r = limpiarFrase('escríbeme a pepe.gomez@correo.com o al 300 123 4567 o +57 310 555 12 34')
    expect(r.texto).not.toMatch(/@|300|4567|310/)
    expect(r.quitado.correo).toBe(1)
    expect(r.quitado.telefono).toBe(2)
  })

  it('quita peso, edad y medidas', () => {
    const r = limpiarFrase('tengo 34 años, peso 82 kg, mido 1.75 y mi cintura de 90 cm, 28% de grasa')
    expect(r.texto).not.toMatch(/34|82|1\.75|90|28/)
    expect(r.tipos).toEqual(expect.arrayContaining(['edad', 'peso', 'medida']))
  })

  it('NEGATIVO: una frase limpia no cambia', () => {
    for (const f of ['¿cuántas series por músculo a la semana?', 'es mejor entrenar en ayunas o después de comer', 'cuánto descanso entre series de sentadilla']) {
      const r = limpiarFrase(f)
      expect(r.texto).toBe(f)
      expect(r.tipos).toEqual([])
    }
  })

  it('los conteos nunca guardan lo quitado', () => {
    const r = limpiarFrase('soy Marcela, 3001234567')
    expect(JSON.stringify(r)).not.toMatch(/Marcela|3001234567/)
  })

  // ---- H1 (informe del custodio, 11-nov): nombres fuera de lista. Los nombres son INVENTADOS. ----
  // Las 14 frases las reconstruyó quien corrige según las categorías del informe (el informe no las copia literal).
  const CATORCE: { frase: string; secreto: RegExp }[] = [
    { frase: 'soy Zulema y entreno en casa', secreto: /Zulema/i },
    { frase: 'mi esposa Ofelia quiere saber cuantas series', secreto: /Ofelia/i },
    { frase: 'mi entrenador Wenceslao dice que haga mas volumen', secreto: /Wenceslao/i },
    { frase: 'entreno con Tiburcio los martes', secreto: /Tiburcio/i },
    { frase: 'Anselmo Quintero pregunta por el descanso', secreto: /Anselmo|Quintero/i },
    { frase: 'mi hija Eulalia tambien entrena', secreto: /Eulalia/i },
    { frase: 'pregunta Doña Rosalba cuantas series', secreto: /Rosalba/i },
    { frase: 'me llamo tiburcio y quiero saber del descanso', secreto: /tiburcio/i },
    { frase: 'trabajo en Bochalema Fitness y entreno ahi', secreto: /Bochalema|Fitness/i },
    { frase: 'vivo en el barrio Cuchicute', secreto: /Cuchicute/i },
    { frase: 'mi usuario es @zule_fit', secreto: /zule_fit/i },
    { frase: 'vivo en la calle 45 # 12-30', secreto: /45|12-30/ },
    { frase: 'mi cedula es 1.020.345.678', secreto: /1\.020|345|678/ },
    { frase: 'tengo treinta y cuatro años y peso ochenta kilos', secreto: /treinta|cuatro|ochenta/i },
  ]

  it('H1: las 14 frases inventadas con nombre o identificador salen sin el dato (0 pasan)', () => {
    const pasan = CATORCE.filter(({ frase, secreto }) => secreto.test(limpiarFrase(frase).texto)).map((c) => c.frase)
    expect(pasan).toEqual([])
  })

  it('H1: correo dictado, «soy x» y «mi esposa x» en minúscula, dos palabras seguidas', () => {
    expect(limpiarFrase('escribeme a zule arroba gmail punto com').texto).not.toMatch(/zule|gmail/i)
    expect(limpiarFrase('soy zulema y quiero saber').texto).not.toMatch(/zulema/i)
    expect(limpiarFrase('mi esposa ofelia entrena conmigo').texto).not.toMatch(/ofelia/i)
    expect(limpiarFrase('mi medico quiere saber').texto).toBe('mi medico quiere saber')
    expect(limpiarFrase('mido un metro setenta').texto).not.toMatch(/metro|setenta/)
  })

  it('H1 NEGATIVO: sin nombres propios la frase queda igual, y las siglas no se rompen', () => {
    for (const f of ['cuantas series por musculo a la semana', 'soy principiante, ¿cuántas series por músculo?', 'Con RIR 2 o RM, ¿cuántas series?', 'Segun el PMID 12345 y el DOMS']) {
      expect(limpiarFrase(f).texto).toBe(f)
    }
  })

  it('H1 COMPROMISO (falla seguro): un apellido de autor con mayúscula se tapa de más', () => {
    expect(limpiarFrase('que dice Schoenfeld del volumen').texto).toBe('que dice [NOMBRE] del volumen')
  })
})
