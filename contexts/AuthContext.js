import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
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
                // Solicitar permisos de notificación tras login exitoso
                registerForPushNotifications(session.user.id);
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
        // Safety timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Auth timeout')), 5000)
        );

        try {
            // Race between actual fetch and 5s timeout
            await Promise.race([
                (async () => {
                    const { data: { user } } = await supabase.auth.getUser();

                    if (user) {
                        const { data: profiles, error } = await supabase
                            .from('user_profiles')
                            .select('*')
                            .eq('id', user.id);

                        let profile = profiles && profiles.length > 0 ? profiles[0] : null;

                        if (profile && profile.role === 'costalero') {
                            const { data: currentCostalero } = await supabase
                                .from('costaleros')
                                .select('id')
                                .eq('email', user.email.toLowerCase().trim())
                                .eq('año', selectedYear)
                                .single();

                            if (currentCostalero) {
                                profile.costalero_id = currentCostalero.id;
                            } else {
                                profile.costalero_id = null;
                            }
                        }

                        // Autocuración logic
                        if (!profile) {
                            const { data: costalero } = await supabase
                                .from('costaleros')
                                .select('id')
                                .eq('email', user.email.toLowerCase().trim())
                                .single();

                            if (costalero) {
                                const { data: newProfile, error: createError } = await supabase
                                    .from('user_profiles')
                                    .insert({
                                        id: user.id,
                                        email: user.email,
                                        role: 'costalero',
                                        costalero_id: costalero.id
                                    })
                                    .select()
                                    .single();

                                if (!createError && newProfile) {
                                    profile = newProfile;
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
                })(),
                timeoutPromise
            ]);

        } catch (error) {
            console.error('Auth check finished with:', error.message);
            if (error?.message === 'Auth timeout') {
                console.log('Auth timed out, assuming stuck state. Clearing loading.');
            }
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
    const registerForPushNotifications = async (userId) => {
        // Notificaciones desactivadas por solicitud del usuario
        return;
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
