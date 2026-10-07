# Pórtico
Sistema de registro y control de acceso QR con Next.js, Supabase/PostgreSQL y Resend.

## Configuración de Supabase
En Supabase abre SQL Editor y ejecuta supabase/migrations/202610070001_initial_access_control.sql.
Crea el primer usuario desde Authentication → Users → Add user. Luego asigna el primer administrador:

~~~sql
update public.user_profiles set role = 'ADMIN'
where id = (select id from auth.users where email = 'tu-correo-admin');
~~~

Crea las cuentas de operadores en Authentication; quedan con rol SCANNER. Deshabilita el registro público. Obtén Project URL y anon/publishable key en Project Settings → API. No expongas la service role en el navegador.

## Variables
Copia .env.example a .env.local y configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY. Para correo configura RESEND_API_KEY y RESEND_FROM_EMAIL. EVENT_NAME es opcional. La aplicación informa cuando falte Resend y no afirma que un mensaje se envió si falló. La service role no es necesaria.

## Ejecutar
~~~sh
npm install
npm run dev
~~~
Abre http://localhost:3000. La cámara requiere localhost o HTTPS. En Vercel añade las variables en Settings → Environment Variables. Ejecuta la migración en Supabase antes de utilizar la aplicación.
