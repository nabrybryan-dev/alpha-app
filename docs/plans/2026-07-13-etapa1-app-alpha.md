# Plan de implementación — App Alpha Athletics · Etapa 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web PWA navegable (portal asesorado + panel coach) con datos simulados persistidos en localStorage, tema dual claro/oscuro con identidad Alpha, y gamificación calculada de los registros.

**Architecture:** React + Vite + TypeScript + Tailwind v4. Capa de dominio pura (tipos + lógica de gamificación/comparación pautado-vs-realizado, 100% testeada) separada de la capa de datos (interfaces de repositorio con implementación mock/localStorage) y de la UI (features por carpeta, componentes UI compartidos). El spec manda: `app/docs/specs/2026-07-13-app-alpha-athletics-diseno.md`.

**Tech Stack:** react, react-router-dom, @tanstack/react-query, tailwindcss v4 (@tailwindcss/vite), vite-plugin-pwa, vitest + @testing-library/react, zod (validación de formularios).

**Convenciones:** commits `feat|fix|test|chore|docs: ...` en español. Archivos ≤400 líneas. Textos de UI en español, tono directo sin exclamaciones. TDD para `src/domain/**` y `src/data/**`; las pantallas se verifican con build + navegación en el navegador (preview) + tests de humo de rutas.

---

## Estructura de archivos

```
app/
├── index.html · vite.config.ts · package.json · tsconfig.json
├── public/ (iconos PWA)
└── src/
    ├── main.tsx · App.tsx
    ├── styles/tokens.css            # variables de marca (dual theme)
    ├── domain/
    │   ├── types.ts                 # todas las entidades
    │   ├── gamification.ts          # rachas, XP, niveles, logros
    │   ├── gamification.test.ts
    │   ├── cumplimiento.ts          # pautado vs realizado, semáforos, adherencia
    │   └── cumplimiento.test.ts
    ├── data/
    │   ├── repos.ts                 # interfaces de repositorio
    │   ├── mockDb.ts                # carga seed + persistencia localStorage
    │   ├── mockDb.test.ts
    │   └── seed/
    │       ├── valentina.ts         # perfil, M21-M22, bienestar, nutrición
    │       ├── otros.ts             # 2 asesorados esqueléticos
    │       ├── cuestionarios.ts · contenidos.ts · mensajes.ts · logros.ts
    ├── app/
    │   ├── router.tsx · router.test.tsx
    │   ├── ThemeProvider.tsx        # data-theme + persistencia + prefers-color-scheme
    │   ├── SessionProvider.tsx      # usuario simulado activo (asesorado|coach)
    │   └── queryClient.ts
    ├── components/ui/               # TopBar, BottomNav, Card, Chip, ChipGroup,
    │   ...                          # Stepper, Badge, ProgressBar, Medalla, Semaforo,
    │                                # MacroPill, EmptyState, Sheet (desplegable)
    └── features/
        ├── hoy/HoyPage.tsx (+ tarjetas)
        ├── entrenar/ MicrocicloPage.tsx · SesionPage.tsx · RegistroSerie.tsx · TestPostSesion.tsx
        ├── bienestar/ BienestarPage.tsx · CheckinForm.tsx · HistorialSemana.tsx
        ├── nutricion/ NutricionPage.tsx · MenuDia.tsx · Equivalencias.tsx · AdherenciaDia.tsx
        ├── chat/ChatPage.tsx
        ├── cuestionarios/ CuestionariosPage.tsx · ResponderCuestionario.tsx
        ├── contenidos/ContenidosPage.tsx
        ├── logros/LogrosPage.tsx
        ├── marca/MarcaPage.tsx
        └── coach/ AsesoradosPage.tsx · AsesoradoDetallePage.tsx · CoachChatPage.tsx · GenerarMicrocicloSheet.tsx
```

---

### Task 1: Andamiaje del proyecto

**Files:** Create: proyecto Vite en `app/` (conservando `docs/` y `.git/`), `src/styles/tokens.css`, `vite.config.ts`, `vitest.config.ts`.

- [ ] **Step 1:** Scaffold en carpeta temporal y mover (Vite no inicializa sobre carpeta no vacía):

```bash
cd "C:/Users/Usuario/Desktop/Cerebro Alpha"
npm create vite@latest _app_tmp -- --template react-ts
# mover contenido de _app_tmp a app/ sin tocar docs/ ni .git/
```

