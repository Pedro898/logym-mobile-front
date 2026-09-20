import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomTabBar from '../components/BottomTabBar';
import LogymBackground from '../components/LogymBackground';

import {
  buscarAcademiasAdmin,
  buscarAcademiasDoGerente,
  buscarAvaliacoesAdmin,
  buscarGerentePorUsuarioId,
  buscarGerentesAdmin,
  buscarUsuarioAutenticado,
  buscarUsuariosAdmin,
  formatarNomeUsuario,
  type Academia,
  type Avaliacao,
  type Gerente,
  type Usuario,
} from '@/lib/api';
import {
  ehAdmin,
  ehAdministrativo,
  ehGerente,
} from '@/lib/permissoes';

// ================================================================
// URL DO FRONTEND WEB
//
// O botão do Mobile abre SEMPRE a página de login do Web e envia o
// redirect do painel correto. O LoginPage atual já entende:
//
// /login?redirect=/painel-gerente
// /login?redirect=/painel-admin
//
// Assim a sessão do Mobile não é reutilizada indevidamente no Web.
// ================================================================

function buscarWebUrl() {
  if (process.env.EXPO_PUBLIC_WEB_URL) {
    return process.env.EXPO_PUBLIC_WEB_URL.replace(/\/$/, '');
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:5173';
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  const host = hostUri?.split(':')[0];

  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:5173`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5173';
  }

  return 'http://localhost:5173';
}

// ================================================================
// HELPERS
// ================================================================

function statusNormalizado(status?: string | null) {
  return String(status || '').trim().toUpperCase();
}

function calcularPercentual(quantidade: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((quantidade / total) * 100);
}

function localizacaoAcademia(academia: Academia) {
  return [academia.cidade, academia.estado]
    .filter(Boolean)
    .join(' - ');
}

// ================================================================
// CARD DE RESUMO
// ================================================================

function ResumoCard({
  numero,
  texto,
}: {
  numero: number;
  texto: string;
}) {
  return (
    <View
      style={{
        width: '48.5%',
        minHeight: 95,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#111',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14,
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#f97316',
          fontSize: 26,
          fontWeight: '900',
          marginBottom: 5,
        }}
      >
        {numero}
      </Text>

      <Text
        style={{
          color: '#444',
          fontSize: 12,
          lineHeight: 17,
          fontWeight: '600',
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

// ================================================================
// GRUPO DO DASHBOARD ADMIN
// ================================================================

function GrupoResumoAdmin({
  titulo,
  descricao,
  cards,
}: {
  titulo: string;
  descricao: string;
  cards: Array<{
    numero: number;
    texto: string;
  }>;
}) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#111',
        borderRadius: 18,
        padding: 15,
        marginBottom: 14,
      }}
    >
      <Text
        style={{
          color: '#111',
          fontSize: 17,
          fontWeight: '900',
          marginBottom: 4,
        }}
      >
        {titulo}
      </Text>

      <Text
        style={{
          color: '#666',
          fontSize: 12,
          lineHeight: 18,
          marginBottom: 13,
        }}
      >
        {descricao}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {cards.map((card) => (
          <ResumoCard
            key={`${titulo}-${card.texto}`}
            numero={card.numero}
            texto={card.texto}
          />
        ))}
      </View>
    </View>
  );
}

// ================================================================
// BARRA DE PROGRESSO DO GERENTE
// ================================================================

function ResumoStatusGerente({
  label,
  quantidade,
  total,
  cor,
}: {
  label: string;
  quantidade: number;
  total: number;
  cor: string;
}) {
  const percentual = calcularPercentual(quantidade, total);

  return (
    <View style={{ marginBottom: 15 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 7,
        }}
      >
        <Text
          style={{
            color: '#111',
            fontSize: 13,
            fontWeight: '800',
          }}
        >
          {label}
        </Text>

        <Text
          style={{
            color: '#666',
            fontSize: 12,
          }}
        >
          {quantidade} academia(s) • {percentual}%
        </Text>
      </View>

      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: '#242424',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${percentual}%`,
            height: '100%',
            backgroundColor: cor,
            borderRadius: 999,
          }}
        />
      </View>
    </View>
  );
}

