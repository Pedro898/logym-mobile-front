import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

type AcademyMapProps = {
  latitude?: string | number | null;
  longitude?: string | number | null;
  nome?: string;
  endereco?: string;
};

type Coordenadas = [number, number];

type LeafletRuntime = {
  L: any;
  MapContainer: any;
  Marker: any;
  Popup: any;
  TileLayer: any;
  useMap: () => any;
};

const LEAFLET_CSS_ID = 'logym-leaflet-css';
const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

function garantirCssLeaflet() {
  if (typeof document === 'undefined' || document.getElementById(LEAFLET_CSS_ID)) {
    return;
  }

  const link = document.createElement('link');
  link.id = LEAFLET_CSS_ID;
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS_URL;
  link.crossOrigin = '';
  document.head.appendChild(link);
}

function getCoordenadasValidas(
  latitude?: string | number | null,
  longitude?: string | number | null
): Coordenadas | null {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    String(latitude).trim() === '' ||
    String(longitude).trim() === ''
  ) {
    return null;
  }

  const latitudeNumerica = Number(latitude);
  const longitudeNumerica = Number(longitude);

  if (
    !Number.isFinite(latitudeNumerica) ||
    !Number.isFinite(longitudeNumerica) ||
    latitudeNumerica < -90 ||
    latitudeNumerica > 90 ||
    longitudeNumerica < -180 ||
    longitudeNumerica > 180
  ) {
    return null;
  }

  return [latitudeNumerica, longitudeNumerica];
}

function MapaLeaflet({
  runtime,
  coordenadas,
  nome,
  endereco,
}: {
  runtime: LeafletRuntime;
  coordenadas: Coordenadas;
  nome?: string;
  endereco?: string;
}) {
  const { L, MapContainer, Marker, Popup, TileLayer, useMap } = runtime;

  const academyMarkerIcon = useMemo(
    () =>
      L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    [L]
  );

  function AjustarMapa() {
    const map = useMap();

    useEffect(() => {
      const timer = window.setTimeout(() => {
        map.invalidateSize();
        map.setView(coordenadas, 16);
      }, 0);

      return () => window.clearTimeout(timer);
    }, [map]);

    return null;
  }

  return (
    <View
      style={{
        width: '100%',
        height: 200,
        overflow: 'hidden',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#dedede',
        backgroundColor: '#f3f4f6',
      }}
    >
      <MapContainer
        center={coordenadas}
        zoom={16}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AjustarMapa />

        <Marker position={coordenadas} icon={academyMarkerIcon}>
          <Popup>
            <div
              style={{
                minWidth: 150,
                color: '#000',
                fontFamily: 'Arial, Helvetica, sans-serif',
              }}
            >
              <strong style={{ display: 'block', marginBottom: 5 }}>
                {nome || 'Academia'}
              </strong>

              {endereco ? (
                <p style={{ margin: '4px 0', fontSize: 12, lineHeight: 1.3 }}>
                  {endereco}
                </p>
              ) : null}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </View>
  );
}

export default function AcademyMap({
  latitude,
  longitude,
  nome,
  endereco,
}: AcademyMapProps) {
  const [runtime, setRuntime] = useState<LeafletRuntime | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let ativo = true;

    garantirCssLeaflet();

    Promise.all([import('leaflet'), import('react-leaflet')])
      .then(([leafletModule, reactLeafletModule]) => {
        if (!ativo) {
          return;
        }

        const L = (leafletModule as any).default ?? leafletModule;

        setRuntime({
          L,
          MapContainer: reactLeafletModule.MapContainer,
          Marker: reactLeafletModule.Marker,
          Popup: reactLeafletModule.Popup,
          TileLayer: reactLeafletModule.TileLayer,
          useMap: reactLeafletModule.useMap,
        });
      })
      .catch((error) => {
        console.error('Erro ao carregar o mapa da academia:', error);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const coordenadas = useMemo(
    () => getCoordenadasValidas(latitude, longitude),
    [latitude, longitude]
  );

  if (!coordenadas) {
    return (
      <Text
        style={{
          color: '#666',
          fontSize: 15,
        }}
      >
        Localização indisponível.
      </Text>
    );
  }

  if (!runtime) {
    return (
      <View
        style={{
          width: '100%',
          height: 200,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#dedede',
          backgroundColor: '#fafafa',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#666', fontSize: 14 }}>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <MapaLeaflet
      runtime={runtime}
      coordenadas={coordenadas}
      nome={nome}
      endereco={endereco}
    />
  );
}
