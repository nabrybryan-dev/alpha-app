# Ciclo de revisiones: agendar, enseñar, comprobar que se entendió

**Fecha:** 2026-08-02
**Estado:** propuesta, pendiente de revisión
**Proyecto 3 de 4** — depende de [la barra del coach](2026-08-02-barra-coach-y-adjuntos-diseno.md)
(donde vive) y de *Niveles* (que consume su resultado).

---

## 1. Por qué

La revisión de literatura del 2026-08-02
([clasificación de nivel y educación](../../../wiki/conocimiento/clasificacion-nivel-y-educacion.md))
dejó un temario de diez conceptos, ordenado por lo que la evidencia dice que hay que
construir primero: patrón técnico → hábito de registrar → estimar el RIR → tolerar volumen
→ gestionar fatiga.

Ese temario, hoy, es papel. Nada lo agenda, nada comprueba si el asesorado lo entendió y
nada impide explicar ondulación a quien todavía no sabe qué es el RIR.

Este proyecto lo convierte en ciclo: **se avisa, se dicta, se comprueba, y solo entonces se
avanza**. Y conecta con la escala de niveles por el lado que hoy le falta — los niveles
miden lo que la persona *hace*; esto mide lo que *sabe*.

---

## 2. El ciclo

```
      ┌──────────────────────────────────────────────────┐
      │                                                  │
      ▼                                                  │
  ESPERANDO ──(faltan ≤7 días)──► PRÓXIMA ──(el asesorado marca)──► CALIFICANDO
                                     │                                    │
                            cuenta atrás + temas          ┌───────────────┴────────────┐
                                                          ▼                            ▼
                                                   "Lo entendí"                "No del todo"
                                                          │                            │
                                                 avanza al siguiente          repite el mismo
                                                     tema del nivel           en la próxima
                                                          │                            │
                                                          └────────────┬───────────────┘
                                                                       ▼
                                                                  ESPERANDO
```

**Cadencia:** 20 días por defecto, **ajustable por asesorado**. No se ata al microciclo a
propósito: unos van a 8 días y otros a 15, y una constante global movería la revisión a la
mitad de la cartera.

**"Agendar" no es un calendario.** La app avisa de que toca agendar y muestra qué se va a
tratar; la cita se acuerda por el chat, que ya existe. Construir agenda con
disponibilidad, zonas horarias y recordatorios es otro proyecto, y no es el que hace falta
para que esto funcione.

---

## 3. Qué ve el asesorado

Todo dentro de la barra del coach, en la cabecera de Hoy. La barra cambia de cara según el
estado; no aparece una pestaña nueva en ningún sitio.

**Estado PRÓXIMA** (desde 7 días antes)
- Cuenta atrás: cuántos días faltan.
- Los temas de esa revisión, con su nombre en lenguaje llano.
- Una llamada a acordar la fecha, que abre el chat.

**Estado CALIFICANDO** (tras marcar la revisión como hecha)
- Por cada tema tratado, dos opciones: **lo entendí** / **no del todo**.
- En "no del todo", un campo opcional para decir qué quedó flojo. Va al coach como
  mensaje: es la duda concreta, y llega antes de la próxima revisión en vez de esperarla.

**Estado ESPERANDO**
- La barra vuelve a su cara normal. Si quedó algún tema pendiente, lo dice en una línea:
  se retoma en la próxima.

**Quién marca que ocurrió:** el asesorado, con un botón que **solo aparece cuando la cuenta
atrás llegó a cero**. Antes de la fecha no se puede marcar.

---

## 4. Qué ve el coach

Una sección en el detalle del asesorado, junto a la valoración de competencias que ya
existe:

- En qué punto del temario va y qué temas quedaron pendientes de comprender.
- Cuándo fue la última revisión y cuándo toca la próxima.
- **Revertir una revisión marcada.** Es la red del modelo elegido: como el asesorado marca
  su propia revisión, puede marcar una que no ocurrió y darse por entendido un tema que
  nadie explicó. Revertir la devuelve a pendiente. No se le pide nada al coach por
  adelantado; queda la corrección disponible.
- Cambiar los temas de la próxima revisión, si quiere tratar otra cosa.

---

## 5. Cómo se eligen los temas

Dos reglas, en este orden:

1. **Lo pendiente manda.** Un tema marcado "no del todo" vuelve a la siguiente revisión.
   Es lo que pediste y lo que sostiene la literatura: no se avanza sobre lo que no se
   entendió.
2. **Lo nuevo sale del nivel.** Cada peldaño de la Escala Alfa declara qué temas del
   temario le corresponden. Se toma el siguiente sin ver de ese nivel.

