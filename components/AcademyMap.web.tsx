import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import {
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';

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
};

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

function criarIconeAcademiaGoogle() {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      '<svg width="28" height="39" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 27 15 27s15-15.75 15-27C30 6.716 23.284 0 15 0Z" fill="#343434"/><circle cx="15" cy="15" r="5" fill="#ffffff"/></svg>'
    )}`,
    scaledSize: { width: 28, height: 39 },
    anchor: { x: 14, y: 39 },
  };
}

const academyMarkerIconGoogle = criarIconeAcademiaGoogle();

function AcademyGoogleMapContent({
  coordenadas,
  nome,
  endereco,
  onError,
}: {
  coordenadas: Coordenadas;
  nome?: string;
  endereco?: string;
  onError: () => void;
}) {
  const [infoAberta, setInfoAberta] = useState(false);
  const statusDaApi = useApiLoadingStatus();

  useEffect(() => {
    if (statusDaApi === 'FAILED' || statusDaApi === 'AUTH_FAILURE') {
      onError();
    }
  }, [onError, statusDaApi]);

  return (
    <Map
      defaultCenter={{ lat: coordenadas[0], lng: coordenadas[1] }}
      defaultZoom={16}
      gestureHandling="greedy"
      disableDefaultUI={false}
      streetViewControl={false}
      mapTypeControl={false}
      style={{ width: '100%', height: '100%' }}
      onClick={() => setInfoAberta(false)}
    >
      <Marker
        position={{ lat: coordenadas[0], lng: coordenadas[1] }}
        icon={academyMarkerIconGoogle as any}
        title={nome || 'Academia'}
        onClick={() => setInfoAberta(true)}
      />

      {infoAberta ? (
        <InfoWindow
          position={{ lat: coordenadas[0], lng: coordenadas[1] }}
          onClose={() => setInfoAberta(false)}
          shouldFocus={false}
        >
          <div
            style={{
              minWidth: 160,
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
              {nome || 'Academia'}
            </strong>

            {endereco ? <p style={{ margin: '5px 0' }}>{endereco}</p> : null}
          </div>
        </InfoWindow>
      ) : null}
    </Map>
  );
}

function AcademyGoogleMap({
  apiKey,
  coordenadas,
  nome,
  endereco,
  onError,
}: {
  apiKey: string;
  coordenadas: Coordenadas;
  nome?: string;
  endereco?: string;
  onError: () => void;
}) {
  return (
    <APIProvider
      apiKey={apiKey}
      language="pt-BR"
      region="BR"
      onError={onError}
    >
      <AcademyGoogleMapContent
        coordenadas={coordenadas}
        nome={nome}
        endereco={endereco}
        onError={onError}
      />
    </APIProvider>
  );
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
  const { L, MapContainer, Marker, Popup, TileLayer } = runtime;

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

  return (
    <MapContainer
      center={coordenadas}
      zoom={16}
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

      <Marker position={coordenadas} icon={academyMarkerIcon}>
        <Popup>
          <div
            style={{
              minWidth: 160,
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
              {nome || 'Academia'}
            </strong>

            {endereco ? <p style={{ margin: '5px 0' }}>{endereco}</p> : null}
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}

export default function AcademyMap({
  latitude,
  longitude,
  nome,
  endereco,
}: AcademyMapProps) {
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
        });
      })
      .catch((error) => {
        console.error('Erro ao carregar o mapa alternativo da academia:', error);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const coordenadas = useMemo(
    () => getCoordenadasValidas(latitude, longitude),
    [latitude, longitude]
  );

  const selecionarProvider = useCallback((provider: string) => {
    setProviderAtivo(provider);

    try {
      sessionStorage.setItem(MAP_PROVIDER_STORAGE_KEY, provider);
    } catch {
      // Se o navegador bloquear sessionStorage, a troca ainda funciona na tela atual.
    }
  }, []);

  const ativarFallbackLeaflet = useCallback(() => {
    selecionarProvider(LEAFLET_PROVIDER);
  }, [selecionarProvider]);

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

  const usandoGoogle = providerAtivo === GOOGLE_PROVIDER && googleDisponivel;
  const textoProvider = usandoGoogle ? 'Google Maps' : 'Mapa alternativo';
  const textoBotao = usandoGoogle ? 'Usar mapa alternativo' : 'Usar Google Maps';

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${coordenadas[0]},${coordenadas[1]}`;

  async function abrirComoChegar() {
    try {
      await Linking.openURL(directionsUrl);
    } catch (error) {
      console.error('Não foi possível abrir o Google Maps:', error);
    }
  }

  return (
    <View style={{ width: '100%' }}>
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
        {usandoGoogle ? (
          <AcademyGoogleMap
            apiKey={apiKey}
            coordenadas={coordenadas}
            nome={nome}
            endereco={endereco}
            onError={ativarFallbackLeaflet}
          />
        ) : typeof window === 'undefined' || !runtime ? (
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#f3f4f6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#666', fontSize: 14 }}>Carregando mapa...</Text>
          </View>
        ) : (
          <MapaLeaflet
            runtime={runtime}
            coordenadas={coordenadas}
            nome={nome}
            endereco={endereco}
          />
        )}
      </View>

      <View
        style={{
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={abrirComoChegar}
          style={{
            paddingVertical: 7,
            paddingHorizontal: 11,
            borderRadius: 7,
            backgroundColor: '#f97316',
            borderWidth: 1,
            borderColor: '#f97316',
          }}
        >
          <Text
            style={{
              color: '#111',
              fontSize: 12,
              fontWeight: '900',
            }}
          >
            Como chegar
          </Text>
        </TouchableOpacity>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            flexShrink: 1,
          }}
        >
          <Text
            style={{
              color: '#777',
              fontSize: 11.5,
              fontWeight: '600',
            }}
          >
            {textoProvider}
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
              {textoBotao}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
