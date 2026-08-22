# Perfil de resistencia — derivarlo, no etiquetarlo a mano

**Fecha:** 2026-08-12
**Estado:** propuesta, sin implementar
**Acompaña a:** `2026-08-12-reparto-de-volumen-por-zona-diseno.md` §3.2
**Origen:** planteamiento del coach — el perfil de resistencia se puede **calcular**
a partir de la física del ejercicio, no hace falta declararlo uno por uno.

---

## 0. Lo que cambia respecto al plan anterior

El documento de reparto dejó el perfil de resistencia como **deuda del coach**: una
etiqueta `elongado | medio | acortado` que había que poner a mano a cada ejercicio del
catálogo. Con ~900 nombres distintos, eso era pedirle 900 decisiones.

El coach planteó otra cosa: **el perfil es una consecuencia, no un dato**. Si el torque
que exige un ejercicio es carga por brazo de momento, y el implemento determina cómo
varía ese brazo a lo largo del recorrido, entonces el perfil **se deriva** de dos cosas
que ya sabemos o casi: el **patrón de movimiento** (que ya tenemos, es la clave del
catálogo) y el **implemento** (que ya detectamos para el modificador de estabilización).

Eso convierte 900 decisiones en **una tabla de dos entradas**. Es el mismo movimiento
que hicimos con la contribución: la clave no es el nombre, es el movimiento.

---

## 1. La física, escrita una vez

$$\tau = F \times d_{\perp}$$

El torque que la articulación debe vencer es la fuerza de la resistencia por la
**distancia perpendicular** entre su línea de acción y el eje articular. La carga (`F`)
no cambia durante la serie; **el brazo (`d⊥`) sí**, y por eso la dificultad no es la
misma en todo el recorrido.

El **perfil de resistencia** es simplemente **dónde del recorrido cae el pico de `d⊥`**.

De ahí sale el punto que el coach señaló y que conviene tener escrito: un peso muerto
con barra, con mancuernas, en Smith y en una máquina convergente son **el mismo patrón
—bisagra de cadera— con cuatro perfiles distintos**. Reparten volumen igual (§3.1 del
otro documento: el implemento no cambia la hipertrofia del objetivo) pero **no exigen
igual en el mismo punto del recorrido**, y eso es información distinta que hoy la app
no tiene en ninguna parte.

---

## 2. El implemento fija la **forma** de la curva

| Clase de implemento | Cómo varía `d⊥` | Forma | Dónde pica |
|---|---|---|---|
| **Gravedad vertical** (barra, mancuerna, Smith, peso corporal) | `d⊥` = distancia **horizontal** entre eje y carga | pico agudo | donde el segmento queda **horizontal** |
| **Polea** | `d⊥` depende del ángulo del cable con el segmento | más plana | ajustable según la altura de la polea |
| **Leva** (máquina con cam) | la leva está diseñada para seguir la curva de fuerza | ~constante | por diseño, **en ningún sitio** |
| **Pendular / convergente** | brazo mecánico con eje propio | **campana** | a **mitad** de recorrido |
| **Banda elástica** | la tensión crece con el estiramiento | creciente | al **final** del recorrido |

Las dos primeras filas son geometría pura. La tercera y la cuarta son declaraciones del
fabricante que se cumplen con desigual fortuna, así que conviene tratarlas como
«aproximadamente constante» y «aproximadamente en campana», no como certezas.

---

## 3. El patrón fija **dónde cae** ese pico

Con gravedad vertical, que es el caso con menos ambigüedad:

| Movimiento | Segmento horizontal en… | Perfil |
|---|---|---|
| `sentadilla` · `prensa` · `zancada-split` | el fondo | **elongado** |
| `press-horizontal` · `fondos` · `apertura` | el fondo | **elongado** |
| `press-vertical` | el fondo | **elongado** |
| `bisagra-rodilla-extendida` (rumano, stiff) | el fondo, tronco horizontal | **elongado** |
| `pullover` | la posición sobre la cabeza | **elongado** |
| `pantorrilla` | el fondo | **elongado** |
| `hip-thrust` | **arriba**, cadera extendida | **acortado** |
| `bisagra-rodilla-flexionada` (banco 45°/romano) | **arriba**, tronco horizontal | **acortado** |
| `extension-rodilla` | **arriba**, pierna horizontal | **acortado** |
| `elevacion-lateral` | a 90° de abducción | **acortado** |
| `curl-biceps` de pie | a 90° de codo | **medio** |

> **El caso que mejor prueba el planteamiento del coach.** El peso muerto rumano y la
> extensión de cadera en banco romano son **los dos extensión de cadera**, y reparten
> volumen parecido. Pero el rumano pica **en elongación** y el banco romano pica **en
> acortamiento**, porque el tronco queda horizontal en extremos opuestos del recorrido.
> Programar los dos no es repetir: es cubrir el recorrido. Programar dos rumanos sí es
> repetir. Eso es exactamente lo que la app no sabe ver hoy.

Y el matiz que el nombre a veces trae y hay que aprovechar: un **curl predicador** pica
en elongación y un **curl en polea alta** en acortamiento, siendo ambos `curl-biceps`.
Cuando el nombre lo diga (`PREDICADOR`, `INCLINADO`, `SOBRE LA CABEZA`, `POLEA ALTA`),
se usa; cuando no lo diga, **no se inventa** (§4).

---

## 4. La regla de composición, y cuándo decir «no lo sé»