Máximo **dos temas por revisión**: uno pendiente y uno nuevo, o dos nuevos. Una llamada de
coaching no sostiene más, y el sistema no puede fingir que sí.

---

## 6. Cómo engancha con los niveles

**Los temas pendientes son un requisito de nivel.** Aunque cumpla los números —consistencia,
error de RIR, volumen, fuerza, técnica—, no sube mientras tenga un tema sin comprender.

Es lo que convierte el nivel en dominio y no solo en constancia. Y tiene un efecto de
diseño que conviene ver: **el ascenso deja de ser puramente automático**. Sigue sin pedir
aprobación del coach, pero ahora exige que el asesorado haya pasado por las conversaciones
y las haya dado por entendidas.

Se añade como un requisito más a `requisitosDeNivel()`, con su métrica visible en la Ruta,
igual que los otros cinco.

---

## 7. Datos

Nada de esto necesita tabla nueva: cabe en `perfiles.datos` (JSONB), como la valoración de
competencias y los campos del bloque. La migración `0008` ya impide que el asesorado
escriba en el perfil lo que no le corresponde, así que hay que revisar que el trigger deje
pasar exactamente estos campos y ninguno más.

Por asesorado se guarda:

| Dato | Para qué |
|---|---|
| Fecha de la última revisión | Calcular la próxima |
| Cadencia en días (por defecto 20) | Ajuste individual |
| Temas de la próxima revisión | Lo que se anuncia en la barra |
| Historial por tema: comprendido sí/no y cuándo | Qué se repite y qué se da por visto |

El temario en sí —los diez conceptos y a qué nivel pertenece cada uno— es **contenido, no
dato de la persona**: vive en `data/` junto al resto del contenido de la Ruta, y se
actualiza con la app.

La lógica de qué toca y cuándo va entera en `domain/revisiones.ts`: sin React y sin I/O,
con sus tests al lado.

---

## 8. Casos borde

| Caso | Comportamiento |
|---|---|
| Nunca ha tenido una revisión | La primera se cuenta desde que empieza su primer microciclo |
| Se pasa la fecha y no marca nada | La barra sigue en PRÓXIMA con la cuenta en negativo: "vencida hace N días". No se salta sola |
| Marca la revisión y no califica | Queda en CALIFICANDO; no arranca la cuenta de la siguiente hasta calificar |
| El coach revierte una ya calificada | Los temas vuelven a pendientes y el requisito de nivel se cierra otra vez |
| Termina todos los temas de su nivel | La barra lo dice y las revisiones siguen agendándose: el temario del nivel siguiente se abre al subir |
| Cambia la cadencia a mitad de ciclo | La próxima fecha se recalcula desde la última revisión, no desde hoy |

---

## 9. Tests

Todo el reparto de temas y fechas es lógica pura, así que se prueba sin pintar nada.

**`domain/revisiones.test.ts`**
- La próxima fecha sale de la última + cadencia, no de hoy.
- Un tema no comprendido vuelve en la siguiente revisión.
- Un tema comprendido no vuelve.
- Nunca se proponen más de dos temas.
- Sin temas del nivel disponibles, no se inventan del nivel siguiente.
- Con la fecha vencida el estado no salta solo a calificando.

**Del requisito de nivel**
- Con un tema pendiente, no sube aunque cumpla los otros cinco requisitos.
- Al comprender el último pendiente, el requisito pasa a cumplido.

**De la barra** (`features/hoy/BarraCoach.revision.test.tsx`)
- El botón de marcar no existe antes de la fecha.
- Calificar "no del todo" manda la duda al coach como mensaje.

**Del panel del coach**
- Revertir una revisión devuelve sus temas a pendientes.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| El asesorado se auto-certifica y sube de nivel sin haber hablado | El coach ve lo marcado y puede revertirlo; el botón no existe antes de la fecha |
| Alguien muy constante se queda trabado por un tema que no entiende | Es el efecto buscado, pero la Ruta debe decir con claridad **qué** falta y que se resuelve hablando, no entrenando más |
| El temario se percibe como deber escolar | Dos temas por revisión como máximo, y cada uno se abre con un dato suyo, no con teoría |
| La cadencia individual se olvida de configurar | 20 días por defecto: funciona sin tocar nada |

---

## 11. Fuera de alcance

- Agenda real con disponibilidad y recordatorios.
- Material de estudio dentro de la app (videos, fichas) para cada tema. Hoy el tema es un
  título y una conversación; el contenido puede venir después desde `contenidos`.
- Preguntas de comprobación tipo test. La calificación es declarativa a propósito: pedirle
  a alguien que apruebe un examen para subir de nivel es otro producto.
