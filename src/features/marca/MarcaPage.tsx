import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Chip } from '../../components/ui/Chip'
import { Medalla } from '../../components/ui/Medalla'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Semaforo } from '../../components/ui/Semaforo'
import logoAguila from '../../assets/brand/logo-aguila.jpeg'
import marcaHalcon from '../../assets/brand/marca-halcon.jpeg'
import monogramaA from '../../assets/brand/monograma-a.jpeg'
import wordmark from '../../assets/brand/wordmark.jpeg'

const colores = [
  { nombre: 'BLACK', hex: '#0A0A0A', uso: 'Fondos y base visual · 70%' },
  { nombre: 'WHITE', hex: '#FFFFFF', uso: 'Texto principal · 15%' },
  { nombre: 'GREY', hex: '#7A7A7A', uso: 'Texto secundario · 10%' },
  { nombre: 'RED', hex: '#FF1E1E', uso: 'Acentos y énfasis · 5%' },
]

export default function MarcaPage() {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <p className="kicker">Brand identity</p>
        <h2 className="font-display text-3xl text-texto">Manual de marca</h2>
        <p className="mt-1 text-sm text-tenue">
          Sistema vivo de Alpha Athletics: la referencia para cualquier pieza nueva.
        </p>
      </section>

      <Card>
        <p className="kicker">Logos oficiales</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { src: logoAguila, alt: 'Logo principal: águila con monograma A' },
            { src: marcaHalcon, alt: 'Marca alternativa: cabeza de halcón' },
            { src: monogramaA, alt: 'Monograma A rasgado' },
            { src: wordmark, alt: 'Wordmark ALPHA ATHLETICS' },
          ].map((logo) => (
            <img
              key={logo.alt}
              src={logo.src}
              alt={logo.alt}
              loading="lazy"
              className="aspect-square w-full rounded-xl border border-linea object-cover"
            />
          ))}
        </div>
      </Card>

      <Card>
        <p className="kicker">Sistema de color</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {colores.map((color) => (
            <div key={color.nombre} className="overflow-hidden rounded-xl border border-linea">
              <div className="h-14" style={{ backgroundColor: color.hex }} />
              <div className="bg-surface-2 p-2.5">
                <p className="text-sm font-black text-texto">{color.nombre}</p>
                <p className="font-mono text-xs text-tenue">{color.hex}</p>
                <p className="mt-0.5 text-[11px] text-tenue">{color.uso}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-tenue">
          Regla 70/15/10/5: el rojo es escaso a propósito — cuando aparece, importa.
        </p>
      </Card>

      <Card>
        <p className="kicker">Sistema tipográfico</p>
        <p className="mt-3 font-display text-3xl text-texto">Satoshi Bold</p>
        <p className="text-xs text-tenue">Tipografía principal: titulares, números grandes, CTA</p>
        <p className="mt-3 text-base text-texto">
          Inter Regular — así comunica Alpha Athletics con claridad, precisión y estructura.
        </p>
        <p className="text-xs text-tenue">Tipografía secundaria: cuerpo, datos, prescripciones</p>
        <ul className="mt-3 list-disc pl-5 text-xs text-tenue">
          <li>Máximo dos fuentes</li>
          <li>Alto contraste</li>
          <li>Espaciado amplio (tracking) en titulares y kickers</li>
        </ul>
      </Card>

      <Card>
        <p className="kicker">Dirección visual</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['Cinemático', 'Oscuro', 'Minimalista', 'Alto contraste', 'Crudo', 'Real', 'Sin artificialidad'].map((v) => (
            <Badge key={v}>{v}</Badge>
          ))}
        </div>
        <p className="mt-3 text-sm text-texto/90">
          Luz lateral, sombras marcadas, texturas de humo/metal/concreto. Premium = disciplina: un
          solo acento, espacio generoso, jerarquía tipográfica fuerte.
        </p>
      </Card>

      <Card>
        <p className="kicker">Componentes vivos</p>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-xl bg-rojo px-4 py-2.5 font-display text-sm text-white">
              Botón primario
            </button>
            <button type="button" className="rounded-xl border border-linea bg-surface-2 px-4 py-2.5 text-sm font-bold text-texto">
              Botón secundario
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip etiqueta="Chip activo" seleccionado onSeleccionar={() => {}} />
            <Chip etiqueta="Chip inactivo" seleccionado={false} onSeleccionar={() => {}} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tono="verde">Cumplido</Badge>
            <Badge tono="ambar">Precaución</Badge>
            <Badge tono="rojo">Acción</Badge>
            <Badge>Neutro</Badge>
          </div>
          <div className="flex flex-col gap-1">
            <ProgressBar pct={65} etiqueta="Ejemplo de progreso" />
            <p className="text-xs text-tenue">Barra de progreso · siempre en rojo Alpha</p>
          </div>
          <div className="flex gap-4">
            <Semaforo datos={{ color: 'verde', motivo: 'Al día' }} />
            <Semaforo datos={{ color: 'ambar', motivo: 'Atención' }} />
            <Semaforo datos={{ color: 'rojo', motivo: 'Intervenir' }} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Medalla logro={{ id: 'demo1', titulo: 'Logro desbloqueado', criterio: 'Así se ve al ganarlo', desbloqueado: true }} />
            <Medalla logro={{ id: 'demo2', titulo: 'Logro bloqueado', criterio: 'Así se ve el reto pendiente', desbloqueado: false }} />
          </div>
        </div>
      </Card>

      <Card>
        <p className="kicker">Semántica de color</p>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-texto/90">
          <li><span className="font-bold text-verde">Verde</span> = cumplido, progresó, al día.</li>
          <li><span className="font-bold text-ambar">Ámbar</span> = precaución, readiness baja, parcial.</li>
          <li><span className="font-bold text-rojo">Rojo Alpha</span> = marca y acción; nunca significa "error" por sí solo.</li>
        </ul>
      </Card>
    </div>
  )
}
