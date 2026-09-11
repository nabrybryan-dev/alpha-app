-- 0063 · Quién quiere que le avisemos al teléfono.
--
-- Una fila por persona. Guarda DOS cosas distintas que se confunden siempre:
-- lo que la persona DIJO (`dijo_si`) y si su teléfono está realmente suscrito
-- (`endpoint`). Se puede decir que sí y no tener suscripción —todavía no hay
-- clave de servidor de empuje—, y contar solo una de las dos pierde la mitad
-- del embudo.
--
-- `visto_en` es cuándo se le enseñó nuestra pantalla, no cuándo se suscribió:
-- de ahí sale el primer número de los tres (cuántos lo vieron).
--
-- `vivo_en` lo escribirá el propio teléfono cuando reciba un aviso. Hoy nadie
-- lo escribe y por eso es opcional: es la pieza siguiente. Sin él, «aceptó» y
-- «sigue llegándole» se ven exactamente igual, que es donde se rompen los
-- avisos de verdad — no en el primero, sino en el de la tercera semana.

create table if not exists permisos_de_aviso (
  usuario_id uuid primary key references usuarios_app (id) on delete cascade,
  dijo_si boolean not null,
  visto_en timestamptz not null default now(),
  endpoint text,
  p256dh text,
  auth text,
  vivo_en timestamptz,
  actualizado_en timestamptz not null default now()
);

alter table permisos_de_aviso enable row level security;

-- Cada quien la suya, y nada más. Es el aislamiento entre asesorados, que en
-- este repo ya se rompió dos veces por políticas que miraban el rol.
drop policy if exists "avisos: cada quien ve su decision" on permisos_de_aviso;
create policy "avisos: cada quien ve su decision"
  on permisos_de_aviso for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "avisos: cada quien guarda la suya" on permisos_de_aviso;
create policy "avisos: cada quien guarda la suya"
  on permisos_de_aviso for insert to authenticated
  with check (usuario_id = auth.uid());

drop policy if exists "avisos: cada quien cambia la suya" on permisos_de_aviso;
create policy "avisos: cada quien cambia la suya"
  on permisos_de_aviso for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Borrar desde el cliente: nadie. Quitar el permiso es poner `dijo_si = false`,
-- no hacer desaparecer la fila: si se borrara, el embudo perdería a quien dijo
-- que no y el porcentaje de aceptación saldría inflado para siempre.

-- El informe cuenta por fecha de decisión.
create index if not exists permisos_de_aviso_visto_idx on permisos_de_aviso (visto_en desc);
