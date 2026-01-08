-- Desactivar sistema de notificaciones
-- El usuario ha solicitado anular el proyecto de notificaciones

-- 1. Eliminar el trigger que dispara la Edge Function
DROP TRIGGER IF EXISTS tr_on_announcement_created ON public.anuncios;

-- 2. Eliminar la función que invoca a la Edge Function
DROP FUNCTION IF EXISTS public.fn_notify_announcement();

-- 3. (Opcional) Limpiar la tabla de suscripciones si ya no se va a usar
-- DELETE FROM public.push_subscriptions;
