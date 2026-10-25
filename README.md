# Stock y ventas (Vercel + Supabase)

Sitio estático (sin build) con base de datos en la nube, login y dos roles:
- **Administración:** equipamiento, accesorios, ventas, historial, gastos y cambio de precios, con permiso para modificar todo.
- **Consulta:** solo ve Equipamiento y Accesorios (stock y precios). No ve ventas ni gastos y no puede modificar nada.

## Estructura
```
index.html        → estructura de la página (HTML)
css/styles.css    → estilos
assets/logo.png   → logo que aparece en la pestaña del navegador (reemplázalo por el tuyo)
js/config.js      → URL y clave de Supabase (lo único que debes editar)
js/app.js         → lógica de la aplicación
sql/              → scripts de la base de datos (se ejecutan en Supabase)
```

## 1. Supabase
1. Crea un proyecto en https://supabase.com.
2. Authentication → Sign In / Providers → Email: **desactiva "Allow new users to sign up"**.
3. Authentication → Users → **Add user**: crea primero tu usuario (será administración). Marca "Auto confirm".
4. SQL Editor: ejecuta los archivos de la carpeta `sql/` **en este orden**:
   1. `supabase.sql`
   2. `supabase-roles.sql`
   3. `supabase-marca-vehiculo.sql`
   4. `supabase-venta-detalle.sql`
   5. `supabase-accesorios.sql`
   6. `supabase-editar-precios.sql`
   7. `supabase-forma-pago.sql`
   8. `supabase-precios.sql`
5. Crea el resto de usuarios en Authentication → Users: quedan como **consulta**. Para volver administración a alguien, ejecuta el `update` que está al final de `supabase-roles.sql`.
6. Project Settings → API: copia **Project URL** y la clave **anon public**.

## 2. Configurar
Pega la URL y la clave anon en `js/config.js`.

## 3. Publicar en Vercel
1. Sube esta carpeta a un repositorio de GitHub.
2. vercel.com → Add New → Project → importa el repositorio.
3. Framework Preset: **Other**. Sin build command ni output directory. Deploy.
4. (Opcional) Settings → Domains para usar tu dominio.

## Logo
Para cambiar el logo de la pestaña del navegador, reemplaza `assets/logo.png` por tu imagen conservando el mismo nombre (PNG cuadrado, de 512×512 px si es posible). Vuelve a desplegar y recarga la página con Ctrl+F5, porque el navegador guarda los íconos en caché.

## Notas
- Los permisos los aplica la base de datos, no solo la pantalla.
- Si actualizas desde una versión anterior (un solo `index.html`), mueve tu `config.js` a `js/config.js` y reemplaza el resto de archivos.
- El historial muestra las últimas 1000 ventas y 1000 gastos.
