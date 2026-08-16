import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperacionPendiente } from './cola'

/**
 * Qué sale hacia Supabase cuando el asesorado registra lo que come.
 *
 * Lo que se prueba aquí no es que "sincroniza": es la FORMA exacta de lo que se
 * encola. Las dos tablas generan su id en el servidor, así que el móvil no lo
 * conoce; si el `cliente_id` o el `on_conflict` se pierden por el camino, cada
 * reintento insertaría una fila nueva y el día se duplicaría. Eso no da error en
 * pantalla: solo aparecen calorías que nadie comió.
 */

const VALENTINA = 'u-valentina'
const HOY = new Date()
const FECHA = `${HOY.getFullYear()}-${String(HOY.getMonth() + 1).padStart(2, '0')}-${String(
  HOY.getDate(),
).padStart(2, '0')}`

let modulos: { db: import('../repos').Db; cola: () => OperacionPendiente[] } | undefined

async function appEnModoNube() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-de-prueba')
  vi.resetModules()
  const sync = await import('./sync')
  const { crearMockDb } = await import('../mockDb')
  return {
    db: sync.crearDbSincronizada(crearMockDb()),
    cola: () => JSON.parse(localStorage.getItem('alpha-cola-sync') ?? '[]') as OperacionPendiente[],
  }
}

const almuerzo = {
  usuarioId: VALENTINA,
  momentoIso: `${FECHA}T13:00:00`,
  comida: 'almuerzo' as const,
  cocinadoPorEl: true,
  aceiteG: null,
  salG: null,
  confianza: 'pesado' as const,
}

const arroz = {
  alimentoId: 'arroz-blanco-pulido-cocido-sin-sal',
  gramos: 150,
  fuePesado: true,
  estadoAsumido: 'cocido' as const,
}

