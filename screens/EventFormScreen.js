import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function EventFormScreen({ navigation, route }) {
    const { eventData } = route.params || {};

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
        if (eventData) {
            navigation.setOptions({ title: 'Editar Evento' });
        }
    }, [navigation, eventData]);

    const onDateChange = (event, selectedDate, setter, currentVal) => {
        if (event.type === 'dismissed') {
            return;
        }
        const currentDate = selectedDate || currentVal;
        setter(currentDate);
        if (Platform.OS === 'android') {
            setShowInicioDate(false); setShowInicioTime(false);
            setShowFinDate(false); setShowFinTime(false);
        }
    };

    const handleSave = async () => {
        if (!nombre || !lugar) {
            Alert.alert("Error", "Nombre y Lugar son obligatorios");
            return;
        }
        if (fechaFin <= fechaInicio) {
            Alert.alert("Error", "La fecha de fin debe ser posterior al inicio");
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
                updatedAt: new Date() // Track updates
            };

            if (eventData?.id) {
                // Update existing
                await setDoc(doc(db, "eventos", eventData.id), dataToSave, { merge: true });
                Alert.alert("Éxito", "Evento actualizado correctamente");
            } else {
                // Create new
                dataToSave.createdAt = new Date();
                await addDoc(collection(db, "eventos"), dataToSave);
                Alert.alert("Éxito", "Evento creado correctamente");
            }
            navigation.goBack();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "No se pudo guardar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date) => date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.label}>Nombre del Evento</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Ensayo General, Salida Procesional" />

            <Text style={styles.label}>Lugar</Text>
            <TextInput style={styles.input} value={lugar} onChangeText={setLugar} placeholder="Ej: Casa Hermandad" />

            {/* FECHA INICIO */}
            <Text style={styles.label}>Inicio del Evento</Text>
            <View style={styles.row}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowInicioDate(true)}>
                    <Text>{fechaInicio.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowInicioTime(true)}>
                    <Text>{fechaInicio.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
            </View>

            {(showInicioDate || showInicioTime) && (
                <DateTimePicker
                    value={fechaInicio}
                    mode={showInicioDate ? 'date' : 'time'}
                    display="default"
                    onChange={(e, d) => {
                        onDateChange(e, d, setFechaInicio, fechaInicio);
                        if (Platform.OS === 'android') { setShowInicioDate(false); setShowInicioTime(false); }
                        else {
                            // iOS logic if needed embedded
                            if (showInicioDate) setShowInicioDate(false);
                            if (showInicioTime) setShowInicioTime(false);
                        }
                    }}
                />
            )}


            {/* FECHA FIN */}
            <Text style={styles.label}>Fin del Evento (Cierre automático)</Text>
            <View style={styles.row}>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFinDate(true)}>
                    <Text>{fechaFin.toLocaleDateString()}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowFinTime(true)}>
                    <Text>{fechaFin.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </TouchableOpacity>
            </View>

            {(showFinDate || showFinTime) && (
                <DateTimePicker
                    value={fechaFin}
                    mode={showFinDate ? 'date' : 'time'}
                    display="default"
                    onChange={(e, d) => {
                        onDateChange(e, d, setFechaFin, fechaFin);
                        if (Platform.OS === 'android') { setShowFinDate(false); setShowFinTime(false); }
                        else {
                            if (showFinDate) setShowFinDate(false);
                            if (showFinTime) setShowFinTime(false);
                        }
                    }}
                />
            )}

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                <Text style={styles.saveButtonText}>{loading ? "Guardando..." : (eventData ? "Guardar Cambios" : "Crear Evento")}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA'
    },
    scrollContent: {
        padding: 20
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        color: '#424242',
        letterSpacing: 0.3
    },
    input: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        padding: 14,
        marginBottom: 18,
        backgroundColor: 'white',
        fontSize: 16,
        color: '#212121',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    dateButton: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 10,
        padding: 14,
        width: '48%',
        alignItems: 'center',
        backgroundColor: 'white',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    dateText: {
        fontSize: 16,
        color: '#212121'
    },
    saveButton: {
        backgroundColor: '#5E35B1',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: "#5E35B1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    saveButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5
    }
});
