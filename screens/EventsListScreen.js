import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ScrollView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';
import { MaterialIcons } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useOffline } from '../contexts/OfflineContext';
import { OfflineService } from '../services/OfflineService';
import SideMenu from '../components/SideMenu';

import { normalizeString } from '../utils/stringUtils';

export default function EventsListScreen({ navigation }) {
    const { userRole, userProfile } = useAuth();
    const { selectedYear, availableYears, changeSelectedYear } = useSeason();
    const [eventos, setEventos] = useState([]);
    const [filteredEventos, setFilteredEventos] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const { unreadCount } = useNotifications();
    const { isOffline, isSyncing, queueSize } = useOffline();

    const isManagement = ['superadmin', 'admin', 'capataz', 'auxiliar'].includes(userRole?.toLowerCase());

    const fetchEventos = async () => {
        try {
            // 1. Cargar desde caché primero para rapidez
            const cached = await OfflineService.getEvents();
            if (cached && cached.length > 0 && eventos.length === 0) {
                setEventos(cached);
            }

            // 2. Si no estamos totalmente offline, intentar fetch
            if (!isOffline) {
                const { data, error } = await supabase
                    .from('eventos')
                    .select('*')
                    .eq('año', selectedYear)
                    .order('fecha', { ascending: false });

                if (error) throw error;

                if (data) {
                    setEventos(data);
                    // 3. Guardar en caché para la próxima vez
                    await OfflineService.saveEvents(data);
                }
            }
        } catch (error) {
            console.error(error);
            // Solo alertamos si no es un error de red esperado
            if (!isOffline) {
                Alert.alert("Error", "No se pudieron cargar los eventos");
            }
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchEventos();
        }, [selectedYear])
    );

    useEffect(() => {
        const query = normalizeString(searchQuery);
        const filtered = eventos.filter(e => {
            const nombre = normalizeString(e.nombre || '');
            const lugar = normalizeString(e.lugar || '');
            return nombre.includes(query) || lugar.includes(query);
        });
        setFilteredEventos(filtered);
    }, [eventos, searchQuery]);

    // Timer to update currentTime and refresh event statuses in real-time
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 30000); // Check every 30 seconds

        return () => clearInterval(timer);
    }, []);

    const renderItem = ({ item }) => {
        const now = currentTime;
        const eventDate = new Date(item.fecha);
        const eventEndDate = item.fechaFin ? new Date(item.fechaFin) : null;

        let statusColor = '#FFE5CC';
        let statusText = 'Pendiente';
        let statusTextColor = '#D97706';

        if (eventEndDate && now > eventEndDate) {
            statusColor = '#FFD6D6';
            statusText = 'Finalizado';
            statusTextColor = '#DC2626';
        } else if (now >= eventDate && (!eventEndDate || now <= eventEndDate)) {
            statusColor = '#D6F5D6';
            statusText = 'En curso';
            statusTextColor = '#059669';
        }

        return (
            <TouchableOpacity
                style={[styles.item, { backgroundColor: statusColor }]}
                onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
            >
                <View style={styles.contentContainer}>
                    <View style={styles.eventHeader}>
                        <Text style={styles.name} numberOfLines={2}>{item.nombre}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: 'white' }]}>
                            <Text style={[styles.statusText, { color: statusTextColor }]}>{statusText}</Text>
                        </View>
                    </View>
                    <Text style={styles.date}>
                        📅 {new Date(item.fecha).toLocaleDateString()} • 🕒 {new Date(item.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {item.fechaFin ? ` - ${new Date(item.fechaFin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </Text>
                    {item.lugar && <Text style={styles.place} numberOfLines={1}>📍 {item.lugar}</Text>}
                </View>
                <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
        );
    };

    const EmptyComponent = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No se encontraron eventos.</Text>
        </View>
    );

    const [menuVisible, setMenuVisible] = useState(false);

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerLeft: () => (
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ marginLeft: 0, marginRight: 16 }}>
                    <MaterialIcons name="menu" size={28} color="#212121" />
                </TouchableOpacity>
            ),
            headerRight: () => isManagement ? (
                <TouchableOpacity
                    onPress={() => navigation.navigate('NotificationsList')}
                    style={{ marginRight: 32, position: 'relative', paddingRight: 4 }}
                >
                    <MaterialIcons name="notifications-none" size={26} color="#424242" />
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            ) : null,
        });
    }, [navigation, unreadCount, isManagement]);

    const navigateAndClose = (screen, params = {}) => {
        setMenuVisible(false);
        navigation.navigate(screen, params);
    };

    // Note: handleLogout is now handled in SideMenu, but we can keep it here if needed or remove it
    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            Alert.alert("Error", "No se pudo cerrar sesión.");
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="🔍 Buscar evento o lugar..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>

            {isOffline && (
                <View style={styles.offlineBanner}>
                    <MaterialIcons name="cloud-off" size={16} color="#B91C1C" />
                    <Text style={styles.offlineText}>Modo Offline Activo</Text>
                    {queueSize > 0 && <Text style={styles.queueText}>({queueSize} cambios pendientes)</Text>}
                </View>
            )}

            {isSyncing && (
                <View style={[styles.offlineBanner, { backgroundColor: '#DBEAFE' }]}>
                    <MaterialIcons name="sync" size={16} color="#1E40AF" />
                    <Text style={[styles.offlineText, { color: '#1E40AF' }]}>Sincronizando datos...</Text>
                </View>
            )}

            <SideMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                navigation={navigation}
            />

            <FlatList
                data={filteredEventos}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={EmptyComponent}
            />

            {/* El menú lateral ahora se gestiona a través del componente SideMenu compartido */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA'
    },
    searchContainer: {
        backgroundColor: 'white',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    searchInput: {
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#212121',
        borderWidth: 1,
        borderColor: '#E0E0E0'
    },
    item: {
        backgroundColor: 'white',
        padding: 18,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    contentContainer: {
        flex: 1,
        marginRight: 12,
    },
    name: {
        flex: 1, // Permite que el texto se envuelva y deje espacio al badge
        fontSize: 18,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 6
    },
    date: {
        color: '#757575',
        marginTop: 4,
        fontSize: 14,
        fontWeight: '500'
    },
    place: {
        color: '#9E9E9E',
        fontStyle: 'italic',
        fontSize: 13,
        marginTop: 2
    },
    arrow: {
        fontSize: 24,
        color: '#BDBDBD',
        fontWeight: '300'
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 80,
        paddingHorizontal: 40
    },
    emptyText: {
        color: '#9E9E9E',
        fontSize: 16,
        textAlign: 'center'
    },
    eventHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6
    },
    statusBadge: {
        paddingHorizontal: 10, // Un poco más de espacio para evitar recortes
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 12,
        flexShrink: 0,
        justifyContent: 'center',
        alignItems: 'center'
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    badge: {
        position: 'absolute',
        right: 0,
        top: 3,
        backgroundColor: '#D32F2F',
        borderRadius: 9,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
        zIndex: 100,
        elevation: 5
    },
    badgeText: {
        color: 'white',
        fontSize: 9,
        fontWeight: 'bold'
    },
    // Offline Styles
    offlineBanner: {
        backgroundColor: '#FEE2E2',
        paddingVertical: 6,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#FECACA'
    },
    offlineText: {
        color: '#B91C1C',
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 8
    },
    queueText: {
        color: '#B91C1C',
        fontSize: 11,
        marginLeft: 4,
        fontWeight: '500'
    }
});
