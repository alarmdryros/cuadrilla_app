import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
    try {
        const { record } = await req.json();

        // 1. Inicializar Supabase
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 2. Obtener todas las suscripciones
        const { data: subscriptions, error: subError } = await supabase
            .from('push_subscriptions')
            .select('token, platform');

        if (subError) throw subError;
        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ message: "No subscriptions found" }), { status: 200 });
        }

        const nativeTokens = subscriptions.filter(s => s.platform === 'native').map(s => s.token);
        // const webSubscriptions = subscriptions.filter(s => s.platform === 'web').map(s => JSON.parse(s.token));

        // 3. Enviar a Expo (Android Native)
        if (nativeTokens.length > 0) {
            const messages = nativeTokens.map(token => ({
                to: token,
                sound: 'default',
                title: record.titulo,
                body: record.mensaje,
                data: { url: '/Announcements' },
            }));

            await fetch(EXPO_PUSH_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
            });
        }

        // 4. Web Push (iPhone PWA) - Temporalmente deshabilitado por error de empaquetado
        /*
        const webPromises = webSubscriptions.map(sub => 
          // Pendiente reimplementar con WebCrypto nativo para evitar dependencias externas
          console.log("Web Push pendiente:", sub)
        );
        await Promise.all(webPromises);
        */

        return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
})
