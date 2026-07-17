# App Alpha Athletics

Aplicación web (PWA) de Alpha Athletics para asesorados y coach: programaciones por
microciclo, registro de entrenamiento (carga/reps/RIR por serie), bienestar diario,
nutrición individualizada, chat, cuestionarios, biblioteca de contenidos y
gamificación (rachas, XP, niveles, logros).

## Estado

**Etapa 1** — app completa navegable con datos simulados ("Valentina Cruz"),
persistidos en localStorage. Sin backend todavía.

- Especificación: [docs/specs/2026-07-13-app-alpha-athletics-diseno.md](docs/specs/2026-07-13-app-alpha-athletics-diseno.md)
- Plan de implementación: [docs/plans/2026-07-13-etapa1-app-alpha.md](docs/plans/2026-07-13-etapa1-app-alpha.md)
- Etapa 2 (pendiente): Supabase (login real, base de datos, push, subida de contenidos).
- Etapa 3 (pendiente): generación de microciclos con IA (Cerebro Alpha / motor Heracles).

## Cómo correrla

```bash
npm install
npm run dev      # abre http://localhost:5173
npm test         # tests unitarios (vitest)
npm run build    # build de producción
```

En la app: el avatar de la esquina superior derecha permite alternar entre la vista
de asesorada (Valentina) y la del coach (Bryan). El sol/luna cambia el tema.

## Nota técnica de este equipo

La política de control de aplicaciones de Windows bloquea binarios nativos de npm
(esbuild.exe, rollup nativo, rolldown). Por eso `package.json` fija **overrides**
a las versiones WebAssembly (`esbuild-wasm`, `@rollup/wasm-node`) y usa Tailwind v3
(JS puro). No quitar esos overrides en esta máquina.
