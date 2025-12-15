import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Por favor, introduce email y contraseña");
            return;
        }

        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Navigation is handled automatically by App.js onAuthStateChanged
        } catch (error) {
            console.error(error);
            let errorMessage = "Error al iniciar sesión";

            if (error.code === 'auth/invalid-email') {
                errorMessage = "Email inválido";
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = "Usuario no encontrado";
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = "Contraseña incorrecta";
            } else if (error.code === 'auth/invalid-credential') {
                errorMessage = "Credenciales inválidas";
            }

            Alert.alert("Error", errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Text style={styles.title}>Cuadrilla App</Text>
                <Text style={styles.subtitle}>Gestión de Costaleros</Text>

                <View style={styles.form}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="tu@email.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Contraseña</Text>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    {loading ? (
                        <ActivityIndicator size="large" color="#5E35B1" style={styles.loader} />
                    ) : (
                        <TouchableOpacity style={styles.button} onPress={handleLogin}>
                            <Text style={styles.buttonText}>Iniciar Sesión</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.hint}>Solo para capataz y asistentes autorizados</Text>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA'
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 30
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#5E35B1',
        textAlign: 'center',
        marginBottom: 8
    },
    subtitle: {
        fontSize: 18,
        color: '#757575',
        textAlign: 'center',
        marginBottom: 50
    },
    form: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#212121',
        marginBottom: 8,
        marginTop: 12
    },
    input: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        backgroundColor: '#FAFAFA',
        color: '#212121'
    },
    button: {
        backgroundColor: '#5E35B1',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: "#5E35B1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    loader: {
        marginTop: 24
    },
    hint: {
        textAlign: 'center',
        color: '#9E9E9E',
        fontSize: 13,
        marginTop: 24,
        fontStyle: 'italic'
    }
});
