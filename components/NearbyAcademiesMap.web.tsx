import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';

import type { AcademiaProxima } from '@/lib/api';

type NearbyAcademiesMapProps = {
  userLatitude?: string | number | null;
  userLongitude?: string | number | null;
  academiasProximas: AcademiaProxima[];
  onAcademiaPress?: (academiaId: string | number) => void;
};

type Coordenadas = [number, number];

type AcademiaComCoordenadas = {
  academia: AcademiaProxima['academia'];
  distanciaKm: AcademiaProxima['distanciaKm'];
  coordenadas: Coordenadas;
};

type LeafletRuntime = {
  L: any;
  MapContainer: any;
  Marker: any;
  Popup: any;
  TileLayer: any;
  useMap: () => any;
};

type AcademiaSelecionada = AcademiaComCoordenadas | null;

const MAP_PROVIDER_STORAGE_KEY = 'logym_map_provider';
const GOOGLE_PROVIDER = 'google';
const LEAFLET_PROVIDER = 'leaflet';

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

function criarIconePin(cor: string, tamanho: { largura: number; altura: number }) {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg width="${tamanho.largura}" height="${tamanho.altura}" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0Z" fill="${cor}"/><circle cx="15" cy="15" r="5" fill="#ffffff"/></svg>`
    )}`,
    scaledSize: {
      width: tamanho.largura,
      height: tamanho.altura,
    },
    anchor: {
      x: tamanho.largura / 2,
      y: tamanho.altura,
    },
  };
}

const userMarkerIcon = criarIconePin('#f97316', {
  largura: 30,
  altura: 42,
});

const academyMarkerIcon = criarIconePin('#343434', {
  largura: 28,
  altura: 39,
});

function lerProviderDaSessao(googleDisponivel: boolean) {
  if (!googleDisponivel || typeof sessionStorage === 'undefined') {
    return LEAFLET_PROVIDER;
  }

  try {
    return sessionStorage.getItem(MAP_PROVIDER_STORAGE_KEY) === LEAFLET_PROVIDER
      ? LEAFLET_PROVIDER
      : GOOGLE_PROVIDER;
  } catch {
    return GOOGLE_PROVIDER;
  }
}

function AjustarEnquadramentoGoogle({ pontos }: { pontos: Coordenadas[] }) {
  const map = useMap();

  useEffect(() => {
    const googleMaps = (window as any).google?.maps;

    if (!map || !googleMaps || pontos.length === 0) {
      return undefined;
    }

    if (pontos.length === 1) {
      map.setCenter({ lat: pontos[0][0], lng: pontos[0][1] });
      map.setZoom(16);
      return undefined;
    }

    const bounds = new googleMaps.LatLngBounds();

    pontos.forEach(([lat, lng]) => {
      bounds.extend({ lat, lng });
    });

    map.fitBounds(bounds, 40);

    const listener = googleMaps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > 15) {
        map.setZoom(15);
      }
    });

    return () => listener.remove();
  }, [map, pontos]);

  return null;
}

function NearbyAcademiesGoogleMapContent({
  coordenadasUsuario,
  academiasComCoordenadas,
  onAcademiaPress,
  onError,
}: {
  coordenadasUsuario: Coordenadas;
  academiasComCoordenadas: AcademiaComCoordenadas[];
  onAcademiaPress?: (academiaId: string | number) => void;
  onError: () => void;
}) {
  const [academiaSelecionada, setAcademiaSelecionada] =
    useState<AcademiaSelecionada>(null);
  const statusDaApi = useApiLoadingStatus();

  const pontosDoMapa = useMemo(
    () => [
      coordenadasUsuario,
      ...academiasComCoordenadas.map(({ coordenadas }) => coordenadas),
    ],
    [academiasComCoordenadas, coordenadasUsuario]
  );

  useEffect(() => {
    setAcademiaSelecionada(null);
  }, [academiasComCoordenadas, coordenadasUsuario]);

  useEffect(() => {
    if (statusDaApi === 'FAILED' || statusDaApi === 'AUTH_FAILURE') {
      onError();
    }
  }, [onError, statusDaApi]);

  return (
    <Map
      defaultCenter={{
        lat: coordenadasUsuario[0],
        lng: coordenadasUsuario[1],
      }}
      defaultZoom={14}
      gestureHandling="greedy"
      disableDefaultUI={false}
      streetViewControl={false}
      mapTypeControl={false}
      style={{ width: '100%', height: '100%' }}
      onClick={() => setAcademiaSelecionada(null)}
    >
      <AjustarEnquadramentoGoogle pontos={pontosDoMapa} />

      <Marker
        position={{
          lat: coordenadasUsuario[0],
          lng: coordenadasUsuario[1],
        }}
        icon={userMarkerIcon as any}
        title="Sua localização"
      />

      {academiasComCoordenadas.map(({ academia, distanciaKm, coordenadas }) => (
        <Marker
          key={academia.id}
          position={{ lat: coordenadas[0], lng: coordenadas[1] }}
          icon={academyMarkerIcon as any}
          title={academia.nome || 'Academia'}
          onClick={() =>
            setAcademiaSelecionada({ academia, distanciaKm, coordenadas })
          }
        />
      ))}

      {academiaSelecionada ? (
        <InfoWindow
          position={{
            lat: academiaSelecionada.coordenadas[0],
            lng: academiaSelecionada.coordenadas[1],
          }}
          onClose={() => setAcademiaSelecionada(null)}
          shouldFocus={false}
        >
          <div
            style={{
              minWidth: 170,
              color: '#333',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            <strong
              style={{
                display: 'block',
                color: '#151515',
                fontSize: 14,
              }}
            >
              {academiaSelecionada.academia.nome || 'Academia'}
            </strong>

            {formatarDistancia(academiaSelecionada.distanciaKm) ? (
              <p style={{ margin: '5px 0' }}>
                {formatarDistancia(academiaSelecionada.distanciaKm)}
              </p>
            ) : null}

            {montarEnderecoResumido(academiaSelecionada.academia) ? (
              <p style={{ margin: '5px 0' }}>
                {montarEnderecoResumido(academiaSelecionada.academia)}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() =>
                onAcademiaPress?.(academiaSelecionada.academia.id)
              }
              style={{
                display: 'inline-block',
                marginTop: 4,
                padding: '6px 10px',
                border: '1px solid #f97316',
                borderRadius: 6,
                backgroundColor: '#f97316',
                color: '#111',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Ver detalhes
            </button>
          </div>
        </InfoWindow>
      ) : null}
    </Map>
  );
}

function NearbyAcademiesGoogleMap({
  apiKey,
  coordenadasUsuario,
  academiasComCoordenadas,
  onAcademiaPress,
  onError,
}: {
  apiKey: string;
  coordenadasUsuario: Coordenadas;
  academiasComCoordenadas: AcademiaComCoordenadas[];
  onAcademiaPress?: (academiaId: string | number) => void;
  onError: () => void;
}) {
  return (
    <APIProvider
      apiKey={apiKey}
      language="pt-BR"
      region="BR"
      onError={onError}
    >
      <NearbyAcademiesGoogleMapContent
        coordenadasUsuario={coordenadasUsuario}
        academiasComCoordenadas={academiasComCoordenadas}
        onAcademiaPress={onAcademiaPress}
        onError={onError}
      />
    </APIProvider>
  );
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
  academiasComCoordenadas: AcademiaComCoordenadas[];
  pontosDoMapa: Coordenadas[];
  onAcademiaPress?: (academiaId: string | number) => void;
}) {
  const { L, MapContainer, Marker, Popup, TileLayer, useMap } = runtime;

  const userMarkerIcon = useMemo(
    () =>
      L.divIcon({
        className: 'user-location-marker',
        html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0Z" fill="#f97316"/><circle cx="15" cy="15" r="5" fill="#ffffff"/></svg>`,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
        popupAnchor: [0, -38],
      }),
    [L]
  );

  const academyMarkerIcon = useMemo(
    () =>
      L.divIcon({
        className: 'academy-location-marker',
        html: `<svg width="28" height="39" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0Z" fill="#343434"/><circle cx="15" cy="15" r="5" fill="#ffffff"/></svg>`,
        iconSize: [28, 39],
        iconAnchor: [14, 39],
        popupAnchor: [0, -35],
      }),
    [L]
  );

  function AjustarEnquadramento({ pontos }: { pontos: Coordenadas[] }) {
    const map = useMap();

    useEffect(() => {
      const frame = window.requestAnimationFrame(() => {
        const container = map.getContainer?.();

        if (!container || !container.isConnected) {
          return;
        }

        map.invalidateSize({ animate: false });

        if (pontos.length === 1) {
          map.setView(pontos[0], 16, { animate: false });
          return;
        }

        map.fitBounds(L.latLngBounds(pontos), {
          padding: [40, 40],
          maxZoom: 15,
          animate: false,
        });
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }, [map, pontos]);

    return null;
  }

  return (
    <MapContainer
      center={coordenadasUsuario}
      zoom={14}
      scrollWheelZoom={false}
      zoomAnimation={false}
      fadeAnimation={false}
      markerZoomAnimation={false}
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
                  minWidth: 170,
                  color: '#333',
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: 12,
                  lineHeight: 1.4,
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    color: '#151515',
                    fontSize: 14,
                  }}
                >
                  {academia.nome || 'Academia'}
                </strong>

                {distanciaFormatada ? (
                  <p style={{ margin: '5px 0' }}>{distanciaFormatada}</p>
                ) : null}

                {endereco ? <p style={{ margin: '5px 0' }}>{endereco}</p> : null}

                <button
                  type="button"
                  onClick={() => onAcademiaPress?.(academia.id)}
                  style={{
                    display: 'inline-block',
                    marginTop: 4,
                    padding: '6px 10px',
                    border: '1px solid #f97316',
                    borderRadius: 6,
                    backgroundColor: '#f97316',
                    color: '#111',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
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
  );
}

export default function NearbyAcademiesMap({
  userLatitude,
  userLongitude,
  academiasProximas,
  onAcademiaPress,
}: NearbyAcademiesMapProps) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';
  const googleDisponivel = Boolean(apiKey);

  const [providerAtivo, setProviderAtivo] = useState(() =>
    lerProviderDaSessao(googleDisponivel)
  );
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

  const academiasComCoordenadas = useMemo<AcademiaComCoordenadas[]>(() => {
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
        (item): item is AcademiaComCoordenadas =>
          Boolean(item.academia && item.coordenadas)
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

  const selecionarProvider = useCallback((provider: string) => {
    setProviderAtivo(provider);

    try {
      sessionStorage.setItem(MAP_PROVIDER_STORAGE_KEY, provider);
    } catch {
      // A indisponibilidade do sessionStorage não impede a troca na sessão atual.
    }
  }, []);

  const ativarFallbackLeaflet = useCallback(() => {
    selecionarProvider(LEAFLET_PROVIDER);
  }, [selecionarProvider]);

  if (!coordenadasUsuario) {
    return (
      <View
        style={{
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: '#fff8f3',
          borderWidth: 1,
          borderColor: '#f6c49f',
          borderRadius: 11,
        }}
      >
        <Text
          style={{
            color: '#7a3108',
            textAlign: 'center',
            fontSize: 13,
          }}
        >
          Atualize seu endereço no perfil para visualizar o mapa de academias próximas.
        </Text>
      </View>
    );
  }

  const usandoGoogle = providerAtivo === GOOGLE_PROVIDER && googleDisponivel;
  const textoDoBotao = usandoGoogle ? 'Usar mapa alternativo' : 'Usar Google Maps';

  return (
    <View style={{ width: '100%' }}>
      <View
        style={{
          width: '100%',
          height: 150,
          overflow: 'hidden',
          borderRadius: 13,
          borderWidth: 1,
          borderColor: '#e2e2e2',
          backgroundColor: '#f3f4f6',
        }}
      >
        {usandoGoogle ? (
          <NearbyAcademiesGoogleMap
            apiKey={apiKey}
            coordenadasUsuario={coordenadasUsuario}
            academiasComCoordenadas={academiasComCoordenadas}
            onAcademiaPress={onAcademiaPress}
            onError={ativarFallbackLeaflet}
          />
        ) : typeof window === 'undefined' || !runtime ? (
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#f3f4f6',
            }}
          />
        ) : (
          <MapaLeaflet
            runtime={runtime}
            coordenadasUsuario={coordenadasUsuario}
            academiasComCoordenadas={academiasComCoordenadas}
            pontosDoMapa={pontosDoMapa}
            onAcademiaPress={onAcademiaPress}
          />
        )}
      </View>

      <View
        style={{
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
        }}
      >
        <Text
          style={{
            color: '#777',
            fontSize: 11.5,
            fontWeight: '600',
          }}
        >
          {usandoGoogle ? 'Google Maps' : 'Mapa alternativo'}
        </Text>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            selecionarProvider(usandoGoogle ? LEAFLET_PROVIDER : GOOGLE_PROVIDER)
          }
          disabled={!usandoGoogle && !googleDisponivel}
          style={{
            paddingVertical: 5,
            paddingHorizontal: 9,
            borderWidth: 1,
            borderColor: '#e1b28f',
            borderRadius: 7,
            backgroundColor: '#fffaf7',
            opacity: !usandoGoogle && !googleDisponivel ? 0.6 : 1,
          }}
        >
          <Text
            style={{
              color: '#8c3906',
              fontSize: 11.5,
              fontWeight: '800',
            }}
          >
            {textoDoBotao}
          </Text>
        </TouchableOpacity>
      </View>

      {academiasComCoordenadas.length === 0 ? (
        <View
          style={{
            marginTop: 10,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderWidth: 1,
            borderColor: '#f6c49f',
            borderRadius: 11,
            backgroundColor: '#fff8f3',
          }}
        >
          <Text
            style={{
              color: '#7a3108',
              textAlign: 'center',
              fontSize: 13,
            }}
          >
            Nenhuma academia encontrada em até 5 km da sua localização.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
