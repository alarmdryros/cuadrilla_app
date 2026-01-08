import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import QRCode from 'react-native-qrcode-svg';
import { MaterialIcons } from '../components/Icon';
import { supabase } from '../supabaseConfig';
import { useSeason } from '../contexts/SeasonContext';
import { useAuth } from '../contexts/AuthContext';

export default function CostaleroFormScreen({ navigation, route }) {
    const { costaleroId: paramId, readOnly, isNew } = route.params || {};
    const { userProfile } = useAuth();
    const { currentYear } = useSeason();
    const [loading, setLoading] = useState(false);

    // Si es nuevo, NO usamos el ID del usuario actual (que sería el admin)
    const costaleroId = isNew ? null : (paramId || userProfile?.costalero_id);

    // Form state
    const [nombre, setNombre] = useState('');
    const [apellidos, setApellidos] = useState('');
    const [puesto, setPuesto] = useState('');
    const [altura, setAltura] = useState('');
    const [fechaIngreso, setFechaIngreso] = useState('');
    const [suplemento, setSuplemento] = useState('');
    const [trabajadera, setTrabajadera] = useState('1');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: readOnly ? "Perfil de Costalero" : (costaleroId ? "Editar Costalero" : "Nuevo Costalero"),
            headerLeft: () => (
                <TouchableOpacity
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            // Navegar al Dashboard de forma segura (dentro de MainTabs)
                            navigation.navigate('MainTabs', { screen: 'Dashboard' });
                        }
                    }}
                    style={{ marginLeft: 8, padding: 8 }}
                >
                    <MaterialIcons name="arrow-back" size={26} color="#212121" />
                </TouchableOpacity>
            ),
        });
    }, [navigation, readOnly, costaleroId, route.params]);

    useEffect(() => {
        if (costaleroId) {
            loadCostalero(costaleroId);
        } else if (userProfile?.email) {
            loadCostalero(null, userProfile.email);
        }
    }, [costaleroId, userProfile?.email]);

    const loadCostalero = async (id, fallbackEmail = null) => {
        setLoading(true);
        try {
            let query = supabase.from('costaleros').select('*');

            if (id) {
                query = query.eq('id', id);
            } else if (fallbackEmail) {
                query = query.eq('email', fallbackEmail.toLowerCase().trim()).order('año', { ascending: false }).limit(1);
            } else {
                setLoading(false);
                return;
            }

            const { data, error } = await query.maybeSingle();

            if (error) throw error;

            if (data) {
                setNombre(data.nombre);
                setApellidos(data.apellidos);
                setPuesto(data.puesto);
                setAltura(data.altura ? String(data.altura) : '');
                setFechaIngreso(data.fechaIngreso || '');
                setSuplemento(data.suplemento || '');
                setTrabajadera(data.trabajadera ? String(data.trabajadera) : '1');
                setTelefono(data.telefono || '');
                setEmail(data.email || '');
            }
        } catch (error) {
            console.error(error);
            if (id || fallbackEmail) {
                Alert.alert("Error", "No se pudo cargar el perfil del costalero");
            }
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
                            if (email) {
                                await supabase
                                    .from('user_profiles')
                                    .delete()
                                    .eq('email', email.toLowerCase().trim());
                            }

                            const { error } = await supabase
                                .from('costaleros')
                                .delete()
                                .eq('id', costaleroId);

                            if (error) throw error;

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

        if (email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                Alert.alert("Error", "Por favor introduce un email válido");
                return;
            }
        }

        setLoading(true);
        try {
            let formattedPhone = telefono.trim();
            if (formattedPhone && !formattedPhone.startsWith('+')) {
                formattedPhone = formattedPhone.replace(/^0+/, '');
                formattedPhone = '+34' + formattedPhone;
            }

            const costaleroData = {
                nombre,
                apellidos,
                puesto,
                altura: altura ? parseFloat(String(altura).replace(/,/g, '.')) : null,
                fechaIngreso,
                suplemento: suplemento ? parseFloat(String(suplemento).replace(/,/g, '.')) : null,
                trabajadera: parseInt(trabajadera, 10),
                telefono: formattedPhone,
                email: email.trim() ? email.toLowerCase().trim() : null,
                año: currentYear,
                updatedAt: new Date().toISOString()
            };

            if (costaleroId) {
                const { error } = await supabase
                    .from('costaleros')
                    .update(costaleroData)
                    .eq('id', costaleroId);

                if (error) throw error;
                Alert.alert("Éxito", "Costalero actualizado");
            } else {
                costaleroData.createdAt = new Date().toISOString();
                const { error } = await supabase
                    .from('costaleros')
                    .insert([costaleroData]);

                if (error) throw error;
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

    const InfoRow = ({ icon, label, value, color = '#5E35B1', onValuePress = null }) => (
        <View style={styles.infoRow}>
            <View style={[styles.infoIconContainer, { backgroundColor: color + '15' }]}>
                <MaterialIcons name={icon} size={22} color={color} />
            </View>
            <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>{label}</Text>
                <TouchableOpacity onPress={onValuePress} disabled={!onValuePress}>
                    <Text style={[styles.infoValue, onValuePress && { color: '#1565C0' }]}>{value || 'No registrado'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const SectionHeader = ({ title }) => (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLine} />
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionHeaderLine} />
        </View>
    );

    if (loading && costaleroId && !nombre) {
        return <ActivityIndicator size="large" style={styles.loading} />;
    }

    if (readOnly) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
                <View style={styles.profileHeader}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{nombre?.[0]}{apellidos?.[0]}</Text>
                    </View>
                    <Text style={styles.profileName}>{nombre} {apellidos}</Text>
                    {puesto ? (
                        <View style={styles.puestoBadge}>
                            <Text style={styles.puestoBadgeText}>{puesto.toUpperCase()}</Text>
                        </View>
                    ) : null}
                </View>

                <SectionHeader title="Datos Técnicos" />
                <View style={styles.cardContainer}>
                    <InfoRow icon="grid-view" label="Trabajadera" value={trabajadera === '0' ? 'Sin Asignar' : `Trabajadera ${trabajadera}`} />
                    <InfoRow icon="straighten" label="Altura" value={altura ? `${altura} m` : 'No registrada'} color="#1976D2" />
                    <InfoRow icon="vertical-align-top" label="Suplemento" value={suplemento ? `${suplemento} cm` : 'Sin suplemento'} color="#388E3C" />
                    <InfoRow icon="event" label="Fecha de Ingreso" value={fechaIngreso} color="#F57C00" />
                </View>

                <SectionHeader title="Contacto" />
                <View style={styles.cardContainer}>
                    <InfoRow
                        icon="phone"
                        label="Teléfono"
                        value={telefono}
                        color="#2E7D32"
                        onValuePress={() => telefono && Linking.openURL(`tel:${telefono}`)}
                    />
                    <InfoRow
                        icon="email"
                        label="Correo Electrónico"
                        value={email}
                        color="#D32F2F"
                        onValuePress={() => email && Linking.openURL(`mailto:${email}`)}
                    />
                </View>

                {costaleroId ? (
                    <View style={styles.qrCard}>
                        <SectionHeader title="Código QR de Asistencia" />
                        <Text style={styles.qrNameText}>{nombre} {apellidos}</Text>
                        <QRCode value={String(costaleroId)} size={200} />
                        <Text style={styles.qrHint}>Muestra este código para que el capataz registre tu asistencia.</Text>
                    </View>
                ) : null}

                {costaleroId && (
                    <View style={styles.profileActions}>
                        <TouchableOpacity
                            style={styles.historyBtn}
                            onPress={() => navigation.navigate('CostaleroHistory', { costaleroId, costaleroName: `${nombre} ${apellidos}` })}
                        >
                            <MaterialIcons name="assessment" size={24} color="white" />
                            <Text style={styles.historyBtnText}>HISTORIAL COMPLETO</Text>
                        </TouchableOpacity>

                        {telefono && (
                            <View style={styles.contactActions}>
                                <TouchableOpacity
                                    style={[styles.smallActionBtn, { backgroundColor: '#25D366' }]}
                                    onPress={() => Linking.openURL(`whatsapp://send?phone=${telefono}`)}
                                >
                                    <MaterialIcons name="chat" size={20} color="white" />
                                    <Text style={styles.smallActionText}>WhatsApp</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.smallActionBtn, { backgroundColor: '#34b7f1' }]}
                                    onPress={() => Linking.openURL(`tel:${telefono}`)}
                                >
                                    <MaterialIcons name="call" size={20} color="white" />
                                    <Text style={styles.smallActionText}>Llamar</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={nombre} onChangeText={setNombre} />

            <Text style={styles.label}>Apellidos</Text>
            <TextInput style={styles.input} value={apellidos} onChangeText={setApellidos} />

            <Text style={styles.label}>Trabajadera</Text>
            <View style={styles.input}>
                <Picker
                    selectedValue={trabajadera}
                    style={{ color: '#212121' }}
                    onValueChange={(itemValue) => setTrabajadera(itemValue)}>
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

            <Text style={styles.label}>Puesto</Text>
            <View style={styles.input}>
                <Picker
                    selectedValue={puesto}
                    style={{ color: '#212121' }}
                    onValueChange={(itemValue) => setPuesto(itemValue)}>
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

            <Text style={styles.label}>Suplemento</Text>
            <View style={styles.input}>
                <Picker
                    selectedValue={suplemento}
                    style={{ color: '#212121' }}
                    onValueChange={(itemValue) => setSuplemento(itemValue)}>
                    <Picker.Item label="Nada" value="" />
                    <Picker.Item label="0.5 cm" value="0.5" />
                    <Picker.Item label="1.0 cm" value="1.0" />
                    <Picker.Item label="1.5 cm" value="1.5" />
                    <Picker.Item label="2.0 cm" value="2.0" />
                    <Picker.Item label="2.5 cm" value="2.5" />
                    <Picker.Item label="3.0 cm" value="3.0" />
                    <Picker.Item label="3.5 cm" value="3.5" />
                    <Picker.Item label="4.0 cm" value="4.0" />
                    <Picker.Item label="4.5 cm" value="4.5" />
                    <Picker.Item label="5.0 cm" value="5.0" />
                    <Picker.Item label="5.5 cm" value="5.5" />
                    <Picker.Item label="6.0 cm" value="6.0" />
                </Picker>
            </View>

            <Text style={styles.label}>Altura (m)</Text>
            <TextInput style={styles.input} value={altura} onChangeText={setAltura} keyboardType="numeric" />

            <Text style={styles.label}>Fecha de Ingreso (DD/MM/AAAA)</Text>
            <TextInput style={styles.input} value={fechaIngreso} onChangeText={setFechaIngreso} placeholder="Ej: 15/03/2018" />

            <Text style={styles.label}>Teléfono</Text>
            <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />

            <Text style={styles.label}>Email (Opcional)</Text>
            <Text style={styles.emailHint}>💡 Si el costalero quiere usar la app, deberá tener su email aquí para poder registrarse.</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

            {loading ? (
                <ActivityIndicator color="blue" />
            ) : (
                <View style={{ marginTop: 10 }}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                        <Text style={styles.saveBtnText}>{costaleroId ? "ACTUALIZAR" : "GUARDAR COSTALERO"}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {costaleroId ? (
                <View style={styles.qrCard}>
                    <SectionHeader title="Código QR de Asistencia" />
                    <Text style={styles.qrNameText}>{nombre} {apellidos}</Text>
                    <QRCode value={String(costaleroId)} size={200} />
                    <Text style={styles.qrHint}>Muestra este código para que el capataz registre tu asistencia.</Text>
                </View>
            ) : null}

            {costaleroId && (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <MaterialIcons name="delete-outline" size={24} color="#D32F2F" />
                    <Text style={styles.deleteBtnText}>ELIMINAR COSTALERO</Text>
                </TouchableOpacity>
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
        paddingBottom: 150
    },
    profileHeader: {
        alignItems: 'center',
        paddingVertical: 24,
        backgroundColor: 'white',
        borderRadius: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    avatarCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EDE7F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 2,
        borderColor: '#5E35B1'
    },
    avatarText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#5E35B1'
    },
    profileName: {
        fontSize: 22,
        fontWeight: '800',
        color: '#212121',
        marginBottom: 8,
        textAlign: 'center'
    },
    puestoBadge: {
        backgroundColor: '#E8EAF6',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    puestoBadgeText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#3F51B5',
        letterSpacing: 0.5
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
        paddingHorizontal: 8
    },
    sectionHeaderLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#EEEEEE'
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#BDBDBD',
        marginHorizontal: 12,
        textTransform: 'uppercase',
        letterSpacing: 1
    },
    cardContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5'
    },
    infoIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16
    },
    infoTextContainer: {
        flex: 1
    },
    infoLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9E9E9E',
        textTransform: 'uppercase',
        marginBottom: 2
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#424242'
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
        color: '#212121'
    },
    emailHint: {
        fontSize: 12,
        color: '#FF9800',
        marginBottom: 8,
        fontWeight: '500'
    },
    profileActions: {
        marginTop: 24,
    },
    historyBtn: {
        backgroundColor: '#5E35B1',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 15,
        marginBottom: 16,
        shadowColor: "#5E35B1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    },
    historyBtnText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 16,
        marginLeft: 12,
        letterSpacing: 0.5
    },
    contactActions: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    smallActionBtn: {
        flex: 0.48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        elevation: 2
    },
    smallActionText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 14,
        marginLeft: 8
    },
    saveBtn: {
        backgroundColor: '#5E35B1',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10
    },
    saveBtnText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 16,
        letterSpacing: 0.5
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 20,
        marginBottom: 50,
        borderWidth: 1,
        borderColor: '#FFCDD2'
    },
    deleteBtnText: {
        color: '#D32F2F',
        fontWeight: '700',
        fontSize: 14,
        marginLeft: 10
    },
    qrCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#EEEEEE',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    qrNameText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#5E35B1',
        marginBottom: 20,
        textAlign: 'center'
    },
    qrHint: {
        fontSize: 13,
        color: '#757575',
        textAlign: 'center',
        fontStyle: 'italic',
        lineHeight: 18,
        marginTop: 20
    },
    loading: {
        marginTop: 50
    }
});
