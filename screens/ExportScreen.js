import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../supabaseConfig';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import QRCode from 'qrcode';

export default function ExportScreen() {
    const [loading, setLoading] = useState(false);

    const generateCSV = (headers, rows) => {
        const csvHeaders = headers.join(',');
        const csvRows = rows.map(row =>
            row.map(cell => {
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
            const { data: costaleros, error } = await supabase
                .from('costaleros')
                .select('*')
                .order('apellidos');

            if (error) throw error;

            const headers = ['Apellidos', 'Nombre', 'Trabajadera', 'Puesto', 'Altura (m)', 'Fecha Nacimiento', 'Teléfono', 'Email'];
            const rows = [];

            costaleros.forEach(data => {
                rows.push([
                    data.apellidos || '',
                    data.nombre || '',
                    data.trabajadera || '',
                    data.puesto || '',
                    data.altura || '',
                    data.fecha_nacimiento || '',
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
            // Get all events
            const { data: events, error: eventsError } = await supabase
                .from('eventos')
                .select('*')
                .order('fecha', { ascending: false });

            if (eventsError) throw eventsError;

            const headers = ['Evento', 'Fecha', 'Lugar', 'Total Registrados', 'Presentes', 'Ausentes', 'Justificados', '% Asistencia'];
            const rows = [];

            // For each event, get attendance stats
            // Could be optimized with a join or group by if possible, but iterative is fine for now
            for (const eventData of events) {
                const { data: asistencias, error: asistError } = await supabase
                    .from('asistencias')
                    .select('estado')
                    .eq('event_id', eventData.id);

                if (asistError) {
                    console.error("Error fetching asistencias for event", eventData.id, asistError);
                    continue;
                }

                let presentes = 0, ausentes = 0, justificados = 0;
                asistencias.forEach(record => {
                    const status = record.estado; // 'estado' en Supabase vs 'status' en Firebase
                    if (status === 'presente') presentes++;
                    else if (status === 'ausente') ausentes++;
                    else if (status === 'justificado') justificados++;
                });

                const total = presentes + ausentes + justificados;
                const porcentaje = total > 0 ? Math.round((presentes / total) * 100) : 0;

                rows.push([
                    eventData.nombre || '',
                    eventData.fecha ? new Date(eventData.fecha).toLocaleDateString() : '',
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

    const printQRReport = async () => {
        setLoading(true);
        try {
            // Fetch costaleros sorted by trabajadera
            const { data: costaleros, error } = await supabase
                .from('costaleros')
                .select('*')
                .order('trabajadera');

            if (error) throw error;

            // Loop and generate QR for each (async)
            let costalerosWithQR = [];
            for (const data of costaleros) {
                const id = data.id;
                // Generate SVG String (Works in React Native without Canvas)
                try {
                    const svgString = await QRCode.toString(id, { type: 'svg', margin: 1 });
                    costalerosWithQR.push({ ...data, id, qrSVG: svgString });
                } catch (e) {
                    console.error("QR Gen Error", e);
                    costalerosWithQR.push({ ...data, id, qrSVG: null });
                }
            }

            // HTML for the PDF
            const html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { font-family: 'Helvetica', sans-serif; padding: 20px; }
                        .card { 
                            border: 2px solid #000; 
                            padding: 20px; 
                            margin-bottom: 30px; 
                            text-align: center; 
                            page-break-inside: avoid;
                            border-radius: 10px;
                        }
                        /* FORCE SVG Size */
                        svg { width: 200px !important; height: 200px !important; margin: 10px auto; display: block; }
                        
                        .name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
                        .meta { font-size: 18px; color: #555; }
                        .section-title { 
                            background-color: #5E35B1; 
                            color: white; 
                            padding: 10px; 
                            font-size: 20px; 
                            margin-top: 40px; 
                            margin-bottom: 20px;
                            text-align: center;
                            font-weight: bold;
                            border-radius: 5px;
                            page-break-after: avoid;
                        }
                        .page-break { page-break-after: always; }
                    </style>
                </head>
                <body>
                    <h1 style="text-align: center;">Códigos QR - Cuadrilla</h1>
                    
                    ${generateCostalerosHTML(costalerosWithQR)}
                </body>
            </html>
            `;

            const { uri } = await Print.printToFileAsync({ html });
            // Sharing on web/expo-go might behave differently but standard Sharing is fine
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

        } catch (error) {
            console.error(error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const generateCostalerosHTML = (list) => {
        // Group by Trabajadera
        const grouped = { '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], '7': [], '0': [] };
        list.forEach(c => {
            const t = c.trabajadera && grouped[c.trabajadera] ? c.trabajadera : '0';
            grouped[t].push(c);
        });

        let htmlContent = '';

        // Define clean names for layout
        const tNames = { '1': 'Trabajadera 1', '2': 'Trabajadera 2', '3': 'Trabajadera 3', '4': 'Trabajadera 4', '5': 'Trabajadera 5', '6': 'Trabajadera 6', '7': 'Trabajadera 7', '0': 'Sin Asignar' };

        Object.keys(grouped).forEach(key => {
            const group = grouped[key];
            if (group.length > 0) {
                htmlContent += `<div class="section-title">${tNames[key]}</div>`;
                htmlContent += `<div style="display: flex; flex-wrap: wrap; justify-content: space-around;">`;

                group.forEach(c => {
                    const qrValue = c.id;

                    htmlContent += `
                        <div class="card" style="width: 40%;">
                            <div class="name">${c.nombre} ${c.apellidos}</div>
                            <div class="meta">${c.puesto || 'Costalero'}</div>
                            ${c.qrSVG ? c.qrSVG : '<div style="height:200px; display:flex; align-items:center; justify-content:center;">Error QR</div>'}
                            <div class="meta" style="font-size: 12px; margin-top: 5px;">${qrValue}</div>
                        </div>
                    `;
                });

                htmlContent += `</div><div class="page-break"></div>`;
            }
        });
        return htmlContent;
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
                    <Text style={styles.cardIcon}>📄</Text>
                    <Text style={styles.cardTitle}>Informe QR (PDF)</Text>
                    <Text style={styles.cardDescription}>
                        Genera un PDF con los códigos QR ordenados por trabajadera, listo para imprimir.
                    </Text>
                    <TouchableOpacity
                        style={styles.exportButton}
                        onPress={printQRReport}
                        disabled={loading}
                    >
                        <Text style={styles.exportButtonText}>
                            {loading ? 'Generando PDF...' : 'Descargar PDF QRs'}
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
