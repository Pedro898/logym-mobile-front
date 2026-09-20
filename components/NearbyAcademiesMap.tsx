import { Text, View } from 'react-native';

import type { AcademiaProxima } from '@/lib/api';

type NearbyAcademiesMapProps = {
  userLatitude?: string | number | null;
  userLongitude?: string | number | null;
  academiasProximas: AcademiaProxima[];
  onAcademiaPress?: (academiaId: string | number) => void;
};

export default function NearbyAcademiesMap({
  academiasProximas,
}: NearbyAcademiesMapProps) {
  return (
    <View
      style={{
        width: '100%',
        minHeight: 100,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#f97316',
        backgroundColor: '#fff7ed',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#000',
          fontSize: 14,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {academiasProximas.length} academia(s) encontrada(s) em até 5 km.
      </Text>

      <Text
        style={{
          color: '#444',
          fontSize: 12,
          textAlign: 'center',
          marginTop: 5,
        }}
      >
        O mapa interativo usa o mesmo Leaflet + OpenStreetMap do Web e é exibido na versão Web do Mobile.
      </Text>
    </View>
  );
}
