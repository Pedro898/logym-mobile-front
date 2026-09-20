import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomTabBar from '../components/BottomTabBar';
import LogymBackground from '../components/LogymBackground';

import {
  alternarFavoritoNoBanco,
  buscarFavoritosDoUsuario,
  buscarPrimeiraFotoAcademia,
  buscarUsuarioAutenticado,
  getFotoAcademiaUrl,
  type Academia,
  type Usuario,
} from '@/lib/api';
import { ehUsuarioComum } from '@/lib/permissoes';

type AcademiaFavorita = Academia & {
  fotoUrl?: string | null;
};

// Pega a primeira letra do nome da academia.
// Essa letra aparece quando a academia não tem foto cadastrada.
function getInicialAcademia(nome?: string) {
  const nomeLimpo = String(nome || 'A').trim();

  if (!nomeLimpo) {
    return 'A';
  }

  return nomeLimpo.charAt(0).toUpperCase();
}

// Mesmo visual usado na Home:
// fundo degradê escuro/laranja,
// círculo branco,
// borda laranja,
// inicial preta no centro.
function AcademiaSemFoto({ nome }: { nome?: string }) {
  return (
    <LinearGradient
      colors={['#1a0700', '#f97316']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 132,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 66,
          height: 66,
          borderRadius: 33,
          backgroundColor: '#fff',
          borderWidth: 2,
          borderColor: '#f97316',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#000',
            fontSize: 34,
            fontWeight: '900',
          }}
        >
          {getInicialAcademia(nome)}
        </Text>
      </View>
    </LinearGradient>
  );
}

function formatarCepFavorito(cep?: string | number | null) {
  const numeros = String(cep || '').replace(/\D/g, '');
  return numeros.length === 8
    ? `${numeros.slice(0, 5)}-${numeros.slice(5)}`
    : String(cep || '');
}

