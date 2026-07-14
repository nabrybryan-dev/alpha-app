import { Badge } from '../../components/ui/Badge'
import type { MenuDia as Menu } from '../../domain/types'

const tonoTipoDia = { ALTO: 'verde', BAJO: 'azul', CHEAT: 'ambar' } as const

export function MenuDia({ menu }: { menu: Menu }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h4 className="font-display text-sm text-texto">{menu.nombre}</h4>
        <Badge tono={tonoTipoDia[menu.tipoDia]}>{menu.tipoDia}</Badge>
      </div>
      {menu.comidas.map((comida) => (
        <div key={`${comida.hora}-${comida.titulo}`} className="border-l-2 border-rojo-osc pl-3">
          <p className="text-xs font-black tracking-wider text-rojo">{comida.hora}</p>
          <p className="text-sm font-bold text-texto">{comida.titulo}</p>
          <ul className="mt-1 list-disc pl-4 text-sm text-texto/90">
            {comida.alimentos.map((alimento) => (
              <li key={alimento}>{alimento}</li>
            ))}
          </ul>
          {comida.nota && <p className="mt-1 text-xs italic text-tenue">{comida.nota}</p>}
        </div>
      ))}
    </div>
  )
}
