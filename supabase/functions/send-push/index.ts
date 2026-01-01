import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import webpush from "npm:web-push@3.6.7"

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
    try {
        const { record } = await req.json();

        // 1. Inicializar Supabase y Web Push
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        webpush.setVapidDetails(
            Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
            Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
            Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
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
        const webSubscriptions = subscriptions.filter(s => s.platform === 'web').map(s => JSON.parse(s.token));

        // 3. Enviar a Expo (Android Native)
        const promises = [];
        if (nativeTokens.length > 0) {
            const messages = nativeTokens.map(token => ({
                to: token,
                sound: 'default',
                title: record.titulo,
                body: record.mensaje,
                data: { url: '/Announcements' },
            }));

            promises.push(
                fetch(EXPO_PUSH_URL, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messages),
                }).catch(err => console.error("Expo Push Error:", err))
            );
        }

        // 4. Enviar Web Push (iPhone PWA / Desktop)
        if (webSubscriptions.length > 0) {
            const payload = JSON.stringify({
                title: record.titulo,
                body: record.mensaje,
                url: '/Announcements'
            });

            const webPushPromises = webSubscriptions.map(sub =>
                webpush.sendNotification(sub, payload).catch(err => {
                    if (err.statusCode === 410) {
                        console.log("Subscription expired, cleaning up...");
                        // Opcional: Borrar suscripción inválida
                    } else {
                        console.error("Web Push Error:", err);
                    }
                })
            );
            promises.push(...webPushPromises);
        }

        await Promise.all(promises);

        return new Response(JSON.stringify({ success: true, count: subscriptions.length }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
})
