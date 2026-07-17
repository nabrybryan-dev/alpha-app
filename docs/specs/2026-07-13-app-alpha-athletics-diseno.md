# App Alpha Athletics — Especificación de diseño

**Fecha:** 2026-07-13 · **Estado:** para revisión del usuario
**Decisiones tomadas con el usuario (Bryan):** tema dual claro/oscuro · móvil primero ·
portal asesorado + panel coach · datos semilla anonimizados basados en Daniela ·
nutrición basada en los planes HTML reales · construir la app real por etapas (opción 2).

---

## 1 · Objetivo

Reemplazar gradualmente los Excel de asesorados por una aplicación web (PWA) que:
centraliza perfiles, programaciones por microciclo, bienestar diario, nutrición y
comunicación; es legible y elegante para el asesorado; y alimenta al Cerebro Alpha
(motor Heracles) con datos estructurados para decidir cada microciclo.

## 2 · Etapas

| Etapa | Entrega | Backend |
|-------|---------|---------|
| **1 (este spec)** | App completa navegable con datos simulados (capa mock), instalable como PWA, tema dual | Ninguno (mock en memoria/JSON) |
| 2 | Supabase: login real, base de datos, permisos por fila, push notifications, subida de contenidos, constructor de cuestionarios del coach | Supabase (cuenta la crea Bryan) |
| 3 | Integración IA en la app: generación de microciclos vía motor Heracles + retroalimentación automática | API IA + Cerebro |

La etapa 1 se construye contra una **interfaz de repositorio de datos** para que la
etapa 2 solo cambie la implementación (mock → Supabase), no las pantallas.

## 3 · Manual de marca

Fuente principal: el **sistema de identidad oficial de Alpha Athletics**
(imágenes suministradas por Bryan el 2026-07-14, en `Desktop/APP ALPHA/`),
complementado con atletaalpha.com y los planes nutricionales HTML reales:

- **Logos oficiales** (copiados a `src/assets/brand/`): águila musculada con "A"
  (principal), cabeza de halcón (marca alternativa), monograma "A" rasgado,
  wordmark ALPHA ATHLETICS. Blanco sobre negro.
- **Sistema de color oficial:** BLACK `#0A0A0A` (fondos y base visual), WHITE
  `#FFFFFF` (texto principal), GREY `#7A7A7A` (texto secundario), RED `#FF1E1E`
  (acentos y énfasis). **Regla de uso: 70% negro / 15% blanco / 10% gris / 5% rojo.**
- **Tipografía oficial:** **Satoshi Bold** (principal, titulares) + **Inter
  Regular** (secundaria, texto y datos). Máximo dos fuentes, alto contraste,
  tracking amplio en titulares.
- **Dirección visual oficial:** cinemática, oscura, minimalista, alto contraste;
  luz lateral y sombras marcadas; texturas de humo/metal/concreto/grano fino;
  atmósfera intensa, cruda, real, sin artificialidad.
- **Paleta oscura (tema principal):** fondo `#0a0a0a`, superficies `#141414` /
  `#1c1c1e` / `#242427`, línea `#2e2e31`, texto `#f2f2f2`, tenue `#a8a8ad`
  (gris de marca `#7a7a7a` para elementos no críticos).
- **Acento:** rojo Alpha `#ff1e1e` (único acento; botones primarios,
  progresiones, kickers). Rojo oscuro `#8f1119` para bordes.
- **Semánticos:** verde `#28c76f` (cumplido/progresó), ámbar `#f5a623`
  (precaución/cheat), azul `#3b9dff` (informativo/enlaces).
- **Paleta clara (tema alternativo):** fondo `#f7f7f5`, superficies blancas,
  texto `#111`, mismos acento y semánticos. El asesorado elige con interruptor;
  se respeta `prefers-color-scheme` por defecto.
- **Tipografía:** display condensada en mayúsculas para titulares y números
  (Archivo/Anton u otra similar vía Google Fonts, máx. 2 familias), sans del sistema
  o Inter para datos y prescripciones. Legibilidad en gimnasio: cuerpo ≥16px,
  números de carga grandes.
- **Tono:** directo, motivador, español, "science based performance", sin
  exclamaciones gratuitas. Kickers en mayúsculas con tracking amplio.
- **Premium = disciplina:** un solo acento, espacio generoso, jerarquía tipográfica;
  sin dorados ni efectos.
- Entregable: página `/marca` dentro de la app con el manual vivo.

## 4 · Arquitectura técnica

- **React 19 + Vite + TypeScript + Tailwind CSS v4.**
- **PWA:** manifest, service worker, instalable en Android/iOS.
- **Enrutado:** React Router. **Estado servidor:** TanStack Query sobre la interfaz
  de repositorios. **Estado UI:** ligero (contexto/Zustand solo si hace falta).
