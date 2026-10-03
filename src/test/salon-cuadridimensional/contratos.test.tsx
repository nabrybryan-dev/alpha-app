import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import {
  CLAVES_ANTROPOMETRICAS,
  LIMITES_ANTROPOMETRICOS,
  validarAntropometria,
} from '../../domain/antropometria'
import { analizarBiomecanica } from '../../features/entrenar/encoder/analisisBiomecanico'
import { patronDeCategoria } from '../../domain/patrones/catalogo'
import { descripcionDeCadena } from '../../domain/patrones/acciones'
import type {
  EjercicioPrescrito,
  MedidasAntropometricas,
  Microciclo,
  PerfilAntropometrico,
  Sesion,
} from '../../domain/types'
import {
  _antropometriaLocal,
  guardarPerfilAntropometrico,
  perfilAntropometricoDe,
} from '../../data/antropometria/local'
import { db } from '../../data/dbInstance'
import { reiniciarDb } from '../../data/mockDb'
import { EncuestaPalancas } from '../../features/entrenar/antropometria/EncuestaPalancas'
import { MEDIDAS_DE_PALANCAS } from '../../features/entrenar/antropometria/perfil'
import {
  estructurasDe,
  estructurasDesconocidas,
  musculosSinNivel,
} from '../../features/entrenar/capas/nivelesAnatomicos'
import { mallasDelSujeto } from '../../features/entrenar/capas/mallaDelNivel'
import { ArquitecturaSala } from '../../features/entrenar/salon/sala/ArquitecturaSala'
import { trazarSalon } from '../../features/entrenar/salon/sala/trazadoDelSalon'
import { SalonCuadridimensional } from '../../features/entrenar/salon/SalonCuadridimensional'
import SesionPage from '../../features/entrenar/SesionPage'

vi.mock('../../features/entrenar/visor/VisorPatron', () => ({
  VisorPatron: ({ patron }: { patron: { id: string } }) => (
    <canvas aria-label={`visor simulado ${patron.id}`} data-testid="visor-patron" />
  ),
}))

const SABOTAJE = process.env.SALON_SABOTAJE
const medidas: MedidasAntropometricas = {
  tibiaPeroneCm: 42,
  femurCm: 46,
  torsoCm: 52,
  antebrazoCm: 27,
  brazoCm: 31,
  anchoClavicularCm: 40,
  cinturaCm: 80,
  caderasCm: 96,
}

function perfil(usuarioId = 'u-prueba'): PerfilAntropometrico {
  return { usuarioId, actualizadoEn: '2026-09-01T12:00:00.000Z', ...medidas }
}

function ejercicio(parcial: Partial<EjercicioPrescrito> = {}): EjercicioPrescrito {
  return {
    id: 'e-salon',
    categoria: 'SENTADILLA',
    nombre: 'Sentadilla con barra',
    cues: 'Conserva el mediopié.',
    prescripcion: '3 series de 8 repeticiones.',
    descansoMin: 2,
    sets: 3,
    rango: '8',
    repsDiana: 8,
    rirObjetivo: 2,
    series: [],
    ...parcial,
  }
}

function sesion(ejercicios: EjercicioPrescrito[] = [ejercicio()]): Sesion {
  return {
    id: 's-salon-qa',
    orden: 1,
    nombre: 'Fuerza QA',
    tipo: 'fuerza',
    ejercicios,
  }
}

