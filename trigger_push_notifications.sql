-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- 2. Función que llama a la Edge Function
CREATE OR REPLACE FUNCTION public.fn_notify_announcement()
RETURNS TRIGGER AS $$
BEGIN
  -- Llamada asíncrona a la Edge Function
  -- Sustituir <TU_PROYECTO_ID> por el ID real de tu proyecto de Supabase
  PERFORM net.http_post(
    url := 'https://gxleekwbcnpcckmvnthn.functions.supabase.co/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'TU_SERVICE_ROLE_KEY' -- Preferible usar variables de entorno
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger que se dispara tras insertar en 'anuncios'
CREATE OR REPLACE TRIGGER tr_on_announcement_created
AFTER INSERT ON public.anuncios
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_announcement();
