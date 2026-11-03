import { useNavigate } from 'react-router-dom'
import { MarcaAguila } from '../../components/ui/MarcaAguila'

/**
 * La ruta comodín (`*`): toda dirección que la app no conoce. Antes se pintaba en blanco (decisión de Bryan,
 * 23-oct: una pantalla que lo diga y lleve a Hoy). Va fuera de los layouts, así que sirve igual para
 * el asesorado, el equipo y la cuenta Alpha; «Hoy» (`/`) manda a cada quien a su portada.
 */
export default function NoEncontradaPage() {
  const navigate = useNavigate()
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <MarcaAguila className="h-12 w-12 text-texto" />
      <h1 className="font-display text-xl text-texto">Esta página no existe</h1>
      <p className="text-sm text-tenue">El enlace está roto o ya no está en la app. Tu información sigue donde estaba.</p>
      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="press min-h-[44px] rounded-2xl bg-accion px-6 py-2 text-sm font-bold text-white"
      >
        Ir a Hoy
      </button>
    </main>
  )
}
