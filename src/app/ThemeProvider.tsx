import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Tema = 'dark' | 'light'

interface TemaContexto {
  tema: Tema
  alternar: () => void
}

const Contexto = createContext<TemaContexto>({ tema: 'dark', alternar: () => {} })

function temaInicial(): Tema {
  const guardado = localStorage.getItem('alpha-tema')
  if (guardado === 'dark' || guardado === 'light') return guardado
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    localStorage.setItem('alpha-tema', tema)
  }, [tema])

  const alternar = () => setTema((t) => (t === 'dark' ? 'light' : 'dark'))

  return <Contexto.Provider value={{ tema, alternar }}>{children}</Contexto.Provider>
}

export function useTema(): TemaContexto {
  return useContext(Contexto)
}
