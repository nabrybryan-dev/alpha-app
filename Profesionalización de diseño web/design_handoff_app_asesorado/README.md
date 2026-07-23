# Handoff: App del asesorado — Alfa Athletics (rediseño premium)

## Overview
Rediseño de alta fidelidad de la **app móvil del asesorado**: flujo splash → login →
app con 5 pestañas (Hoy · Entreno · Bienestar · Progreso · Coach). El foco es la
**captura de la rutina de entrenamiento serie a serie** (carga/reps/RIR), fiel al
proceso 100% individualizado de Alfa (hoja PERFIL + microciclos del Excel).

## About the Design Files
`Alfa App Pro v2.dc.html` es una **referencia de diseño hecha en HTML** (un prototipo
del look y el comportamiento), **no** código de producción para copiar tal cual. La
tarea es **recrear este diseño dentro del codebase real** (`Cerebro Alpha/app`, que ya
usa **React + TypeScript + Vite + Tailwind + Supabase**), reutilizando sus componentes
(`components/ui/*`: Button, Card, Badge, Stepper, Chip…) y sus features
(`features/entrenar/SesionPage`, `RegistroSerie`, `DescansoTimer`, `features/bienestar/CheckinForm`).
El prototipo se construyó sobre el design system **Alfa Athletics** — respeta esos tokens.

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciado, animaciones y microinteracciones
son finales. Recrear pixel-perfect con los componentes existentes del codebase.

## Screens / Views

### 1. Splash
Fondo arena (radial `#1f2327`→`#08090a`). Emblema Alpha (`assets/alpha-a-mark.jpeg`,
`mix-blend-mode: screen` sobre negro) con `pop` + `breathe`; wordmark con barrido metálico
(`shineSweep`); lema "Forjado para rendir" con `trackIn`; barra loader inferior 1.9s.
Auto-avanza a login a los 2.3s o al tocar.

### 2. Login (arena/oscuro)
Emblema + "Alfa Athletics" + "100% personalizado, 0% genérico". Inputs Correo/Contraseña
(componente `Input` del DS) y botón primario volt "ENTRAR" → estado "ACCEDIENDO…" 0.9s → app.
Cada elemento entra con `rise` escalonado.

### 3. Hoy (superficie clara)
- **Header**: eyebrow "Microciclo M8 · Semana 2 · Déficit 10-15%" + "Hola, Manuela" (display
  900) + Avatar ring volt.
- **Tarjeta check-in**: pendiente (CTA "Llenar" → Bienestar) o hecho (check verde + resumen).
- **Tarjeta sesión (ink-900)**: barra de acento volt, "Sesión de hoy · M8 / LEG A",
  meta (4 ejercicios · 12 series · ~2h30), chips de prioridad de volumen (Isquios Muy alto,
  Glúteo Alto, Cuádriceps Bajo), emblema Alpha, CTA "EMPEZAR/CONTINUAR SESIÓN" o resumen registrado.
- **3 stats**: Racha · Peso prom. M8 (55.7 kg) · Adherencia (92%, volt-700).
- **Tarjeta "Tu bloque actual"**: objetivo, fase energética (Déficit 10-15%), proteína 2,0 g/kg,
  pasos 9 000/día.
- **Mensaje del coach** (Avatar + Badge Coach + timestamp).

### 4. Entreno (arena/oscuro) — pantalla protagonista
- Header: botón atrás, pill "M8 · LEG A", cronómetro de sesión (mm:ss) corriendo.
- Categoría + nombre del ejercicio + rango; barra segmentada de progreso por ejercicio.
- **Tarjeta prescripción del coach** (mono): texto canónico p.ej.
  `50KG A 10 REPS; 3 SERIES (RIR 2). PROGRESA +2.5KG VS M7. RANGO COMPLETO.` +
  desplegable "Ver notas de ejecución" (cues técnicos).
- **Timer de descanso** (aparece tras guardar serie, auto 2–2.5 min): mm:ss volt, +15s, pausa/play, barra.
- **Series guardadas**: filas Serie/Carga/Reps/RIR con check volt.
- **Registrador de serie activa**: stepper grande de Carga (±2.5 kg) + Reps (±1) + RIR (±1).
- "A continuación": próximos ejercicios con categoría y esquema.
- CTA fijo inferior "GUARDAR SERIE N".
- Al terminar ejercicio → overlay "Ejercicio completado". Al terminar el último →
  **Test post entrenamiento** (bottom sheet: RPE 6–10 + recuperación POCO/NORMAL/MUCHO) →
  overlay "Sesión registrada" (series, volumen, +40 XP).

