import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, Modal } from 'react-native';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebaseConfig';

export default function EventsListScreen({ navigation }) {
    const [eventos, setEventos] = useState([]);
    const [filteredEventos, setFilteredEventos] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const q = query(collection(db, "eventos"), orderBy("fecha", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const eventosData = [];
            querySnapshot.forEach((doc) => {
                eventosData.push({ id: doc.id, ...doc.data() });
            });
            setEventos(eventosData);
        });

        return () => unsubscribe();
    }, []);

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

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.item}
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
                    <Text style={{ fontSize: 24, color: '#212121' }}>☰</Text>
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
            await signOut(auth);
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
                            <Text style={styles.menuTitle}>Menú</Text>
                        </View>

                        <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('EventForm')}>
                            <Text style={styles.menuIcon}>➕</Text>
                            <Text style={styles.menuText}>Nuevo Evento</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('CostalerosList')}>
                            <Text style={styles.menuIcon}>👥</Text>
                            <Text style={styles.menuText}>Cuadrilla</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => navigateAndClose('Export')}>
                            <Text style={styles.menuIcon}>📊</Text>
                            <Text style={styles.menuText}>Exportar Datos</Text>
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                            <Text style={styles.menuIcon}>🚪</Text>
                            <Text style={[styles.menuText, { color: '#D32F2F' }]}>Cerrar Sesión</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                            <Text style={styles.menuIcon}>✖️</Text>
                            <Text style={styles.menuText}>Cerrar Menú</Text>
                        </TouchableOpacity>
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
    link: {
        color: '#5E35B1',
        marginTop: 10,
        textDecorationLine: 'underline'
    },
    fabContainer: {
        position: 'absolute',
        right: 20,
        bottom: 20,
    },
    fab: {
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#5E35B1',
        borderRadius: 28,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    fabText: {
        color: 'white',
        fontSize: 28,
        fontWeight: '300'
    },
    // Menu Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        flexDirection: 'row'
    },
    menuContainer: {
        width: '75%',
        backgroundColor: 'white',
        paddingVertical: 40,
        paddingHorizontal: 20,
        shadowColor: "#000",
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 16
    },
    menuHeader: {
        marginBottom: 30,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE'
    },
    menuTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#4A148C',
        letterSpacing: 1
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginBottom: 4
    },
    menuIcon: {
        fontSize: 24,
        marginRight: 20,
        width: 30,
        textAlign: 'center'
    },
    menuText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#424242'
    },
    menuDivider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        marginVertical: 20
    }
});
