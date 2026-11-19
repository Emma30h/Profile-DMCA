-- Supabase Realtime para la campanita de notificaciones (reemplaza /api/notificaciones/stream)
-- Esquema: gestion_personal. Prisma se conecta como "postgres" (BYPASSRLS), así que las reglas
-- de abajo no afectan a la app del lado del servidor: solo a lo que escucha el navegador.

begin;

-- 1. El navegador (usuario logueado) puede ver el esquema y leer estas dos tablas...
grant usage on schema gestion_personal to authenticated;
grant select on gestion_personal.notificaciones to authenticated;
grant select on gestion_personal.usuarios to authenticated;

-- 2. ...pero solo sus propias filas
alter table gestion_personal.notificaciones enable row level security;
alter table gestion_personal.usuarios enable row level security;

create policy "cada usuario ve sus notificaciones"
  on gestion_personal.notificaciones for select to authenticated
  using ("usuarioId" = auth.uid()::text);

create policy "cada usuario ve su propia fila"
  on gestion_personal.usuarios for select to authenticated
  using (id = auth.uid()::text);

-- 3. Que la base avise los cambios de estas dos tablas
alter publication supabase_realtime add table gestion_personal.notificaciones;
alter publication supabase_realtime add table gestion_personal.usuarios;

commit;

-- Para deshacer:
-- begin;
-- alter publication supabase_realtime drop table gestion_personal.notificaciones;
-- alter publication supabase_realtime drop table gestion_personal.usuarios;
-- drop policy "cada usuario ve sus notificaciones" on gestion_personal.notificaciones;
-- drop policy "cada usuario ve su propia fila" on gestion_personal.usuarios;
-- alter table gestion_personal.notificaciones disable row level security;
-- alter table gestion_personal.usuarios disable row level security;
-- revoke select on gestion_personal.notificaciones from authenticated;
-- revoke select on gestion_personal.usuarios from authenticated;
-- revoke usage on schema gestion_personal from authenticated;
-- commit;
