---
name: verificar-contra-la-realidad
description: Antes de afirmar que algo está aplicado, arreglado, desplegado o cubierto, comprobarlo contra la fuente real (la base de datos, git, el navegador, una medición). Usar siempre que se vaya a hacer una afirmación de estado sobre este proyecto.
---

# Verificar contra la realidad

En este proyecto, **el repo no es la realidad**. Las migraciones se aplican a mano, el
código vive en varias ramas y máquinas, y los tests no ven píxeles. Una afirmación de
estado que no se ha comprobado suele ser falsa, y aquí las falsas salen caras: datos de
salud, cargas de entrenamiento y privacidad entre asesorados.

**La regla: si vas a decir "está aplicado", "está arreglado", "ya está en producción" o
"está cubierto", primero míralo.**

## Por qué existe esta skill

Todos estos se creyeron ciertos y eran falsos. Cada uno se descubrió al comprobar:

| Se creía | La realidad |
|---|---|
| La suite está en rojo | Estaba **intermitente**; aislada pasaba |
| La nutricionista aún lee todas las consultas | Esas políticas **sí** estaban aplicadas |
| La 0013 está aplicada | Estaba **a medias**: 3 de 6 sentencias |
| `sync.ts` es peligroso por su estado de módulo | La cola vive en `localStorage`; la única variable de módulo era `enVuelo` |
| La rama es de permisos (por su nombre) | Contenía el **motor de ondulación** del método |
| El linter no estaba por descuido | WDAC **bloquea** su binario nativo |
| El refactor está verificado (242 tests) | El botón **tapaba** los números del ejercicio |
| Los 7 avisos del linter son 7 | La regla reporta **uno por efecto**; salieron más |

## Dónde está la fuente real, según lo que vayas a afirmar

**«La migración está aplicada»** → `supabase/comprobar-migraciones.sql` en el SQL
Editor. El repo tiene el archivo; eso no dice qué corrió. Si el objeto que buscas no
está en ese archivo, añádele la señal.

**«Eso ya está en `main`»** → `git ls-tree -r --name-only origin/main | Select-String "<archivo>"`.
Y para ramas, `git diff --stat origin/main...<rama>`: **el nombre de una rama no dice
lo que contiene.**

**«Está desplegado»** → `git log --oneline -1 origin/main` y la app en producción. Un
commit en local no está desplegado; una rama sin mezclar tampoco.

**«Se ve bien»** → los tests no ven píxeles. Levanta la app en modo demo
(`npm run dev -- --mode demo`) y mídelo: `getBoundingClientRect()` sobre los elementos
fijos dice si se solapan; una captura no siempre. Y si no puedes verlo tú, **dilo** en
vez de dar por bueno.

**«Está cubierto por tests»** → `npm run coverage`. Y recuerda qué significa: que el
código hace lo que su autor dijo, **no** que sea correcto para el método de
entrenamiento o nutrición. Eso lo confirma Bryan.

**«El linter/los tipos están limpios»** → `npm run verify`. Antes de creer que un aviso
desapareció, cuéntalos: arreglar uno puede destapar el siguiente.

## Cómo se afirma cuando no se ha comprobado

No se afirma. Se dice qué se comprobó y qué no:

> «Los tests pasan y el build está en verde. **No he abierto la app**, así que no puedo
> decirte que se vea bien.»

Esa frase es la que hizo que Bryan mirara y encontrara el botón tapando los números.
Una afirmación con su límite declarado vale más que una segura y equivocada.

## Cuando te equivoques

Corrige explícitamente y sigue: «te dije X, comprobé y es Y». Sin rodeos y sin
disculpas largas. Varias de las correcciones de esta lista cambiaron la decisión
siguiente; callarlas habría costado más que admitirlas.
