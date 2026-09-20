import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TopNavbar from '../components/TopNavbar';

// ================================================================
// LAYOUT PRINCIPAL
//
// Mantém exatamente a preparação de host do Mobile funcional.
// A navbar visual fica como HEADER do Stack, em vez de envolver o
// Stack inteiro. Assim a área da tela continua sendo calculada pelo
// Expo Router normalmente no Web e no Android/iOS.
// ================================================================

export default function RootLayout() {
  const [hostPreparado, setHostPreparado] = useState(
    Platform.OS !== 'web'
  );

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    if (typeof window === 'undefined') {
      setHostPreparado(true);
      return;
    }

    if (window.location.hostname === 'localhost') {
      const novaUrl = new URL(window.location.href);

      novaUrl.hostname = '127.0.0.1';

      window.location.replace(
        novaUrl.toString()
      );

      return;
    }

    setHostPreparado(true);
  }, []);

  if (!hostPreparado) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#faf8f5',
        }}
      />
    );
  }

  return (
    <>
      <StatusBar style="light" />

      <Stack
        screenOptions={{
          headerShown: true,

          header: () => (
            <SafeAreaView
              edges={['top']}
              style={{
                backgroundColor: '#000',
              }}
            >
              <TopNavbar />
            </SafeAreaView>
          ),

          contentStyle: {
            backgroundColor: '#faf8f5',
          },
        }}
      >
        {/* Login e rota inicial continuam sem navbar superior. */}

        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}