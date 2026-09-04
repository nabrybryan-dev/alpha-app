import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, hoyIso } from '../../../../data/dbInstance'
import { cargaPorGrupo } from '../../../../domain/fatiga'
import { notasDelMicrociclo } from '../../../../domain/notasDeLaSemana'
import { requisitosParaPeldano } from '../../../../domain/nivelesAlfa'
import { PATRONES, patronDeCategoria } from '../../../../domain/patrones/catalogo'
import { indiceRecuperacion } from '../../../../domain/readiness'
import {
  armarSemana,
  competenciasCalculadas,
  estadisticasCalculadas,
  progresoAlSiguiente,
  type DatosRuta,
} from '../../../../domain/rutaEntrenamiento'
import type { EjercicioPrescrito, Sesion } from '../../../../domain/types'
import { TOPE_PARED } from '../huecos'
import { SalonEntrenar } from '../SalonEntrenar'
import { SalonSinSujeto, tienePatronDeMovimiento } from './SalonSinSujeto'

/**
 * SIN SUJETO: el centro cuando el ejercicio no tiene modelo, y el visor que NO se monta.
 *
 * ## De dónde salen los casos de prueba
 *
 * De ningún sitio inventado. La regla de «esto tiene patrón / esto no» vive entera en
 * `patronDeCategoria()` —alias de categoría, búsqueda por nombre y el apartado que deja fuera
 * el cardio y los cribados—, así que aquí:
 *
 * - los ejercicios CON patrón se construyen sobre las categorías reales de `PATRONES`, la
 *   lista importada del catálogo;
 * - los ejercicios SIN patrón se sacan del propio seed de demo, que trae ocho reales;
 * - y la respuesta correcta la da siempre `patronDeCategoria()`, no una lista escrita aquí.
 *
 * Copiar los términos habría creado una segunda lista que se separa de la primera: el día que
 * el catálogo aprenda un patrón nuevo, un test con la lista copiada seguiría exigiendo que no
 * lo tenga, y el rojo apuntaría al sitio equivocado.
 *
 * ## Lo que jsdom sí puede decir aquí
 *
 * Que el visor NO se monta es comprobable sin WebGL: se mira si hay `<canvas>` en el árbol.
 * `getContext('webgl')` devolvería `null` de todas formas, pero el `<canvas>` existe en el DOM
 * en cuanto `VisorPatron` se monta, así que su ausencia es prueba de que no se montó — que es
 * justo lo que hay que garantizar, porque en un móvil montarlo y esconderlo con CSS arrancaría
 * un contexto WebGL entero para no enseñar nada.
 */

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e-prueba',
    categoria: 'AISLAMIENTO',
    nombre: 'Ejercicio de prueba',
    cues: '',
    prescripcion: '',
    descansoMin: 2,
    sets: 3,
    rango: '(8-12)',
    repsDiana: 10,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

/** Los ejercicios del seed que el catálogo deja SIN patrón. Reales, no inventados. */
function ejerciciosDelSeedSinPatron(): EjercicioPrescrito[] {
  const vistos = new Set<string>()
  const salida: EjercicioPrescrito[] = []
  for (const usuario of db.usuarios.list()) {
    for (const micro of db.microciclos.byUsuario(usuario.id)) {
      for (const sesion of micro.sesiones) {
        for (const e of sesion.ejercicios) {
          const clave = `${e.categoria}|${e.nombre}`
          if (vistos.has(clave)) continue
          vistos.add(clave)
          if (!patronDeCategoria(e.categoria, e.nombre)) salida.push(e)
        }
      }
    }
  }
  return salida
}

/** La sesión metabólica del seed: sin ejercicios y con bloques de cardio. */
function sesionMetabolicaDelSeed(): Sesion {
  const usuario = db.usuarios.byId('u-valentina')!
  const micro = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const metabolica = micro.sesiones.find((s) => (s.bloquesCardio?.length ?? 0) > 0)
  if (!metabolica) throw new Error('el seed ya no trae una sesión con bloques de cardio')
  return metabolica
}

/** Monta el salón entero con la sesión que se le pase. */
function montarSalon(sesion: Sesion | undefined) {
  const usuario = db.usuarios.byId('u-valentina')!
  const microciclo = db.microciclos.byUsuario(usuario.id).find((m) => m.estado === 'activo')!
  const hoy = hoyIso()
  const datos: DatosRuta = {
    microcicloNumero: microciclo.numero,
    sesionesRegistradas: 0,
    sesionesTotales: microciclo.sesiones.length,
    seriesPorGrupo: cargaPorGrupo(microciclo).map((g) => g.seriesPautadas),
  }
  const requisitos = requisitosParaPeldano(2, datos)
  return render(
    <MemoryRouter>
      <SalonEntrenar
        microciclo={microciclo}
        ruta={db.ruta.byUsuario(usuario.id)}
        recuperacion={indiceRecuperacion(db.bienestar.byUsuario(usuario.id), hoy)}
        progresoPct={progresoAlSiguiente(requisitos)}
        estadisticas={estadisticasCalculadas(datos)}
        competencias={competenciasCalculadas(datos)}
        requisitos={requisitos}
        semana={armarSemana(microciclo, hoy)}
        notas={notasDelMicrociclo(microciclo)}
        sesion={sesion}
      />
    </MemoryRouter>,
  )
}