describe('el registro de comidas sube a Supabase', () => {
  beforeEach(async () => {
    localStorage.clear()
    // Sin red: la cola se llena y no se drena, que es justo lo que se inspecciona.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin red'))))
    modulos = await appEnModoNube()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    modulos = undefined
  })

  it('abrir una comida la encola con su id de cliente', () => {
    const { db, cola } = modulos!
    db.registroComidas.abrirComida(almuerzo)

    const [op] = cola()
    expect(op.tabla).toBe('registro_comida')
    expect(op.tipo).toBe('upsert')
    expect(op.payload.cliente_id).toBeTruthy()
    expect(op.payload.asesorado_id).toBe(VALENTINA)
  })

  it('el upsert resuelve el conflicto por cliente_id, no por la clave primaria', () => {
    // Sin esto, cada reintento insertaría una comida nueva: el `id` lo genera
    // el servidor y el móvil nunca lo manda.
    const { db, cola } = modulos!
    db.registroComidas.abrirComida(almuerzo)
    expect(cola()[0].onConflict).toBe('cliente_id')
  })

  it('el ítem viaja apuntando a su comida por el id de cliente', () => {
    const { db, cola } = modulos!
    const comidaId = db.registroComidas.abrirComida(almuerzo)
    db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

    const item = cola().find((o) => o.tabla === 'registro_item')
    expect(item?.payload.comida_cliente_id).toBe(comidaId)
    expect(item?.payload.gramos).toBe(150)
    expect(item?.onConflict).toBe('cliente_id')
  })

  it('la comida va SIEMPRE antes que sus ítems', () => {
    // El trigger de la base resuelve la comida del ítem al insertarlo: si el
    // ítem llegara primero, no la encontraría y lo rechazaría.
    const { db, cola } = modulos!
    const comidaId = db.registroComidas.abrirComida(almuerzo)
    db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

    expect(cola().map((o) => o.tabla)).toEqual(['registro_comida', 'registro_item'])
  })

  it('editar la misma comida cinco veces deja UN upsert, no cinco', () => {
    const { db, cola } = modulos!
    const comidaId = db.registroComidas.abrirComida(almuerzo)
    for (const aceiteG of [7, 14, 21, 28, 42]) {
      db.registroComidas.editarComida(VALENTINA, comidaId, { aceiteG })
    }

    const comidas = cola().filter((o) => o.tabla === 'registro_comida')
    expect(comidas).toHaveLength(1)
    expect(comidas[0].payload.aceite_g).toBe(42)
  })

  describe('quitar cosas', () => {
    it('un ítem se marca borrado, no se borra', () => {
      // La cola no sabe hacer `delete`. Y el rastro es información real: el
      // coach puede ver que algo se anotó y se quitó.
      const { db, cola } = modulos!
      const comidaId = db.registroComidas.abrirComida(almuerzo)
      db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)
      const [item] = db.registroComidas.delDia(VALENTINA, FECHA)[0].items

      db.registroComidas.quitarItem(VALENTINA, comidaId, item.id)

      const borrado = cola().find((o) => o.tipo === 'update' && o.tabla === 'registro_item')
      expect(borrado?.payload.borrado).toBe(true)
      expect(borrado?.filtro?.cliente_id).toBe(item.id)
    })

    it('una comida entera también', () => {
      const { db, cola } = modulos!
      const comidaId = db.registroComidas.abrirComida(almuerzo)
      db.registroComidas.borrarComida(VALENTINA, comidaId)

      const borrado = cola().find((o) => o.tipo === 'update' && o.tabla === 'registro_comida')
      expect(borrado?.payload.borrado).toBe(true)
      expect(borrado?.filtro?.cliente_id).toBe(comidaId)
    })
  })

  it('la preferencia de crudo o cocido también sube', () => {
    const { db, cola } = modulos!
    db.registroComidas.recordarPreferencia({
      usuarioId: VALENTINA,
      familia: 'arroz',
      estado: 'cocido',
    })

    const op = cola().find((o) => o.tabla === 'preferencia_estado')
    expect(op?.payload).toMatchObject({ asesorado_id: VALENTINA, familia: 'arroz', estado: 'cocido' })
  })

  describe('cuando las migraciones todavía no están aplicadas', () => {
    beforeEach(() => localStorage.setItem('alpha-tablas-registro', '0'))

    it('no encola nada, para no quemar los reintentos', () => {
      // Sin este freno, cada alimento anotado fallaría ocho veces y acabaría
      // descartado. El asesorado no vería ningún error: seguiría registrando
      // con normalidad mientras su día se evapora en la cola.
      const { db, cola } = modulos!
      const comidaId = db.registroComidas.abrirComida(almuerzo)
      db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

      expect(cola()).toEqual([])
    })

    it('pero el registro se guarda en el dispositivo igual', () => {
      const { db } = modulos!
      const comidaId = db.registroComidas.abrirComida(almuerzo)
      db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

      expect(db.registroComidas.delDia(VALENTINA, FECHA)[0].items).toHaveLength(1)
    })
  })

  describe('la encuesta de nutrición', () => {
    const encuesta = { genero: 'M', pesoKg: 56, alergias: ['lacteos'], cicloMenstrual: 'irregular' }

    it('a medias NO sube: el perfil se lee entero o no se lee', () => {
      const { db, cola } = modulos!
      db.perfilNutricion.guardar(VALENTINA, encuesta, false)
      expect(cola().filter((o) => o.tabla === 'perfil_alimentario')).toEqual([])
    })

    it('al terminarla sube, con las respuestas en crudo', () => {
      const { db, cola } = modulos!
      db.perfilNutricion.guardar(VALENTINA, encuesta, true)

      const op = cola().find((o) => o.tabla === 'perfil_alimentario')
      expect(op?.payload.asesorado_id).toBe(VALENTINA)
      expect(op?.payload.respuestas).toMatchObject(encuesta)
      expect(op?.payload.completada_en).toBeTruthy()
    })

    it('y con las columnas que se consultan, proyectadas del crudo', () => {
      // El jsonb es la fuente de verdad; estas columnas existen para poder
      // preguntar "quiénes no comen lácteos" sin abrir el jsonb de cada uno.
      const { db, cola } = modulos!
      db.perfilNutricion.guardar(VALENTINA, encuesta, true)

      const op = cola().find((o) => o.tabla === 'perfil_alimentario')
      expect(op?.payload.alergias).toEqual(['lacteos'])
      expect(op?.payload.ciclo_menstrual).toBe('irregular')
    })

    it('un texto libre entra como lista de un elemento, sin trocearlo', () => {
      // "no consigo salmón ni arándanos" es UNA respuesta. Partirla por comas
      // que la persona no puso sería inventarse una estructura.
      const { db, cola } = modulos!
      db.perfilNutricion.guardar(VALENTINA, { sinAcceso: 'salmón, arándanos' }, true)

      const op = cola().find((o) => o.tabla === 'perfil_alimentario')
      expect(op?.payload.sin_acceso).toEqual(['salmón, arándanos'])
    })

    describe('el embarazo declarado tiene que LLEGAR al motor', () => {
      /**
       * El hueco que estos tests cierran, y por qué son de seguridad.
       *
       * El motor veta el hígado en embarazo leyendo `condiciones_medicas`
       * (`topes_nutrientes.py` → `VETO_POR_CONDICION`). Esta columna se llenaba
       * solo con el texto libre de «¿tienes alguna condición médica?», así que
       * la respuesta de la pregunta de embarazo se quedaba en el jsonb: la
       * asesorada podía declarar que estaba embarazada y el motor le seguía
       * pudiendo proponer hígado.
       */
      const dentroDeUnAno = () => {
        const d = new Date()
        return `${d.getFullYear() + 1}-01-01`
      }

      it('el embarazo viaja como condición médica', () => {
        const { db, cola } = modulos!
        db.perfilNutricion.guardar(
          VALENTINA,
          { embarazo: 'si', fechaProbableParto: dentroDeUnAno() },
          true,
        )

        const op = cola().find((o) => o.tabla === 'perfil_alimentario')
        expect(op?.payload.condiciones_medicas).toContain('embarazo')
      })

      it('la lactancia también', () => {
        const { db, cola } = modulos!
        db.perfilNutricion.guardar(VALENTINA, { embarazo: 'lactancia' }, true)

        const op = cola().find((o) => o.tabla === 'perfil_alimentario')
        expect(op?.payload.condiciones_medicas).toContain('lactancia')
      })

      it('sin pisar lo que ella escribió de su puño y letra', () => {
        const { db, cola } = modulos!
        db.perfilNutricion.guardar(
          VALENTINA,
          { condicionesMedicas: 'hipotiroidismo', embarazo: 'lactancia' },
          true,
        )

        const op = cola().find((o) => o.tabla === 'perfil_alimentario')
        expect(op?.payload.condiciones_medicas).toEqual(['hipotiroidismo', 'lactancia'])
      })

      it('un embarazo caducado deja de viajar', () => {
        // La marca caduca por fecha probable de parto, y por eso la lista se
        // rehace cada vez que ella toca su perfil. Se mira que no esté, no que
        // la lista quede vacía: Valentina ya trae un «ninguna» escrito por ella
        // en condiciones médicas, y eso no se toca.
        const { db, cola } = modulos!
        db.perfilNutricion.guardar(
          VALENTINA,
          { embarazo: 'si', fechaProbableParto: '2020-01-01' },
          true,
        )

        const op = cola().find((o) => o.tabla === 'perfil_alimentario')
        expect(op?.payload.condiciones_medicas).not.toContain('embarazo')
      })

      it('quien no declaró nada no gana ninguna condición', () => {
        const { db, cola } = modulos!
        db.perfilNutricion.guardar('u-mateo', { genero: 'H' }, true)

        const op = cola().find((o) => o.tabla === 'perfil_alimentario')
        expect(op?.payload.condiciones_medicas).toBeNull()
      })
    })

    it('lo que no se respondió entra como null, no como lista vacía', () => {
      // Mateo no tiene perfil en el seed: `guardar` fusiona con lo previo, así
      // que hace falta alguien que empiece de cero para ver los huecos.
      const { db, cola } = modulos!
      db.perfilNutricion.guardar('u-mateo', { genero: 'H' }, true)

      const op = cola().find((o) => o.tabla === 'perfil_alimentario')
      expect(op?.payload.alergias).toBeNull()
      expect(op?.payload.come_visceras).toBeNull()
    })
  })

  describe('los vetos que escribe la nutricionista', () => {
    /**
     * Sin esto, Manuela codifica las alergias en su móvil y no salen de ahí.
     * La traducción de texto libre a alimentos es lo único que impide que la
     * app le proponga a alguien lo que le hace daño.
     */
    it('vetar sube la fila', () => {
      const { db, cola } = modulos!
      db.vetados.vetar({
        usuarioId: VALENTINA,
        alimentoId: 'arroz-blanco-cocido',
        motivo: 'alergia declarada',
      })

      const op = cola().find((o) => o.tabla === 'perfil_alimentario_veto')
      expect(op?.payload.asesorado_id).toBe(VALENTINA)
      expect(op?.payload.alimento_id).toBe('arroz-blanco-cocido')
      expect(op?.payload.borrado).toBe(false)
    })

    it('QUITAR SUBE UN UPSERT CON borrado, no un delete', () => {
      // La cola solo sabe upsert y update. Sin la columna de la 0035, quitar
      // un veto no llegaría a la base: ella lo vería desaparecer y volvería en
      // la siguiente hidratación.
      const { db, cola } = modulos!
      db.vetados.quitar(VALENTINA, 'arroz-blanco-cocido')

      const op = cola().find((o) => o.tabla === 'perfil_alimentario_veto')
      expect(op?.tipo).toBe('upsert')
      expect(op?.payload.borrado).toBe(true)
    })

    it('el motivo en blanco viaja como null, no como cadena vacía', () => {
      // La tabla lo comprueba: `motivo is null or length(trim(motivo)) > 0`.
      // Una cadena vacía haría fallar el upsert entero y el veto se perdería.
      const { db, cola } = modulos!
      db.vetados.vetar({ usuarioId: VALENTINA, alimentoId: 'papa-cocida', motivo: '  ' })

      const op = cola().find((o) => o.tabla === 'perfil_alimentario_veto')
      expect(op?.payload.motivo).toBeNull()
    })
  })

  describe('las pruebas de calibración', () => {
    const prueba = {
      usuarioId: VALENTINA,
      fecha: FECHA,
      alimentoId: 'arroz-blanco-pulido-cocido-sin-sal',
      gramosEstimados: 100,
      gramosReales: 130,
    }

    it('suben con su id de cliente', () => {
      const { db, cola } = modulos!
      db.calibracion.registrar(prueba)

      const op = cola().find((o) => o.tabla === 'prueba_calibracion')
      expect(op?.payload.cliente_id).toBeTruthy()
      expect(op?.payload.gramos_estimados).toBe(100)
      expect(op?.payload.gramos_reales).toBe(130)
    })

    it('el conflicto se resuelve por cliente_id, para que reintentar no duplique', () => {
      // Una prueba duplicada pesa el doble en la mediana del sesgo, y si cae en
      // un extremo mueve el veredicto: alguien con sesgo real podría pasar el
      // corte y registrar todo con un margen que no le corresponde.
      const { db, cola } = modulos!
      db.calibracion.registrar(prueba)
      expect(cola().find((o) => o.tabla === 'prueba_calibracion')?.onConflict).toBe('cliente_id')
    })

    it('sin las tablas aplicadas no se encola, pero sí se guarda en el móvil', () => {
      localStorage.setItem('alpha-tablas-registro', '0')
      const { db, cola } = modulos!
      db.calibracion.registrar(prueba)

      expect(cola().filter((o) => o.tabla === 'prueba_calibracion')).toEqual([])
      expect(db.calibracion.byUsuario(VALENTINA)).toHaveLength(1)
    })
  })

  it('lo local se guarda aunque no haya red', () => {
    // El registro no depende de que la subida funcione. Es lo que permite
    // anotar en un sótano sin cobertura.
    const { db } = modulos!
    const comidaId = db.registroComidas.abrirComida(almuerzo)
    db.registroComidas.agregarItem(VALENTINA, comidaId, arroz)

    expect(db.registroComidas.delDia(VALENTINA, FECHA)[0].items).toHaveLength(1)
  })
})
