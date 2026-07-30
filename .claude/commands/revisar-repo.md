---
description: Busca trabajo terminado que nunca llegó a producción y otros huérfanos del repo
---

Revisión periódica del repo. Busca las cosas que **no fallan, simplemente no están**:
trabajo acabado que nadie mezcló, y números de migración pisados.

Existe porque el 2026-07-29 aparecieron **dos** bolsas de trabajo terminado que nunca
llegó a los asesorados, y ninguna daba error:

- Cinco commits sin empujar en el portátil, con el arreglo de los 8 fallos de pérdida
  de datos y el de RLS de la nutricionista.
- El **motor de ondulación del Método Heracles** (393 líneas + 328 de tests) en una
  rama llamada `claude/permisos-pc-dhanny-juan-camilo`, que no lleva ningún permiso.

Ni el CI ni la protección de rama detectan una rama que nadie abre. Esto sí.

Correr cada pocas semanas, o antes de planear trabajo nuevo: puede que ya esté hecho.

---

## 1 · Ramas con trabajo sin mezclar

```powershell
git fetch origin --prune
git for-each-ref --format="%(refname:short)" refs/remotes/origin |
  Where-Object { $_ -ne "origin/main" -and $_ -ne "origin/HEAD" } |
  ForEach-Object {
    $n = git rev-list --count "origin/main..$_"
    if ([int]$n -gt 0) {
      $f = git log -1 --format="%ad" --date=short $_
      "{0,3} commits sin mezclar | {1} | {2}" -f $n, $f, $_
    }
  } | Sort-Object
```

**Para cada rama que salga, NO te fíes del nombre.** Los nombres describen la tarea con
la que empezó la sesión, no lo que acabó dentro. Mira siempre qué contiene:

```powershell
git log --format="%h %ad %s" --date=short "origin/main..<rama>"
git diff --stat "origin/main...<rama>"
```

Y antes de proponer recuperarla, comprueba dos cosas:

- **¿Ya está en `main` por otra vía?** Busca los archivos clave con
  `git ls-tree -r --name-only origin/main | Select-String "<archivo>"`. Puede que el
  trabajo se rehiciera después y la rama solo sea ruido.
- **¿Mezclaría limpio?** `git merge-tree --write-tree origin/main <rama>`. Si sale
  limpio, recuperarla es baratísimo.

Para recuperar: rama nueva desde `main` y `cherry-pick` de los commits en su orden
original —no mezclar la rama vieja, que arrastra una base antigua—, después
`npm run verify`, y dejarlo como PR para que Bryan revise. **Que los tests pasen dice
que el código hace lo que su autor dijo, no que sea correcto para el método.** Lo que
sea criterio de entrenamiento o nutrición lo confirma él.

## 2 · Números de migración pisados

```powershell
git ls-tree -r --name-only origin/main -- supabase/migrations |
  ForEach-Object { if ($_ -match "/(\d{4})_") { $matches[1] } } |
  Group-Object | Where-Object { $_.Count -gt 1 } |
  ForEach-Object { "DUPLICADO: $($_.Name) x$($_.Count)" }
```

Revisa también las ramas sin mezclar: el caso real fue una `0006_reparar_usuarios.sql`
en una rama huérfana mientras `main` ya tenía `0006_staff_nutricionista.sql`. **Git no
lo detecta**, porque son archivos distintos; el choque es solo de significado.

## 3 · Ramas locales ya mezcladas (se pueden borrar)

```powershell
git branch --merged main
```

`git branch -d <rama>` se niega si de verdad queda algo sin mezclar, así que es seguro.

## 4 · Y lo que el repo no puede saber

Si aparece una migración en una rama huérfana, la pregunta no es «¿la mezclo?» sino
**«¿está aplicada en producción?»**. Correr `supabase/comprobar-migraciones.sql` y
mirar los efectos en la base. El caso real: el trigger que hace visible a un asesorado
nuevo ya estaba puesto, y `0001_esquema.sql` ya lo instalaba, así que la rama sobraba.

Al terminar, si encuentras algo, archívalo en el Cerebro de Programación con
`/incidente` en vez de dejarlo en el chat.
