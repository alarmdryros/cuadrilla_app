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

    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    const handleRoleChange = (userId, currentRole, userEmail) => {
        setSelectedUser({ id: userId, email: userEmail });
        setModalVisible(true);
    };

    const confirmRoleChange = (newRole) => {
        if (selectedUser) {
            updateUserRole(selectedUser.id, newRole);
            setModalVisible(false);
            setSelectedUser(null);
        }
    };

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

            {/* Role Selection Modal */}
            {modalVisible && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Gestionar Rol</Text>
                        <Text style={styles.modalSubtitle}>Para: {selectedUser?.email}</Text>

                        <TouchableOpacity style={styles.modalOption} onPress={() => confirmRoleChange('superadmin')}>
                            <Text style={[styles.optionText, { color: '#D32F2F' }]}>Super Admin</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={() => confirmRoleChange('admin')}>
                            <Text style={[styles.optionText, { color: '#E64A19' }]}>Admin</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={() => confirmRoleChange('capataz')}>
                            <Text style={[styles.optionText, { color: '#FBC02D' }]}>Capataz</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={() => confirmRoleChange('auxiliar')}>
                            <Text style={[styles.optionText, { color: '#1976D2' }]}>Auxiliar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalOption} onPress={() => confirmRoleChange('costalero')}>
                            <Text style={[styles.optionText, { color: '#43A047' }]}>Costalero</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.modalOption, styles.cancelOption]} onPress={() => setModalVisible(false)}>
                            <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
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
    modalOverlay: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        width: '80%',
        maxWidth: 400,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
        color: '#212121'
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#757575',
        marginBottom: 20,
        textAlign: 'center'
    },
    modalOption: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
        alignItems: 'center'
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
    },
    cancelOption: {
        borderBottomWidth: 0,
        marginTop: 10,
        backgroundColor: '#F5F5F5',
        borderRadius: 8,
    },
    cancelText: {
        fontSize: 16,
        color: '#757575',
        fontWeight: '600'
    }
});
