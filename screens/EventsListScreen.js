import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, ScrollView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';
import { MaterialIcons } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import { useNotifications } from '../contexts/NotificationContext';

import { normalizeString } from '../utils/stringUtils';

export default function EventsListScreen({ navigation }) {
    const { userRole, userProfile } = useAuth();
    const { selectedYear, availableYears, changeSelectedYear } = useSeason();
    const [eventos, setEventos] = useState([]);
    const [filteredEventos, setFilteredEventos] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const { unreadCount } = useNotifications();

    const isManagement = ['superadmin', 'admin', 'capataz', 'auxiliar'].includes(userRole?.toLowerCase());

    const fetchEventos = async () => {
        try {
            const { data, error } = await supabase
                .from('eventos')
                .select('*')
                .eq('año', selectedYear)
                .order('fecha', { ascending: false });

            if (error) throw error;
            setEventos(data || []);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "No se pudieron cargar los eventos");
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

            <FlatList
                data={filteredEventos}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListEmptyComponent={EmptyComponent}
            />

            <Modal
                visible={menuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setMenuVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setMenuVisible(false)}
                >
                    <View style={styles.menuContainer}>
                        <View style={styles.menuHeader}>
                            <MaterialIcons name="event-note" size={48} color="#5E35B1" />
                            <Text style={styles.menuTitle}>Cuadrilla App</Text>
                            <Text style={styles.menuSubtitle}>
                                {isManagement ? 'Gestión de Costaleros' : 'Panel de Costalero'}
                            </Text>
                            {!isManagement && userProfile && (
                                <Text style={styles.userEmail}>{userProfile.email}</Text>
                            )}
                        </View>

                        <ScrollView
                            style={styles.menuItemsContainer}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            showsVerticalScrollIndicator={false}
                        >
                            {isManagement && (
                                <>
                                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('EventForm')}>
                                        <View style={[styles.iconContainer, { backgroundColor: '#EDE7F6' }]}>
                                            <MaterialIcons name="add-circle-outline" size={20} color="#5E35B1" />
                                        </View>
                                        <Text style={styles.menuText}>Nuevo Evento</Text>
                                        <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('CostalerosList')}>
                                        <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                                            <MaterialIcons name="people-outline" size={20} color="#1565C0" />
                                        </View>
                                        <Text style={styles.menuText}>Cuadrilla</Text>
                                        <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('NotificationsList')}>
                                        <View style={[styles.iconContainer, { backgroundColor: '#FFF3E0' }]}>
                                            <MaterialIcons name="notifications-none" size={20} color="#FF9800" />
                                        </View>
                                        <Text style={styles.menuText}>Buzón de Avisos</Text>
                                        {unreadCount > 0 && <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{unreadCount}</Text></View>}
                                        <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Export')}>
                                        <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
                                            <MaterialIcons name="file-download" size={20} color="#2E7D32" />
                                        </View>
                                        <Text style={styles.menuText}>Exportar Datos</Text>
                                        <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('SeasonManagement')}>
                                        <View style={[styles.iconContainer, { backgroundColor: '#FBE9E7' }]}>
                                            <MaterialIcons name="settings-applications" size={20} color="#D84315" />
                                        </View>
                                        <Text style={styles.menuText}>Configurar Temporada</Text>
                                        <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                    </TouchableOpacity>
                                </>
                            )}

                            {!isManagement && (
                                <>
                                    <TouchableOpacity style={styles.menuItem} onPress={() => {
                                        if (userProfile?.costalero_id) {
                                            navigateAndClose('CostaleroHistory', { costaleroId: userProfile.costalero_id });
                                        } else {
                                            Alert.alert("Error", "No tienes un perfil de costalero vinculado.");
                                        }
                                    }}>
                                        <View style={[styles.iconContainer, { backgroundColor: '#E1F5FE' }]}>
                                            <MaterialIcons name="history" size={20} color="#0288D1" />
                                        </View>
                                        <Text style={styles.menuText}>Mi Historial</Text>
                                        <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.menuItem} onPress={() => {
                                        if (userProfile?.costalero_id) {
                                            navigateAndClose('CostaleroForm', {
                                                costaleroId: userProfile.costalero_id,
                                                readOnly: true
                                            });
                                        } else {
                                            Alert.alert("Error", "No tienes un perfil de costalero vinculado.");
                                        }
                                    }}>
                                        <View style={[styles.iconContainer, { backgroundColor: '#F3E5F5' }]}>
                                            <MaterialIcons name="person-outline" size={20} color="#9C27B0" />
                                        </View>
                                        <Text style={styles.menuText}>Mi Perfil</Text>
                                        <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                    </TouchableOpacity>
                                </>
                            )}
                            {/* GESTIÓN SUPER ADMIN */}
                            {userRole === 'superadmin' && (
                                <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('SuperAdmin')}>
                                    <View style={[styles.iconContainer, { backgroundColor: '#FFEBEE' }]}>
                                        <MaterialIcons name="security" size={20} color="#D32F2F" />
                                    </View>
                                    <Text style={styles.menuText}>Panel Super Admin</Text>
                                    <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                                </TouchableOpacity>
                            )}
                        </ScrollView>

                        <View style={styles.seasonSelector}>
                            <View style={styles.seasonHeader}>
                                <View style={[styles.iconContainer, { backgroundColor: '#EDE7F6', width: 32, height: 32 }]}>
                                    <MaterialIcons name="date-range" size={18} color="#5E35B1" />
                                </View>
                                <Text style={styles.seasonLabel}>Temporada:</Text>
                            </View>
                            <View style={styles.pickerWrapper}>
                                <View style={styles.fakePicker}>
                                    <Text style={styles.fakePickerText}>Temporada {selectedYear}</Text>
                                    <MaterialIcons name="arrow-drop-down" size={24} color="#5E35B1" />
                                </View>
                                <Picker
                                    selectedValue={selectedYear}
                                    onValueChange={(itemValue) => changeSelectedYear(itemValue)}
                                    style={styles.hiddenPicker}
                                    dropdownIconColor="transparent"
                                    mode="dialog"
                                >
                                    {availableYears.map(year => (
                                        <Picker.Item key={year} label={`Temporada ${year}`} value={year} />
                                    ))}
                                </Picker>
                            </View>
                        </View>

                        <View style={styles.menuFooter}>
                            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                                <MaterialIcons name="logout" size={20} color="#D32F2F" />
                                <Text style={styles.logoutText}>Cerrar Sesión</Text>
                            </TouchableOpacity>
                            <Text style={styles.versionText}>v2.2.5</Text>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    // Menu Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        flexDirection: 'row'
    },
    menuContainer: {
        width: '88%',
        backgroundColor: 'white',
        paddingVertical: 25,
        paddingHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 16,
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20,
        maxHeight: '100%'
    },
    menuHeader: {
        marginBottom: 16,
        marginTop: 0,
        alignItems: 'center'
    },
    menuTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#424242',
        marginTop: 8,
        letterSpacing: 0.5
    },
    menuSubtitle: {
        fontSize: 12,
        color: '#9E9E9E',
        fontWeight: '700',
        marginTop: 2
    },
    userEmail: {
        fontSize: 12,
        color: '#5E35B1',
        marginTop: 4,
        fontWeight: '600'
    },
    menuItemsContainer: {
        flex: 1
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        marginBottom: 4,
        borderRadius: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    menuText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#424242',
        letterSpacing: 0.3
    },
    menuFooter: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        alignItems: 'center'
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 30,
        marginBottom: 16
    },
    logoutText: {
        color: '#D32F2F',
        fontWeight: '900',
        marginLeft: 8,
        fontSize: 15
    },
    versionText: {
        fontSize: 12,
        color: '#BDBDBD'
    },
    // Season Selector
    seasonSelector: {
        marginTop: "auto",
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        marginBottom: 10
    },
    seasonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10
    },
    seasonLabel: {
        fontSize: 13,
        fontWeight: '900',
        color: '#424242',
        marginLeft: 10,
        letterSpacing: 0.3
    },
    pickerWrapper: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        position: 'relative',
        height: 55,
        justifyContent: 'center',
    },
    fakePicker: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        width: '100%',
    },
    fakePickerText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#212121', // Ahora en negro
    },
    hiddenPicker: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0, // El picker es invisible pero funcional al tocar
        width: '100%',
        height: '100%',
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
    menuBadge: {
        backgroundColor: '#D32F2F',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
        paddingHorizontal: 6
    },
    menuBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    }
});
