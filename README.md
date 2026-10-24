# INBOX24

Base inicial del MVP: buscador público de mesas, acceso a mesa, creación de solicitudes y Inbox operativo.

La interfaz actual es un MVP estático servido desde `index.html`, con autenticación, mesas, categorías, configuración e Inbox conectados a Supabase. El modelo Prisma documenta la evolución prevista hacia una aplicación Next.js/PostgreSQL; no debe ejecutarse `db:push` sobre el proyecto actual sin revisar antes las tablas y políticas existentes.

## Configuración de Supabase

1. Crear un proyecto en Supabase.
2. Copiar `.env.example` como `.env`.
3. Completar `DATABASE_URL`, `DIRECT_URL` y las claves de Supabase.
4. Ejecutar `npm install`.
5. Ejecutar `npm run db:generate`.
6. Ejecutar `npm run db:push` para crear las tablas durante la etapa inicial.

El modelo de datos está en `prisma/schema.prisma`. Incluye aislamiento por empresa, mesas, logo y portada, visibilidad pública, categorías, formularios, campos dinámicos, tickets, mensajes, adjuntos, eventos, hilos de email y límites del plan gratuito.
