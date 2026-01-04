import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '../components/Icon';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import DashboardCard from '../components/DashboardCard';
import StatCard from '../components/StatCard';
import SideMenu from '../components/SideMenu';

export default function DashboardScreen({ navigation }) {
    const { userRole, userProfile } = useAuth();
    const { selectedYear } = useSeason();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [nextEvent, setNextEvent] = useState(null);
    const [stats, setStats] = useState({
        pendingEvents: 0,
        attendance: { attended: 0, total: 0 },
        totalCostaleros: 0,
    });
    const [recentNotifications, setRecentNotifications] = useState([]);
    const [menuVisible, setMenuVisible] = useState(false);

    const isManagement = ['superadmin', 'admin', 'capataz', 'auxiliar'].includes(userRole?.toLowerCase());

    const fetchDashboardData = async () => {
        try {
            // 1. Próximo evento
            const { data: eventData } = await supabase
                .from('eventos')
                .select('*')
                .eq('año', selectedYear)
                .gte('fecha', new Date().toISOString())
                .order('fecha', { ascending: true })
                .limit(1)
                .single();

            setNextEvent(eventData);

            // 2. Estadísticas
            // Eventos pendientes
            const { count: pendingCount } = await supabase
                .from('eventos')
                .select('*', { count: 'exact', head: true })
                .eq('año', selectedYear)
                .gte('fecha', new Date().toISOString());

            // Asistencias del usuario (si es costalero)
            let attendanceData = { attended: 0, total: 0 };
            if (userProfile?.costalero_id) {
                const { count: totalEvents } = await supabase
                    .from('eventos')
                    .select('*', { count: 'exact', head: true })
                    .eq('año', selectedYear)
                    .lte('fecha', new Date().toISOString());

                const { count: attendedEvents } = await supabase
                    .from('asistencias')
                    .select('*', { count: 'exact', head: true })
                    .eq('costalero_id', userProfile.costalero_id)
                    .eq('estado', 'presente');

                attendanceData = { attended: attendedEvents || 0, total: totalEvents || 0 };
            }

            // Total de costaleros
            const { count: costaleroCount } = await supabase
                .from('costaleros')
                .select('*', { count: 'exact', head: true })
                .eq('año', selectedYear);

            setStats({
                pendingEvents: pendingCount || 0,
                attendance: attendanceData,
                totalCostaleros: costaleroCount || 0,
            });

            // 3. Notificaciones recientes (Removed but keep state for now to avoid breaking return)
            setRecentNotifications([]);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [selectedYear, userProfile])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const getTimeUntilEvent = (eventDate) => {
        const now = new Date();
        const event = new Date(eventDate);
        const diff = event - now;

        if (diff < 0) return 'En curso';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) return `Faltan ${days}d ${hours}h`;
        if (hours > 0) return `Faltan ${hours}h`;
        return 'Muy pronto';
    };

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => (
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: '#212121' }}>
                        Hola {userProfile?.nombre?.split(' ')[0] || 'Usuario'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#757575', fontWeight: '600', marginTop: 2 }}>
                        {userRole?.toUpperCase()} • Temporada {selectedYear}
                    </Text>
                </View>
            ),
            headerLeft: () => (
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ marginLeft: 12, padding: 8 }}>
                    <MaterialIcons name="menu" size={28} color="#212121" />
                </TouchableOpacity>
            ),
        });
    }, [navigation, isManagement, userProfile, userRole, selectedYear]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1a5d1a" />
                <Text style={styles.loadingText}>Cargando...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <SideMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                navigation={navigation}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1a5d1a']} />
                }
            >
                {/* Próximo Evento */}
                {nextEvent ? (
                    <DashboardCard
                        title="PRÓXIMO EVENTO"
                        icon="event"
                        color="#1a5d1a"
                        onPress={() => navigation.navigate('EventDetail', { eventId: nextEvent.id })}
                    >
                        <Text style={styles.eventName}>{nextEvent.nombre}</Text>
                        {nextEvent.lugar && (
                            <View style={styles.eventDetail}>
                                <MaterialIcons name="place" size={16} color="#757575" />
                                <Text style={styles.eventDetailText}>{nextEvent.lugar}</Text>
                            </View>
                        )}
                        <View style={styles.eventDetail}>
                            <MaterialIcons name="schedule" size={16} color="#757575" />
                            <Text style={styles.eventDetailText}>
                                {new Date(nextEvent.fecha).toLocaleDateString('es-ES', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </Text>
                        </View>
                        <View style={styles.countdown}>
                            <MaterialIcons name="timer" size={20} color="#1a5d1a" />
                            <Text style={styles.countdownText}>{getTimeUntilEvent(nextEvent.fecha)}</Text>
                        </View>
                    </DashboardCard>
                ) : (
                    <DashboardCard title="PRÓXIMO EVENTO" icon="event" color="#9E9E9E">
                        <Text style={styles.noDataText}>No hay eventos próximos</Text>
                    </DashboardCard>
                )}

                {/* Estadísticas */}
                <Text style={styles.sectionTitle}>Estadísticas</Text>
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <StatCard
                            icon="event-available"
                            value={stats.pendingEvents}
                            label="Eventos"
                            subtitle="Pendientes"
                            color="#1a5d1a"
                        />
                    </View>
                    <View style={styles.statItem}>
                        <StatCard
                            icon="check-circle"
                            value={`${stats.attendance.attended}/${stats.attendance.total}`}
                            label="Asistido"
                            subtitle={stats.attendance.total > 0 ? `${Math.round((stats.attendance.attended / stats.attendance.total) * 100)}%` : '0%'}
                            color="#4CAF50"
                        />
                    </View>
                    <View style={styles.statItem}>
                        <StatCard
                            icon="people"
                            value={stats.totalCostaleros}
                            label="Cuadrilla"
                            subtitle="Costaleros"
                            color="#5E35B1"
                        />
                    </View>
                </View>

                {/* Accesos Rápidos */}
                <Text style={styles.sectionTitle}>Accesos Rápidos</Text>
                <View style={styles.quickAccess}>
                    <TouchableOpacity
                        style={styles.quickButton}
                        onPress={() => navigation.navigate('Announcements')}
                    >
                        <MaterialIcons name="grid-view" size={32} color="#1a5d1a" />
                        <Text style={styles.quickButtonText}>Tablón</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.quickButton}
                        onPress={() => navigation.navigate('EventsList')}
                    >
                        <MaterialIcons name="event" size={32} color="#1a5d1a" />
                        <Text style={styles.quickButtonText}>Eventos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.quickButton}
                        onPress={() => navigation.navigate(isManagement ? 'Management' : 'Profile')}
                    >
                        <MaterialIcons name="people" size={32} color="#1a5d1a" />
                        <Text style={styles.quickButtonText}>{isManagement ? 'Cuadrilla' : 'Mi Perfil'}</Text>
                    </TouchableOpacity>
                    {isManagement && (
                        <TouchableOpacity
                            style={styles.quickButton}
                            onPress={() => navigation.navigate('EventForm')}
                        >
                            <MaterialIcons name="add-circle" size={32} color="#1a5d1a" />
                            <Text style={styles.quickButtonText}>Crear</Text>
                        </TouchableOpacity>
                    )}
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FAFAFA',
    },
    loadingText: {
        marginTop: 12,
        color: '#757575',
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    welcomeSection: {
        marginBottom: 24,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 4,
    },
    roleText: {
        fontSize: 14,
        color: '#757575',
        fontWeight: '600',
    },
    eventName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 8,
    },
    eventDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    eventDetailText: {
        fontSize: 14,
        color: '#757575',
        marginLeft: 6,
    },
    countdown: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        backgroundColor: '#E8F5E9',
        padding: 8,
        borderRadius: 8,
    },
    countdownText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1a5d1a',
        marginLeft: 6,
    },
    noDataText: {
        fontSize: 14,
        color: '#9E9E9E',
        fontStyle: 'italic',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#212121',
        marginTop: 8,
        marginBottom: 12,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6,
        marginBottom: 16,
    },
    statItem: {
        width: '50%',
        padding: 6,
    },
    quickAccess: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    quickButton: {
        width: '48%',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    quickButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#212121',
        marginTop: 8,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    notificationText: {
        fontSize: 14,
        color: '#424242',
        marginLeft: 8,
        flex: 1,
    },
    viewAllText: {
        fontSize: 14,
        color: '#1a5d1a',
        fontWeight: '600',
        marginTop: 8,
    },
});
