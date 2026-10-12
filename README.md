# Shikkum · control de acceso QR

Aplicación web en HTML, CSS y JavaScript sin framework de interfaz. PostgreSQL/Supabase conserva autenticación, RLS, registro de entradas y validación atómica; las funciones de Vercel gestionan correo y operaciones protegidas.

## Ejecutar localmente

1. Instala Node.js LTS.
2. Copia `.env.example` como `.env.local` y completa las variables con los valores del proyecto Supabase y Resend.
3. Ejecuta `npm install`, luego `npm run dev`.
4. Abre `http://localhost:3000`.

No compartas `.env.local`. El navegador recibe únicamente la URL y la publishable key de Supabase. Las claves de Resend nunca se envían al cliente.

## Variables de entorno

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (dominio/emisor verificado en Resend)
- `NEXT_PUBLIC_SITE_URL` (en producción: `https://shikkum.vercel.app`)
- `EVENT_NAME` (opcional)

En Vercel, configura esas variables para Production y Preview según corresponda y vuelve a desplegar.

## Funcionalidades

- Inicio de sesión Supabase con roles ADMIN/cashier y SCANNER/gate_operator.
- Dashboard real, registros, búsqueda, filtros, QR, anulación y reenvío de email.
- Registro transaccional mediante `register_guest_group`; tokens aleatorios creados por PostgreSQL.
- Email real con Resend; la interfaz muestra enviado solo con respuesta exitosa del proveedor.
- QR público y descargable. WhatsApp abre el chat de compartir con el enlace de la entrada; el envío lo confirma la persona operadora desde WhatsApp.
- Scanner de cámara con `html5-qrcode`; el check-in usa `check_in_qr` en PostgreSQL con bloqueo de fila para evitar doble ingreso concurrente.
- Las funciones validan sesión/rol en servidor y consultan con publishable key más el JWT del usuario; no usan service role.

## Base de datos y seguridad

La aplicación reutiliza las tablas y funciones que ya están en `supabase/`. No ejecuta migraciones automáticamente ni borra datos. Las reglas RLS y funciones SECURITY DEFINER del esquema protegen operaciones críticas.

## Comprobaciones

- `npm run lint`: verificación sintáctica de JavaScript.
- `npm run build`: comprueba que estén todos los archivos de la aplicación.
- `npm run dev`: servidor local que sirve el sitio y las funciones API.

El escaneo de cámara requiere HTTPS en producción o `localhost` en desarrollo. La librería de cámara se carga desde un CDN.