- **Capa de datos:** `src/data/repositories/*` define interfaces
  (AsesoradosRepo, MicrociclosRepo, BienestarRepo, NutricionRepo, MensajesRepo,
  CuestionariosRepo, ContenidosRepo). Etapa 1: implementación mock con seed JSON
  + persistencia en localStorage. Etapa 2: implementación Supabase.
- **Estructura:** organización por feature (`src/features/hoy`, `entrenar`,
  `bienestar`, `nutricion`, `chat`, `contenidos`, `cuestionarios`, `coach`),
  archivos ≤400 líneas, componentes UI compartidos en `src/components/ui`.
- **Proyecto:** carpeta `app/` dentro de "Cerebro Alpha", repositorio git propio.

## 5 · Portal del asesorado (móvil primero, navegación inferior)

Pestañas: **Hoy · Entrenar · Bienestar · Nutrición · Chat**. La biblioteca de
contenidos y los cuestionarios cuelgan de "Hoy" y de menú superior desplegable.

1. **Hoy:** saludo + sesión del día (ej. "LEG A · M22"), estado del check-in de
   bienestar, cuestionarios pendientes, mensajes sin leer, recordatorios internos
   (banners/badges). Acceso a la biblioteca de contenidos.
2. **Entrenar:** microciclo actual → lista de sesiones → detalle de sesión:
   por ejercicio: categoría, nombre, cues técnicos, prescripción canónica
   (`42.5KG A 8 REPS; 3 SERIES (RIR 2). PROGRESA +2.5KG VS M19...`), enlace a
   demo del ejercicio (video/imagen del patrón de movimiento), y **registro por
   serie: carga / reps / RIR** con controles grandes (steppers). Al finalizar:
   test post-entrenamiento (duración, RPE de sesión, PRS de entrada).
   Movilidad/activación previa como bloque inicial.
3. **Bienestar:** el "TEST DURANTE EL DÍA" del Excel como formulario con chips:
   peso, pasos, entreno, rendimiento, motivación, hambre, cansancio, estrés,
   horas y calidad de sueño, alimentación, comentarios. Valores cualitativos
   (`BUENA/REGULAR/MALA`, `POCO/REGULAR/MUCHO`) como píldoras tipo RP. Historial
   de la semana visible.
4. **Nutrición:** espejo de los planes HTML reales: análisis (TDEE, objetivo),
   macros por tipo de día (**ALTO / BAJO / CHEAT** con píldoras kcal/P/C/G),
   menús con comidas (hora, título, alimentos, nota), tabla de equivalencias,
   lista de compras, suplementación, secciones especiales (ej. ciclo & SOP) y
   registro de adherencia diaria (¿cumpliste? sí/parcial/no + comentario).
5. **Chat:** conversación con el coach; adjuntar foto/video (mock en etapa 1).
6. **Cuestionarios:** bandeja de tests asignados; tipos de pregunta: sí/no,
   escala 1-5, opción múltiple, texto libre. Respuestas guardadas y visibles
   para el coach.
7. **Contenidos:** biblioteca desplegable por categorías (patrones de movimiento,
   técnica, educación nutricional): tarjetas con video corto/imagen/vínculo.
   Cada ejercicio de la prescripción enlaza a su demo.

## 6 · Panel del coach

Responsive (útil en escritorio, funcional en móvil). Acceso por rol coach.

- **Asesorados:** lista con semáforos — adherencia del microciclo (% sesiones
  registradas), readiness promedio de la semana, días sin registrar, mensajes
  pendientes, cuestionarios sin responder.
- **Detalle de asesorado:** perfil (objetivos, volumen por grupo, medidas),
  pautado vs. realizado por sesión (RIR objetivo vs. real, reps, cargas),
  variables de vida de la semana, respuestas a cuestionarios, plan nutricional.
- **Chat:** bandeja unificada.
- **Cuestionarios:** en etapa 1, lista de tests existentes y respuestas
  (constructor completo en etapa 2).
- **Contenidos:** en etapa 1, catálogo visible (subida real en etapa 2).
- **Generar microciclo (IA):** botón presente como maqueta con explicación del
  flujo futuro (etapa 3); en etapa 2 el flujo real es: Bryan genera la decisión
  con el Cerebro leyendo la base de datos y la carga como propuesta.

## 7 · Modelo de datos (espejo del Excel + planes HTML)

Entidades: `usuario` (rol coach/asesorado), `perfil` (objetivos, precondiciones,
días/tiempo, somatotipo, volumen semanal por grupo, medidas corporales en serie
temporal), `microciclo` (número, cadencia 8/15 días, estado), `sesion` (nombre,
orden), `ejercicio_prescrito` (categoría, nombre, cues, prescripción, descanso,
sets, rango, reps diana, RIR objetivo, vínculo a demo), `serie_registrada`
(carga, reps, RIR, orden), `test_post_sesion` (duración, RPE, PRS),
`checkin_diario` (todas las variables de bienestar), `plan_nutricional`
(análisis, tipos de día con macros, comidas, equivalencias, compras,
suplementación, secciones especiales), `adherencia_nutricional`,
`mensaje` (hilo coach-asesorado, adjuntos), `cuestionario` + `pregunta` +
`respuesta`, `contenido` (tipo, categoría, url/medio, patrón de movimiento).

