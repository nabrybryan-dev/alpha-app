import { useState } from "react";
import { Sheet } from "../../../../components/ui/Sheet";
import type { CapaDelCuerpo } from "../../sujeto/pintura";
import {
  NOMBRE_DE_REGION,
  REGIONES,
  type IdDeRegion,
} from "../../sujeto/regiones";
import { lecturaCorta, type SeriesPorRegion } from "../../sujeto/tinte";

/**
 * LA PORTADA DEL CUERPO: lo que se lee ENCIMA del sujeto de Blender.
 *
 * Capas (Piel · Músculo · Hueso) a un lado, la lectura corta de las series anotadas, el dolor
 * del check-in en rojo en su propia línea, y el paso a la vista de movimiento (la escena
 * vieja del salón, entera). Es el hueco `cuerpo` de `huecos.ts`.
 *
 * Cuenta SERIES ANOTADAS, no estímulo: lo dice debajo de la lectura, como la maqueta 7.
 */

export type VistaDelSalon = "cuerpo" | "movimiento";
export type RangoDeLectura = "hoy" | "semana";

export interface PortadaDelCuerpoProps {
  vista: VistaDelSalon;
  capa: CapaDelCuerpo;
  rango: RangoDeLectura;
  series: SeriesPorRegion;
  doloridas: readonly IdDeRegion[];
  alCambiarCapa: (capa: CapaDelCuerpo) => void;
  alCambiarRango: (rango: RangoDeLectura) => void;
  alCambiarVista: (vista: VistaDelSalon) => void;
}

const CAPAS: readonly { id: CapaDelCuerpo; nombre: string }[] = [
  { id: "piel", nombre: "Piel" },
  { id: "musculo", nombre: "Músculo" },
  { id: "hueso", nombre: "Hueso" },
];

const BOTON =
  "press min-h-[44px] rounded-boton border px-3 text-xs font-bold uppercase tracking-[0.1em]";

function cifra(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r).replace(".", ",");
}

export function PortadaDelCuerpo(p: PortadaDelCuerpoProps) {
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const enCuerpo = p.vista === "cuerpo";
  const lectura = lecturaCorta(p.series);

  return (
    <>
      <div data-hueco="cuerpo" className="pointer-events-none absolute inset-0">
        {enCuerpo && (
          <div
            role="radiogroup"
            aria-label="Capas del cuerpo"
            className="pointer-events-auto absolute right-3 flex flex-col gap-1.5"
            style={{ top: "9.5rem" }}
          >
            {CAPAS.map((c) => {
              const activa = c.id === p.capa;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={activa}
                  onClick={() => p.alCambiarCapa(c.id)}
                  className={`${BOTON} ${activa ? "border-ambar/60 bg-ambar/15 text-ambar" : "border-linea bg-surface-2/80 text-tenue"}`}
                >
                  {c.nombre}
                </button>
              );
            })}
          </div>
        )}

        <div
          className="pointer-events-auto absolute left-5 flex max-w-[62%] flex-col items-start gap-1"
          style={{ bottom: "calc(var(--tope-nav) + 6.6rem)" }}
        >
          {enCuerpo && (
            <>
              <div
                role="radiogroup"
                aria-label="Rango de la lectura"
                className="flex gap-1.5"
              >
                {(["hoy", "semana"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={p.rango === r}
                    onClick={() => p.alCambiarRango(r)}
                    className={`${BOTON} ${p.rango === r ? "border-ambar/60 text-ambar" : "border-linea text-tenue"}`}
                  >
                    {r === "hoy" ? "Hoy" : "Semana"}
                  </button>
                ))}
              </div>
              {lectura ? (
                <button
                  type="button"
                  aria-label="Ver series por región"
                  onClick={() => setHojaAbierta(true)}
                  className="press text-left font-display text-base text-texto"
                >
                  {lectura}
                </button>
              ) : (
                <p className="font-display text-base text-texto">
                  Aún no hay series anotadas
                </p>
              )}
              <p className="text-[11px] text-tenue">
                {p.rango === "hoy" ? "series hoy" : "series de la semana"} ·
                cuenta series anotadas, no el estímulo
              </p>
              {p.doloridas.length > 0 && (
                <p
                  className="text-xs font-bold"
                  style={{ color: "var(--rojo)" }}
                >
                  Te duele:{" "}
                  {p.doloridas.map((id) => NOMBRE_DE_REGION[id]).join(" · ")}
                </p>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => p.alCambiarVista(enCuerpo ? "movimiento" : "cuerpo")}
            className={`${BOTON} border-linea bg-surface-2/80 text-tenue`}
          >
            {enCuerpo ? "Ver el movimiento" : "Ver el cuerpo"}
          </button>
        </div>
      </div>
      {/* La hoja va FUERA del hueco: `pointer-events: none` se hereda y la dejaria sorda. */}
      <Sheet
        abierto={hojaAbierta}
        titulo="Series por región"
        onCerrar={() => setHojaAbierta(false)}
      >
        <ul className="flex flex-col divide-y divide-linea">
          {REGIONES.map((r) => {
            const n = p.series[r.id] ?? 0;
            const duele = p.doloridas.includes(r.id);
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="text-texto">{r.nombre}</span>
                <span className="cifras text-tenue">
                  {duele && (
                    <span
                      className="mr-2 font-bold"
                      style={{ color: "var(--rojo)" }}
                    >
                      Te duele
                    </span>
                  )}
                  {cifra(n)}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-tenue">
          Cuenta series anotadas, no el estímulo.
        </p>
      </Sheet>
    </>
  );
}