- [ ] **Step 2:** Instalar dependencias:

```bash
cd app
npm i react-router-dom @tanstack/react-query zod
npm i -D tailwindcss @tailwindcss/vite vite-plugin-pwa vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 3:** `vite.config.ts` con react, tailwindcss y VitePWA (registerType `autoUpdate`, manifest: name "Alpha Athletics", short_name "Alpha", theme_color `#0a0a0a`, background_color `#0a0a0a`, display `standalone`, lang `es`, iconos 192/512 generados como PNG rojos con el monograma A).

- [ ] **Step 4:** `src/styles/tokens.css` — tema dual con variables (fuente del spec §3):

```css
@import "tailwindcss";
:root, [data-theme="dark"] {
  --bg:#0a0a0a; --surface-1:#141414; --surface-2:#1c1c1e; --surface-3:#242427;
  --linea:#2e2e31; --texto:#f2f2f2; --tenue:#a8a8ad;
  --rojo:#e11d2a; --rojo-osc:#8f1119;
  --verde:#28c76f; --ambar:#f5a623; --azul:#3b9dff;
}
[data-theme="light"] {
  --bg:#f7f7f5; --surface-1:#ffffff; --surface-2:#f0efec; --surface-3:#e7e5e0;
  --linea:#d9d7d0; --texto:#111111; --tenue:#5f5e5a;
  --rojo:#d5121f; --rojo-osc:#8f1119;
  --verde:#178a4c; --ambar:#a86e07; --azul:#1462b8;
}
@theme inline {
  --color-bg: var(--bg); --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2); --color-surface-3: var(--surface-3);
  --color-linea: var(--linea); --color-texto: var(--texto); --color-tenue: var(--tenue);
  --color-rojo: var(--rojo); --color-rojo-osc: var(--rojo-osc);
  --color-verde: var(--verde); --color-ambar: var(--ambar); --color-azul: var(--azul);
  --font-display: "Archivo", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
}
```

En `index.html`: `<html lang="es" data-theme="dark">`, Google Fonts Archivo (800/900) + Inter (400/500/700), `<title>Alpha Athletics</title>`.

- [ ] **Step 5:** `vitest.config.ts` (environment jsdom, setup con jest-dom). Script `"test": "vitest run"`.
- [ ] **Step 6:** `npm run build` y `npm test` en verde (test placeholder de sanity). Commit `chore: andamiaje vite+react+ts, tailwind v4, pwa, vitest y tokens de marca`.

---

### Task 2: Tipos de dominio

**Files:** Create: `src/domain/types.ts`.

- [ ] **Step 1:** Escribir todas las entidades del spec §7 (sin lógica). Contenido íntegro:

```ts
export type Rol = "asesorado" | "coach";
export interface Usuario { id: string; nombre: string; rol: Rol; avatarIniciales: string; }

export type NivelVolumen = "Muy Bajo" | "Bajo" | "Normal" | "Alto" | "Muy Alto";
export interface Perfil {
  usuarioId: string; objetivos: string; edad: number; diasEntrenamiento: number;
  tiempoSesionMin: number; somatotipo: string;
  volumenSemanal: Record<string, NivelVolumen>;      // grupo muscular → asignación
  medidas: MedidaCorporal[];
}
export interface MedidaCorporal {
  fecha: string; pesoKg: number; alturaCm: number;
  perimetros: Record<string, number>; pgPct?: number; masaMagraKg?: number;
}

export interface Microciclo {
  id: string; usuarioId: string; numero: number; cadenciaDias: 8 | 15;
  estado: "activo" | "cerrado" | "propuesto"; fechaInicio: string; sesiones: Sesion[];
}
export interface Sesion { id: string; nombre: string; orden: number; ejercicios: EjercicioPrescrito[]; testPost?: TestPostSesion; }
export interface EjercicioPrescrito {
  id: string; categoria: string; nombre: string; cues: string;
  prescripcion: string;                               // formato canónico del coach
  descansoMin: number; sets: number; rango: string; repsDiana: number; rirObjetivo: number;
  contenidoDemoId?: string; series: SerieRegistrada[];
}
export interface SerieRegistrada { orden: number; cargaKg: number; reps: number; rir: number; }
export interface TestPostSesion { duracionMin: number; rpeSesion: number; prsEntrada: number; }

export type Cualitativo3 = "MALA" | "REGULAR" | "BUENA";
export type Cantidad3 = "POCO" | "REGULAR" | "MUCHO";
export interface CheckinDiario {
  id: string; usuarioId: string; fecha: string; pesoKg?: number; pasos?: number;
  entreno?: string; rendimiento?: Cualitativo3; motivacion?: Cantidad3;
  hambre?: Cantidad3; cansancio?: Cantidad3; estres?: Cantidad3;
  horasSueno?: number; calidadSueno?: Cualitativo3; alimentacion?: Cualitativo3;
  comentarios?: string;
}

export type TipoDia = "ALTO" | "BAJO" | "CHEAT";
export interface Macros { kcal: number; proteinaG: number; carbosG: number; grasaG: number; }
export interface Comida { hora: string; titulo: string; alimentos: string[]; nota?: string; }
export interface MenuDia { nombre: string; tipoDia: TipoDia; comidas: Comida[]; }
export interface Equivalencia { grupo: string; base: string; opciones: string[]; }
export interface PlanNutricional {
  id: string; usuarioId: string; analisis: string;
  macrosPorDia: Record<TipoDia, Macros>; menus: MenuDia[];
  equivalencias: Equivalencia[]; listaCompras: string[]; suplementacion: string[];
  seccionesEspeciales: { titulo: string; contenido: string }[];
}
export type EstadoAdherencia = "si" | "parcial" | "no";
export interface AdherenciaNutricional { id: string; usuarioId: string; fecha: string; estado: EstadoAdherencia; comentario?: string; }

export interface Mensaje { id: string; deId: string; paraId: string; fechaIso: string; texto: string; adjuntoUrl?: string; leido: boolean; }

export type TipoPregunta = "si_no" | "escala_1_5" | "opcion_multiple" | "texto";
export interface Pregunta { id: string; tipo: TipoPregunta; enunciado: string; opciones?: string[]; }
export interface Cuestionario { id: string; titulo: string; descripcion: string; preguntas: Pregunta[]; asignadoA: string[]; }
export interface Respuesta { id: string; cuestionarioId: string; usuarioId: string; fechaIso: string; valores: Record<string, string>; }

export type TipoContenido = "video" | "imagen" | "articulo";
export interface Contenido { id: string; tipo: TipoContenido; categoria: string; titulo: string; descripcion: string; url: string; patronMovimiento?: string; }

export interface PremiacionCoach { id: string; usuarioId: string; titulo: string; fecha: string; nota?: string; }
```

- [ ] **Step 2:** `npx tsc --noEmit` en verde. Commit `feat: tipos de dominio (espejo del Excel y planes HTML)`.

---

### Task 3: Datos semilla

**Files:** Create: `src/data/seed/valentina.ts`, `otros.ts`, `cuestionarios.ts`, `contenidos.ts`, `mensajes.ts`, `logros.ts` (premiaciones), `index.ts`.