```
perfil = ajustePorVariante( perfilBase(movimiento), claseDeImplemento )
```

- **Leva** y **pendular/convergente** aplanan o centran la curva → `medio`, sea cual sea
  el patrón. Es justamente para lo que existen.
- **Banda** desplaza el pico hacia el final del recorrido → `acortado` en la mayoría de
  patrones.
- **Polea** depende de la altura, que el nombre casi nunca dice → **`desconocido`** salvo
  que la variante lo aclare.
- **Gravedad vertical** → el perfil base del patrón, tal cual.

> **`desconocido` es un valor de primera clase, no un fallo.** El proyecto ya se quemó
> una vez fingiendo precisión (el «0,37 al glúteo medio» que no escribimos). Un ejercicio
> sin perfil determinable **no participa** en el aviso de cobertura y no se le asigna uno
> plausible. Es preferible avisar de menos que avisar mal.

---

## 5. La alineación: son **dos preguntas distintas**, y conviene no fundirlas

Aquí está lo que el coach pidió de verdad — no la etiqueta, sino qué hacer con ella.
Comparar el perfil de resistencia contra **la curva de fuerza** del grupo da dos lecturas
distintas, y sirven para cosas distintas:

| Relación | Qué significa | Para qué sirve |
|---|---|---|
| **Concordante** — el pico de resistencia cae donde el músculo es fuerte | el ejercicio deja mover **más carga total**; la exigencia se reparte pareja | expresar fuerza, cargas altas, trabajo pesado |
| **Discordante en elongación** — el pico cae donde el músculo está largo | tensión alta en posición estirada; el punto de fallo llega en el estiramiento | el matiz que el coach llama «zona objetivo» |
| **Discordante en acortamiento** — el pico cae donde el músculo está corto | pico de contracción, poca carga absoluta | complemento, finisher, congestión |

Un ejemplo del propio catálogo: la sentadilla profunda con barra es **discordante en
elongación** para el cuádriceps —pica donde la palanca es peor— y la extensión de rodilla
en máquina de leva es **concordante**. No son mejor y peor: son dos exigencias distintas,
y una semana que solo tenga una de las dos tiene un hueco.

### ⚠️ Lo que esto **no** puede hacer, y hay que dejarlo escrito

**No puede ordenar los ejercicios de mejor a peor para hipertrofia.** La tentación es
directa —«lo que pica en elongación crece más»— y la evidencia **no la sostiene**, como
ya quedó documentado en §1 Capa B del documento de reparto:

- El metaanálisis bayesiano de 2025 sobre longitud muscular encontró diferencias
  **triviales** entre sitios, con intervalos cruzando el cero **en todos**.
- Los parciales en elongación de Wolf y cols. (2023) parecían ganar, pero el ensayo
  directo de 2025 del propio grupo **igualó** al recorrido completo, y la réplica
  multicéntrica preregistrada de 15 sedes llegó a lo mismo.
- La revisión sistemática de 2025 sobre sarcomerogénesis sigue **sin poder afirmar**
  crecimiento longitudinal en humanos.

**Consecuencia de diseño:** el perfil de resistencia entra como **cobertura y variedad**,
nunca como puntuación. El motor puede decir «toda la semana de glúteo carga en
acortamiento»; no puede decir «esta semana de glúteo es peor».

---

## 6. Qué se implementa, y en qué orden

1. **`claseDeImplemento(categoria, nombre)`** — cinco clases, sobre el texto normalizado.
   Extiende lo que ya hace `implementoDeEjercicio` en `domain/contribucion.ts`, que hoy
   solo distingue libre/guiado porque es lo único que el modificador de estabilización
   necesitaba.
2. **`PERFIL_BASE: Record<Movimiento, Zona>`** — la tabla de §3, una entrada por
   movimiento del catálogo cerrado. Trece filas, no novecientas.
3. **`perfilDeResistencia(categoria, nombre)`** → `'elongado' | 'medio' | 'acortado' |
   'desconocido'`, componiendo §4.
4. **`coberturaDeZona(microciclo, grupo)`** — el aviso: para cada grupo prioritario, qué
   zonas cubre la semana y cuál falta. Ignora los `desconocido`.

Los tres primeros son dominio puro y se prueban solos. El cuarto es el que toca el motor
y no debería escribirse hasta que el coach haya visto los perfiles que salen de los
tres anteriores **aplicados a su catálogo real**, no a ejemplos.

---

## 7. Lo que falta y es del coach

1. **Revisar la tabla de §3** una vez, con las trece filas delante. Es criterio
   biomecánico y es donde un error se propaga a todo.
2. **Decidir el umbral del aviso.** ¿Basta con que la semana toque dos zonas de tres, o
   se avisa siempre que falte alguna? Un aviso que salta siempre se ignora siempre.
3. **Confirmar que la lectura de §5 es la suya.** El documento asume que «zona objetivo»
   significa dónde cae el pico de exigencia, no dónde el coach quiere que crezca el
   músculo. Si es lo segundo, esto no lo puede resolver: sería hipertrofia regional
   dirigida, y la evidencia de §5 dice que hoy no se puede prometer.

---

## Fuentes

Las de biomecánica y longitud muscular están en
`2026-08-12-reparto-de-volumen-por-zona-diseno.md` §Fuentes y
`2026-08-12-biomecanica-de-la-contribucion.md` §Fuentes. Este documento no añade
evidencia nueva: recombina la ya revisada con la geometría, que no necesita cita.
