-- Ejecutar DESPUÉS de supabase.sql (SQL Editor → New query → Run).
-- Antes de ejecutarlo, crea tu propio usuario en Authentication → Users:
-- los usuarios que ya existan quedan como administración; los que crees después, como consulta.

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin','viewer'))
);
alter table profiles enable row level security;
create policy "ver mi perfil" on profiles for select to authenticated using (user_id = auth.uid());

create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'admin')
$$;

-- Todo usuario nuevo nace con rol "consulta".
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Usuarios ya existentes: administración.
insert into profiles(user_id, role) select id, 'admin' from auth.users on conflict do nothing;

-- Permisos: consulta solo lee productos; administración hace todo.
drop policy "usuarios autenticados" on products;
drop policy "usuarios autenticados" on sales;
drop policy "usuarios autenticados" on sale_items;
drop policy "usuarios autenticados" on expenses;
create policy "todos ven productos" on products for select to authenticated using (true);
create policy "admin escribe productos" on products for all to authenticated using (is_admin()) with check (is_admin());
create policy "solo admin" on sales for all to authenticated using (is_admin()) with check (is_admin());
create policy "solo admin" on sale_items for all to authenticated using (is_admin()) with check (is_admin());
create policy "solo admin" on expenses for all to authenticated using (is_admin()) with check (is_admin());

create or replace function add_stock(p_id uuid, p_qty int) returns void
language plpgsql as $$
begin
  if not is_admin() then raise exception 'Solo administración puede cambiar el stock'; end if;
  update products set stock = stock + p_qty where id = p_id;
end $$;

-- Para cambiar el rol de alguien más adelante:
--   update profiles set role = 'admin'  where user_id = (select id from auth.users where email = 'correo@ejemplo.com');
--   update profiles set role = 'viewer' where user_id = (select id from auth.users where email = 'correo@ejemplo.com');