- [ ] **Step 1:** `valentina.ts` — usuaria `u-valentina` ("Valentina Cruz") + coach `u-bryan` ("Bryan · Coach"). Perfil calcado en estructura del de Daniela pero **inventado**: objetivos "Recomposición corporal / tren inferior / densidad de hombros", 5 días, 02:30, mesomorfa; volumen: Isquios/Pecho/Espalda "Muy Alto", Glúteo "Alto", Bíceps/Hombros "Normal", Cuádriceps/Tríceps "Bajo"; 4 medidas quincenales (60.2→59.1 kg). Microciclos **M21 (cerrado, con todo realizado)** y **M22 (activo, sesiones LEG A / UPPER A / LEG B / UPPER B / FULL C)**; cada sesión 5-6 ejercicios reales con categoría, cues y prescripción canónica (`42.5KG A 8 REPS; 3 SERIES (RIR 2). PROGRESA +2.5KG VS M20. RANGO COMPLETO`); en M22, LEG A ya registrada (3 series por ejercicio + test post), resto pendiente. Check-ins diarios: 12 días (M21 completo, M22 parcial — hoy pendiente). Plan nutricional con 3 menús (ALTO 2100/BAJO 1750/CHEAT), macros, equivalencias (proteínas/carbos/grasas), compras 15 días, suplementación (creatina 5g, omega-3, vit D), sección especial "Ciclo menstrual y entrenamiento". Adherencia nutricional: 9 de 12 días "si", 2 "parcial", 1 "no".
- [ ] **Step 2:** `otros.ts` — `u-mateo` ("Mateo Ríos", M8 activo sin registrar hace 3 días, 1 mensaje sin leer) y `u-sara` ("Sara Duque", M15 activo al día). Solo perfil mínimo + 1 microciclo con 2 sesiones cada uno.
- [ ] **Step 3:** `cuestionarios.ts` — "Chequeo de dolor articular" (5 preguntas si/no + escala + texto) y "Adherencia y disfrute del bloque" (escala + opción múltiple + texto), asignados a los 3. Una respuesta previa de Valentina al segundo. `contenidos.ts` — 9 contenidos: patrones sentadilla, bisagra, empuje horizontal/vertical, tracción, zancada + 2 tarjetas educativas + 1 video de movilidad, con URLs reales de YouTube. `mensajes.ts` — hilo Valentina↔Bryan (4 mensajes, último del coach sin leer por ella) + 1 de Mateo sin leer por el coach. `logros.ts` — 1 premiación del coach a Valentina ("Mejor progresión del mes · junio").
- [ ] **Step 4:** `index.ts` exporta `seedDb` tipado (colecciones por entidad). `npx tsc --noEmit`. Commit `feat: datos semilla anonimizados (Valentina Cruz y compañía)`.

---

### Task 4: Repositorios mock con persistencia

**Files:** Create: `src/data/repos.ts`, `src/data/mockDb.ts`. Test: `src/data/mockDb.test.ts`.

- [ ] **Step 1:** Test primero (los casos clave):

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { crearMockDb } from "./mockDb";

describe("mockDb", () => {
  beforeEach(() => localStorage.clear());
  it("carga el seed la primera vez", () => {
    const db = crearMockDb();
    expect(db.usuarios.list().length).toBeGreaterThanOrEqual(4);
  });
  it("persiste una serie registrada entre instancias", () => {
    const db = crearMockDb();
    const m22 = db.microciclos.byUsuario("u-valentina").find(m => m.estado === "activo")!;
    const ej = m22.sesiones[1].ejercicios[0];
    db.microciclos.registrarSerie(m22.id, ej.id, { orden: 1, cargaKg: 40, reps: 8, rir: 2 });
    const db2 = crearMockDb();
    const ej2 = db2.microciclos.byUsuario("u-valentina")
      .find(m => m.estado === "activo")!.sesiones[1].ejercicios[0];
    expect(ej2.series).toHaveLength(1);
  });
  it("guarda y lee check-ins del día", () => {
    const db = crearMockDb();
    db.bienestar.guardar({ id: "c1", usuarioId: "u-valentina", fecha: "2026-07-13", estres: "POCO" });
    expect(db.bienestar.byUsuario("u-valentina").some(c => c.fecha === "2026-07-13")).toBe(true);
  });
});
```

- [ ] **Step 2:** `npm test` → FALLA (módulo no existe).
- [ ] **Step 3:** `repos.ts` define las interfaces (UsuariosRepo, PerfilesRepo, MicrociclosRepo con `registrarSerie`/`guardarTestPost`, BienestarRepo, NutricionRepo con `marcarAdherencia`, MensajesRepo con `enviar`/`marcarLeidos`, CuestionariosRepo con `responder`, ContenidosRepo, PremiacionesRepo). `mockDb.ts` implementa todo sobre un objeto clonado del seed, serializado a localStorage bajo clave `alpha-db-v1` tras cada mutación (patrón inmutable: cada mutación produce copia nueva y guarda).
- [ ] **Step 4:** `npm test` → PASA. Commit `feat: repositorios con implementación mock persistida en localStorage`.

---

### Task 5: Lógica de gamificación (TDD)

**Files:** Create: `src/domain/gamification.ts`. Test: `src/domain/gamification.test.ts`.

- [ ] **Step 1:** Tests primero. API y reglas exactas:

```ts
import { describe, expect, it } from "vitest";
import { calcularRacha, calcularXp, nivelDeXp, NIVELES, evaluarLogros } from "./gamification";

