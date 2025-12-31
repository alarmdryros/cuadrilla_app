import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../contexts/AuthContext';
import { useSeason } from '../contexts/SeasonContext';
import { useOffline } from '../contexts/OfflineContext';
import { OfflineService } from '../services/OfflineService';
import SideMenu from '../components/SideMenu';

export default function AnnouncementsScreen({ navigation }) {
    const { userRole, userProfile } = useAuth();
    const { selectedYear } = useSeason();
    const { isOffline, isSyncing, queueSize } = useOffline();

    const isManagement = ['admin', 'capataz', 'superadmin'].includes(userRole?.toLowerCase());

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [menuVisible, setMenuVisible] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Form state
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState('info'); // info, urgente, evento
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);

            // 1. Try to load from cache first
            const cached = await OfflineService.getAnnouncements();
            if (cached && cached.length > 0) {
                setAnnouncements(cached);
            }

            // 2. If online, fetch from Supabase
            if (!isOffline) {
                // Fetch announcements
                const { data: annData, error: annError } = await supabase
                    .from('anuncios')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (annError) throw annError;

                // Fetch upcoming events for current season
                const { data: eventData, error: eventError } = await supabase
                    .from('eventos')
                    .select('*')
                    .eq('año', selectedYear)
                    .order('fecha', { ascending: false });

                if (eventError) throw eventError;

                // Format events to look like announcements
                const eventAnnouncements = (eventData || []).map(e => ({
                    id: `event-${e.id}`,
                    eventId: e.id,
                    titulo: e.nombre,
                    mensaje: `📅 ${new Date(e.fecha).toLocaleDateString()} • 🕒 ${new Date(e.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${e.lugar ? `\n📍 ${e.lugar}` : ''}`,
                    tipo: 'evento',
                    created_at: e.fecha, // Sort by event date
                    endDate: e.fechaFin, // Use fechaFin from Supabase
                    isEvent: true
                }));

                const combined = [
                    ...(annData || []),
                    ...eventAnnouncements
                ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

                if (combined) {
                    setAnnouncements(combined);
                    await OfflineService.saveAnnouncements(combined);
                }
            }
        } catch (error) {
            console.error('Error fetching announcements:', error);
            // Don't alert if we have cached data
            if (announcements.length === 0) {
                Alert.alert("Error", "No se pudieron cargar los anuncios.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 30000); // Check every 30 seconds

        return () => clearInterval(timer);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchAnnouncements();
        }, [isOffline])
    );

    const handleCreateOrUpdate = async () => {
        if (!title.trim() || !message.trim()) {
            Alert.alert("Faltan datos", "Por favor, introduce un título y un mensaje.");
            return;
        }

        try {
            setIsSubmitting(true);

            if (editingAnnouncement) {
                // UPDATE logic
                const { error } = await supabase
                    .from('anuncios')
                    .update({
                        titulo: title.trim(),
                        mensaje: message.trim(),
                        tipo: type,
                    })
                    .eq('id', editingAnnouncement.id);

                if (error) throw error;
                Alert.alert("Éxito", "Anuncio actualizado correctamente.");
            } else {
                // CREATE logic
                const newAnnouncement = {
                    titulo: title.trim(),
                    mensaje: message.trim(),
                    tipo: type,
                    emisor_id: userProfile?.id,
                    created_at: new Date().toISOString()
                };

                const { error } = await supabase
                    .from('anuncios')
                    .insert([newAnnouncement]);

                if (error) throw error;
                Alert.alert("Éxito", "Anuncio publicado correctamente.");
            }

            setModalVisible(false);
            resetForm();
            fetchAnnouncements();
        } catch (error) {
            console.error('Error saving announcement:', error);
            Alert.alert("Error", "No se pudo guardar el anuncio.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setMessage('');
        setType('info');
        setEditingAnnouncement(null);
    };

    const openEditModal = (announcement) => {
        setEditingAnnouncement(announcement);
        setTitle(announcement.titulo);
        setMessage(announcement.mensaje);
        setType(announcement.tipo);
        setModalVisible(true);
    };

    const deleteAnnouncement = (id) => {
        if (!isManagement) return;

        Alert.alert(
            "Eliminar Anuncio",
            "¿Estás seguro de que quieres eliminar este anuncio?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('anuncios')
                                .delete()
                                .eq('id', id);

                            if (error) throw error;
                            fetchAnnouncements();
                        } catch (error) {
                            Alert.alert("Error", "No se pudo eliminar el anuncio.");
                        }
                    }
                }
            ]
        );
    };

    const renderAnnouncement = ({ item }) => {
        const date = new Date(item.created_at);
        const formattedDate = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const formattedTime = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const getTypeStyles = (type) => {
            switch (type) {
                case 'urgente': return { color: '#D32F2F', icon: 'report-problem' };
                case 'evento': return { color: '#1976D2', icon: 'event' };
                default: return { color: '#4527A0', icon: 'info' };
            }
        };

        let cardBackgroundColor = 'white';
        let statusBadgeColor = 'transparent';
        let statusBadgeText = '';

        if (item.isEvent) {
            const now = currentTime;
            const eventDate = new Date(item.created_at); // Event start
            const eventEndDate = item.endDate ? new Date(item.endDate) : null;

            if (eventEndDate && now > eventEndDate) {
                cardBackgroundColor = '#FFD6D6'; // Finalizado
                statusBadgeText = 'FINALIZADO';
            } else if (now >= eventDate && (!eventEndDate || now <= eventEndDate)) {
                cardBackgroundColor = '#D6F5D6'; // En curso
                statusBadgeText = 'EN CURSO';
            } else {
                cardBackgroundColor = '#FFE5CC'; // Pendiente
                statusBadgeText = 'PRÓXIMO EVENTO';
            }
        }

        const { color, icon } = getTypeStyles(item.tipo);

        const handlePress = () => {
            if (item.isEvent && item.eventId) {
                navigation.navigate('EventDetail', { eventId: item.eventId });
            }
        };

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: cardBackgroundColor }]}
                onPress={handlePress}
                activeOpacity={item.isEvent ? 0.7 : 1}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: item.isEvent ? 'rgba(255,255,255,0.5)' : color + '20' }]}>
                        <MaterialIcons name={icon} size={20} color={item.isEvent ? '#212121' : color} />
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.typeText, { color: item.isEvent ? '#212121' : color }]}>
                            {item.isEvent ? statusBadgeText : item.tipo.toUpperCase()}
                        </Text>
                        <Text style={styles.dateText}>{formattedDate} - {formattedTime}</Text>
                    </View>
                    {!item.isEvent && isManagement && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionButton}>
                                <MaterialIcons name="edit" size={18} color="#5E35B1" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteAnnouncement(item.id)} style={styles.actionButton}>
                                <MaterialIcons name="delete-outline" size={20} color="#D32F2F" />
                            </TouchableOpacity>
                        </View>
                    )}
                    {item.isEvent && (
                        <MaterialIcons name="chevron-right" size={24} color="#757575" />
                    )}
                </View>
                <Text style={styles.cardTitle}>{item.titulo}</Text>
                <Text style={styles.cardMessage}>{item.mensaje}</Text>
                {item.isEvent && (
                    <View style={[styles.eventHint, { borderTopColor: 'rgba(0,0,0,0.05)' }]}>
                        <Text style={[styles.eventHintText, { color: '#424242' }]}>Toca para ver detalles y pasar lista</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header / Top bar with navigation to Events */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => setMenuVisible(true)}
                >
                    <MaterialIcons name="menu" size={28} color="white" />
                </TouchableOpacity>
                <Text style={styles.topBarTitle}>Anuncios</Text>
                <TouchableOpacity
                    style={styles.eventsButton}
                    onPress={() => navigation.navigate('EventsList')}
                >
                    <MaterialIcons name="calendar-today" size={20} color="white" />
                    <Text style={styles.eventsButtonText}>Eventos</Text>
                </TouchableOpacity>
            </View>

            <SideMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                navigation={navigation}
            />

            {isOffline && (
                <View style={styles.offlineBanner}>
                    <MaterialIcons name="cloud-off" size={16} color="#B91C1C" />
                    <Text style={styles.offlineText}>Modo Offline - Viendo datos en caché</Text>
                </View>
            )}

            {loading && announcements.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#4527A0" />
                </View>
            ) : (
                <FlatList
                    data={announcements}
                    renderItem={renderAnnouncement}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialIcons name="announcement" size={60} color="#E0E0E0" />
                            <Text style={styles.emptyText}>No hay anuncios publicados</Text>
                        </View>
                    }
                />
            )}

            {isManagement && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => {
                        resetForm();
                        setModalVisible(true);
                    }}
                >
                    <MaterialIcons name="add" size={30} color="white" />
                </TouchableOpacity>
            )}

            {/* Modal for creating/editing announcement */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => {
                    setModalVisible(false);
                    resetForm();
                }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingAnnouncement ? 'Editar Anuncio' : 'Nuevo Anuncio'}
                            </Text>
                            <TouchableOpacity onPress={() => {
                                setModalVisible(false);
                                resetForm();
                            }}>
                                <MaterialIcons name="close" size={24} color="#757575" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.form}>
                            <Text style={styles.label}>Título</Text>
                            <TextInput
                                style={styles.input}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Título del aviso"
                            />

                            <Text style={styles.label}>Mensaje</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={message}
                                onChangeText={setMessage}
                                placeholder="Escribe aquí el contenido..."
                                multiline
                                numberOfLines={4}
                            />

                            <Text style={styles.label}>Importancia</Text>
                            <View style={styles.typeSelector}>
                                {['info', 'urgente', 'evento'].map((t) => (
                                    <TouchableOpacity
                                        key={t}
                                        style={[
                                            styles.typeOption,
                                            type === t && styles.activeTypeOption,
                                            type === t && { backgroundColor: t === 'urgente' ? '#FEE2E2' : t === 'evento' ? '#DBEAFE' : '#EDE7F6' }
                                        ]}
                                        onPress={() => setType(t)}
                                    >
                                        <Text style={[
                                            styles.typeOptionText,
                                            type === t && { color: t === 'urgente' ? '#D32F2F' : t === 'evento' ? '#1976D2' : '#4527A0' }
                                        ]}>
                                            {t.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[styles.submitButton, isSubmitting && styles.disabledButton]}
                                onPress={handleCreateOrUpdate}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={styles.submitButtonText}>
                                        {editingAnnouncement ? 'Guardar Cambios' : 'Publicar Anuncio'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA'
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50, // For notch
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: '#4527A0',
        elevation: 4
    },
    topBarTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: 'white',
        flex: 1,
        textAlign: 'center'
    },
    menuButton: {
        padding: 5,
        marginRight: 10
    },
    eventsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20
    },
    eventsButtonText: {
        color: 'white',
        fontWeight: '600',
        marginLeft: 6,
        fontSize: 14
    },
    offlineBanner: {
        backgroundColor: '#FEE2E2',
        paddingVertical: 6,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    offlineText: {
        color: '#B91C1C',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 8
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    list: {
        padding: 15,
        paddingBottom: 100
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    headerTextContainer: {
        flex: 1
    },
    typeText: {
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1
    },
    dateText: {
        fontSize: 12,
        color: '#9E9E9E'
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 8
    },
    cardMessage: {
        fontSize: 15,
        color: '#424242',
        lineHeight: 22
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        marginLeft: 15,
        padding: 4,
    },
    eventHint: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        flexDirection: 'row',
        alignItems: 'center'
    },
    eventHintText: {
        fontSize: 12,
        color: '#1976D2',
        fontWeight: '600',
        fontStyle: 'italic'
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 100
    },
    emptyText: {
        marginTop: 15,
        fontSize: 16,
        color: '#BDBDBD',
        fontWeight: '600'
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 80,
        backgroundColor: '#4527A0',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 20,
        maxHeight: '90%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#212121'
    },
    form: {
        marginBottom: 20
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#616161',
        marginBottom: 8,
        marginTop: 10
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        color: '#212121'
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top'
    },
    typeSelector: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 20
    },
    typeOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: '#F5F5F5',
        marginHorizontal: 4
    },
    activeTypeOption: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)'
    },
    typeOptionText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#757575'
    },
    submitButton: {
        backgroundColor: '#4527A0',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10
    },
    disabledButton: {
        backgroundColor: '#BDBDBD'
    },
    submitButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700'
    }
});
