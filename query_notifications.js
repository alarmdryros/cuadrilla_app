const fetch = require('node-fetch');

const supabaseUrl = 'https://gxleekwbcnpcckmvnthn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bGVla3diY25wY2NrbXZudGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTE0NTcsImV4cCI6MjA4MTUyNzQ1N30._YU7Z8-__lKJry3ZhN5zhYjcL3iVn_7wwH4jl350pWI';

async function queryNotifications() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/notificaciones?select=*&order=created_at.desc`, {
            headers: {
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${supabaseAnonKey}`
            }
        });
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error fetching notifications:', error);
    }
}

queryNotifications();