it("racha cuenta días consecutivos hasta hoy inclusive o ayer", () => {
  expect(calcularRacha(["2026-07-11", "2026-07-12", "2026-07-13"], "2026-07-13")).toEqual({ actual: 3, record: 3 });
  expect(calcularRacha(["2026-07-10", "2026-07-11"], "2026-07-13").actual).toBe(0); // rota
  expect(calcularRacha(["2026-07-11", "2026-07-12"], "2026-07-13").actual).toBe(2); // ayer aún cuenta
});
it("xp: 10 por check-in, 20 por sesión registrada, 10 por adherencia 'si', 5 'parcial', 15 por respuesta", () => {
  expect(calcularXp({ checkins: 3, sesiones: 2, adherenciasSi: 2, adherenciasParcial: 1, respuestas: 1 })).toBe(3*10+2*20+2*10+5+15);
});
it("niveles: Iniciado 0, Constante 150, Disciplinado 400, Espartano 800, Heracles 1500", () => {
  expect(NIVELES.map(n => n.nombre)).toEqual(["Iniciado","Constante","Disciplinado","Espartano","Heracles"]);
  expect(nivelDeXp(0).nombre).toBe("Iniciado");
  expect(nivelDeXp(399).nombre).toBe("Constante");
  expect(nivelDeXp(1500).nombre).toBe("Heracles");
});
it("logros automáticos se desbloquean por datos", () => {
  const l = evaluarLogros({ sesionesRegistradas: 1, diasCheckinConsecutivos: 7, microcicloCompleto: false, adherenciaPerfectaMicrociclo: false, cuestionariosPendientes: 0 });
  const ids = l.filter(x => x.desbloqueado).map(x => x.id);
  expect(ids).toContain("primera-sesion");
  expect(ids).toContain("semana-bienestar");
  expect(ids).toContain("cuestionarios-al-dia");
  expect(ids).not.toContain("microciclo-100");
});
```

- [ ] **Step 2:** `npm test` → FALLA. **Step 3:** Implementar `gamification.ts`: funciones puras; catálogo `LOGROS` con 6 logros del spec §8b (id, titulo, descripcion, criterio). Rachas ordenan fechas únicas y cuentan hacia atrás desde hoy (o ayer). **Step 4:** `npm test` → PASA. **Step 5:** Commit `feat: gamificación (rachas, xp, niveles, logros) con tests`.

---

### Task 6: Lógica de cumplimiento y semáforos (TDD)

**Files:** Create: `src/domain/cumplimiento.ts`. Test: `src/domain/cumplimiento.test.ts`.

- [ ] **Step 1:** Tests primero:

```ts
import { describe, expect, it } from "vitest";
import { desviacionRir, resumenSesion, semaforoAsesorado } from "./cumplimiento";