describe('salón cuadridimensional · contratos independientes', () => {
  beforeEach(() => {
    localStorage.clear()
    reiniciarDb()
  })

  it('C01 · pide exactamente las ocho claves acordadas y ninguna novena', () => {
    const claves: string[] = [...CLAVES_ANTROPOMETRICAS]
    if (SABOTAJE === 'C01') claves.push('estaturaCm')

    expect(claves).toEqual([
      'tibiaPeroneCm',
      'femurCm',
      'torsoCm',
      'antebrazoCm',
      'brazoCm',
      'anchoClavicularCm',
      'cinturaCm',
      'caderasCm',
    ])
    expect(MEDIDAS_DE_PALANCAS.map((m) => m.clave)).toEqual(claves)

    render(<EncuestaPalancas onGuardar={vi.fn()} />)
    expect(screen.getAllByRole('spinbutton')).toHaveLength(8)
  })

  it('C02 · acepta los límites inclusivos y rechaza borde exterior, ausencias y no finitos', () => {
    for (const clave of CLAVES_ANTROPOMETRICAS) {
      const limite = LIMITES_ANTROPOMETRICOS[clave]
      expect(validarAntropometria({ ...medidas, [clave]: limite.minimoCm }).valida).toBe(true)
      expect(validarAntropometria({ ...medidas, [clave]: limite.maximoCm }).valida).toBe(true)
      const debajo = SABOTAJE === 'C02' && clave === 'femurCm'
        ? limite.minimoCm
        : limite.minimoCm - 0.1
      expect(validarAntropometria({ ...medidas, [clave]: debajo }).valida).toBe(false)
      expect(validarAntropometria({ ...medidas, [clave]: limite.maximoCm + 0.1 }).valida).toBe(false)
    }
    expect(validarAntropometria({ ...medidas, torsoCm: Number.NaN }).valida).toBe(false)
    const sinBrazo = { ...medidas } as Partial<MedidasAntropometricas>
    delete sinBrazo.brazoCm
    expect(validarAntropometria(sinBrazo).valida).toBe(false)
  })

  it('C03 · persiste por usuario, aislado de alpha-db-v2, y no reemplaza la copia previa si la escritura muere', () => {
    localStorage.setItem('alpha-db-v2', '{"perfil":"intacto"}')
    const previo = guardarPerfilAntropometrico('u-1', medidas, '2026-09-01T10:00:00.000Z')
    guardarPerfilAntropometrico('u-2', { ...medidas, femurCm: 50 }, '2026-09-01T11:00:00.000Z')
    expect(perfilAntropometricoDe('u-1')).toEqual(previo)
    expect(perfilAntropometricoDe('u-2')?.femurCm).toBe(50)
    expect(localStorage.getItem('alpha-db-v2')).toBe('{"perfil":"intacto"}')
    expect(_antropometriaLocal.CLAVE).toBe('alpha-antropometria-v1')

    const fotoAnterior = localStorage.getItem(_antropometriaLocal.CLAVE)
    const setItemReal = Storage.prototype.setItem
    const espia = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, clave, valor) {
      if (clave === _antropometriaLocal.CLAVE) throw new Error('SABOTAJE: escritura interrumpida')
      return setItemReal.call(this, clave, valor)
    })
    expect(() => guardarPerfilAntropometrico('u-1', { ...medidas, femurCm: 60 })).toThrow(
      'SABOTAJE: escritura interrumpida',
    )
    espia.mockRestore()
    if (SABOTAJE === 'C03') localStorage.setItem(_antropometriaLocal.CLAVE, '[]')
    expect(localStorage.getItem(_antropometriaLocal.CLAVE)).toBe(fotoAnterior)
  })

  it('C04 · resuelve los cinco ejercicios comprometidos a patrones concretos', () => {
    const casos = [
      ['SENTADILLA', 'Sentadilla con barra', 'sentadilla'],
      ['EMPUJE HORIZONTAL', 'Press de banca plano', 'empuje_horizontal'],
      ['EMPUJE VERTICAL', 'Press militar', 'empuje_vertical'],
      ['BISAGRA DE CADERA', 'Peso muerto convencional con barra', 'peso_muerto_convencional'],
      ['TRACCIÓN VERTICAL', 'Dominada prona', 'dominada'],
    ] as const
    const resueltos = casos.map(([categoria, nombre]) => patronDeCategoria(categoria, nombre)?.id)
    if (SABOTAJE === 'C04') resueltos[4] = patronDeCategoria('TRACCIÓN VERTICAL', 'Jalón al pecho')?.id
    expect(resueltos).toEqual(casos.map(([, , id]) => id))
  })

  it('C05 · la dominada es cerrada: manos fijas y cuerpo móvil', () => {
    const patron = patronDeCategoria('TRACCIÓN VERTICAL', SABOTAJE === 'C05' ? 'Jalón al pecho' : 'Dominada prona')
    expect(patron?.id).toBe('dominada')
    expect(patron?.cadena).toBe('cerrada')
    expect(patron?.apoyo).toBe('manos')
    expect(patron && descripcionDeCadena(patron)).toMatch(/manos quedan fijas.*cuerpo se mueve/i)
    expect(patron?.raizFin?.[1]).toBeGreaterThan(patron?.raizInicio?.[1] ?? Infinity)
  })

  it('C06 · el convencional nace en el suelo y no reutiliza el rumano', () => {
    const convencional = patronDeCategoria('BISAGRA DE CADERA', 'Peso muerto convencional con barra')
    const rumano = patronDeCategoria('BISAGRA DE CADERA', 'Peso muerto rumano con barra')
    const idConvencional = SABOTAJE === 'C06' ? rumano?.id : convencional?.id
    expect(idConvencional).toBe('peso_muerto_convencional')
    expect(rumano?.id).not.toBe(idConvencional)
    expect(convencional?.resumen).toMatch(/parte del suelo/i)
    expect((convencional?.inicio.rodillaFlex ?? 0) - (convencional?.fin.rodillaFlex ?? 0)).toBeGreaterThan(25)
    expect(Math.abs((rumano?.inicio.rodillaFlex ?? 0) - (rumano?.fin.rodillaFlex ?? 0))).toBeLessThanOrEqual(15)
  })

  it('C07 · las cinco capas W producen estructuras y cargas de malla distintas', () => {
    const patron = patronDeCategoria('SENTADILLA', 'Sentadilla con barra')
    if (!patron) throw new Error('No existe patrón de sentadilla para probar W')
    const firmas = ([0, 1, 2, 3, 4] as const).map((w) =>
      JSON.stringify(mallasDelSujeto(w, patron).map((m) => ({
        pieza: m.pieza,
        acabado: m.acabado,
        porciones: m.porciones,
        huesos: m.huesos,
      }))),
    )
    if (SABOTAJE === 'C07') firmas[3] = firmas[2]
    expect(new Set(firmas).size).toBe(5)
    for (const w of [0, 1, 2, 3, 4] as const) expect(estructurasDe(w).length).toBeGreaterThan(0)
    expect(estructurasDesconocidas()).toEqual([])
    expect(musculosSinNivel()).toEqual({ fuera: [], repetidos: [] })
  })

  it('C08 · la arquitectura pinta literalmente suelo, techo y tres muros', () => {
    const trazado = trazarSalon()
    const { container } = render(<ArquitecturaSala />)
    const svg = container.querySelector('svg')
    if (!svg) throw new Error('La arquitectura no montó su SVG')
    const trazos = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d'))
    if (SABOTAJE === 'C08') trazos.splice(trazos.indexOf(trazado.muroDerecho), 1)
    expect(trazos).toEqual(expect.arrayContaining([
      trazado.suelo,
      trazado.techo,
      trazado.muroIzquierdo,
      trazado.muroDerecho,
      trazado.muroDelFondo,
    ]))
  })

  it('C09A · la lectura biomecánica pura traza cada regla aprobada sin encender una grabación', () => {
    const dominada = analizarBiomecanica({
      categoria: 'TRACCIÓN VERTICAL',
      nombreEjercicio: 'Dominada prona',
      antropometria: perfil(),
    })
    const reglas = [...dominada.trazabilidad.reglasAplicadas]
    if (SABOTAJE === 'C09A') reglas.pop()
    expect(reglas).toContain('BIO-DOMINADA-BRAZOS-TORSO-04')
    expect(dominada.trazabilidad.cadena).toBe('cerrada')
    expect(dominada.trazabilidad.origenLinea).toBe('centro-de-masas')
    expect(dominada.trazabilidad.aprobaciones.map((a) => a.reglaId)).toEqual(reglas)
    expect(dominada.trazabilidad.aprobaciones.every((a) => a.estado === 'aprobada')).toBe(true)

    const fuente = readFileSync(resolve('src/features/entrenar/encoder/analisisBiomecanico.ts'), 'utf8')
    expect(fuente).not.toMatch(/getUserMedia|MediaRecorder|useCaptura/)
  })

  it('C09B · el análisis posterior distingue sin grabación e incompatibilidad por firma semanal', () => {
    type FirmaEncoder = {
      patron: string
      variante: string
      cargaKg: number
      rom: string
      escala: string
      fps: number
      version: string
    }
    type EstadoEncoder =
      | { estado: 'sin-grabacion' }
      | { estado: 'incompatible'; motivos: string[]; firmaActual: FirmaEncoder; firmaAnterior: FirmaEncoder }
      | { estado: 'analizado'; firma: FirmaEncoder; reglaIds: string[] }
    const ejecutar = analizarBiomecanica as unknown as (
      entrada: Record<string, unknown>,
    ) => { encoder?: EstadoEncoder }
    const base = {
      categoria: 'TRACCIÓN VERTICAL',
      nombreEjercicio: 'Dominada prona',
      antropometria: perfil(),
    }
    const firma: FirmaEncoder = {
      patron: 'dominada',
      variante: 'prona',
      cargaKg: 0,
      rom: 'completo',
      escala: 'barra-40-mm',
      fps: 50,
      version: 'encoder-v2',
    }

    expect(ejecutar(base).encoder).toEqual({ estado: 'sin-grabacion' })
    expect(ejecutar({ ...base, capturaActual: { firma, resultado: { velocidadMs: 0.42 } } }).encoder)
      .toMatchObject({ estado: 'analizado', firma, reglaIds: expect.arrayContaining(['BIO-DOMINADA-BRAZOS-TORSO-04']) })

    const firmaAnterior = SABOTAJE === 'C09B'
      ? { ...firma }
      : { ...firma, variante: 'neutra', fps: 60 }
    expect(ejecutar({
      ...base,
      capturaActual: { firma, resultado: { velocidadMs: 0.42 } },
      capturaAnterior: { firma: firmaAnterior, resultado: { velocidadMs: 0.48 } },
    }).encoder).toMatchObject({
      estado: 'incompatible',
      motivos: expect.arrayContaining([expect.stringMatching(/variante|fps/i)]),
      firmaActual: firma,
      firmaAnterior,
    })
  })

  it('C10 · conserva estados de salón vacío, carga y error sin ocultar la prescripción', () => {
    const s = sesion([])
    const { rerender } = render(
      <SalonCuadridimensional
        usuarioId="u-estados"
        microcicloNumero={1}
        sesion={s}
        indiceEjercicio={0}
        totalEjercicios={0}
      />,
    )
    expect(screen.getByText('Sala en pausa')).toBeInTheDocument()

    rerender(
      <SalonCuadridimensional
        usuarioId="u-estados"
        microcicloNumero={1}
        sesion={s}
        ejercicio={ejercicio()}
        indiceEjercicio={0}
        totalEjercicios={1}
        estado="cargando"
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Preparando sujeto anatómico')

    rerender(
      <SalonCuadridimensional
        usuarioId="u-estados"
        microcicloNumero={1}
        sesion={s}
        ejercicio={ejercicio()}
        indiceEjercicio={0}
        totalEjercicios={1}
        estado={SABOTAJE === 'C10' ? 'listo' : 'error'}
        detalleError="WebGL perdió el contexto"
      />,
    )
    expect(screen.getByText('El sujeto no pudo cargar')).toBeInTheDocument()
    expect(screen.getByText('WebGL perdió el contexto')).toBeInTheDocument()
    expect(screen.getByText('Sentadilla con barra')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('2 min')).toBeInTheDocument()
  })

  it('C11 · el salón no corta el flujo real de registro de serie', async () => {
    const base = db.microciclos.byUsuario('u-valentina').find((m) => m.estado === 'activo')
    if (!base) throw new Error('El seed no trae un microciclo activo')
    const ex = ejercicio({ id: 'e-registro-salon', sets: 3 })
    const s = sesion([ex])
    const propuesta: Microciclo = {
      ...base,
      id: 'm-registro-salon',
      numero: base.numero + 1,
      estado: 'propuesto',
      fechaInicio: '2026-09-01',
      sesiones: [s],
    }
    db.microciclos.guardarPropuesta(propuesta)
    db.microciclos.activarPropuesta(propuesta.id)
    db.antropometria.guardar('u-valentina', medidas)

    render(
      <ThemeProvider>
        <SessionProvider>
          <MemoryRouter initialEntries={[`/entrenar/sesion/${s.id}`]}>
            <Routes>
              <Route path="/entrenar/sesion/:sesionId" element={<SesionPage />} />
            </Routes>
          </MemoryRouter>
        </SessionProvider>
      </ThemeProvider>,
    )

    const boton = screen.getByRole('button', { name: 'Guardar serie 1' })
    if (SABOTAJE === 'C11') boton.remove()
    expect(screen.getByRole('button', { name: 'Guardar serie 1' })).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Guardar serie 1' }))
    const guardada = db.microciclos
      .byUsuario('u-valentina')
      .find((m) => m.id === propuesta.id)
      ?.sesiones[0].ejercicios[0].series
    expect(guardada).toHaveLength(1)
    expect(guardada?.[0]).toMatchObject({ orden: 1, reps: 8, rir: 2 })
  })
})