### 5. Bienestar — "Test durante el día" / check-in diario
Steppers Peso ayunas (±0.1) y Pasos (±500); chips MALA/REGULAR/BUENA y POCO/REGULAR/MUCHO
para rendimiento, motivación, hambre, cansancio, estrés, calidad sueño, alimentación;
stepper horas de sueño; comentarios; "GUARDAR CHECK-IN" (valida campos) → tarjeta resumen +10 XP.
Réplica del `CheckinForm.tsx` real.

### 6. Progreso
Chart peso/fuerza (toggle) con `drawIn`; **Volumen por grupo** (barras Isquios/Espalda Muy alto…
Cuádriceps/Tríceps Bajo — lee la hoja PERFIL); **Medidas · desviación del bloque** (Glúteo, Abdomen, Muslo, PG%).

### 7. Coach
Chat con Santiago (burbujas volt del asesorado / claras del coach), indicador escribiendo,
respuesta simulada a 1.5s, input + envío.

## Interactions & Behavior
- Splash timeout 2.3s / skip al tap. Login 0.9s de "ACCEDIENDO…".
- Nav inferior: pill volt animado (`popSoft`) bajo el icono activo.
- Steppers press `scale(.86)`; botones `scale(.92–.97)`; cards hover `translateY(-2px)`.
- Guardar serie → frase motivacional en toast (o resumen si `frases` off) → descanso auto (si `restAuto`).
- Keyframes: `rise, fadeIn, pop, popSoft, barIn, drawIn, trackIn, loaderSweep, voltPulse, breathe, blinkDot, toastIn, scrimIn, slideUp, flamePulse, shineSweep`. Respeta `prefers-reduced-motion`.

## State Management
Toda la lógica en la clase `Component` del `.dc.html`. Variables clave:
`phase` (splash/login/app), `tab`, `exIdx`, `saved[]` (series), `draft{kg,reps,rir}`,
`restLeft/restOn/restPaused`, `sesionSec/sesionStarted/sesionFin`, `celebrate` (ex/test/all),
`rpe/prs`, `ck{...}` + `ckPeso/ckPasos/ckSueno` + `checkinSaved`, `msgs[]/typing`, `progTab`, `toast`.
En el codebase real esto mapea a IndexedDB/Supabase (ver `data/`, `domain/cumplimiento.ts`, `gamification.ts`).

## Design Tokens (Alfa Athletics DS)
- Volt `#c8ff1e` (acción; texto sobre claro = volt-700 `#5e7a00`). Ink-900 `#08090a`, ink-700 `#16181b`,
  ink-500 `#2a2f35`. Silver-100 `#f4f5f6`, silver-300 `#c2c8cf`, silver-500 `#6f7782`.
  Bone-50 `#fbfaf8`, paper `#fff`, bone-100/200/300. Success `#21a366`. Oro solo Elite.
- Radius: inputs/tags 6, botones 10, cards 14, paneles 20, pills 999.
- Tipografía: display Archivo Expanded 800-900 mayúsculas; UI Hanken Grotesk 400-700; datos JetBrains Mono `tabular-nums`.
- Sombras neutras en claro; en oscuro bordes hairline + `--inset-top-light`; CTAs volt con `--glow-volt`.

## Assets
- `assets/alpha-a-mark.jpeg` — emblema Alpha "A" (blanco sobre negro; usar `mix-blend-mode: screen`).
  Versiones plata/tinta con fondo transparente en el DS: `assets/logo/`. Iconos = Lucide (outline).

## Files
- `Alfa App Pro v2.dc.html` — prototipo completo (template + lógica).
- Referencias del codebase real: `Cerebro Alpha/app/src/features/entrenar/*`,
  `features/bienestar/CheckinForm.tsx`, `components/ui/*`, `wiki/estructura-excel/*`.

## Cómo llevarlo a Claude Code
Descarga este zip, colócalo en la raíz del repo (`Cerebro Alpha/app/`) y en tu conversación
de Claude Code di: *"Implementa el diseño de `design_handoff_app_asesorado/` sobre los
componentes existentes, empezando por la pantalla de Entreno."* El README es autosuficiente.
