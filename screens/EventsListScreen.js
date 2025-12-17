import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';
import { MaterialIcons } from '@expo/vector-icons';

export default function EventsListScreen({ navigation }) {
    const [eventos, setEventos] = useState([]);
    const [filteredEventos, setFilteredEventos] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchEventos = async () => {
        try {
            const { data, error } = await supabase
                .from('eventos')
                .select('*')
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
        }, [])
    );

    useEffect(() => {
        // Filter events based on search query
        const filtered = eventos.filter(e => {
            const nombre = (e.nombre || '').toLowerCase();
            const lugar = (e.lugar || '').toLowerCase();
            const query = searchQuery.toLowerCase();
            return nombre.includes(query) || lugar.includes(query);
        });
        setFilteredEventos(filtered);
    }, [eventos, searchQuery]);

    const renderItem = ({ item }) => {
        // Determine event status based on current time
        const now = new Date();
        const eventDate = new Date(item.fecha);
        const eventEndDate = item.fechaFin ? new Date(item.fechaFin) : null;

        let statusColor = '#FFE5CC'; // Soft orange - Not started (default)

        if (eventEndDate && now > eventEndDate) {
            // Event finished
            statusColor = '#FFD6D6'; // Soft red
        } else if (now >= eventDate && (!eventEndDate || now <= eventEndDate)) {
            // Event in progress
            statusColor = '#D6F5D6'; // Soft green
        }

        return (
            <TouchableOpacity
                style={[styles.item, { backgroundColor: statusColor }]}
                onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
            >
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.nombre}</Text>
                    <Text style={styles.date}>📅 {new Date(item.fecha).toLocaleDateString()}</Text>
                    {item.lugar && <Text style={styles.place}>📍 {item.lugar}</Text>}
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
        });
    }, [navigation]);

    const navigateAndClose = (screen) => {
        setMenuVisible(false);
        navigation.navigate(screen);
    };

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            // App.js handles the state change and redirects to Login
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
                ListEmptyComponent={EmptyComponent}
            />

            {/* Side Menu Modal */}
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
                            <MaterialIcons name="event-note" size={64} color="#5E35B1" />
                            <Text style={styles.menuTitle}>Cuadrilla App</Text>
                            <Text style={styles.menuSubtitle}>Gestión de Costaleros</Text>
                        </View>

                        <View style={styles.menuItemsContainer}>
                            <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('EventForm')}>
                                <View style={[styles.iconContainer, { backgroundColor: '#EDE7F6' }]}>
                                    <MaterialIcons name="add-circle-outline" size={24} color="#5E35B1" />
                                </View>
                                <Text style={styles.menuText}>Nuevo Evento</Text>
                                <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('CostalerosList')}>
                                <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                                    <MaterialIcons name="people-outline" size={24} color="#1565C0" />
                                </View>
                                <Text style={styles.menuText}>Cuadrilla</Text>
                                <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Export')}>
                                <View style={[styles.iconContainer, { backgroundColor: '#E0F2F1' }]}>
                                    <MaterialIcons name="assessment" size={24} color="#00695C" />
                                </View>
                                <Text style={styles.menuText}>Exportar Datos</Text>
                                <MaterialIcons name="chevron-right" size={20} color="#BDBDBD" style={{ marginLeft: 'auto' }} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.menuFooter}>
                            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                                <MaterialIcons name="logout" size={20} color="#D32F2F" />
                                <Text style={styles.logoutText}>Cerrar Sesión</Text>
                            </TouchableOpacity>
                            <Text style={styles.versionText}>v1.3.0</Text>
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
    name: {
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
    // Menu Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        flexDirection: 'row'
    },
    menuContainer: {
        width: '82%',
        backgroundColor: 'white',
        paddingVertical: 40,
        paddingHorizontal: 24,
        shadowColor: "#000",
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 16,
        borderTopRightRadius: 20,
        borderBottomRightRadius: 20
    },
    menuHeader: {
        marginBottom: 40,
        marginTop: 10,
        alignItems: 'center'
    },
    menuTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#424242',
        marginTop: 10,
        letterSpacing: 0.5
    },
    menuSubtitle: {
        fontSize: 14,
        color: '#9E9E9E',
        fontWeight: '500',
        marginTop: 4
    },
    menuItemsContainer: {
        flex: 1
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 16,
        borderRadius: 12,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16
    },
    menuText: {
        fontSize: 17,
        fontWeight: '600',
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
        fontWeight: '700',
        marginLeft: 8,
        fontSize: 15
    },
    versionText: {
        fontSize: 12,
        color: '#BDBDBD'
    }
});