export default function Favoritos() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [academiasFavoritas, setAcademiasFavoritas] = useState<AcademiaFavorita[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useFocusEffect(
    useCallback(() => {
      async function carregarFavoritos() {
        try {
          setCarregando(true);
          setErro('');

          let usuarioLogado: Usuario | null = null;

          try {
            usuarioLogado = await buscarUsuarioAutenticado();

            await AsyncStorage.setItem(
              'usuario',
              JSON.stringify(usuarioLogado)
            );

            setUsuario(usuarioLogado);

            // Favoritos são exclusivos de USER.
            // MANAGER/ADMIN são direcionados ao painel administrativo.
            if (!ehUsuarioComum(usuarioLogado)) {
              setAcademiasFavoritas([]);
              router.replace('/painel');
              return;
            }
          } catch (error) {
            console.error('Sessão inválida ou expirada:', error);

            await AsyncStorage.removeItem('usuario');
            setUsuario(null);
            setAcademiasFavoritas([]);
            router.replace('/login');
            return;
          }

          if (!usuarioLogado?.id) {
            setAcademiasFavoritas([]);
            setErro('Usuário não encontrado. Faça login novamente.');
            return;
          }

          // Busca as academias favoritas reais do banco.
          const academiasBanco = await buscarFavoritosDoUsuario(usuarioLogado.id);

          // Para cada academia favorita, tenta buscar a primeira foto cadastrada.
          // Se não tiver foto, fotoUrl fica null e mostramos o fallback com a inicial.
          const academiasComFotos = await Promise.all(
            academiasBanco.map(async (academia) => {
              try {
                const primeiraFoto = await buscarPrimeiraFotoAcademia(academia.id);

                return {
                  ...academia,
                  fotoUrl: primeiraFoto
                    ? getFotoAcademiaUrl(primeiraFoto.id)
                    : null,
                };
              } catch (error) {
                console.error(
                  `Erro ao buscar foto da academia favorita ${academia.id}:`,
                  error
                );

                return {
                  ...academia,
                  fotoUrl: null,
                };
              }
            })
          );

          setAcademiasFavoritas(academiasComFotos);
        } catch (error) {
          console.error(error);
          setErro('Erro ao carregar favoritos do banco.');
        } finally {
          setCarregando(false);
        }
      }

      carregarFavoritos();
    }, [])
  );

  async function removerFavorito(academiaId: string | number) {
    if (!usuario?.id || !ehUsuarioComum(usuario)) {
      return;
    }

    const idString = String(academiaId);
    const listaAnterior = academiasFavoritas;

    // Remove visualmente na hora.
    setAcademiasFavoritas((listaAtual) =>
      listaAtual.filter((academia) => String(academia.id) !== idString)
    );

    try {
      // Remove no banco usando a mesma rota de toggle.
      await alternarFavoritoNoBanco(usuario.id, academiaId);
    } catch (error) {
      console.error('Erro ao remover favorito do banco:', error);

      // Se der erro, volta a lista anterior.
      setAcademiasFavoritas(listaAnterior);
      setErro('Erro ao remover favorito do banco.');
    }
  }

  return (
    <LogymBackground>
      <View
        style={{
          flex: 1,
          width: '100%',
          alignSelf: 'center',
          paddingTop: 18,
          paddingHorizontal: 14,
          paddingBottom: 86,
        }}
      >
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.97)',
            borderWidth: 1,
            borderColor: '#d7d7d7',
            borderRadius: 20,
            padding: 16,
            marginBottom: 14,
            shadowColor: '#000',
            shadowOpacity: 0.10,
            shadowRadius: 10,
            elevation: 4,
          }}
        >
          <TouchableOpacity
            onPress={() => router.replace('/academias')}
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 13,
            }}
          >
            <Ionicons name="arrow-back" size={21} color="#f97316" />
            <Text style={{ color: '#111', fontWeight: '800', marginLeft: 5 }}>
              Voltar
            </Text>
          </TouchableOpacity>

          <Text
            style={{
              color: '#000',
              fontSize: 26,
              fontWeight: '900',
              letterSpacing: 0.7,
            }}
          >
            ACADEMIAS FAVORITAS
          </Text>
          <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
            Suas escolhas favoritas reunidas em um só lugar.
          </Text>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: '#fff7ed',
              borderWidth: 1,
              borderColor: '#fed7aa',
              borderRadius: 999,
              paddingVertical: 5,
              paddingHorizontal: 10,
              marginTop: 10,
            }}
          >
            <Text style={{ color: '#9a3412', fontSize: 12, fontWeight: '900' }}>
              {academiasFavoritas.length} favorita(s)
            </Text>
          </View>
        </View>

        {carregando ? (
          <View
            style={{
              marginTop: 20,
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: '#ddd',
            }}
          >
            <ActivityIndicator color="#f97316" />
            <Text style={{ color: '#333', textAlign: 'center', marginTop: 10 }}>
              Carregando favoritos do banco...
            </Text>
          </View>
        ) : erro ? (
          <View
            style={{
              backgroundColor: '#fff1f2',
              borderWidth: 1,
              borderColor: '#fecdd3',
              borderRadius: 14,
              padding: 15,
            }}
          >
            <Text style={{ color: '#9f1239', fontSize: 14 }}>{erro}</Text>
          </View>
        ) : academiasFavoritas.length === 0 ? (
          <View
            style={{
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 18,
              padding: 26,
              alignItems: 'center',
            }}
          >
            <Ionicons name="star-outline" size={40} color="#f97316" />
            <Text
              style={{
                color: '#111',
                fontWeight: '900',
                fontSize: 16,
                marginTop: 10,
                textAlign: 'center',
              }}
            >
              SUA LISTA DE FAVORITOS ESTÁ VAZIA
            </Text>
            <Text style={{ color: '#666', fontSize: 13, marginTop: 5, textAlign: 'center' }}>
              Explore a busca e toque na estrela para guardar suas preferidas.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace('/academias')}
              style={{
                backgroundColor: '#000',
                borderRadius: 9,
                paddingVertical: 11,
                paddingHorizontal: 18,
                marginTop: 16,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>
                Explorar academias
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={academiasFavoritas}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 18 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/detalhes',
                    params: { id: String(item.id) },
                  })
                }
                activeOpacity={0.88}
                style={{
                  flexDirection: 'row',
                  height: 132,
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  marginBottom: 12,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: '#d7d7d7',
                  shadowColor: '#000',
                  shadowOpacity: 0.10,
                  shadowRadius: 7,
                  elevation: 4,
                }}
              >
                {item.fotoUrl ? (
                  <Image
                    source={{ uri: item.fotoUrl }}
                    style={{ width: 132, height: '100%', backgroundColor: '#f3f4f6' }}
                    resizeMode="cover"
                  />
                ) : (
                  <AcademiaSemFoto nome={item.nome} />
                )}

                <View style={{ flex: 1, padding: 9, justifyContent: 'space-between' }}>
                  <View>
                    <Text
                      numberOfLines={1}
                      style={{ color: '#000', fontSize: 15, fontWeight: '900' }}
                    >
                      {item.nome}
                    </Text>
                    <Text numberOfLines={1} style={{ color: '#555', fontSize: 11, marginTop: 3 }}>
                      {item.endereco}{item.numero ? `, ${item.numero}` : ''}
                    </Text>
                    <Text numberOfLines={1} style={{ color: '#666', fontSize: 11 }}>
                      {item.bairro ? `${item.bairro} - ` : ''}{item.cidade}
                      {item.estado ? `, ${item.estado}` : ''}
                    </Text>
                    <Text style={{ color: '#ea580c', fontSize: 10, marginTop: 4 }}>
                      CEP: {formatarCepFavorito(item.cep)}
                    </Text>
                    <Text style={{ color: '#111', fontSize: 11, fontWeight: '800', marginTop: 3 }}>
                      {item.nota !== null && item.nota !== undefined
                        ? `${Number(item.nota).toFixed(1)} ⭐`
                        : 'Sem avaliações'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={(event) => {
                      event.stopPropagation();
                      removerFavorito(item.id);
                    }}
                    style={{
                      alignSelf: 'flex-end',
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#fff7ed',
                      borderRadius: 999,
                      paddingVertical: 5,
                      paddingHorizontal: 8,
                    }}
                  >
                    <Ionicons name="star" size={15} color="#f59e0b" />
                    <Text style={{ color: '#9a3412', fontSize: 10, fontWeight: '900', marginLeft: 4 }}>
                      Remover
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        <BottomTabBar usuario={usuario} />
      </View>
    </LogymBackground>
  );
}