/** Una sesión de mentira con un solo ejercicio, para elegir qué ocupa el centro. */
function sesionCon(e: EjercicioPrescrito): Sesion {
  return { id: 's-prueba', nombre: 'SESIÓN DE PRUEBA', orden: 1, ejercicios: [e] }
}

/** El fuente sin comentarios: lo que el archivo HACE, separado de lo que el archivo CUENTA. */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const hayVisor = () => document.querySelector('canvas') !== null
const haySinSujeto = () => document.querySelector('[data-sin-sujeto="true"]') !== null

describe('quién decide si hay sujeto', () => {
  it('`tienePatronDeMovimiento` no es una segunda regla: es `patronDeCategoria`', () => {
    // Se comprueba sobre las categorías reales del catálogo Y sobre los ejercicios reales del
    // seed. Si alguna vez las dos respuestas se separan, el salón enseñaría un modelo donde el
    // dominio dice que no lo hay, o al revés.
    const casos: EjercicioPrescrito[] = [
      ...PATRONES.map((p) => ejercicio({ categoria: p.categoria, nombre: p.ejemplos })),
      ...ejerciciosDelSeedSinPatron(),
    ]
    expect(casos.length).toBeGreaterThan(PATRONES.length)
    for (const e of casos) {
      expect(
        tienePatronDeMovimiento(e),
        `${e.categoria} | ${e.nombre}: las dos respuestas se han separado`,
      ).toBe(patronDeCategoria(e.categoria, e.nombre) !== undefined)
    }
  })

  it('sin ejercicio no hay sujeto: no se inventa uno para llenar el centro', () => {
    expect(tienePatronDeMovimiento(undefined)).toBe(false)
  })
})

describe('el salón sin patrón de movimiento', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => cleanup())

  it.each(ejerciciosDelSeedSinPatron().map((e) => [e.nombre, e] as const))(
    'con «%s» monta SalonSinSujeto y NO monta el visor',
    (_nombre, e) => {
      montarSalon(sesionCon(e))
      expect(haySinSujeto()).toBe(true)
      expect(hayVisor(), 'se montó un canvas para un ejercicio sin modelo').toBe(false)
      // Y el hueco declarado es el del contrato, no un div suelto.
      expect(document.querySelector('[data-hueco="sinPatron"]')).not.toBeNull()
    },
  )

  it('con la sesión metabólica del seed el centro dice que no hay modelo', () => {
    montarSalon(sesionMetabolicaDelSeed())
    expect(haySinSujeto()).toBe(true)
    expect(hayVisor()).toBe(false)
    expect(screen.getByText(/Sin modelo 3D para este ejercicio/)).toBeInTheDocument()
    expect(screen.getByText(/No hay gesto resistido que enseñar/)).toBeInTheDocument()
  })

  /**
   * EL RESTO DEL SALÓN SIGUE EN PIE; EL EJE W NO.
   *
   * Este test decía lo contrario —«la escalera del eje W también: cambiar de capa no
   * depende de que haya modelo»— y esa frase la derogó lo que Bryan vio en el iPhone: los
   * cinco peldaños encendidos a la derecha de una pantalla sin nadie. W no es un ajuste de
   * la pantalla, es la profundidad DEL CUERPO: sin cuerpo no hay piel ni hueso, así que no
   * hay escalón que subir, y una escalera que responde al dedo sin cambiar nada de lo que
   * se ve enseña un mando roto.
   *
   * Lo que sí se queda es todo lo demás: el salón, sus huecos y el panel de abajo. Que la
   * escalera vuelva entera en cuanto hay patrón se comprueba en el test siguiente.
   */
  it('y el resto del salón sigue en pie, pero el eje W se apaga con el sujeto', () => {
    montarSalon(sesionMetabolicaDelSeed())
    const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
    expect(salon).not.toBeNull()
    // El panel de abajo, que es donde vive lo largo, sigue estando.
    expect(salon.querySelector('[data-hueco="panelInferior"]')).not.toBeNull()
    // La escalera del eje W, en cambio, no se monta: ni el grupo ni un peldaño suelto.
    expect(salon.querySelector('[role="group"][aria-label="Capa del cuerpo"]')).toBeNull()
    expect(salon.querySelectorAll('button[aria-pressed]')).toHaveLength(0)
    // `data-w` sigue puesto en la piel: es la capa en la que ESTÁ el salón, no un mando.
    expect(salon.getAttribute('data-w')).toBe('0')
  })

  it.each(PATRONES.map((p) => [p.categoria, p] as const))(
    'y con la categoría real «%s» la escalera vuelve entera, con sus cinco peldaños',
    (categoria, patron) => {
      // La otra mitad de la regla, sobre las MISMAS categorías reales del catálogo. Sin
      // esto, el test de arriba se quedaría verde el día que la escalera se fuera para
      // siempre: «no está» es media comprobación.
      montarSalon(sesionCon(ejercicio({ categoria, nombre: patron.ejemplos })))
      const salon = document.querySelector('[data-salon="entrenar"]') as HTMLElement
      expect(hayVisor(), `no hay cuerpo que atravesar en ${categoria}`).toBe(true)
      // La escalera de cinco botones se fue el 2026-09-04. Lo que prueba lo mismo es que
      // el eje se pueda ATRAVESAR: con cuerpo en el centro, el dedo entra.
      const centro = salon.querySelector('[data-hueco="centro"]') as HTMLElement
      const dedo = (tipo: string, y: number) =>
        fireEvent(centro, new MouseEvent(tipo, { bubbles: true, cancelable: true, clientX: 200, clientY: y }))
      dedo('pointerdown', 400)
      dedo('pointermove', 200)
      dedo('pointerup', 200)
      expect(salon.getAttribute('data-w'), `no se pudo atravesar con ${categoria}`).toBe('1')
    },
  )

  it.each(PATRONES.map((p) => [p.categoria, p] as const))(
    'en cambio, con la categoría real «%s» sí se monta el visor',
    (categoria, patron) => {
      // El contraste importa: si el salón NUNCA montara el visor, todos los test de arriba
      // pasarían por la razón equivocada.
      montarSalon(sesionCon(ejercicio({ categoria, nombre: patron.ejemplos })))
      expect(hayVisor(), `no se montó el visor para ${categoria}`).toBe(true)
      expect(haySinSujeto()).toBe(false)
      expect(
        screen.getByLabelText(new RegExp(`Modelo tridimensional del patrón ${patron.titulo}`, 'i')),
      ).toBeInTheDocument()
    },
  )
})

