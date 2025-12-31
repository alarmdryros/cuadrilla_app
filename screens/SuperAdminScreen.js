import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { MaterialIcons } from '../components/Icon';
import { supabase } from '../supabaseConfig';
import { useAuth } from '../contexts/AuthContext';

export default function SuperAdminScreen({ navigation }) {
    const { userRole } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filteredUsers, setFilteredUsers] = useState([]);

    useEffect(() => {
        if (userRole !== 'superadmin') {
            Alert.alert('Acceso Denegado', 'No tienes permisos de Super Admin.');
            navigation.goBack();
            return;
        }
        fetchUsers();
    }, [userRole]);

    useEffect(() => {
        if (search) {
            const lowerSearch = search.toLowerCase();
            const filtered = users.filter(u =>
                (u.email && u.email.toLowerCase().includes(lowerSearch)) ||
                (u.role && u.role.toLowerCase().includes(lowerSearch))
            );
            setFilteredUsers(filtered);
        } else {
            setFilteredUsers(users);
        }
    }, [search, users]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Fetch all profiles
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .order('role', { ascending: true }); // Show admins first ideally, or by email

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            Alert.alert('Error', 'No se pudieron cargar los usuarios.');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = (userId, currentRole, userEmail) => {
        // Options for role change
        Alert.alert(
            'Gestionar Rol',
            `Selecciona el nuevo rol para ${userEmail}:`,
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Super Admin', onPress: () => updateUserRole(userId, 'superadmin') },
                { text: 'Admin', onPress: () => updateUserRole(userId, 'admin') },
                { text: 'Capataz', onPress: () => updateUserRole(userId, 'capataz') },
                { text: 'Auxiliar', onPress: () => updateUserRole(userId, 'auxiliar') },
                { text: 'Costalero', onPress: () => updateUserRole(userId, 'costalero') },
            ]
        );
    };

    const updateUserRole = async (userId, newRole) => {
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            Alert.alert('Éxito', `Rol actualizado a ${newRole}`);
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error('Error updating role:', error);
            Alert.alert('Error', 'No se pudo actualizar el rol.');
        }
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'superadmin': return '#D32F2F'; // Red
            case 'admin': return '#E64A19'; // Orange
            case 'capataz': return '#FBC02D'; // Yellow
            case 'auxiliar': return '#1976D2'; // Blue
            default: return '#757575'; // Grey
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.userInfo}>
                <Text style={styles.email}>{item.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
                    <Text style={styles.roleText}>{item.role?.toUpperCase() || 'COSTALERO'}</Text>
                </View>
            </View>
            <TouchableOpacity
                style={styles.editButton}
                onPress={() => handleRoleChange(item.id, item.role, item.email)}
            >
                <MaterialIcons name="edit" size={24} color="#5E35B1" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar usuario..."
                    value={search}
                    onChangeText={setSearch}
                />
                <TouchableOpacity onPress={fetchUsers} style={styles.refreshButton}>
                    <MaterialIcons name="refresh" size={24} color="#5E35B1" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#5E35B1" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron usuarios.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    header: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'center',
        backgroundColor: 'white',
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
        padding: 10,
        marginRight: 10,
        fontSize: 16,
    },
    refreshButton: {
        padding: 8,
    },
    list: {
        padding: 16,
    },
    card: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    userInfo: {
        flex: 1,
    },
    email: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#212121',
        marginBottom: 4,
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    roleText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
    editButton: {
        padding: 8,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#757575',
    },
});
