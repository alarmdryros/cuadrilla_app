import * as React from 'react';
import { View, Button, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebaseConfig';

// Screens
import LoginScreen from './screens/LoginScreen';
import CostalerosListScreen from './screens/CostalerosListScreen';
import CostaleroFormScreen from './screens/CostaleroFormScreen';
import EventsListScreen from './screens/EventsListScreen';
import EventDetailScreen from './screens/EventDetailScreen';
import EventFormScreen from './screens/EventFormScreen';
import QRScannerScreen from './screens/QRScannerScreen';
import CostaleroHistoryScreen from './screens/CostaleroHistoryScreen';
import EventTrabajaderasScreen from './screens/EventTrabajaderasScreen';
import ExportScreen from './screens/ExportScreen';
import RelayManagementScreen from './screens/RelayManagementScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5E35B1" />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        {/* Usamos EventsList como Home temporalmente, o podríamos crear un Dashboard */}
        <Stack.Screen
          name="Home"
          component={EventsListScreen}
          options={({ navigation }) => ({
            title: 'Cuadrilla App',
            headerRight: () => (
              <Button title="Salir" onPress={handleLogout} color="#F44336" />
            ),
          })}
        />

        {/* Costaleros */}
        <Stack.Screen
          name="CostalerosList"
          component={CostalerosListScreen}
          options={{ title: 'Cuadrilla' }}
        />
        <Stack.Screen
          name="CostaleroForm"
          component={CostaleroFormScreen}
          options={{ title: 'Datos Costalero' }}
        />
        <Stack.Screen
          name="CostaleroHistory"
          component={CostaleroHistoryScreen}
          options={{ title: 'Historial' }}
        />

        {/* Eventos */}
        <Stack.Screen
          name="EventsList"
          component={EventsListScreen}
          options={{ title: 'Eventos' }}
        />
        <Stack.Screen
          name="EventForm"
          component={EventFormScreen}
          options={{ title: 'Nuevo Evento' }}
        />
        <Stack.Screen
          name="EventDetail"
          component={EventDetailScreen}
          options={{ title: 'Detalle Evento' }}
        />

        {/* Utiles */}
        <Stack.Screen
          name="QRScanner"
          component={QRScannerScreen}
          options={{ title: 'Escanear Asistencia' }}
        />
        <Stack.Screen
          name="EventTrabajaderas"
          component={EventTrabajaderasScreen}
          options={{ title: 'Por Trabajaderas' }}
        />
        <Stack.Screen
          name="Export"
          component={ExportScreen}
          options={{ title: 'Exportar Datos' }}
        />
        <Stack.Screen
          name="RelayManagement"
          component={RelayManagementScreen}
          options={{ title: 'Gestión de Relevos' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA'
  }
});