## 8 · Datos semilla (etapa 1)

- **"Valentina Cruz"**, asesorada ficticia que replica la estructura de Daniela
  (perfil, volumen por grupo, microciclos M21-M22 con sesiones LEG A/UPPER A/…,
  bienestar diario de dos semanas) con todos los datos personales inventados.
- Plan nutricional ficticio con la estructura de los planes de Juliana/Luis
  (3 menús, ALTO/BAJO/CHEAT, equivalencias, compras, suplementación) anonimizado.
- Un segundo y tercer asesorado esqueléticos para que la lista del coach respire.
- Dos cuestionarios de ejemplo (ej. "Chequeo de dolor articular", "Adherencia
  y disfrute del bloque").
- 8-10 contenidos de ejemplo (patrones: sentadilla, bisagra, empuje, tracción...)
  con vínculos a videos reales de YouTube como demo.
- **Ningún dato real de asesorados entra al repositorio de la app.**

## 8b · Rachas y reconocimientos (gamificación)

Pantalla **"Logros"** propia (accesible desde "Hoy", donde además vive un resumen
permanente de nivel y racha en la cabecera):

- **Rachas:** días consecutivos con check-in de bienestar, sesiones registradas del
  microciclo, y adherencia nutricional. Cada racha con contador visible y récord
  personal. Romper la racha no castiga: mensaje motivador de reinicio.
- **Logros (insignias):** hitos automáticos calculados de los datos — ej. "Primera
  sesión registrada", "Semana de bienestar completa", "Microciclo 100% registrado",
  "4 semanas de constancia", "Adherencia nutricional perfecta del microciclo",
  "Cuestionarios al día". Estética de medalla Alpha (monocroma + rojo al
  desbloquear).
- **Niveles:** puntos de disciplina (XP) por cada acción (registrar sesión,
  check-in, adherencia, responder cuestionario, tareas al 100%); escala de niveles
  con identidad del método (ej. Iniciado → Constante → Disciplinado → Espartano →
  Heracles). Barra de progreso al siguiente nivel siempre visible en "Logros".
- **Premiaciones del coach:** reconocimientos manuales que Bryan otorga desde su
  panel (ej. "Mejor progresión del mes") — visibles con distintivo especial.
  *Etapa 1: se muestran desde el seed; otorgarlos en vivo es etapa 2.*
- Todo el cálculo de rachas/XP/logros es determinista a partir de los registros
  existentes (sin datos nuevos que llenar): la gamificación premia usar la app,
  no añade fricción.

## 9 · Notificaciones

- Etapa 1: recordatorios internos (banner en "Hoy" + badges en pestañas).
- Etapa 2: web push real (Android e iOS con PWA instalada) para: bienestar
  pendiente, sesión del día, cuestionario asignado, mensaje del coach.

## 10 · Seguridad y privacidad

- Etapa 1: sin datos reales; selector de usuario simulado (asesorado/coach) para
  navegar ambos portales.
- Etapa 2: auth Supabase (correo+contraseña), RLS por fila (asesorado solo ve lo
  suyo; coach ve su cartera), secretos solo en variables de entorno, validación
  de entradas con esquemas (zod), revisión de seguridad formal antes de invitar
  asesorados reales. Datos de salud = datos sensibles (Ley 1581 CO): mínimo
  privilegio y sin exportaciones a terceros sin autorización.

## 11 · Criterios de éxito de la etapa 1

1. En el celular: instalar la PWA, cambiar tema claro/oscuro, y completar el flujo
   asesorado: ver sesión del día → registrar 3 series de un ejercicio → test
   post-entrenamiento → check-in de bienestar → ver plan de nutrición y marcar
   adherencia → responder un cuestionario → abrir un contenido → enviar un mensaje
   → ver la racha/XP actualizarse y un logro desbloquearse en "Logros".
2. Como coach: ver semáforos de la lista, abrir a Valentina y comparar pautado vs.
   realizado, leer su bienestar y responder su mensaje.
3. Todo persiste localmente (recargar no pierde lo registrado).
4. Lighthouse: accesibilidad ≥90, performance ≥85 en móvil.
5. Página `/marca` con el manual de marca vivo.

## 12 · Fuera de alcance (etapa 1)

Login real, push real, subida de archivos, constructor de cuestionarios del coach,
generación IA en vivo, pantalla de progreso/medidas con gráficas, pasarela de pago,
publicación en tiendas.