// ================================================================
// STATUS DE ACADEMIA
// ================================================================

function StatusAcademia({ status }: { status?: string }) {
  const valor = statusNormalizado(status);

  const cor =
    valor === 'SUSPENSA'
      ? '#ef4444'
      : valor === 'INATIVO'
        ? '#9ca3af'
        : '#22c55e';

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: cor,
        marginTop: 8,
      }}
    >
      <Text
        style={{
          color: cor,
          fontSize: 10,
          fontWeight: '900',
        }}
      >
        {valor || 'SEM STATUS'}
      </Text>
    </View>
  );
}

// ================================================================
// BOTÃO PARA O WEB
// ================================================================

function BotaoPainelWeb({
  abrindo,
  onPress,
  tipo,
}: {
  abrindo: boolean;
  onPress: () => void;
  tipo: 'ADMIN' | 'MANAGER';
}) {
  return (
    <View
      style={{
        marginTop: 8,
        marginBottom: 8,
      }}
    >
      <View
        style={{
          backgroundColor: '#0a0a0a',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: '#222',
          padding: 16,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 9,
          }}
        >
          <Ionicons
            name="desktop-outline"
            size={21}
            color="#f97316"
          />

          <Text
            style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: '900',
              marginLeft: 8,
            }}
          >
            Administração completa no Web
          </Text>
        </View>

        <Text
          style={{
            color: '#aaa',
            fontSize: 13,
            lineHeight: 20,
          }}
        >
          Este painel Mobile é somente para consulta. Cadastros, edições e
          alterações de status continuam no painel Web do LOGYM.
        </Text>
      </View>

      <TouchableOpacity
        onPress={onPress}
        disabled={abrindo}
        activeOpacity={0.85}
        style={{
          backgroundColor: abrindo ? '#9a4d12' : '#f97316',
          borderRadius: 15,
          minHeight: 52,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {abrindo ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="open-outline" size={21} color="#000" />

            <Text
              style={{
                color: '#000',
                fontSize: 15,
                fontWeight: '900',
                marginLeft: 8,
              }}
            >
              Entrar no painel Web
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text
        style={{
          color: '#777',
          fontSize: 11,
          lineHeight: 17,
          textAlign: 'center',
          marginTop: 8,
        }}
      >
        O Web abrirá na tela de login e, após entrar como{' '}
        {tipo === 'ADMIN' ? 'administrador' : 'gerente'}, você será levado
        diretamente ao painel correspondente.
      </Text>
    </View>
  );
}

// ================================================================
// TELA PRINCIPAL
// ================================================================

export default function Painel() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [gerente, setGerente] = useState<Gerente | null>(null);

  const [academiasGerente, setAcademiasGerente] = useState<Academia[]>([]);

  const [usuariosAdmin, setUsuariosAdmin] = useState<Usuario[]>([]);
  const [academiasAdmin, setAcademiasAdmin] = useState<Academia[]>([]);
  const [gerentesAdmin, setGerentesAdmin] = useState<Gerente[]>([]);
  const [avaliacoesAdmin, setAvaliacoesAdmin] = useState<Avaliacao[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [mensagemPainel, setMensagemPainel] = useState('');
  const [abrindoWeb, setAbrindoWeb] = useState(false);

  // ==============================================================
  // CARREGAMENTO DO PAINEL
  // ==============================================================

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregarPainel() {
        try {
          setCarregando(true);
          setMensagemPainel('');

          const usuarioLogado = await buscarUsuarioAutenticado();

          if (!ativo) {
            return;
          }

          await AsyncStorage.setItem(
            'usuario',
            JSON.stringify(usuarioLogado)
          );

          if (!ehAdministrativo(usuarioLogado)) {
            setUsuario(usuarioLogado);
            router.replace('/academias');
            return;
          }

          setUsuario(usuarioLogado);

          // ========================================================
          // GERENTE
          //
          // Mesmo fluxo do painel Web:
          // 1. encontra o cadastro Gerente pelo usuarioId;
          // 2. carrega somente as academias daquele gerente.
          // ========================================================

          if (ehGerente(usuarioLogado)) {
            try {
              const gerenteEncontrado =
                await buscarGerentePorUsuarioId(usuarioLogado.id);

              if (!ativo) {
                return;
              }

              setGerente(gerenteEncontrado);

              if (!gerenteEncontrado?.id) {
                setAcademiasGerente([]);
                setMensagemPainel(
                  'Cadastro de gerente não encontrado. Finalize seu cadastro no Web antes de gerenciar academias.'
                );
                return;
              }

              const academias = await buscarAcademiasDoGerente(
                gerenteEncontrado.id
              );

              if (!ativo) {
                return;
              }

              setAcademiasGerente(
                Array.isArray(academias) ? academias : []
              );
            } catch (error) {
              console.error('Erro ao carregar painel do gerente:', error);

              if (ativo) {
                setGerente(null);
                setAcademiasGerente([]);
                setMensagemPainel(
                  'Não foi possível carregar os dados do painel do gerente.'
                );
              }
            }

            return;
          }

          // ========================================================
          // ADMIN
          //
          // O Web usa Promise.allSettled para que a falha de uma área
          // não derrube todo o dashboard. Repetimos essa ideia aqui.
          // ========================================================

          if (ehAdmin(usuarioLogado)) {
            const cargas = await Promise.allSettled([
              buscarUsuariosAdmin(),
              buscarAcademiasAdmin(),
              buscarGerentesAdmin(),
              buscarAvaliacoesAdmin(),
            ]);

            if (!ativo) {
              return;
            }

            const falhas: string[] = [];

            const [
              usuariosResultado,
              academiasResultado,
              gerentesResultado,
              avaliacoesResultado,
            ] = cargas;

            if (usuariosResultado.status === 'fulfilled') {
              setUsuariosAdmin(
                Array.isArray(usuariosResultado.value)
                  ? usuariosResultado.value
                  : []
              );
            } else {
              console.error(
                'Erro ao carregar usuários do painel:',
                usuariosResultado.reason
              );
              setUsuariosAdmin([]);
              falhas.push('usuários');
            }

            if (academiasResultado.status === 'fulfilled') {
              setAcademiasAdmin(
                Array.isArray(academiasResultado.value)
                  ? academiasResultado.value
                  : []
              );
            } else {
              console.error(
                'Erro ao carregar academias do painel:',
                academiasResultado.reason
              );
              setAcademiasAdmin([]);
              falhas.push('academias');
            }

            if (gerentesResultado.status === 'fulfilled') {
              setGerentesAdmin(
                Array.isArray(gerentesResultado.value)
                  ? gerentesResultado.value
                  : []
              );
            } else {
              console.error(
                'Erro ao carregar gerentes do painel:',
                gerentesResultado.reason
              );
              setGerentesAdmin([]);
              falhas.push('gerentes');
            }

            if (avaliacoesResultado.status === 'fulfilled') {
              setAvaliacoesAdmin(
                Array.isArray(avaliacoesResultado.value)
                  ? avaliacoesResultado.value
                  : []
              );
            } else {
              console.error(
                'Erro ao carregar avaliações do painel:',
                avaliacoesResultado.reason
              );
              setAvaliacoesAdmin([]);
              falhas.push('avaliações');
            }

            if (falhas.length > 0) {
              setMensagemPainel(
                `Não foi possível carregar alguns dados: ${falhas.join(', ')}.`
              );
            }
          }
        } catch (error) {
          console.error('Sessão inválida ao carregar painel:', error);

          await AsyncStorage.removeItem('usuario');

          if (ativo) {
            setUsuario(null);
            router.replace('/login');
          }
        } finally {
          if (ativo) {
            setCarregando(false);
          }
        }
      }

      carregarPainel();

      return () => {
        ativo = false;
      };
    }, [router])
  );

  // ==============================================================
  // RESUMO DO GERENTE
  // ==============================================================

  const resumoGerente = useMemo(() => {
    const ativas = academiasGerente.filter(
      (academia) => statusNormalizado(academia.statusAcademia) === 'ATIVO'
    );

    const inativas = academiasGerente.filter(
      (academia) => statusNormalizado(academia.statusAcademia) === 'INATIVO'
    );

    const suspensas = academiasGerente.filter(
      (academia) => statusNormalizado(academia.statusAcademia) === 'SUSPENSA'
    );

    return {
      total: academiasGerente.length,
      ativas: ativas.length,
      inativas: inativas.length,
      suspensas: suspensas.length,
      academiasAtencao: academiasGerente
        .filter((academia) => {
          const status = statusNormalizado(academia.statusAcademia);
          return status === 'INATIVO' || status === 'SUSPENSA';
        })
        .slice(0, 5),
    };
  }, [academiasGerente]);

  // ==============================================================
  // RESUMO DO ADMIN
  // ==============================================================

  const resumoAdmin = useMemo(() => {
    return {
      usuarios: usuariosAdmin.length,
      usuariosAtivos: usuariosAdmin.filter(
        (item) => statusNormalizado(item.statusUsuario) === 'ATIVO'
      ).length,
      usuariosInativos: usuariosAdmin.filter(
        (item) => statusNormalizado(item.statusUsuario) === 'INATIVO'
      ).length,
      usuariosSuspensos: usuariosAdmin.filter(
        (item) => statusNormalizado(item.statusUsuario) === 'SUSPENSO'
      ).length,

      admins: usuariosAdmin.filter(
        (item) => statusNormalizado(item.nivelAcesso) === 'ADMIN'
      ).length,
      managers: usuariosAdmin.filter(
        (item) => statusNormalizado(item.nivelAcesso) === 'MANAGER'
      ).length,
      users: usuariosAdmin.filter(
        (item) => statusNormalizado(item.nivelAcesso) === 'USER'
      ).length,
      gerentes: gerentesAdmin.length,

      academias: academiasAdmin.length,
      academiasAtivas: academiasAdmin.filter(
        (item) => statusNormalizado(item.statusAcademia) === 'ATIVO'
      ).length,
      academiasInativas: academiasAdmin.filter(
        (item) => statusNormalizado(item.statusAcademia) === 'INATIVO'
      ).length,
      academiasSuspensas: academiasAdmin.filter(
        (item) => statusNormalizado(item.statusAcademia) === 'SUSPENSA'
      ).length,

      avaliacoes: avaliacoesAdmin.length,
      avaliacoesAtivas: avaliacoesAdmin.filter(
        (item) => statusNormalizado(item.statusAvaliacao) === 'ATIVO'
      ).length,
      avaliacoesInativas: avaliacoesAdmin.filter(
        (item) => statusNormalizado(item.statusAvaliacao) === 'INATIVO'
      ).length,
      avaliacoesSuspensas: avaliacoesAdmin.filter(
        (item) => statusNormalizado(item.statusAvaliacao) === 'SUSPENSA'
      ).length,
    };
  }, [usuariosAdmin, academiasAdmin, gerentesAdmin, avaliacoesAdmin]);

  // ==============================================================
  // ABRIR LOGIN DO PAINEL WEB
  // ==============================================================

  async function abrirPainelWeb() {
    if (!usuario || !ehAdministrativo(usuario)) {
      return;
    }

    const rotaPainel = ehAdmin(usuario)
      ? '/painel-admin'
      : '/painel-gerente';

    const url = `${buscarWebUrl()}/login?redirect=${encodeURIComponent(
      rotaPainel
    )}`;

    try {
      setAbrindoWeb(true);

      const podeAbrir = await Linking.canOpenURL(url);

      if (!podeAbrir) {
        Alert.alert(
          'Não foi possível abrir o Web',
          `Confira se o Frontend Web do LOGYM está rodando em ${buscarWebUrl()}.`
        );
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Erro ao abrir login do painel Web:', error);

      Alert.alert(
        'Erro',
        'Não foi possível abrir o sistema Web. Verifique se o Frontend Web está iniciado.'
      );
    } finally {
      setAbrindoWeb(false);
    }
  }

  // ==============================================================
  // CARREGANDO
  // ==============================================================

  if (carregando || !usuario) {
    return (
      <LogymBackground>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
        <ActivityIndicator size="large" color="#f97316" />

        <Text
          style={{
            color: '#444',
            marginTop: 12,
            fontSize: 15,
          }}
        >
          Carregando painel...
        </Text>
        </View>
      </LogymBackground>
    );
  }

  const usuarioEhAdmin = ehAdmin(usuario);
  const usuarioEhGerente = ehGerente(usuario);
  const nomeUsuario = formatarNomeUsuario(usuario);

  return (
    <LogymBackground>
      <View
        style={{
          flex: 1,
          width: '100%',
          alignSelf: 'center',
        }}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 38,
          paddingHorizontal: 15,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================
            IDENTIFICAÇÃO
        ======================================================== */}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 22,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#fff7ed',
              borderWidth: 1,
              borderColor: '#f97316',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons
              name={
                usuarioEhAdmin
                  ? 'shield-checkmark-outline'
                  : 'briefcase-outline'
              }
              size={25}
              color="#f97316"
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: '#888',
                fontSize: 12,
                marginBottom: 2,
              }}
            >
              {usuarioEhAdmin ? 'Administrador' : 'Gerente'}
            </Text>

            <Text
              numberOfLines={1}
              style={{
                color: '#111',
                fontSize: 19,
                fontWeight: '900',
              }}
            >
              {nomeUsuario}
            </Text>
          </View>
        </View>

        <Text
          style={{
            color: '#111',
            fontSize: 27,
            fontWeight: '900',
            marginBottom: 5,
          }}
        >
          Dashboard
        </Text>

        <Text
          style={{
            color: '#666',
            fontSize: 14,
            lineHeight: 20,
            marginBottom: 18,
          }}
        >
          {usuarioEhGerente
            ? 'Acompanhe o resumo das suas academias cadastradas.'
            : 'Acompanhe os principais dados administrativos do LOGYM separados por área.'}
        </Text>

        {mensagemPainel ? (
          <View
            style={{
              backgroundColor: '#1a1008',
              borderWidth: 1,
              borderColor: '#f97316',
              borderRadius: 14,
              padding: 13,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: '#ffd7b5',
                fontSize: 13,
                lineHeight: 19,
              }}
            >
              {mensagemPainel}
            </Text>
          </View>
        ) : null}

        {/* ========================================================
            DASHBOARD DO GERENTE
        ======================================================== */}

        {usuarioEhGerente ? (
          <>
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#111',
                padding: 15,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  color: '#111',
                  fontSize: 18,
                  fontWeight: '900',
                  marginBottom: 13,
                }}
              >
                Visão geral
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <ResumoCard
                  numero={resumoGerente.total}
                  texto="Total de academias"
                />
                <ResumoCard
                  numero={resumoGerente.ativas}
                  texto="Academias ativas"
                />
                <ResumoCard
                  numero={resumoGerente.inativas}
                  texto="Academias inativas"
                />
                <ResumoCard
                  numero={resumoGerente.suspensas}
                  texto="Academias suspensas"
                />
              </View>
            </View>

            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#111',
                padding: 15,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  color: '#111',
                  fontSize: 17,
                  fontWeight: '900',
                  marginBottom: 15,
                }}
              >
                Resumo das suas academias
              </Text>

              <ResumoStatusGerente
                label="Ativas"
                quantidade={resumoGerente.ativas}
                total={resumoGerente.total}
                cor="#22c55e"
              />

              <ResumoStatusGerente
                label="Inativas"
                quantidade={resumoGerente.inativas}
                total={resumoGerente.total}
                cor="#9ca3af"
              />

              <ResumoStatusGerente
                label="Suspensas"
                quantidade={resumoGerente.suspensas}
                total={resumoGerente.total}
                cor="#ef4444"
              />
            </View>

            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#111',
                padding: 15,
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  color: '#111',
                  fontSize: 17,
                  fontWeight: '900',
                  marginBottom: 12,
                }}
              >
                Academias que precisam de atenção
              </Text>

              {resumoGerente.academiasAtencao.length === 0 ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#07130b',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#1f5130',
                    padding: 12,
                  }}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#22c55e"
                  />

                  <Text
                    style={{
                      color: '#b9e8c7',
                      fontSize: 13,
                      marginLeft: 8,
                      flex: 1,
                    }}
                  >
                    Todas as suas academias estão ativas no momento.
                  </Text>
                </View>
              ) : (
                resumoGerente.academiasAtencao.map((academia, index) => (
                  <View
                    key={String(academia.id)}
                    style={{
                      paddingVertical: 11,
                      borderBottomWidth:
                        index === resumoGerente.academiasAtencao.length - 1
                          ? 0
                          : 1,
                      borderBottomColor: '#eeeeee',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: '#111',
                        fontSize: 14,
                        fontWeight: '800',
                      }}
                    >
                      {academia.nome}
                    </Text>

                    {localizacaoAcademia(academia) ? (
                      <Text
                        numberOfLines={1}
                        style={{
                          color: '#666',
                          fontSize: 12,
                          marginTop: 3,
                        }}
                      >
                        {localizacaoAcademia(academia)}
                      </Text>
                    ) : null}

                    <StatusAcademia status={academia.statusAcademia} />
                  </View>
                ))
              )}
            </View>

            {gerente ? (
              <Text
                style={{
                  color: '#666',
                  fontSize: 11,
                  textAlign: 'center',
                  marginBottom: 8,
                }}
              >
                Painel em modo de consulta • Gerente: {gerente.nome || nomeUsuario}
              </Text>
            ) : null}
          </>
        ) : null}

        {/* ========================================================
            DASHBOARD DO ADMIN
        ======================================================== */}

        {usuarioEhAdmin ? (
          <>
            <GrupoResumoAdmin
              titulo="Usuários"
              descricao="Resumo das contas cadastradas no sistema."
              cards={[
                {
                  numero: resumoAdmin.usuarios,
                  texto: 'Total de usuários',
                },
                {
                  numero: resumoAdmin.usuariosAtivos,
                  texto: 'Usuários ativos',
                },
                {
                  numero: resumoAdmin.usuariosInativos,
                  texto: 'Usuários inativos',
                },
                {
                  numero: resumoAdmin.usuariosSuspensos,
                  texto: 'Usuários suspensos',
                },
              ]}
            />

            <GrupoResumoAdmin
              titulo="Academias"
              descricao="Situação das academias cadastradas na plataforma."
              cards={[
                {
                  numero: resumoAdmin.academias,
                  texto: 'Total de academias',
                },
                {
                  numero: resumoAdmin.academiasAtivas,
                  texto: 'Academias ativas',
                },
                {
                  numero: resumoAdmin.academiasInativas,
                  texto: 'Academias inativas',
                },
                {
                  numero: resumoAdmin.academiasSuspensas,
                  texto: 'Academias suspensas',
                },
              ]}
            />

            <GrupoResumoAdmin
              titulo="Avaliações"
              descricao="Controle das avaliações feitas pelos usuários."
              cards={[
                {
                  numero: resumoAdmin.avaliacoes,
                  texto: 'Total de avaliações',
                },
                {
                  numero: resumoAdmin.avaliacoesAtivas,
                  texto: 'Avaliações ativas',
                },
                {
                  numero: resumoAdmin.avaliacoesInativas,
                  texto: 'Avaliações inativas',
                },
                {
                  numero: resumoAdmin.avaliacoesSuspensas,
                  texto: 'Avaliações suspensas',
                },
              ]}
            />

            <GrupoResumoAdmin
              titulo="Administração"
              descricao="Contas administrativas e gerenciais do sistema."
              cards={[
                {
                  numero: resumoAdmin.admins,
                  texto: 'Administradores',
                },
                {
                  numero: resumoAdmin.managers,
                  texto: 'Contas gerente',
                },
                {
                  numero: resumoAdmin.gerentes,
                  texto: 'Gerentes completos',
                },
                {
                  numero: resumoAdmin.users,
                  texto: 'Usuários comuns',
                },
              ]}
            />
          </>
        ) : null}

        <BotaoPainelWeb
          abrindo={abrindoWeb}
          onPress={abrirPainelWeb}
          tipo={usuarioEhAdmin ? 'ADMIN' : 'MANAGER'}
        />
      </ScrollView>

      <BottomTabBar usuario={usuario} />
      </View>
    </LogymBackground>
  );
}
