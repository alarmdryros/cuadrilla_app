import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../supabaseConfig';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Por favor, introduce email y contraseña");
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                throw error;
            }
            // Navigation provided by App.js auth state listener
        } catch (error) {
            console.error(error);
            Alert.alert("Error", error.message || "Error al iniciar sesión");
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
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../assets/escudo-hermandad-logo.jpg')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                </View>
                <Text style={styles.title}>Hermandad de la Soledad</Text>
                <Text style={styles.subtitle}>Ayamonte</Text>
                <Text style={styles.appName}>Gestión de Cuadrilla</Text>

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
                        autoComplete="email"
                        textContentType="emailAddress"
                    />

                    <Text style={styles.label}>Contraseña</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            placeholderTextColor="#666666"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="password"
                            textContentType="password"
                        />
                        <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <MaterialIcons
                                name={showPassword ? "visibility" : "visibility-off"}
                                size={24}
                                color="#1a5d1a"
                            />
                        </TouchableOpacity>
                    </View>

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
        backgroundColor: '#0a0a0a'
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 30
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 30
    },
    logoImage: {
        width: 160,
        height: 160,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#1a5d1a',
        shadowColor: '#1a5d1a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
        elevation: 10
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 4,
        letterSpacing: 1
    },
    subtitle: {
        fontSize: 16,
        color: '#b0b0b0',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 2,
        textTransform: 'uppercase'
    },
    appName: {
        fontSize: 14,
        color: '#1a5d1a',
        textAlign: 'center',
        marginBottom: 40,
        fontStyle: 'italic'
    },
    form: {
        backgroundColor: '#1a1a1a',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        shadowColor: "#1a5d1a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 8,
        marginTop: 12
    },
    input: {
        borderWidth: 1,
        borderColor: '#2a2a2a',
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        backgroundColor: '#0a0a0a',
        color: '#ffffff'
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2a2a2a',
        borderRadius: 8,
        backgroundColor: '#0a0a0a',
        paddingRight: 10
    },
    passwordInput: {
        flex: 1,
        padding: 14,
        fontSize: 16,
        color: '#ffffff'
    },
    eyeButton: {
        padding: 8
    },
    button: {
        backgroundColor: '#1a5d1a',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 24,
        shadowColor: "#1a5d1a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    loader: {
        marginTop: 24,
        color: '#1a5d1a'
    },
    hint: {
        textAlign: 'center',
        color: '#666666',
        fontSize: 13,
        marginTop: 24,
        fontStyle: 'italic'
    }
});
