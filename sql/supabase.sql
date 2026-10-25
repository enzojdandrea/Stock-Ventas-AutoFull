-- Ejecutar completo en Supabase → SQL Editor → New query → Run

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null default 0,
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 3,
  created_at timestamptz not null default now()
);
create table sales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  total numeric(12,2) not null default 0,
  void boolean not null default false,
  user_email text
);
create table sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  qty integer not null check (qty > 0),
  price numeric(12,2) not null
);
create table expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category text not null default 'Otros',
  amount numeric(12,2) not null check (amount > 0),
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Seguridad: solo usuarios con sesión iniciada pueden leer y escribir.
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table expenses enable row level security;
create policy "usuarios autenticados" on products for all to authenticated using (true) with check (true);
create policy "usuarios autenticados" on sales for all to authenticated using (true) with check (true);
create policy "usuarios autenticados" on sale_items for all to authenticated using (true) with check (true);
create policy "usuarios autenticados" on expenses for all to authenticated using (true) with check (true);

-- Registrar una venta: descuenta stock de forma atómica y toma los precios del servidor.
create or replace function create_sale(p_items jsonb) returns uuid
language plpgsql as $$
declare sid uuid; it jsonb; p products%rowtype; q int; tot numeric := 0; nm text;
begin
  if auth.uid() is null then raise exception 'No autorizado'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'La venta está vacía'; end if;
  insert into sales(total, user_email) values (0, auth.jwt()->>'email') returning id into sid;
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'qty')::int;
    if q <= 0 then raise exception 'Cantidad inválida'; end if;
    update products set stock = stock - q
      where id = (it->>'product_id')::uuid and stock >= q returning * into p;
    if not found then
      select name into nm from products where id = (it->>'product_id')::uuid;
      raise exception 'Stock insuficiente de %', coalesce(nm, 'un producto');
    end if;
    insert into sale_items(sale_id, product_id, name, qty, price) values (sid, p.id, p.name, q, p.price);
    tot := tot + q * p.price;
  end loop;
  update sales set total = tot where id = sid;
  return sid;
end $$;

-- Anular una venta y devolver las unidades al stock.
create or replace function void_sale(p_sale_id uuid) returns void
language plpgsql as $$
declare s sales%rowtype; r record;
begin
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if s.void then raise exception 'La venta ya estaba anulada'; end if;
  for r in select product_id, qty from sale_items where sale_id = p_sale_id and product_id is not null loop
    update products set stock = stock + r.qty where id = r.product_id;
  end loop;
  update sales set void = true where id = p_sale_id;
end $$;

-- Sumar stock sin pisar cambios de otros usuarios.
create or replace function add_stock(p_id uuid, p_qty int) returns void
language sql as $$
  update products set stock = stock + p_qty where id = p_id;
$$;

-- Actualización en vivo entre dispositivos.
alter publication supabase_realtime add table products, sales, expenses;
