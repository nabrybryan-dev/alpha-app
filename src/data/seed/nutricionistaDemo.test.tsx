import { configure, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRouter } from '../../app/router'
import { SessionProvider } from '../../app/SessionProvider'
import { ThemeProvider } from '../../app/ThemeProvider'
import { revisarCartera } from '../../features/coach/revisionCartera'
import { db } from '../dbInstance'
import { reiniciarDb } from '../mockDb'

/**
 * H-12 del inventario: en el demo debe existir una nutricionista (ficticia) para poder
 * elegirla en «Ver la app como» y abrir sus pantallas sin base real. NO entrena: no puede
 * colarse en nada que recorra «los que entrenan» (cartera, consola, avisos, salud de datos).
 */
vi.setConfig({ testTimeout: 45_000, hookTimeout: 45_000 })
configure({ asyncUtilTimeout: 30_000 })

const ID = 'u-nutri-demo'

const montarEn = (ruta: string) =>
  render(
    <ThemeProvider>
      <SessionProvider>
        <MemoryRouter initialEntries={[ruta]}>
          <AppRouter />
        </MemoryRouter>
      </SessionProvider>
    </ThemeProvider>,
  )

beforeEach(() => {
  localStorage.clear()
  reiniciarDb()
})

describe('nutricionista ficticia del demo', () => {
  it('está en la lista de usuarios (la del selector) con rol nutricionista y un nombre claramente ficticio', () => {
    const n = db.usuarios.list().filter((u) => u.rol === 'nutricionista')
    expect(n.map((u) => u.id)).toEqual([ID])
    expect(n[0].nombre).toMatch(/demo/i)
  })

  it('NO cuenta entre quienes entrenan: ni en entrenan() ni en la cartera del coach, y no tiene plan ni perfil de entreno', () => {
    expect(db.usuarios.entrenan().some((u) => u.id === ID)).toBe(false)
    expect(revisarCartera(db).some((f) => f.usuario.id === ID)).toBe(false)
    expect(db.microciclos.byUsuario(ID)).toEqual([])
    expect(db.perfiles.byUsuario(ID)).toBeUndefined()
  })

  it('los asesorados siguen siendo los mismos tres', () => {
    expect(db.usuarios.entrenan().map((u) => u.id).sort()).toEqual(['u-mateo', 'u-sara', 'u-valentina'])
  })

  // Con el router y las guardas reales. /mi-plan: sin Supabase NO hay `capacidades_staff`, así que solo se ve
  // el aviso de que falta el permiso de organizar el plan; su contenido no se puede revisar en el demo.
  it.each([
    ['/equipo-nutricion', /Evaluación nutricional del equipo/],
    ['/equipo-nutricion/cifras', /Qué cifras ve cada asesorado/],
    ['/mi-plan', /Pídeselo al coach/],
    ['/bandeja', /Los tres sombreros, juntos/],
  ])('%s no se cae con el router real (en /mi-plan, el aviso de permiso)', async (ruta, texto) => {
    localStorage.setItem('alpha-usuario', ID)
    montarEn(ruta)
    expect(await screen.findByText(texto)).toBeInTheDocument()
  })
})
