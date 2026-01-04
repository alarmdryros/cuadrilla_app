import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../supabaseConfig';
import { MaterialIcons } from '../components/Icon';
import { useSeason } from '../contexts/SeasonContext';

export default function EventFormScreen({ navigation, route }) {
    const { eventData } = route.params || {};
    const { selectedYear } = useSeason();
    const [nombre, setNombre] = useState(eventData?.nombre || '');
    const [lugar, setLugar] = useState(eventData?.lugar || '');
    const [fechaInicio, setFechaInicio] = useState(eventData?.fechaInicio ? new Date(eventData.fechaInicio) : new Date());
    const [fechaFin, setFechaFin] = useState(eventData?.fechaFin ? new Date(eventData.fechaFin) : new Date(new Date().getTime() + 2 * 60 * 60 * 1000));
    const [loading, setLoading] = useState(false);

    // Helpers para pickers
    const [showInicioDate, setShowInicioDate] = useState(false);
    const [showInicioTime, setShowInicioTime] = useState(false);
    const [showFinDate, setShowFinDate] = useState(false);
    const [showFinTime, setShowFinTime] = useState(false);

    // Update title if editing
    React.useLayoutEffect(() => {
        navigation.setOptions({
            title: eventData ? 'Editar Evento' : 'Nuevo Evento',
            headerStyle: { backgroundColor: '#F8F9FA' },
            headerShadowVisible: false,
        });
    }, [navigation, eventData]);


    const onDateChange = (event, selectedDate, setter, currentVal) => {
        if (event.type === 'dismissed') return;
        const currentDate = selectedDate || currentVal;
        setter(currentDate);
        if (Platform.OS === 'android') {
            setShowInicioDate(false); setShowInicioTime(false);
            setShowFinDate(false); setShowFinTime(false);
        }
    };

    const handleSave = async () => {
        if (!nombre || !lugar) {
            Alert.alert("⚠️ Faltan datos", "Por favor, indica un Nombre y un Lugar para el evento.");
            return;
        }
        if (fechaFin <= fechaInicio) {
            Alert.alert("⚠️ Fechas inválidas", "La fecha de fin debe ser posterior al inicio.");
            return;
        }

        setLoading(true);
        try {
            const dataToSave = {
                nombre,
                lugar,
                fechaInicio: fechaInicio.toISOString(),
                fechaFin: fechaFin.toISOString(),
                fecha: fechaInicio.toISOString(), // Legacy support
                año: selectedYear,
                updatedAt: new Date().toISOString()
            };

            if (eventData?.id) {
                const { error } = await supabase
                    .from('eventos')
                    .update(dataToSave)
                    .eq('id', eventData.id);

                if (error) throw error;
                Alert.alert("✅ Actualizado", "Evento modificado correctamente");
            } else {
                dataToSave.createdAt = new Date().toISOString();
                const { error } = await supabase
                    .from('eventos')
                    .insert([dataToSave]);

                if (error) throw error;
                Alert.alert("✅ Creado", "Evento creado correctamente");
            }
            navigation.goBack();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "No se pudo guardar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.mainContainer}>
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

                {/* SECCIÓN 1: DATOS BÁSICOS */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialIcons name="info-outline" size={24} color="#5E35B1" />
                        <Text style={styles.sectionTitle}>Información del Evento</Text>
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.label}>Nombre del Evento</Text>
                        <TextInput
                            style={styles.input}
                            value={nombre}
                            onChangeText={setNombre}
                            placeholder="Ej: Ensayo General"
                            placeholderTextColor="#BDBDBD"
                        />

                        <Text style={styles.label}>Lugar</Text>
                        <TextInput
                            style={styles.input}
                            value={lugar}
                            onChangeText={setLugar}
                            placeholder="Ej: Casa Hermandad"
                            placeholderTextColor="#BDBDBD"
                        />
                    </View>
                </View>

                {/* SECCIÓN 2: HORARIOS */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <MaterialIcons name="access-time" size={24} color="#5E35B1" />
                        <Text style={styles.sectionTitle}>Planificación Temporal</Text>
                    </View>

                    <View style={styles.card}>
                        {/* INICIO */}
                        <Text style={styles.subHeader}>📅  Inicio</Text>
                        <View style={styles.row}>
                            <TouchableOpacity style={styles.datePickerCard} onPress={() => setShowInicioDate(true)}>
                                <MaterialIcons name="calendar-today" size={20} color="#5E35B1" />
                                <Text style={styles.dateText}>{fechaInicio.toLocaleDateString()}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.datePickerCard} onPress={() => setShowInicioTime(true)}>
                                <MaterialIcons name="schedule" size={20} color="#5E35B1" />
                                <Text style={styles.dateText}>
                                    {fechaInicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        {/* FIN */}
                        <Text style={styles.subHeader}>🏁  Fin (Cierre automático)</Text>
                        <View style={styles.row}>
                            <TouchableOpacity style={styles.datePickerCard} onPress={() => setShowFinDate(true)}>
                                <MaterialIcons name="calendar-today" size={20} color="#616161" />
                                <Text style={styles.dateText}>{fechaFin.toLocaleDateString()}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.datePickerCard} onPress={() => setShowFinTime(true)}>
                                <MaterialIcons name="schedule" size={20} color="#616161" />
                                <Text style={styles.dateText}>
                                    {fechaFin.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* ESPACIO EXTRA AL FINAL PARA EL BOTÓN FLOTANTE */}
                <View style={{ height: 100 }} />

                {/* PICKERS OCULTOS (MODALES) */}
                {(showInicioDate || showInicioTime) && (
                    <DateTimePicker
                        value={fechaInicio}
                        mode={showInicioDate ? 'date' : 'time'}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(e, d) => {
                            onDateChange(e, d, setFechaInicio, fechaInicio);
                            if (Platform.OS === 'ios') {
                                if (showInicioDate) setShowInicioDate(false);
                                if (showInicioTime) setShowInicioTime(false);
                            }
                        }}
                    />
                )}
                {(showFinDate || showFinTime) && (
                    <DateTimePicker
                        value={fechaFin}
                        mode={showFinDate ? 'date' : 'time'}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(e, d) => {
                            onDateChange(e, d, setFechaFin, fechaFin);
                            if (Platform.OS === 'ios') {
                                if (showFinDate) setShowFinDate(false);
                                if (showFinTime) setShowFinTime(false);
                            }
                        }}
                    />
                )}

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                    <Text style={styles.saveButtonText}>
                        {loading ? "Guardando..." : (eventData ? "Guardar Cambios" : "Crear Evento")}
                    </Text>
                    <MaterialIcons name="check" size={24} color="white" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    section: {
        marginBottom: 25,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingLeft: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4527A0',
        marginLeft: 10,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#616161',
        marginBottom: 8,
        marginTop: 4,
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#212121',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    subHeader: {
        fontSize: 14,
        fontWeight: '700',
        color: '#424242',
        marginBottom: 12,
        marginTop: 4,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    datePickerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        width: '48%',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    dateText: {
        marginLeft: 8,
        fontSize: 15,
        fontWeight: '600',
        color: '#424242',
    },
    divider: {
        height: 1,
        backgroundColor: '#EEEEEE',
        marginVertical: 20,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#EEEEEE',
        paddingBottom: Platform.OS === 'ios' ? 30 : 50,
    },
    saveButton: {
        backgroundColor: '#5E35B1',
        borderRadius: 14,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#5E35B1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    }
});
