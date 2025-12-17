
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://gxleekwbcnpcckmvnthn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4bGVla3diY25wY2NrbXZudGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTE0NTcsImV4cCI6MjA4MTUyNzQ1N30._YU7Z8-__lKJry3ZhN5zhYjcL3iVn_7wwH4jl350pWI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
