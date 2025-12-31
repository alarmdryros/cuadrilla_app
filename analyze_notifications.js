const fetch = require('node-fetch');

const supabaseUrl = 'https://gxleekwbcnpcckmvnthn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bGVla3diY25wY2NrbXZudGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTE0NTcsImV4cCI6MjA4MTUyNzQ1N30._YU7Z8-__lKJry3ZhN5zhYjcL3iVn_7wwH4jl350pWI';

async function analyzeNotifications() {
    try {
        const headers = {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`
        };

        // 1. Fetch Notifications
        const resNotes = await fetch(`${supabaseUrl}/rest/v1/notificaciones?select=*&order=created_at.desc`, { headers });
        const notifications = await resNotes.json();

        // 2. Fetch Costaleros
        const resCostaleros = await fetch(`${supabaseUrl}/rest/v1/costaleros?select=id,nombre,apellidos`, { headers });
        const costaleros = await resCostaleros.json();
        const costaleroMap = costaleros.reduce((acc, c) => ({ ...acc, [c.id]: `${c.nombre} ${c.apellidos}` }), {});

        // 3. Fetch Events
        const resEvents = await fetch(`${supabaseUrl}/rest/v1/eventos?select=id,nombre`, { headers });
        const events = await resEvents.json();
        const eventMap = events.reduce((acc, e) => ({ ...acc, [e.id]: e.nombre }), {});

        // Format Analysis
        const analysis = notifications.map(n => ({
            id: n.id,
            costalero: costaleroMap[n.emisor_id] || 'Desconocido',
            evento: eventMap[n.event_id] || 'Evento no encontrado',
            titulo: n.titulo,
            mensaje: n.mensaje,
            motivo: n.motivo,
            leida: n.leida ? 'Leída' : 'Pendiente',
            fecha: new Date(n.created_at).toLocaleString('es-ES')
        }));

        console.log(JSON.stringify(analysis, null, 2));
    } catch (error) {
        console.error('Error analyzing data:', error);
    }
}

analyzeNotifications();