describe('SalonSinSujeto, la pieza suelta', () => {
  afterEach(() => cleanup())

  it('no importa el visor ni condicionalmente', () => {
    // No basta con que no se monte: montarlo y esconderlo con CSS arrancaría igual un
    // contexto WebGL entero en un móvil que a lo mejor está grabando una serie. La única
    // garantía de verdad es que el archivo no lo conozca.
    //
    // Se miran los comentarios APARTE: la cabecera del archivo nombra las dos piezas justo
    // para explicar que no las usa, y buscar la palabra a pelo daría rojo por leer la
    // explicación. Lo que no puede haber es código.
    const codigo = sinComentarios(readFileSync(join(__dirname, 'SalonSinSujeto.tsx'), 'utf8'))
    expect(codigo).not.toContain('VisorPatron')
    expect(codigo).not.toContain('EstudioDelPatron')
    expect(codigo).not.toContain('canvas')
    // Y ni un import más allá del dominio y del propio contrato de huecos.
    const imports = [...codigo.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    expect(imports.every((i) => i.includes('/domain/') || i === '../huecos')).toBe(true)
  })

  it('enseña los cuatro datos de la prescripción, y dice cuáles faltan en vez de inventarlos', () => {
    render(<SalonSinSujeto bloques={sesionMetabolicaDelSeed().bloquesCardio} />)
    for (const rotulo of ['minutos', 'zona', 'ritmo', 'descanso']) {
      expect(
        document.querySelector(`[data-prescripcion="${rotulo}"]`),
        `falta el dato «${rotulo}»`,
      ).not.toBeNull()
    }
  })

  it('sin nada escrito no se calla ni se inventa: dice que no hay dato', () => {
    render(<SalonSinSujeto />)
    expect(screen.getByText('Sin minutos prescritos')).toBeInTheDocument()
    expect(screen.getByText('Sin zona ni RPE escritos')).toBeInTheDocument()
    expect(screen.getByText('Sin ritmo escrito')).toBeInTheDocument()
  })

  it('ningún texto del centro se pasa del tope del hueco', () => {
    // `sinPatron` declara el mismo `topeDeTexto` que las paredes, y por el mismo motivo: se
    // lee de reojo en mitad de la pantalla. Lo largo baja íntegro al panel.
    const { container } = render(<SalonSinSujeto bloques={sesionMetabolicaDelSeed().bloquesCardio} />)
    for (const nodo of Array.from(container.querySelectorAll('p, dt, dd'))) {
      const texto = (nodo.textContent ?? '').trim()
      expect([...texto].length, `se pasa del tope: «${texto}»`).toBeLessThanOrEqual(TOPE_PARED)
    }
  })
})
