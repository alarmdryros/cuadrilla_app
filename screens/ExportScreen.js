import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function ExportScreen() {
    const [loading, setLoading] = useState(false);

    const generateCSV = (headers, rows) => {
        const csvHeaders = headers.join(',');
        const csvRows = rows.map(row =>
            row.map(cell => {
                // Escape commas and quotes
                const cellStr = String(cell || '');
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',')
        );
        return [csvHeaders, ...csvRows].join('\n');
    };

    const shareCSV = async (csvContent, filename) => {
        try {
            const fileUri = FileSystem.documentDirectory + filename;
            await FileSystem.writeAsStringAsync(fileUri, csvContent, {
                encoding: 'utf8',
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Exportar a Google Sheets',
                    UTI: 'public.comma-separated-values-text'
                });
            } else {
                Alert.alert('Error', 'No se puede compartir archivos en este dispositivo');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error al generar el archivo: ' + error.message);
        }
    };

    const exportCostaleros = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "costaleros"), orderBy("apellidos"));
            const snapshot = await getDocs(q);

            const headers = ['Apellidos', 'Nombre', 'Trabajadera', 'Puesto', 'Altura (m)', 'Fecha Nacimiento', 'Teléfono', 'Email'];
            const rows = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                rows.push([
                    data.apellidos || '',
                    data.nombre || '',
                    data.trabajadera || '',
                    data.puesto || '',
                    data.altura || '',
                    data.fechaNacimiento || '',
                    data.telefono || '',
                    data.email || ''
                ]);
            });

            const csv = generateCSV(headers, rows);
            await shareCSV(csv, `costaleros_${new Date().toISOString().split('T')[0]}.csv`);
            Alert.alert('Éxito', `${rows.length} costaleros exportados`);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const exportAllEvents = async () => {
        setLoading(true);
        try {
            const eventsQuery = query(collection(db, "eventos"), orderBy("fecha", "desc"));
            const eventsSnapshot = await getDocs(eventsQuery);

            const headers = ['Evento', 'Fecha', 'Lugar', 'Total Registrados', 'Presentes', 'Ausentes', 'Justificados', '% Asistencia'];
            const rows = [];

            for (const eventDoc of eventsSnapshot.docs) {
                const eventData = eventDoc.data();
                const asistenciasSnapshot = await getDocs(collection(db, "eventos", eventDoc.id, "asistencias"));

                let presentes = 0, ausentes = 0, justificados = 0;
                asistenciasSnapshot.forEach(doc => {
                    const status = doc.data().status;
                    if (status === 'presente') presentes++;
                    else if (status === 'ausente') ausentes++;
                    else if (status === 'justificado') justificados++;
                });

                const total = presentes + ausentes + justificados;
                const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0;

                rows.push([
                    eventData.nombre || '',
                    new Date(eventData.fecha).toLocaleDateString() || '',
                    eventData.lugar || '',
                    total,
                    presentes,
                    ausentes,
                    justificados,
                    `${porcentaje}%`
                ]);
            }

            const csv = generateCSV(headers, rows);
            await shareCSV(csv, `eventos_resumen_${new Date().toISOString().split('T')[0]}.csv`);
            Alert.alert('Éxito', `${rows.length} eventos exportados`);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Exportar Datos</Text>
                <Text style={styles.subtitle}>Genera archivos CSV para abrir en Google Sheets</Text>

                <View style={styles.card}>
                    <Text style={styles.cardIcon}>👥</Text>
                    <Text style={styles.cardTitle}>Lista de Costaleros</Text>
                    <Text style={styles.cardDescription}>
                        Exporta la lista completa con todos los datos de los costaleros
                    </Text>
                    <TouchableOpacity
                        style={styles.exportButton}
                        onPress={exportCostaleros}
                        disabled={loading}
                    >
                        <Text style={styles.exportButtonText}>
                            {loading ? 'Generando...' : 'Exportar Costaleros'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardIcon}>📊</Text>
                    <Text style={styles.cardTitle}>Resumen de Eventos</Text>
                    <Text style={styles.cardDescription}>
                        Exporta un resumen de todos los eventos con estadísticas de asistencia
                    </Text>
                    <TouchableOpacity
                        style={styles.exportButton}
                        onPress={exportAllEvents}
                        disabled={loading}
                    >
                        <Text style={styles.exportButtonText}>
                            {loading ? 'Generando...' : 'Exportar Eventos'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#5E35B1" />
                        <Text style={styles.loadingText}>Generando archivo...</Text>
                    </View>
                )}

                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>💡 Cómo usar:</Text>
                    <Text style={styles.infoText}>1. Pulsa el botón de exportación</Text>
                    <Text style={styles.infoText}>2. Comparte el archivo (Drive, Gmail, etc.)</Text>
                    <Text style={styles.infoText}>3. Abre el CSV en Google Sheets</Text>
                    <Text style={styles.infoText}>4. ¡Listo para analizar!</Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA'
    },
    content: {
        padding: 20
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 16,
        color: '#757575',
        marginBottom: 30
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    cardIcon: {
        fontSize: 48,
        marginBottom: 16,
        textAlign: 'center'
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 8,
        textAlign: 'center'
    },
    cardDescription: {
        fontSize: 14,
        color: '#757575',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20
    },
    exportButton: {
        backgroundColor: '#5E35B1',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: "#5E35B1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    exportButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    loadingContainer: {
        alignItems: 'center',
        marginTop: 20
    },
    loadingText: {
        marginTop: 12,
        color: '#757575',
        fontSize: 14
    },
    infoCard: {
        backgroundColor: '#E8F5E9',
        borderRadius: 12,
        padding: 20,
        marginTop: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50'
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2E7D32',
        marginBottom: 12
    },
    infoText: {
        fontSize: 14,
        color: '#2E7D32',
        marginBottom: 6,
        paddingLeft: 8
    }
});
