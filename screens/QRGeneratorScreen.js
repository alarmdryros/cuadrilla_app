import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
// screens/QRGeneratorScreen.js

import React, { useState } from 'react';
// ... (resto de imports)
// ... (código y estilos del Generador de QR)

export default function QRGeneratorScreen() {
    // ... (el código de la función App anterior)

// ... (los estilos)
  return (
    <View style={styles.container}>
      <Text>Open up App.js to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
