import { Text, View } from 'react-native';

type AcademyMapProps = {
  latitude?: string | number | null;
  longitude?: string | number | null;
  nome?: string;
  endereco?: string;
};

export default function AcademyMap({ latitude, longitude }: AcademyMapProps) {
  const latitudeNumerica = Number(latitude);
  const longitudeNumerica = Number(longitude);

  const possuiCoordenadas =
    latitude !== null &&
    latitude !== undefined &&
    longitude !== null &&
    longitude !== undefined &&
    String(latitude).trim() !== '' &&
    String(longitude).trim() !== '' &&
    Number.isFinite(latitudeNumerica) &&
    Number.isFinite(longitudeNumerica);

  return (
    <View
      style={{
        width: '100%',
        minHeight: 90,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#dedede',
        backgroundColor: '#fafafa',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Text
        style={{
          color: '#666',
          fontSize: 15,
          textAlign: 'center',
        }}
      >
        {possuiCoordenadas
          ? 'O mapa da academia está disponível na versão Web do LOGYM.'
          : 'Localização indisponível.'}
      </Text>
    </View>
  );
}
