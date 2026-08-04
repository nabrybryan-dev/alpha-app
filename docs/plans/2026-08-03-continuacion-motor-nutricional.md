# Continuación: lo que queda del motor nutricional

**Fecha:** 2026-08-03
**Para:** la sesión que retome esto (no tiene la conversación anterior)
**Spec que manda:** [`docs/specs/2026-08-03-motor-de-ajuste-nutricional-diseno.md`](../specs/2026-08-03-motor-de-ajuste-nutricional-diseno.md)

---

## 0. Lee esto antes de tocar nada

- **`app/CLAUDE.md`** — restricciones de la máquina, arquitectura, trampas conocidas.
- **El spec de arriba**, entero. Tiene decisiones ya tomadas por Bryan que no se reabren.
- **`docs/revisiones/2026-08-03-frases-del-motor-para-manuela.md`** — los textos que dirá el
  motor están pendientes de que los firme la nutricionista. **No inventes copy nuevo para
  esas cuatro situaciones**; si necesitas una frase, usa la propuesta marcada como
  recomendada y deja un `TODO` citando ese documento.

---

## 1. Estado exacto al cerrar la sesión anterior

**Mezclado en `main`** (PR #31, merge `12f5b4f`):

- El cableado de la visibilidad de cifras de punta a punta.
- El arreglo de la carrera de sincronización (`conPendientes` + `asesorado_id` en
  `identidadDeFila`).
- Correcciones a `CLAUDE.md` y `supabase/comprobar-migraciones.sql`.
- El spec y el documento de frases.

**Sin mezclar:** el commit `b7d27b7` («la alerta de disponibilidad energética por fin se
calcula») vive solo en la rama `nutricion-visibilidad-de-cifras`, que se quedó **1 commit por
detrás y 1 por delante** de `main`. Primera tarea abajo.

`npm run verify` en esa rama: **98 archivos, 1.146 tests, 0 errores, 5 avisos** (los 5 son
antiguos y están documentados en `CLAUDE.md`; no añadas ninguno).

---

## 2. Lo que NO hay que rehacer

Ya está construido, probado y en producción. Si te parece que falta, búscalo antes de
escribirlo:

| Pieza | Dónde |
|---|---|
| TMB (Mifflin), factor de actividad, TDEE, reparto de macros | `src/domain/nutricion/energia.ts` |
| % de grasa (US Navy), masa magra, IMC, disponibilidad energética | `src/domain/nutricion/composicion.ts` |
| Ventana de días para la disponibilidad energética | `src/domain/nutricion/ventanaEnergetica.ts` |
| Registro de comidas completo, márgenes, calibración | `src/domain/nutricion/`, `src/features/nutricion/` |
| Qué cifras ve cada asesorado | `src/domain/nutricion/visibilidad.ts`, `src/features/nutricion/visibilidadDelAsesorado.ts` |
| Valores DRI/NASEM de 9 micronutrientes | `../../wiki/conocimiento/micronutrientes-adecuacion.md` |
| Filtro de qué se le puede recomendar a cada persona | `../../herramientas/base-alimentos/filtro_persona.py` (Python, por portar) |
| Constantes MET y fórmula de gasto | `../../wiki/conocimiento/calculadora-cinta-neat.md` |

---

## 3. Reglas de este repo que rompen cosas si las ignoras

1. **WDAC bloquea binarios nativos de npm.** No propongas herramientas con `.node` o `.exe`.
   Ya costó una vez (`oxlint` quedó inservible y el linter no corrió durante semanas).
2. **`gh` no está instalado.** No intentes `gh pr create` ni `gh search`. Para un PR: `git
   push`, y dale a Bryan el enlace `pull/new/<rama>` más el cuerpo por separado.
3. **Código y comentarios en español.** No traduzcas lo existente.
4. **Vercel publica con solo empujar a `main`.** Trabaja en rama. No empujes a `main`.
5. **`aplicarSnapshot` reemplaza la base local entera.** Cualquier tabla nueva que se hidrate
   necesita su fallback a lo local cuando el servidor falla, o borrarás datos. Ya pasó tres
   veces. Mira cómo lo hacen `perfilesNutricion`, `pruebasCalibracion` y `visibilidades` en
   `src/data/nube/hidratar.ts`.
6. **Toda tabla nueva necesita su política RLS** y su señal en `supabase/comprobar-migraciones.sql`.
   Las migraciones se pegan a mano: sin señal, un pegado truncado pasa por bueno.
7. **Tests primero cuando hay un fallo.** El patrón es: un commit con el test en rojo que
   documenta el bug, y otro que lo arregla.
8. **Nunca datos reales de asesorados** en código, tests, comentarios ni commits. Usa el seed
   de Valentina.
9. **`null` = «no se midió», `0` = «se midió y no contiene».** No los confundas nunca.

---

## 4. Guardarraíles de seguridad — no negociables

Esto no es estilo. El apartado maneja datos de salud de personas con antecedente de conducta
alimentaria, y hay una migración entera (`0018`) dedicada a protegerlas.

- **Ningún interruptor de privacidad puede callar una alerta de salud.** La alerta de
  disponibilidad energética se pinta fuera de los tres interruptores, a propósito. Si tocas
  `PerfilCalculadoVista`, no la metas dentro de ninguno.
- **El motor de ajuste nunca deja el día por debajo del TMB** ni por debajo del umbral de
  disponibilidad energética, y **nunca propone saltarse una comida**. Si corregir entero
  cruzaría ese piso, corrige lo que pueda y dilo.
- **Con `estado: 'en_espera'` no se dan recomendaciones de ajuste.**
- **Con `verContadorKcal: false` se habla en porciones, no en calorías.**
- **Los micronutrientes no sellan el día.** Van como tendencia a 7–14 días. Está decidido y
  el porqué está en el spec §3.2.

---

## 5. Tareas, en orden

### T1 · Poner la ventana energética en `main` *(15 min)*

`b7d27b7` está sin mezclar. Pon la rama al día con `main`, corre `npm run verify`, empuja, y
dale a Bryan el enlace del PR con un cuerpo listo para pegar. **No mezcles tú.**

**Hecho cuando:** la rama está al día, verify en verde y Bryan tiene el enlace.

---

### T2 · El gasto de entrenamiento *(la pieza que más bloquea)*

**Por qué urge.** La alerta de disponibilidad energética ya se calcula, pero
`gastoEjercicioKcal` cuenta como **cero** porque nada lo mide. Y el error va en la dirección
mala: con gasto cero la disponibilidad sale **más alta** de lo real, así que **la alerta se
calla justo en quien entrenó y no comió**. Hoy la tarjeta lo declara por escrito; el arreglo
es medirlo.

Ejemplo real: come 1.600 y quema 400 → disponibilidad real 26,3 (**problema**). Con gasto
cero la app calcula 35,1 (**bien**) y se calla.

**Qué construir:**

1. **Pregunta de jornada en la encuesta** (`src/domain/nutricion/encuesta.ts`, `CAMPOS`).
   Cuánto se mueve fuera del gimnasio: trabajo sentado, de pie, con carga. Es la mitad NEAT
   que los pasos no capturan. Campo nuevo, opcional al principio para no bloquear a los que
   ya respondieron.
2. **Estimado por sesión.** Fórmula ya documentada en
   `../../wiki/conocimiento/calculadora-cinta-neat.md`:
   `kcal = 0,0175 × peso_kg × MET × minutos`, con MET de pesas ≈ 3,5. Módulo nuevo en
   `src/domain/nutricion/` con sus tests.
3. **Categorías** por sesiones/semana, duración media e intensidad, promediando.
4. **La sesión que no se registró.** Si llega la noche y no hay registro de una sesión
   pautada, preguntar *¿entrenaste hoy?*. Con un sí basta para aplicar un **estimado mínimo**
   — el suelo de lo que cuesta esa sesión — y **marcarlo como estimado**, que viaje con esa
   etiqueta a todas partes.
5. **Conectarlo** a `calcularPerfil(respuestas, hoy, { ingestaKcal, gastoEjercicioKcal })` en
   `src/features/nutri/CifrasAsesoradosPage.tsx`, y **quitar** el renglón que hoy dice que el
   gasto cuenta como cero.

**Cuidado con:** contar cero cuando no se sabe. Si no hay dato de una sesión, el estimado
mínimo es mejor que el cero, y el cero es mejor que inventar un número alto. Que se vea cuál
es cuál.

**Hecho cuando:** la tarjeta de energía de la pantalla de la nutricionista enseña gasto real
o estimado con su etiqueta, y ya no declara que cuenta como cero.

---

### T3 · La cifra normocalórica con las dos fórmulas *(fase 1 del spec)*

Hoy `energia.ts` usa solo Mifflin-St. Jeor. `../../wiki/conocimiento/cuantificacion-calorica.md`
recomienda **promediar Mifflin con Katch-McArdle** cuando se conoce el % de grasa — y se
conoce, sale de la encuesta.

```
TMB = ½ × [ Mifflin(peso, altura, edad, sexo) + Katch-McArdle(masa magra) ]
```

Katch-McArdle (rev. Cunningham): `370 + 21,6 × masa libre de grasa (kg)`.

**Cuidado:** cuando no hay % de grasa, `masaMagraKg` es `null` y hay que caer a Mifflin solo,
no a un promedio con cero. Y esto **cambia el TDEE de todos los perfiles existentes**:
compruébalo contra un caso conocido antes y después, y dilo en el commit.

**Hecho cuando:** hay tests que fijan los dos caminos (con y sin % de grasa) y `npm run verify`
sigue en verde.

---

### T4 · La despensa *(fase 2 del spec — sesión propia, no la empieces a medias)*

Está detallada en el spec §11. Resumen de lo que la hace distinta de lo que parece:

- La lista de compra **no se parsea sola**. Son líneas humanas
  (`Espinaca, lechuga, brócoli, zanahoria`). La resolución a alimentos del catálogo **la hace
  la persona** al marcar lo que compró.
- La despensa guarda **presencia, no saldo**. No se descuenta comida a comida: un inventario
  que se descuenta se desincroniza en tres días y empieza a recomendar comida que no está.
- El alimento que no está en el catálogo entra igual, marcado *sin datos*, y va a una cola
  que resuelve el staff. **El motor no lo usa para calcular** hasta que tenga tabla
  nutricional.
- El catálogo va **empaquetado en el build**, así que añadir un alimento hoy exige
  redesplegar. Propuesta del spec: tabla `alimento_extra` que se fusiona al leer.

---

## 6. Lo que necesita a Bryan — no lo puede hacer el agente

1. **Confirmar la migración 0023.** Es lo más urgente de toda la lista. Mientras no esté
   aplicada, cada comida que un asesorado registre falla con `42P10` y **se descarta en
   silencio**, y lo descartado tiene tope de 20 operaciones y dos rescates: se pierde. El
   chequeo es de solo lectura y está en `supabase/comprobar-migraciones.sql` (busca la señal
   `0023 - indices cliente_id no parciales`). Si dice `NO`, se aplica
   `supabase/migrations/0023_indices_cliente_id_no_parciales.sql`, que es idempotente.
   **Recuérdaselo al empezar la sesión.**
2. **Las frases del motor**, firmadas por Manuela.
3. **De dónde sale la lista de compra por asesorado** — hoy `plan.listaCompras` es texto libre
   escrito a mano por el coach.

---

## 7. Cómo verificar

```bash
npm run verify
```

Debe salir en verde: 0 errores, y ni un aviso de linter más de los 5 que ya hay.

Y **míralo en el navegador** si el cambio se ve: `preview_start` con `alpha-app-demo`, no
`npm run dev` a mano. La pantalla de la nutricionista está en `/equipo-nutricion/cifras` y
**el seed no trae usuario con rol `nutricionista`** — hay que inyectarlo en `localStorage`
(clave `alpha-db-v2`, más `alpha-usuario`) para poder abrirla. Restaura el seed al terminar.
