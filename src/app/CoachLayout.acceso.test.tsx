import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Rol } from '../domain/types'

/**
 * La consola se abre por CAPACIDAD, no por rol (decisión de Bryan, 26-sep). El resto del
 * panel del coach sigue siendo solo del coach. Se sustituyen la sesión y las capacidades
 * en su capa más baja para probar la guarda real de `CoachLayout`.
 */
const estado = {
  rol: 'nutricionista' as Rol,
  cargando: false,
  capacidades: new Set<string>(),
}

vi.mock('./SessionProvider', () => ({
  useSesion: () => ({
    usuario: { id: 'u-staff', nombre: 'Staff', rol: estado.rol, avatarIniciales: 'ST' },
    esNube: false,
    cambiarUsuario: () => {},
    cerrarSesion: () => {},
  }),
  useSesionOpcional: () => null,
}))

vi.mock('../features/coach/consola/useCapacidades', () => ({
  useCapacidades: () => ({
    cargando: estado.cargando,
    tiene: (c: string) => estado.capacidades.has(c),
    usuarioId: 'u-staff',
  }),
}))

vi.mock('../components/ui/TopBar', () => ({ TopBar: ({ titulo }: { titulo: string }) => <h1>{titulo}</h1> }))

const { CoachLayout } = await import('./layouts')

