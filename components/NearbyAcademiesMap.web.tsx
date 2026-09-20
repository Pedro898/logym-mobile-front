import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import type { AcademiaProxima } from '@/lib/api';

type NearbyAcademiesMapProps = {
  userLatitude?: string | number | null;
  userLongitude?: string | number | null;
  academiasProximas: AcademiaProxima[];
  onAcademiaPress?: (academiaId: string | number) => void;
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

function formatarDistancia(distanciaKm?: number | string | null) {
  const distancia = Number(distanciaKm);

  if (!Number.isFinite(distancia) || distancia < 0) {
    return '';
  }

  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(distancia)} km de você`;
}

function montarEnderecoResumido(academia: AcademiaProxima['academia']) {
  return [academia?.endereco, academia?.bairro, academia?.cidade, academia?.estado]
    .filter(Boolean)
    .join(' - ');
}

function MapaLeaflet({
  runtime,
  coordenadasUsuario,
  academiasComCoordenadas,
  pontosDoMapa,
  onAcademiaPress,
}: {
  runtime: LeafletRuntime;
  coordenadasUsuario: Coordenadas;
  academiasComCoordenadas: Array<{
    academia: AcademiaProxima['academia'];
    distanciaKm: AcademiaProxima['distanciaKm'];
    coordenadas: Coordenadas;
  }>;
  pontosDoMapa: Coordenadas[];
  onAcademiaPress?: (academiaId: string | number) => void;
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

  const userMarkerIcon = useMemo(
    () =>
      L.divIcon({
        className: 'user-location-marker',
        html: '<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0Z" fill="#f97316"/><circle cx="15" cy="15" r="5" fill="#ffffff"/></svg>',
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -40],
      }),
    [L]
  );

  function AjustarEnquadramento({ pontos }: { pontos: Coordenadas[] }) {
    const map = useMap();

    useEffect(() => {
      const timer = window.setTimeout(() => {
        map.invalidateSize();

        if (pontos.length === 1) {
          map.setView(pontos[0], 16);
          return;
        }

        map.fitBounds(L.latLngBounds(pontos), {
          padding: [40, 40],
          maxZoom: 15,
        });
      }, 0);

      return () => window.clearTimeout(timer);
    }, [map, pontos]);

    return null;
  }

  return (
    <View
      style={{
        width: '100%',
        height: 150,
        overflow: 'hidden',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#dedede',
        backgroundColor: '#f3f4f6',
      }}
    >
      <MapContainer
        center={coordenadasUsuario}
        zoom={14}
        scrollWheelZoom={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AjustarEnquadramento pontos={pontosDoMapa} />

        <Marker position={coordenadasUsuario} icon={userMarkerIcon}>
          <Popup>Sua localização</Popup>
        </Marker>

        {academiasComCoordenadas.map(({ academia, distanciaKm, coordenadas }) => {
          const endereco = montarEnderecoResumido(academia);
          const distanciaFormatada = formatarDistancia(distanciaKm);

          return (
            <Marker key={academia.id} position={coordenadas} icon={academyMarkerIcon}>
              <Popup>
                <div
                  style={{
                    minWidth: 150,
                    color: '#000',
                    fontFamily: 'Arial, Helvetica, sans-serif',
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: 5 }}>
                    {academia.nome || 'Academia'}
                  </strong>

                  {distanciaFormatada ? (
                    <p style={{ margin: '4px 0', fontSize: 12 }}>{distanciaFormatada}</p>
                  ) : null}

                  {endereco ? (
                    <p style={{ margin: '4px 0', fontSize: 12, lineHeight: 1.3 }}>{endereco}</p>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => onAcademiaPress?.(academia.id)}
                    style={{
                      display: 'inline-block',
                      marginTop: 4,
                      padding: '6px 10px',
                      backgroundColor: '#f97316',
                      border: '1px solid #ea580c',
                      borderRadius: 4,
                      color: '#000',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Ver detalhes
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </View>
  );
}

export default function NearbyAcademiesMap({
  userLatitude,
  userLongitude,
  academiasProximas,
  onAcademiaPress,
}: NearbyAcademiesMapProps) {
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
        console.error('Erro ao carregar o mapa Leaflet:', error);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const coordenadasUsuario = useMemo(
    () => getCoordenadasValidas(userLatitude, userLongitude),
    [userLatitude, userLongitude]
  );

  const academiasComCoordenadas = useMemo(() => {
    if (!Array.isArray(academiasProximas)) {
      return [];
    }

    return academiasProximas
      .map(({ academia, distanciaKm }) => ({
        academia,
        distanciaKm,
        coordenadas: getCoordenadasValidas(academia?.latitude, academia?.longitude),
      }))
      .filter(
        (item): item is {
          academia: AcademiaProxima['academia'];
          distanciaKm: AcademiaProxima['distanciaKm'];
          coordenadas: Coordenadas;
        } => Boolean(item.academia && item.coordenadas)
      );
  }, [academiasProximas]);

  const pontosDoMapa = useMemo<Coordenadas[]>(() => {
    if (!coordenadasUsuario) {
      return [];
    }

    return [
      coordenadasUsuario,
      ...academiasComCoordenadas.map(({ coordenadas }) => coordenadas),
    ];
  }, [academiasComCoordenadas, coordenadasUsuario]);

  if (!coordenadasUsuario) {
    return null;
  }

  // Expo Router faz uma renderização no servidor para o Web estático.
  // Leaflet depende de window/document, então ele só pode ser carregado
  // depois que o componente já estiver no navegador.
  if (typeof window === 'undefined' || !runtime) {
    return (
      <View
        style={{
          width: '100%',
          height: 180,
          overflow: 'hidden',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: 'rgba(15, 23, 42, 0.16)',
          backgroundColor: '#f3f4f6',
        }}
      />
    );
  }

  return (
    <MapaLeaflet
      runtime={runtime}
      coordenadasUsuario={coordenadasUsuario}
      academiasComCoordenadas={academiasComCoordenadas}
      pontosDoMapa={pontosDoMapa}
      onAcademiaPress={onAcademiaPress}
    />
  );
}
