import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, Alert, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export default function QRScannerScreen({ route, navigation }) {
    const { eventId } = route.params || {};
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resultMessage, setResultMessage] = useState('');
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        // Monitor network status
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected);
            if (state.isConnected) {
                // When connection returns, sync offline scans
                syncOfflineScans();
            }
        });

        // Check for pending offline scans on mount
        syncOfflineScans();

        return () => unsubscribe();
    }, []);

    const syncOfflineScans = async () => {
        try {
            const offlineScansJson = await AsyncStorage.getItem('offlineScans');
            if (!offlineScansJson) return;

            const offlineScans = JSON.parse(offlineScansJson);
            if (offlineScans.length === 0) return;

            console.log(`Syncing ${offlineScans.length} offline scans...`);

            for (const scan of offlineScans) {
                try {
                    await addDoc(collection(db, "eventos", scan.eventId, "asistencias"), {
                        costaleroId: scan.costaleroId,
                        nombreCostalero: scan.nombreCostalero,
                        timestamp: serverTimestamp(),
                        status: 'presente'
                    });
                } catch (error) {
                    console.error("Error syncing scan:", error);
                }
            }

            // Clear synced scans
            await AsyncStorage.setItem('offlineScans', JSON.stringify([]));
            console.log("Offline scans synced successfully");
        } catch (error) {
            console.error("Error syncing offline scans:", error);
        }
    };

    const saveOfflineScan = async (costaleroId, nombreCostalero) => {
        try {
            const offlineScansJson = await AsyncStorage.getItem('offlineScans');
            const offlineScans = offlineScansJson ? JSON.parse(offlineScansJson) : [];

            offlineScans.push({
                eventId,
                costaleroId,
                nombreCostalero,
                timestamp: new Date().toISOString()
            });

            await AsyncStorage.setItem('offlineScans', JSON.stringify(offlineScans));
            console.log("Scan saved offline");
        } catch (error) {
            console.error("Error saving offline scan:", error);
            throw error;
        }
    };

    const handleBarCodeScanned = async ({ data }) => {
        if (scanned) return;

        setScanned(true);
        setLoading(true);
        Vibration.vibrate(100);

        const costaleroId = data;

        try {
            // 1. Verificar si existe el costalero (requiere conexión)
            if (!isOnline) {
                // In offline mode, we can't verify the costalero exists
                // Save locally and sync later
                await saveOfflineScan(costaleroId, "Costalero (offline)");
                setResultMessage(`📴 MODO OFFLINE\n✅ Guardado localmente\nSe sincronizará cuando haya conexión`);
                setLoading(false);
                return;
            }

            if (!eventId) {
                Alert.alert("Error", "No se ha seleccionado un evento.");
                setLoading(false);
                return;
            }

            const costaleroRef = doc(db, "costaleros", costaleroId);
            const costaleroSnap = await getDoc(costaleroRef);

            if (!costaleroSnap.exists()) {
                setResultMessage(`❌ Error: Costalero no encontrado (ID: ${costaleroId})`);
                setLoading(false);
                return;
            }

            const costaleroData = costaleroSnap.data();
            const nombreCompleto = `${costaleroData.nombre} ${costaleroData.apellidos}`;

            // 2. Verificar si ya está registrado en este evento
            const asistenciasRef = collection(db, "eventos", eventId, "asistencias");
            const q = query(asistenciasRef, where("costaleroId", "==", costaleroId));
            const existingSnap = await getDocs(q);

            if (!existingSnap.empty) {
                // Ya existe un registro
                const existingDoc = existingSnap.docs[0].data();
                const statusText = existingDoc.status === 'presente' ? 'PRESENTE' :
                    existingDoc.status === 'justificado' ? 'JUSTIFICADO' : 'AUSENTE';
                setResultMessage(`⚠️ ${nombreCompleto}\nYa registrado como: ${statusText}`);
                setLoading(false);
                return;
            }

            // 3. Registrar asistencia (solo si no existe)
            await addDoc(collection(db, "eventos", eventId, "asistencias"), {
                costaleroId: costaleroId,
                nombreCostalero: nombreCompleto,
                timestamp: serverTimestamp(),
                status: 'presente'
            });

            setResultMessage(`✅ Asistencia registrada:\n${nombreCompleto}`);
        } catch (error) {
            console.error(error);
            setResultMessage(`❌ Error al registrar: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!permission) {
        return <View style={styles.container}><Text>Solicitando permisos de cámara...</Text></View>;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>Necesitamos permiso para usar la cámara</Text>
                <Button onPress={requestPermission} title="Conceder permiso" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {!isOnline && (
                <View style={styles.offlineBanner}>
                    <Text style={styles.offlineText}>📴 MODO OFFLINE</Text>
                </View>
            )}

            <CameraView
                style={styles.camera}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            >
                <View style={styles.overlay}>
                    <View style={styles.scanArea} />
                </View>
            </CameraView>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                </View>
            )}

            {resultMessage ? (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultText}>{resultMessage}</Text>
                    <Button title="Escanear Otro" onPress={() => { setScanned(false); setResultMessage(''); }} />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    camera: { flex: 1 },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    scanArea: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: 'white',
        backgroundColor: 'transparent'
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)'
    },
    resultContainer: {
        position: 'absolute',
        bottom: 50,
        left: 20,
        right: 20,
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        alignItems: 'center'
    },
    resultText: {
        fontSize: 16,
        marginBottom: 15,
        textAlign: 'center',
        fontWeight: 'bold'
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
        color: 'white'
    },
    offlineBanner: {
        backgroundColor: '#FF9800',
        padding: 12,
        alignItems: 'center',
        zIndex: 1000
    },
    offlineText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16
    }
});