import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking, TouchableOpacity } from 'react-native';
import { doc, setDoc, getDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';
import QRCode from 'react-native-qrcode-svg';
import { db } from '../firebaseConfig';

export default function CostaleroFormScreen({ navigation, route }) {
    const { costaleroId } = route.params || {};
    const [loading, setLoading] = useState(false);

    // Form state
    const [nombre, setNombre] = useState('');
    const [apellidos, setApellidos] = useState('');
    const [puesto, setPuesto] = useState('');
    const [altura, setAltura] = useState('');
    const [fechaNacimiento, setFechaNacimiento] = useState('');
    const [trabajadera, setTrabajadera] = useState('1');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');

    useEffect(() => {
        if (costaleroId) {
            loadCostalero(costaleroId);
        }
    }, [costaleroId]);

    const loadCostalero = async (id) => {
        setLoading(true);
        const docRef = doc(db, "costaleros", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setNombre(data.nombre);
            setApellidos(data.apellidos);
            setPuesto(data.puesto);
            setAltura(data.altura);
            setFechaNacimiento(data.fechaNacimiento);
            setTrabajadera(data.trabajadera || '1');
            setTelefono(data.telefono || '');
            setEmail(data.email || '');
        }
        setLoading(false);
    };

    const handleDelete = async () => {
        Alert.alert(
            "Eliminar Costalero",
            "¿Estás seguro? Esta acción borrará la ficha definitivamente, aunque el historial de asistencia se mantendrá.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await deleteDoc(doc(db, "costaleros", costaleroId));
                            Alert.alert("Eliminado", "Costalero eliminado correctamente.");
                            navigation.goBack();
                        } catch (e) {
                            Alert.alert("Error", e.message);
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleSave = async () => {
        if (!nombre || !apellidos) {
            Alert.alert("Error", "Nombre y Apellidos son obligatorios");
            return;
        }

        setLoading(true);
        try {
            const costaleroData = {
                nombre,
                apellidos,
                puesto,
                altura,
                fechaNacimiento,
                trabajadera,
                telefono,
                email,
                updatedAt: new Date()
            };

            if (costaleroId) {
                // Update
                await setDoc(doc(db, "costaleros", costaleroId), costaleroData, { merge: true });
                Alert.alert("Éxito", "Costalero actualizado");
            } else {
                // Create
                // We generate a QR ID automatically if not present. For now, Firestore ID serves as QR ID.
                costaleroData.createdAt = new Date();
                const newDoc = await addDoc(collection(db, "costaleros"), costaleroData);
                // Optionally update with its own ID if needed explicitly in field, but ID is in metadata
                Alert.alert("Éxito", "Costalero creado correctamente");
            }
            navigation.goBack();
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "No se pudo guardar: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && costaleroId && !nombre) {
        return <ActivityIndicator size="large" style={styles.loading} />;
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />

            <Text style={styles.label}>Apellidos</Text>
            <TextInput style={styles.input} value={apellidos} onChangeText={setApellidos} />

            <Text style={styles.label}>Puesto</Text>
            <View style={styles.input}>
                <Picker
                    selectedValue={puesto}
                    onValueChange={(itemValue, itemIndex) => setPuesto(itemValue)}>
                    <Picker.Item label="Seleccionar Puesto" value="" />
                    <Picker.Item label="Patero Izquierdo" value="Patero Izquierdo" />
                    <Picker.Item label="Patero Derecho" value="Patero Derecho" />
                    <Picker.Item label="Fijador Izquierdo" value="Fijador Izquierdo" />
                    <Picker.Item label="Fijador Derecho" value="Fijador Derecho" />
                    <Picker.Item label="Costero Izquierdo" value="Costero Izquierdo" />
                    <Picker.Item label="Costero Derecho" value="Costero Derecho" />
                    <Picker.Item label="Corriente" value="Corriente" />
                </Picker>
            </View>

            <Text style={styles.label}>Trabajadera</Text>
            <View style={styles.input}>
                <Picker
                    selectedValue={trabajadera}
                    onValueChange={(itemValue, itemIndex) => setTrabajadera(itemValue)}>
                    <Picker.Item label="Trabajadera 1" value="1" />
                    <Picker.Item label="Trabajadera 2" value="2" />
                    <Picker.Item label="Trabajadera 3" value="3" />
                    <Picker.Item label="Trabajadera 4" value="4" />
                    <Picker.Item label="Trabajadera 5" value="5" />
                    <Picker.Item label="Trabajadera 6" value="6" />
                    <Picker.Item label="Trabajadera 7" value="7" />
                    <Picker.Item label="Sin Asignar" value="0" />
                </Picker>
            </View>

            <Text style={styles.label}>Altura (m)</Text>
            <TextInput style={styles.input} value={altura} onChangeText={setAltura} keyboardType="numeric" />

            <Text style={styles.label}>Fecha Nacimiento (DD/MM/AAAA)</Text>
            <TextInput style={styles.input} value={fechaNacimiento} onChangeText={setFechaNacimiento} />

            <Text style={styles.label}>Teléfono</Text>
            <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />

            {costaleroId && telefono ? (
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#25D366' }]} onPress={() => Linking.openURL(`whatsapp://send?phone=${telefono}`)}>
                        <Text style={styles.btnText}>WhatsApp</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#34b7f1' }]} onPress={() => Linking.openURL(`tel:${telefono}`)}>
                        <Text style={styles.btnText}>Llamar</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            {costaleroId && (
                <View style={{ marginBottom: 20 }}>
                    <Button
                        title="📜 Ver Historial de Asistencia"
                        onPress={() => navigation.navigate('CostaleroHistory', { costaleroId: costaleroId, costaleroName: `${nombre} ${apellidos}` })}
                    />
                </View>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

            {loading ? (
                <ActivityIndicator color="blue" />
            ) : (
                <Button title={costaleroId ? "Actualizar" : "Guardar Costalero"} onPress={handleSave} />
            )}

            {costaleroId && (
                <View style={{ marginTop: 20, marginBottom: 50 }}>
                    <Button title="🗑️ Eliminar Costalero" onPress={handleDelete} color="red" />
                </View>
            )}

            {costaleroId && (
                <View style={styles.qrInfo}>
                    <Text style={styles.qrLabel}>{nombre} {apellidos}</Text>
                    <View style={styles.qrContainer}>
                        <QRCode
                            value={costaleroId}
                            size={200}
                        />
                    </View>
                    <Text style={styles.qrCode}>{costaleroId}</Text>
                    <Text style={styles.hint}>Haz una captura o comparte este código con el costalero.</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA'
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100 // Asegura espacio para el teclado y botones inferiores
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
    loading: {
        marginTop: 50
    },
    qrInfo: {
        marginTop: 30,
        padding: 24,
        backgroundColor: 'white',
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: "#5E35B1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#E8E0F5'
    },
    qrLabel: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
        color: '#5E35B1',
        letterSpacing: 0.5
    },
    qrContainer: {
        padding: 16,
        backgroundColor: 'white',
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    qrCode: {
        fontSize: 13,
        fontFamily: 'monospace',
        marginVertical: 12,
        letterSpacing: 1,
        color: '#757575',
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6
    },
    hint: {
        fontSize: 13,
        color: '#9E9E9E',
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic'
    },
    actionButtons: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
        marginTop: 10
    },
    actionBtn: {
        flex: 1,
        marginHorizontal: 6,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    btnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
        letterSpacing: 0.5
    },
    deleteButton: {
        backgroundColor: '#FFEBEE',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 30,
        borderWidth: 2,
        borderColor: '#F44336'
    },
    deleteButtonText: {
        color: '#F44336',
        fontWeight: '700',
        fontSize: 16,
        letterSpacing: 0.5
    }
});