function en(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/" element={<p>Portada</p>} />
        <Route path="/tablero" element={<p>Tablero a pantalla completa</p>} />
        <Route path="/coach" element={<CoachLayout />}>
          <Route index element={<p>Cartera del coach</p>} />
          <Route path="consola" element={<p>Contenido de la consola</p>} />
          <Route path="estrategias" element={<p>Contenido de estrategias</p>} />
          <Route path="administracion" element={<p>Contenido de administracion</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('CoachLayout · acceso por capacidad', () => {
  afterEach(() => {
    estado.rol = 'nutricionista'
    estado.cargando = false
    estado.capacidades = new Set()
  })

  it('staff con leer_entrenamiento entra a la consola', () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    en('/coach/consola')
    expect(screen.getByText('Contenido de la consola')).toBeInTheDocument()
    // Sin los enlaces del panel del coach. La vuelta a su app ya la hace el «‹» de la cabecera (aquí
    // simulada): el enlace «Volver a mi app» no se repite donde el «‹» existe.
    expect(screen.queryByText('Revisar audios y vídeos')).not.toBeInTheDocument()
    expect(screen.queryByText('Volver a mi app')).not.toBeInTheDocument()
  })

  it('Estrategias y Administración también llevan «‹» (a Empresa): no repiten el «Volver a mi app» de texto', () => {
    estado.capacidades = new Set(['responder_mercadeo', 'ver_administracion', 'organizar_plan'])
    const a = en('/coach/estrategias')
    expect(screen.queryByText('Volver a mi app')).not.toBeInTheDocument()
    a.unmount()
    en('/coach/administracion')
    expect(screen.queryByText('Volver a mi app')).not.toBeInTheDocument()
  })

  it('…pero el resto del panel del coach sigue siendo solo del coach', () => {
    estado.capacidades = new Set(['leer_entrenamiento'])
    en('/coach')
    expect(screen.getByText('Portada')).toBeInTheDocument()
    expect(screen.queryByText('Cartera del coach')).not.toBeInTheDocument()
  })

  it('staff SIN la capacidad va a la portada, como antes', () => {
    estado.capacidades = new Set(['responder_por_asesorado'])
    en('/coach/consola')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })

  it('mientras las capacidades cargan no abre ni echa: espera', () => {
    estado.cargando = true
    en('/coach/consola')
    expect(screen.getByText('Comprobando tu acceso a la consola…')).toBeInTheDocument()
    expect(screen.queryByText('Contenido de la consola')).not.toBeInTheDocument()
    expect(screen.queryByText('Portada')).not.toBeInTheDocument()
  })

  it('el coach entra a todo, tenga o no filas de capacidades', () => {
    estado.rol = 'coach'
    en('/coach')
    expect(screen.getByText('Cartera del coach')).toBeInTheDocument()
    expect(screen.getByText('Revisar audios y vídeos')).toBeInTheDocument()
  })

  it('el coach con ver_administracion ve Administración; sin ella, «sin permiso» y la barra lleva a Empresa', () => {
    estado.rol = 'coach'
    estado.capacidades = new Set(['ver_administracion'])
    const a = en('/coach/administracion')
    expect(screen.getByText('Contenido de administracion')).toBeInTheDocument()
    // La pestaña directa ya no existe: las herramientas se agrupan en Empresa (paso 11).
    expect(screen.getAllByRole('link', { name: 'Empresa' }).length).toBeGreaterThan(0)
    a.unmount()
    estado.capacidades = new Set(['decisiones_compartidas', 'organizar_plan'])
    en('/coach/administracion')
    expect(screen.getByRole('alert').textContent).toMatch(/Sin permiso/)
    expect(screen.queryByText('Contenido de administracion')).not.toBeInTheDocument()
    // La salida es el «‹» de la cabecera, no un enlace de texto suelto.
    expect(screen.queryByRole('link', { name: 'Volver' })).toBeNull()
    // La fuerza que tenía esta prueba en main: lo que la puerta devuelve no se ofrece como enlace.
    expect(screen.queryByRole('link', { name: 'Administración' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Empresa' }).length).toBeGreaterThan(0)
  })

  it('el coach (cuenta personal) ve la barra de cinco espacios de la maqueta 7, también en escritorio, sin marco aparte', () => {
    estado.rol = 'coach'
    estado.capacidades = new Set(['ver_administracion', 'revisar_creadores'])
    en('/coach/estrategias')
    const barra = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(barra.textContent).toMatch(/Mi día.*Equipo.*Bandeja.*Empresa.*Yo/)
    expect(screen.queryByRole('navigation', { name: 'Alpha' })).not.toBeInTheDocument()
    // La barra no se esconde por ancho: ningún ancestro lleva `lg:hidden`.
    expect(barra.closest('.lg\\:hidden')).toBeNull()
  })

  it('el coach sin capacidades de estrategia ni de administración no ve esas pestañas', () => {
    estado.rol = 'coach'
    estado.capacidades = new Set(['leer_entrenamiento'])
    en('/coach/consola')
    const barra = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(barra.textContent).not.toMatch(/Estrategias|Administración/)
  })

  it('la cuenta «Alpha» (solo_tablero): todo /coach la lleva al tablero, sin barra ni panel', () => {
    estado.rol = 'coach'
    estado.capacidades = new Set(['solo_tablero', 'leer_entrenamiento', 'ver_administracion'])
    for (const ruta of ['/coach', '/coach/consola', '/coach/administracion', '/coach/estrategias']) {
      const r = en(ruta)
      expect(screen.getByText('Tablero a pantalla completa'), ruta).toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      r.unmount()
    }
  })

  it('al coach no se le decide nada mientras se consultan sus capacidades', () => {
    estado.rol = 'coach'
    estado.cargando = true
    estado.capacidades = new Set(['solo_tablero'])
    en('/coach/consola')
    expect(screen.getByText('Comprobando tu acceso…')).toBeInTheDocument()
    expect(screen.queryByText('Tablero a pantalla completa')).not.toBeInTheDocument()
    expect(screen.queryByText('Contenido de la consola')).not.toBeInTheDocument()
  })

  it('la cuenta personal de Bryan (asesorado con puesto_de_coach) entra al panel como coach y ve su barra', () => {
    estado.rol = 'asesorado'
    estado.capacidades = new Set(['puesto_de_coach', 'ver_administracion'])
    en('/coach/administracion')
    expect(screen.getByText('Contenido de administracion')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegación principal' }).textContent).toMatch(/Mi día.*Equipo.*Bandeja.*Empresa.*Yo/)
  })

  it('…y sin esa capacidad un asesorado vuelve a la portada; mientras se consulta, no se decide nada', () => {
    estado.rol = 'asesorado'
    estado.capacidades = new Set()
    const a = en('/coach/administracion')
    expect(screen.getByText('Portada')).toBeInTheDocument()
    a.unmount()
    estado.cargando = true
    estado.capacidades = new Set(['puesto_de_coach'])
    en('/coach/administracion')
    expect(screen.getByText('Comprobando tu acceso…')).toBeInTheDocument()
    expect(screen.queryByText('Portada')).not.toBeInTheDocument()
  })

  it('Manuela no cambia: su barra y su consola siguen igual y no tiene marco aparte', () => {
    estado.capacidades = new Set(['leer_entrenamiento', 'ver_administracion'])
    en('/coach/consola')
    const barra = screen.getByRole('navigation', { name: 'Navegación principal' })
    expect(barra.textContent).toMatch(/Mi día.*Equipo.*Bandeja.*Empresa.*Yo/)
  })

  it('un asesorado nunca entra a la consola', () => {
    estado.rol = 'asesorado'
    en('/coach/consola')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })

  // Capacidades REALES de Manuela hoy en la base (incluye ver_administracion).
  const MANUELA = [
    'aprobar_plan_estrategico', 'aprobar_primer_plan', 'decisiones_compartidas', 'detener_publicacion',
    'firmar_creadores', 'leer_entrenamiento', 'organizar_plan', 'reportar_riesgo', 'responder_mercadeo',
    'responder_por_asesorado', 'revisar_creadores', 'ver_administracion',
  ]

  it('Manuela con sus capacidades reales entra a Estrategias y a Administración', () => {
    estado.capacidades = new Set(MANUELA)
    const a = en('/coach/estrategias')
    expect(screen.getByText('Contenido de estrategias')).toBeInTheDocument()
    a.unmount()
    en('/coach/administracion')
    expect(screen.getByText('Contenido de administracion')).toBeInTheDocument()
  })

  it('Estrategias se abre con responder_mercadeo o con revisar_creadores, cada una por su lado', () => {
    estado.capacidades = new Set(['responder_mercadeo'])
    const a = en('/coach/estrategias')
    expect(screen.getByText('Contenido de estrategias')).toBeInTheDocument()
    a.unmount()
    estado.capacidades = new Set(['revisar_creadores'])
    en('/coach/estrategias')
    expect(screen.getByText('Contenido de estrategias')).toBeInTheDocument()
  })

  it('Administración se abre con organizar_plan o con decisiones_compartidas, cada una por su lado', () => {
    estado.capacidades = new Set(['organizar_plan'])
    const a = en('/coach/administracion')
    expect(screen.getByText('Contenido de administracion')).toBeInTheDocument()
    a.unmount()
    estado.capacidades = new Set(['decisiones_compartidas'])
    en('/coach/administracion')
    expect(screen.getByText('Contenido de administracion')).toBeInTheDocument()
  })

  it('un staff sin esas capacidades vuelve a la portada en las dos áreas', () => {
    estado.capacidades = new Set(['responder_por_asesorado', 'leer_entrenamiento'])
    const a = en('/coach/estrategias')
    expect(screen.getByText('Portada')).toBeInTheDocument()
    a.unmount()
    en('/coach/administracion')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })

  it('Estrategias y Administración no se prestan la puerta', () => {
    estado.capacidades = new Set(['responder_mercadeo'])
    en('/coach/administracion')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })

  // El caso que se colaba en Empresa: `decisiones_compartidas` abre Administración, no Estrategias.
  it('decisiones_compartidas abre Administración y NO Estrategias', () => {
    estado.capacidades = new Set(['decisiones_compartidas'])
    const a = en('/coach/administracion')
    expect(screen.getByText('Contenido de administracion')).toBeInTheDocument()
    a.unmount()
    en('/coach/estrategias')
    expect(screen.getByText('Portada')).toBeInTheDocument()
  })
})
