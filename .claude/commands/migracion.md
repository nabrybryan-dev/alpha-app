---
description: Crear una migración de Supabase con su política RLS
---

Crear una migración nueva en `supabase/migrations/`. Contexto: **$ARGUMENTS**

Reglas de este proyecto:

1. **Numeración.** Lee los archivos existentes y usa el **siguiente** número de la
   serie (`00NN_descripcion.sql`, en `snake_case` y español). **Nunca edites una
   migración ya aplicada**: si algo salió mal, se corrige con una migración nueva.
2. **RLS obligatoria.** Toda tabla nueva va con `ENABLE ROW LEVEL SECURITY` y sus
   políticas. Toda columna nueva que contenga datos de un asesorado hereda el
   aislamiento de su tabla.
3. **Políticas no tautológicas.** Una política que compara una columna consigo misma
   (`rol = rol`) no restringe nada: permitió que un asesorado se auto-promoviera a
   coach (corregido en `0008_seguridad_rol_perfil.sql`). Distingue siempre `USING`
   (qué filas se pueden leer) de `WITH CHECK` (qué valores se pueden escribir), y
   comprueba que un asesorado no pueda escribirse un rol ni tocar filas de otro.
4. **Roles reales del proyecto:** asesorado, coach y nutricionista. La nutricionista
   está **acotada** a propósito (`0013_acotar_nutricionista.sql`): no ve las
   consultas ni el bienestar completo del equipo. No la trates como staff con acceso
   total.
5. **Nada de datos personales** en el archivo de migración. Las semillas con datos
   reales van en `*.local.sql`, que no se commitea.
6. **Verificación.** Explica en un comentario de cabecera qué problema resuelve la
   migración y **cómo comprobar que la política funciona** (qué debería fallar y con
   qué rol). Si el cambio afecta al aislamiento, añade o ajusta el test
   correspondiente en `src/data/nube/`.
7. **Aplicación.** La migración se aplica en Supabase **antes** de que el código que
   la necesita llegue a producción. Recuérdaselo a Bryan y no la apliques tú.
