import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MaterialIcons } from '../components/Icon';
import { supabase } from '../supabaseConfig';

export default function RegisterScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('costalero');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleRegister = async () => {
        // Validaciones
        if (!email || !password || !confirmPassword) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            // 1. Verificar si el email existe en costaleros
            const { data: costalero, error: checkError } = await supabase
                .from('costaleros')
                .select('id, nombre, apellidos')
                .eq('email', email.toLowerCase().trim())
                .single();

            if (checkError || !costalero) {
                Alert.alert(
                    'Email no registrado',
                    'Tu email no está en el sistema.\n\nPor favor, contacta con el administrador de la cuadrilla para que te añada primero como costalero.',
                    [{ text: 'Entendido' }]
                );
                setLoading(false);
                return;
            }

            // 2. Crear usuario en Supabase Auth con metadatos para el trigger
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email: email.toLowerCase().trim(),
                password: password,
                options: {
                    data: {
                        costalero_id: costalero.id,
                        role: role // Pass selected role to trigger
                    }
                }
            });

            if (signUpError) {
                if (signUpError.message.includes('already registered')) {
                    // Si ya está registrado, vamos a ver si es un usuario "huérfano" (sin perfil)
                    const { data: profileCheck } = await supabase
                        .from('user_profiles')
                        .select('id')
                        .eq('email', email.toLowerCase().trim())
                        .single();

                    if (!profileCheck) {
                        Alert.alert(
                            'Cuenta ya existente',
                            'Tu cuenta ya existe en el sistema de autenticación pero no tiene un perfil vinculado.\n\nPor favor, intenta iniciar sesión normalmente. Si no puedes entrar, contacta con tu capataz para sincronizar tu cuenta.',
                            [{ text: 'Ir a Login', onPress: () => navigation.navigate('Login') }]
                        );
                    } else {
                        Alert.alert(
                            'Ya estás registrado',
                            'Este email ya tiene una cuenta activa. Por favor, inicia sesión.',
                            [{ text: 'Ir a Login', onPress: () => navigation.navigate('Login') }]
                        );
                    }
                } else {
                    throw signUpError;
                }
                setLoading(false);
                return;
            }

            // Nota: El perfil se crea automáticamente mediante un Database Trigger
            // usando el costalero_id pasado en los metadatos.

            Alert.alert(
                '¡Registro exitoso!',
                `Bienvenido ${costalero.nombre} ${costalero.apellidos}.\n\nPuedes iniciar sesión ahora.`,
                [
                    {
                        text: 'Iniciar Sesión',
                        onPress: () => navigation.replace('Login')
                    }
                ]
            );

        } catch (error) {
            console.error('Final Registration Catch:', error);
            const errorMessage = error.message || 'Error desconocido';

            if (errorMessage.includes('42501') || errorMessage.includes('security policy')) {
                Alert.alert(
                    'Error de Seguridad (RLS)',
                    'Parece que hay un problema de permisos en la base de datos.\n\nPor favor, asegúrate de haber ejecutado el script "Master Fix" en Supabase SQL Editor.'
                );
            } else {
                Alert.alert('Error de Registro', errorMessage);
            }
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
                <Text style={styles.title}>Registro de Costalero</Text>
                <Text style={styles.subtitle}>
                    Introduce el email que te proporcionó el administrador
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                />

                <View style={styles.pickerContainer}>
                    <Text style={styles.label}>Rol Solicitado:</Text>
                    <Picker
                        selectedValue={role}
                        onValueChange={(itemValue) => setRole(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Costalero" value="costalero" />
                        <Picker.Item label="Auxiliar" value="auxiliar" />
                        <Picker.Item label="Capataz" value="capataz" />
                    </Picker>
                </View>

                <View style={styles.passwordContainer}>
                    <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Contraseña (mínimo 6 caracteres)"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        editable={!loading}
                    />
                    <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowPassword(!showPassword)}
                    >
                        <MaterialIcons
                            name={showPassword ? "visibility-off" : "visibility"}
                            size={24}
                            color="#757575"
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.passwordContainer}>
                    <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Confirmar contraseña"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        editable={!loading}
                    />
                    <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                        <MaterialIcons
                            name={showConfirmPassword ? "visibility-off" : "visibility"}
                            size={24}
                            color="#757575"
                        />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.buttonText}>Registrarse</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.navigate('Login')}
                    disabled={loading}
                >
                    <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia sesión</Text>
                </TouchableOpacity>

                <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>ℹ️ Información importante</Text>
                    <Text style={styles.infoText}>
                        • Solo puedes registrarte si el administrador te ha añadido previamente como costalero
                    </Text>
                    <Text style={styles.infoText}>
                        • Usa el mismo email que te proporcionó el administrador
                    </Text>
                    <Text style={styles.infoText}>
                        • Si tienes problemas, contacta con el administrador
                    </Text>
                </View>
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
        padding: 24,
        justifyContent: 'center'
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#212121',
        marginBottom: 8,
        textAlign: 'center'
    },
    subtitle: {
        fontSize: 14,
        color: '#757575',
        marginBottom: 32,
        textAlign: 'center',
        lineHeight: 20
    },
    input: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        fontSize: 16,
        color: '#212121'
    },
    pickerContainer: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden'
    },
    label: {
        fontSize: 12,
        color: '#757575',
        marginLeft: 16,
        marginTop: 8
    },
    picker: {
        width: '100%',
        height: 50
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        marginBottom: 16,
        paddingRight: 12
    },
    eyeBtn: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    button: {
        backgroundColor: '#5E35B1',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#5E35B1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6
    },
    buttonDisabled: {
        opacity: 0.6
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700'
    },
    linkButton: {
        marginTop: 16,
        padding: 8,
        alignItems: 'center'
    },
    linkText: {
        color: '#5E35B1',
        fontSize: 14,
        fontWeight: '600'
    },
    infoBox: {
        backgroundColor: '#E8F5E9',
        borderRadius: 12,
        padding: 16,
        marginTop: 24,
        borderLeftWidth: 4,
        borderLeftColor: '#4CAF50'
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2E7D32',
        marginBottom: 8
    },
    infoText: {
        fontSize: 13,
        color: '#2E7D32',
        marginBottom: 4,
        lineHeight: 18
    }
});
