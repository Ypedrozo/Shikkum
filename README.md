# Shikkum

Aplicación Next.js de registro de invitados, entradas QR personales y control de acceso, conectada a Supabase/PostgreSQL y Resend.

## Configurar Supabase

En el proyecto `oiektdosylghnjlrcngc`, abre **SQL Editor** y ejecuta las migraciones en orden:

1. `supabase/migrations/202610070001_initial_access_control.sql` (solo si la estructura inicial aún no existe).
2. `supabase/migrations/202610120001_guest_groups_tickets.sql`.

La segunda migración conserva los registros actuales, agrega grupos/tickets y el RPC atómico para registrar, anular y validar entradas. No habilites el registro público de usuarios. Crea usuarios desde **Authentication → Users**; asigna sus roles en `public.user_profiles`: `ADMIN`, `cashier` o `gate_operator` (`SCANNER` existente sigue funcionando como rol legado).

## Variables de entorno

Copia `.env.example` a `.env.local` y completa:

- `NEXT_PUBLIC_SUPABASE_URL`: Project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: publishable key del proyecto Supabase.
- `RESEND_API_KEY` y `RESEND_FROM_EMAIL`: credenciales del servidor. El remitente debe estar habilitado en Resend para enviar a tus destinatarios.
- `NEXT_PUBLIC_SITE_URL`: URL pública del sitio, especialmente la de producción; se usa en los enlaces de QR.
- `EVENT_NAME`: opcional.

No configures `SUPABASE_SERVICE_ROLE_KEY` en el navegador. Esta aplicación usa la sesión de cada usuario, RLS y funciones SQL con permisos acotados.

## Ejecutar localmente

~~~sh
npm install
npm run dev
~~~

Abre `http://localhost:3000`. La cámara funciona en localhost o HTTPS y requiere permiso del navegador.

## Desplegar en Vercel

Importa el repositorio `Shikkum`, añade las variables anteriores en **Settings → Environment Variables** para Production y Preview, fija `NEXT_PUBLIC_SITE_URL` en el dominio de producción, y vuelve a desplegar. La migración SQL debe estar aplicada en Supabase antes del primer registro.
