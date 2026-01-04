import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { supabase } from '../supabaseConfig';
import { useSeason } from './SeasonContext';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const lastBackgroundTime = useRef(null);

    useEffect(() => {
        // Cargar sesión inicial
        loadUserProfile();

        // Escuchar cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                await loadUserProfile();
            } else {
                setUser(null);
                setUserRole(null);
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Monitorear AppState para cierre de sesión por inactividad (10 min)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                if (lastBackgroundTime.current) {
                    const elapsed = Date.now() - lastBackgroundTime.current;
                    const tenMinutes = 10 * 60 * 1000;

                    if (elapsed > tenMinutes) {
                        console.log('Sesión expirada por inactividad (>10min). Cerrando sesión...');
                        signOut();
                        Alert.alert(
                            "Sesión Expirada",
                            "Por seguridad, tu sesión se ha cerrado tras más de 10 minutos de inactividad."
                        );
                    } else {
                        // Refresco silencioso si volvemos pronto
                        loadUserProfile();
                    }
                    // Resetear el tiempo de background
                    lastBackgroundTime.current = null;
                }
            } else if (nextAppState === 'background') {
                lastBackgroundTime.current = Date.now();
            }
        });

        return () => subscription.remove();
    }, []);

    const { selectedYear } = useSeason();

    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                const { data: profiles, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', user.id);

                let profile = profiles && profiles.length > 0 ? profiles[0] : null;

                // Buscar siempre si el usuario tiene un registro en la tabla costaleros para obtener su nombre real
                const { data: costaleros } = await supabase
                    .from('costaleros')
                    .select('id, año, nombre')
                    .eq('email', user.email.toLowerCase().trim())
                    .order('año', { ascending: false });

                if (costaleros && costaleros.length > 0) {
                    // 1. Intentar el del año seleccionado
                    const current = costaleros.find(c => c.año === selectedYear) || costaleros[0];
                    profile.costalero_id = current.id;
                    profile.nombre = current.nombre; // Añadido nombre al perfil
                } else {
                    // Fallback: usar nombre de los metadatos de Supabase si existen
                    profile.nombre = user.user_metadata?.full_name || user.user_metadata?.nombre;
                }

                // Autocuración logic (si no hay perfil pero el email existe en costaleros)
                if (!profile) {
                    const { data: costaleroData } = await supabase
                        .from('costaleros')
                        .select('id')
                        .eq('email', user.email.toLowerCase().trim())
                        .limit(1);

                    if (costaleroData && costaleroData.length > 0) {
                        const { data: newProfile, error: createError } = await supabase
                            .from('user_profiles')
                            .insert({
                                id: user.id,
                                email: user.email,
                                role: 'costalero'
                            })
                            .select()
                            .single();

                        if (!createError && newProfile) {
                            profile = newProfile;
                            profile.costalero_id = costaleroData[0].id;
                        }
                    }
                }

                if (!profile) {
                    Alert.alert(
                        "Acceso Denegado",
                        "Tu usuario no tiene un perfil vinculado. Contacta con tu capataz.",
                        [{ text: "Entendido" }]
                    );
                    await supabase.auth.signOut();
                    setUser(null);
                    setUserRole(null);
                    setUserProfile(null);
                    return;
                }

                setUserProfile(profile);
                setUserRole(profile?.role || 'costalero');
                setUser(user);
            }
        } catch (error) {
            console.error('Error cargando perfil:', error.message);
            if (error?.message?.includes('Refresh Token') || error?.status === 400) {
                await signOut();
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            loadUserProfile();
        }
    }, [selectedYear]);

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setUserRole(null);
        setUserProfile(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            userRole,
            userProfile,
            loading,
            signOut,
            loadUserProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
