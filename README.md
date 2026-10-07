# Pórtico

Plataforma SaaS para registro de personas y control de acceso con QR. Esta entrega cubre únicamente la Fase 1: estructura Next.js, Tailwind, clientes iniciales Supabase y portada. No implementa todavía base de datos, autenticación ni gestión de participantes.

## Arquitectura propuesta

El navegador y las páginas/acciones de Next.js llaman a Supabase usando el cliente anon y las cookies de sesión. PostgreSQL y RLS aplicarán la autorización. Las claves privilegiadas y Resend se reservarán para módulos de servidor cuando lleguen sus fases. No hace falta un servidor Node independiente.

## Estructura

```text
app/                 App Router: páginas, layout y estilos
components/          Componentes compartidos de interfaz
emails/              Plantillas para Resend
lib/supabase/        Clientes de navegador y servidor
services/            Casos de uso y lógica de negocio
supabase/             Migraciones y configuración local (Fase 2)
types/                Tipos compartidos
public/               Recursos estáticos
```

## Ejecutar localmente

Requisitos: Node.js 20.9+ y npm.

1. Copia `.env.example` a `.env.local`.
2. Para usar Supabase, completa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. La portada no depende aún de esas credenciales.
3. Ejecuta `npm install`, luego `npm run dev` y abre <http://localhost:3000>.
4. Verifica producción local con `npm run build` y `npm start`.

No incluyas valores reales en Git. `SUPABASE_SERVICE_ROLE_KEY` y `RESEND_API_KEY` son exclusivamente de servidor; no se utilizan en esta fase. El cliente inicial usa la clave pública anon y depende de RLS.

## GitHub y Vercel

Inicializa Git con `git init`, crea un repositorio GitHub y enlázalo con `git remote add origin <URL-del-repositorio>`. En Vercel, importa el repositorio, conserva el preset Next.js y configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` para Preview y Production cuando se conecte Supabase. La portada puede desplegarse antes sin ellas. Las claves de Resend y service role se añadirán únicamente a las variables server-side en las fases correspondientes.

## Dependencias principales

Next.js App Router, React, TypeScript, Tailwind CSS 4 y `@supabase/ssr`/`@supabase/supabase-js`. QR, cámara y Resend se incorporarán después.