it("desviación de RIR = promedio real - objetivo", () => {
  expect(desviacionRir(2, [{ orden:1, cargaKg:40, reps:8, rir:1 }, { orden:2, cargaKg:40, reps:8, rir:3 }])).toBe(0);
});
it("resumen de sesión: % ejercicios con registro completo", () => {
  // 1 de 2 ejercicios con sus 3 series → 50
  expect(resumenSesion({ prescritos: 2, conSeriesCompletas: 1 }).pctRegistrado).toBe(50);
});
it("semáforo: verde al día, ambar 2+ días sin registrar o readiness baja, rojo 4+", () => {
  expect(semaforoAsesorado({ diasSinRegistrar: 0, readinessBaja: false }).color).toBe("verde");
  expect(semaforoAsesorado({ diasSinRegistrar: 2, readinessBaja: false }).color).toBe("ambar");
  expect(semaforoAsesorado({ diasSinRegistrar: 5, readinessBaja: true }).color).toBe("rojo");
});
```

- [ ] **Steps 2-4:** FALLA → implementar (funciones puras, redondeo con `Math.round`) → PASA. Commit `feat: cumplimiento pautado-vs-realizado y semáforos con tests`.

---

### Task 7: Cáscara de la app (tema, sesión simulada, rutas, navegación)

**Files:** Create: `src/app/ThemeProvider.tsx`, `src/app/SessionProvider.tsx`, `src/app/queryClient.ts`, `src/app/router.tsx`, `src/components/ui/TopBar.tsx`, `BottomNav.tsx`, `Card.tsx`, `Chip.tsx`, `Badge.tsx`, `ProgressBar.tsx`, `Stepper.tsx`, `Semaforo.tsx`, `MacroPill.tsx`, `Sheet.tsx`, `EmptyState.tsx`. Modify: `src/App.tsx`, `src/main.tsx`. Test: `src/app/router.test.tsx`.

- [ ] **Step 1:** Test de humo de rutas (render con MemoryRouter y providers; espera texto distintivo por ruta): `/` → "Hoy", `/entrenar`, `/bienestar`, `/nutricion`, `/chat`, `/logros`, `/contenidos`, `/cuestionarios`, `/marca`, `/coach` (con sesión coach). FALLA.
- [ ] **Step 2:** `ThemeProvider`: estado `dark|light`, inicial de localStorage o `prefers-color-scheme`, aplica `data-theme` en `<html>`; botón sol/luna en TopBar. `SessionProvider`: usuario activo (`u-valentina` por defecto), conmutador en TopBar (menú: Valentina / Bryan · Coach) — al elegir coach redirige a `/coach`. TopBar: monograma A rojo en marco (como los planes HTML), nombre de pantalla en display uppercase, campana con badge (recordatorios internos), conmutadores. BottomNav (solo rol asesorado): Hoy · Entrenar · Bienestar · Nutrición · Chat, iconos SVG inline, activo en rojo.
- [ ] **Step 3:** Componentes UI base con tokens (Card = surface-1 + borde linea + radio 16; Chip seleccionable con `aria-pressed`, seleccionado = fondo rojo translúcido + borde rojo; Stepper = botones −/+ grandes de 44px con valor central; ProgressBar roja; Semaforo = punto de color + etiqueta; MacroPill como los planes HTML; Sheet = panel desplegable inferior).
- [ ] **Step 4:** Rutas con lazy loading por feature; guard: `/coach/*` requiere rol coach, pestañas de asesorado requieren rol asesorado. Test de rutas PASA. Build ok. Commit `feat: cáscara de la app (tema dual, sesión simulada, navegación y ui base)`.

---

### Task 8: Pantalla Hoy

**Files:** Create: `src/features/hoy/HoyPage.tsx`, `TarjetaSesionDia.tsx`, `TarjetaPendientes.tsx`, `ResumenGamificacion.tsx`.

- [ ] **Step 1:** Composición: saludo ("Hola, Valentina" + kicker rojo "MICROCICLO M22 · DÍA N"); `ResumenGamificacion` (racha con llama, nivel y barra XP → enlaza `/logros`); `TarjetaSesionDia` (siguiente sesión sin registrar del microciclo activo: nombre, nº ejercicios, botón "Empezar" → `/entrenar/sesion/:id`); `TarjetaPendientes` con recordatorios internos calculados (check-in de hoy pendiente, adherencia de hoy, cuestionarios sin responder, mensajes sin leer — cada uno navega a su pestaña); accesos a Contenidos y Cuestionarios (tarjetas horizontales). Estados vacíos con `EmptyState`.
- [ ] **Step 2:** Verificar en preview (móvil 375px, ambos temas). Commit `feat: pantalla hoy con recordatorios y resumen de gamificación`.

---

### Task 9: Entrenar (microciclo, sesión, registro, test post)

**Files:** Create: `src/features/entrenar/MicrocicloPage.tsx`, `SesionPage.tsx`, `EjercicioCard.tsx`, `RegistroSerie.tsx`, `TestPostSesion.tsx`.

- [ ] **Step 1:** `MicrocicloPage` (`/entrenar`): cabecera M22 + progreso (sesiones registradas/total), lista de sesiones con estado (✓ registrada / pendiente). `SesionPage` (`/entrenar/sesion/:id`): bloque "Movilidad y activación previa" si existe; por ejercicio, `EjercicioCard`: categoría (kicker), nombre (display), prescripción canónica destacada en monospace-ish, cues en tenue, botón "Ver técnica" si `contenidoDemoId` (abre `Sheet` con el contenido/video embebido), y `RegistroSerie` por set: steppers de carga (paso 2.5), reps (paso 1), RIR (0-5) precargados con la prescripción; guardar vía repo (query invalidation).
- [ ] **Step 2:** Al completar todas las series de todos los ejercicios aparece `TestPostSesion` (duración en min, RPE 1-10 con chips, PRS 1-10) → guarda y muestra pantalla de cierre con XP ganado y racha ("+20 XP · Sesión LEG B registrada").
- [ ] **Step 3:** Preview: registrar una sesión completa de M22 end-to-end; recargar y verificar persistencia. Commit `feat: flujo de entrenamiento con registro por serie y test post-sesión`.

---

### Task 10: Bienestar

**Files:** Create: `src/features/bienestar/BienestarPage.tsx`, `CheckinForm.tsx`, `HistorialSemana.tsx`.

- [ ] **Step 1:** `CheckinForm` para hoy: peso (numérico decimal), pasos (numérico), entreno (texto corto), y chips `ChipGroup` para rendimiento/calidad sueño/alimentación (`MALA/REGULAR/BUENA`) y motivación/hambre/cansancio/estrés (`POCO/REGULAR/MUCHO`), horas de sueño (stepper 0.5), comentarios (textarea). Validación zod (rangos razonables), guardado por repo, estado "completado hoy ✓" si ya existe.
- [ ] **Step 2:** `HistorialSemana`: últimos 7 días en tarjetas compactas (fecha, peso, sueño, chips resumidos con color semántico).
- [ ] **Step 3:** Preview ambos temas. Commit `feat: check-in de bienestar diario con historial semanal`.

---

### Task 11: Nutrición

**Files:** Create: `src/features/nutricion/NutricionPage.tsx`, `MenuDia.tsx`, `Equivalencias.tsx`, `AdherenciaDia.tsx`.

- [ ] **Step 1:** `NutricionPage` con secciones desplegables (acordeón, mismo orden que los planes HTML): Análisis; Macros por tipo de día (selector ALTO/BAJO/CHEAT con `Chip` + 4 `MacroPill` kcal/P/C/G); Menús (`MenuDia`: comidas con hora en rojo, título, lista de alimentos, nota en cursiva tenue — borde izquierdo rojo como los planes); Equivalencias (tabla por grupo); Lista de compras (checklist visual); Suplementación; Secciones especiales.
- [ ] **Step 2:** `AdherenciaDia` fijo arriba: "¿Cumpliste el plan hoy?" con `si / parcial / no` + comentario opcional → repo; muestra racha nutricional actual.
- [ ] **Step 3:** Preview. Commit `feat: pantalla de nutrición espejo de los planes html con adherencia diaria`.

---

### Task 12: Chat, Cuestionarios y Contenidos

**Files:** Create: `src/features/chat/ChatPage.tsx`, `src/features/cuestionarios/CuestionariosPage.tsx`, `ResponderCuestionario.tsx`, `src/features/contenidos/ContenidosPage.tsx`.

- [ ] **Step 1:** `ChatPage`: burbujas (asesorado derecha en rojo oscuro, coach izquierda surface-2), fecha relativa, input con botón enviar y botón adjuntar (en etapa 1 abre selector y muestra el nombre como chip "adjunto simulado"); al abrir marca leídos.
- [ ] **Step 2:** `CuestionariosPage`: pendientes vs respondidos. `ResponderCuestionario`: render por tipo (si/no = 2 chips grandes; escala 1-5 = 5 círculos; múltiple = chips; texto = textarea), progreso "3/5", guardar respuesta → XP.
- [ ] **Step 3:** `ContenidosPage`: filtro por categoría (chips) + grid de tarjetas (miniatura/icono por tipo, título, patrón de movimiento como Badge); tocar → `Sheet` con YouTube embebido (`https://www.youtube-nocookie.com/embed/{id}`) o imagen/artículo.
- [ ] **Step 4:** Preview de los 3 flujos. Commit `feat: chat, cuestionarios dinámicos y biblioteca de contenidos`.

---

### Task 13: Logros

**Files:** Create: `src/features/logros/LogrosPage.tsx`, `src/components/ui/Medalla.tsx`.

- [ ] **Step 1:** Cabecera héroe: nivel actual en display uppercase ("DISCIPLINADO"), XP y `ProgressBar` al siguiente nivel, y las 3 rachas (bienestar / entrenamiento / nutrición) con contador y récord. Grid de `Medalla`: desbloqueadas a color (borde rojo + icono), bloqueadas en gris con criterio visible ("Registra un microciclo completo"). Sección "Reconocimientos del coach" con las premiaciones (distintivo especial dorado-NO: usar rojo + estrella). Mensaje de racha rota amable si aplica.
- [ ] **Step 2:** Todo calculado con `gamification.ts` desde los repos (sin estado propio). Preview: registrar un check-in y ver XP subir. Commit `feat: pantalla de logros con rachas, niveles, medallas y premiaciones`.

---

### Task 14: Panel del coach

**Files:** Create: `src/features/coach/AsesoradosPage.tsx`, `AsesoradoDetallePage.tsx`, `PautadoVsRealizado.tsx`, `CoachChatPage.tsx`, `GenerarMicrocicloSheet.tsx`.

- [ ] **Step 1:** `AsesoradosPage` (`/coach`): tarjeta por asesorado — nombre, microciclo actual, `Semaforo` (usa `semaforoAsesorado`), chips de estado (adherencia %, readiness, "3 días sin registrar", mensajes sin leer, cuestionarios pendientes). Orden: rojos primero.
- [ ] **Step 2:** `AsesoradoDetallePage` con pestañas internas: **Resumen** (perfil, objetivos, volumen por grupo como chips de nivel, medidas recientes), **Entrenamiento** (`PautadoVsRealizado`: por sesión de M22, tabla ejercicio × [prescrito | realizado | desviación RIR con color semántico]), **Vida** (check-ins de la semana), **Nutrición** (adherencia del microciclo), **Cuestionarios** (respuestas). Botón fijo "Generar microciclo (IA)" → `GenerarMicrocicloSheet`: maqueta que explica el flujo (leer registros → motor Heracles → propuesta de prescripción) con ejemplo de salida y nota "Disponible en la etapa 3 · hoy Bryan lo genera con el Cerebro".
- [ ] **Step 3:** `CoachChatPage`: bandeja (hilos con no-leídos arriba) + conversación reutilizando componentes del chat.
- [ ] **Step 4:** Preview como coach (conmutador). Commit `feat: panel del coach con semáforos, pautado vs realizado y maqueta ia`.

---

### Task 15: Página de marca, PWA y verificación final

**Files:** Create: `src/features/marca/MarcaPage.tsx`, `public/` iconos. Modify: manifest en `vite.config.ts`.

- [ ] **Step 1:** `/marca`: paleta (muestras con hex de ambos temas), tipografías con ejemplos, tono (hazlo/no lo hagas), componentes vivos (botones, chips, medallas, semáforos), reglas ("un solo acento", "verde=cumplido, ámbar=precaución").
- [ ] **Step 2:** Iconos PWA 192/512 (PNG: fondo `#0a0a0a`, monograma "A" rojo en marco redondeado — generarlos con un script node/canvas o SVG→PNG). Probar instalabilidad en preview (manifest + SW sin errores en consola).
- [ ] **Step 3:** Verificación completa contra spec §11: recorrer el flujo asesorado entero + flujo coach en preview móvil (375px) en ambos temas; `npm test` y `npm run build` en verde; revisar consola sin errores; Lighthouse (si disponible vía preview) accesibilidad ≥90.
- [ ] **Step 4:** `README.md` breve (qué es, cómo correr `npm run dev`, estado etapa 1, enlace al spec). Commit `feat: página de manual de marca, iconos pwa y verificación final`.

---

## Autorrevisión del plan (hecha)

- **Cobertura del spec:** §3 marca→Tasks 1/15 · §4 arquitectura→1/4/7 · §5 portal→8-13 · §6 coach→14 · §7 modelo→2 · §8 seed→3 · §8b gamificación→5/13 · §9 notificaciones internas→8 · §10 seguridad etapa 1 (sin datos reales, selector simulado)→3/7 · §11 criterios→15 · §12 fuera de alcance respetado (sin login/push/subidas reales).
- **Placeholders:** los pasos de UI especifican composición, estados y datos exactos; el código completo se exige donde hay lógica testeable (Tasks 2, 4, 5, 6).
- **Consistencia de tipos:** nombres de `types.ts` usados idénticos en tests de Tasks 4-6 (`registrarSerie`, `byUsuario`, `calcularRacha`, `semaforoAsesorado`).
