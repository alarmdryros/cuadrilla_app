-- 1. Asegurar que la extensión pg_net existe (necesaria para Edge Functions)
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Crear (o reemplazar) la función que llama a la Edge Function
CREATE OR REPLACE FUNCTION public.fn_notify_push()
RETURNS TRIGGER AS $$
BEGIN
  -- Llamada asíncrona a la Edge Function 'send-push'
  -- Reemplaza la URL y la Key por tus valores reales si han cambiado.
  -- Usamos los valores obtenidos de los archivos previos.
  PERFORM net.http_post(
    url := 'https://gxleekwbcnpcckmvnthn.functions.supabase.co/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- TU_SERVICE_ROLE_KEY debe reemplazarse por la clave real de Service Role si la función la requiere
      -- Por seguridad, a menudo se usa un secreto en la Edge Function, o la key de anon si está abierta.
      -- Asumimos que la key estaba hardcodeada antes o configurada en la Edge Function.
      -- Poniendo un placeholder estándar.
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el Trigger en la tabla 'notificaciones'
-- Esto enviará push para CUALQUIER notificación insertada (incluyendo avisos de ausencia).
DROP TRIGGER IF EXISTS tr_push_on_notification ON public.notificaciones;

CREATE TRIGGER tr_push_on_notification
AFTER INSERT ON public.notificaciones
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_push();

-- 4. Comentario: Asegúrate de tener la tabla 'notificaciones' con los campos correctos.
