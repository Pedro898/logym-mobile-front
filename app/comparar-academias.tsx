import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomTabBar from '@/components/BottomTabBar';
import LogymBackground from '@/components/LogymBackground';

import {
  buscarComparacaoAcademias,
  buscarUsuarioAutenticado,
  getFotoPrincipalAcademiaUrl,
  type AcademiaComparacao,
  type Usuario,
} from '@/lib/api';

import {
  buscarAcademiasSelecionadasComparacao,
  removerAcademiaDaComparacao,
  type AcademiaSelecionadaComparacao,
} from '@/lib/comparacao';

import { ehUsuarioComum } from '@/lib/permissoes';

type LinhaComparacao = {
  chave: string;
  nome: string;
};

function formatarNumero(
  valor: unknown,
  casas = 1
) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return '—';
  }

  return new Intl.NumberFormat(
    'pt-BR',
    {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }
  ).format(numero);
}

function formatarDistancia(
  distanciaKm: unknown
) {
  if (
    distanciaKm === null ||
    distanciaKm === undefined ||
    !Number.isFinite(
      Number(distanciaKm)
    )
  ) {
    return '—';
  }

  return `${new Intl.NumberFormat(
    'pt-BR',
    {
      maximumFractionDigits: 2,
    }
  ).format(
    Number(distanciaKm)
  )} km`;
}

function montarEndereco(
  academia: AcademiaComparacao
) {
  const linha1 = [
    academia.endereco,
    academia.numero,
  ]
    .filter(
      (valor) =>
        valor !== null &&
        valor !== undefined &&
        String(valor).trim()
    )
    .join(', ');

  const linha2 = [
    academia.bairro,
    academia.cidade,
    academia.estado,
  ]
    .filter(
      (valor) =>
        valor !== null &&
        valor !== undefined &&
        String(valor).trim()
    )
    .join(' - ');

  return (
    [
      linha1,
      linha2,
    ]
      .filter(Boolean)
      .join(', ') ||
    'Endereço não informado'
  );
}

function criarLinhas(
  academias: AcademiaComparacao[],
  propriedade:
    | 'criterios'
    | 'categorias'
    | 'facilidades'
) {
  const itens =
    new Map<
      string,
      LinhaComparacao
    >();

  academias.forEach(
    (academia) => {
      const valores =
        Array.isArray(
          academia[
            propriedade
          ]
        )
          ? academia[
              propriedade
            ]!
          : [];

      valores.forEach(
        (item) => {
          const nome =
            item?.nome?.trim();

          if (!nome) {
            return;
          }

          const chave =
            String(
              item.id ??
                nome
            );

          itens.set(
            chave,
            {
              chave,
              nome,
            }
          );
        }
      );
    }
  );

  return [
    ...itens.values(),
  ];
}

function academiaPossuiItem(
  academia:
    AcademiaComparacao,
  propriedade:
    | 'categorias'
    | 'facilidades',
  chave: string
) {
  const itens =
    Array.isArray(
      academia[
        propriedade
      ]
    )
      ? academia[
          propriedade
        ]!
      : [];

  return itens.some(
    (item) =>
      String(
        item.id ??
          item.nome
      ) === chave
  );
}

function AcademiaSemFoto({
  nome,
}: {
  nome?: string;
}) {
  return (
    <LinearGradient
      colors={[
        '#1a0700',
        '#f97316',
      ]}
      start={{
        x: 0,
        y: 0,
      }}
      end={{
        x: 1,
        y: 1,
      }}
      style={{
        width: '100%',
        height: 145,
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
            fontSize: 32,
            fontWeight: '900',
          }}
        >
          {nome
            ?.trim()
            ?.charAt(0)
            ?.toUpperCase() ||
            'A'}
        </Text>
      </View>
    </LinearGradient>
  );
}

function Valor({
  texto,
  destaque = false,
}: {
  texto: string;
  destaque?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor:
          destaque
            ? '#dcfce7'
            : '#f7f7f7',
        borderWidth: 1,
        borderColor:
          destaque
            ? '#86efac'
            : '#e5e5e5',
        borderRadius: 8,
        paddingVertical: 7,
        paddingHorizontal: 9,
      }}
    >
      <Text
        style={{
          color:
            destaque
              ? '#166534'
              : '#222',
          fontSize: 12,
          fontWeight:
            destaque
              ? '900'
              : '700',
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

export default function CompararAcademias() {
  const router =
    useRouter();

  const [
    usuario,
    setUsuario,
  ] =
    useState<Usuario | null>(
      null
    );

  const [
    selecionadas,
    setSelecionadas,
  ] = useState<
    AcademiaSelecionadaComparacao[]
  >([]);

  const [
    academias,
    setAcademias,
  ] = useState<
    AcademiaComparacao[]
  >([]);

  const [
    carregandoEstado,
    setCarregandoEstado,
  ] = useState(true);

  const [
    carregandoComparacao,
    setCarregandoComparacao,
  ] = useState(false);

  const [
    mensagem,
    setMensagem,
  ] = useState('');

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregarEstado() {
        try {
          setCarregandoEstado(
            true
          );

          const [
            usuarioBanco,
            academiasSelecionadas,
          ] =
            await Promise.all(
              [
                buscarUsuarioAutenticado(),
                buscarAcademiasSelecionadasComparacao(),
              ]
            );

          if (!ativo) {
            return;
          }

          await AsyncStorage.setItem(
            'usuario',
            JSON.stringify(
              usuarioBanco
            )
          );

          setUsuario(
            usuarioBanco
          );

          setSelecionadas(
            academiasSelecionadas
          );
        } catch (error) {
          console.error(
            'Erro ao preparar comparação:',
            error
          );

          if (!ativo) {
            return;
          }

          await AsyncStorage.removeItem(
            'usuario'
          );

          router.replace(
            '/login'
          );
        } finally {
          if (ativo) {
            setCarregandoEstado(
              false
            );
          }
        }
      }

      carregarEstado();

      return () => {
        ativo = false;
      };
    }, [router])
  );

  const idsSelecionados =
    useMemo(
      () =>
        selecionadas.map(
          (academia) =>
            academia.id
        ),
      [selecionadas]
    );

  const idsChave =
    idsSelecionados
      .map(String)
      .join(',');

  useEffect(() => {
    let ativo = true;

    async function carregarComparacao() {
      if (
        carregandoEstado ||
        !ehUsuarioComum(
          usuario
        ) ||
        idsSelecionados.length <
          2
      ) {
        setAcademias([]);
        setCarregandoComparacao(
          false
        );
        return;
      }

      try {
        setCarregandoComparacao(
          true
        );
        setMensagem('');

        const resposta =
          await buscarComparacaoAcademias(
            idsSelecionados
          );

        const recebidas =
          Array.isArray(
            resposta
          )
            ? resposta
            : [];

        const porId =
          new Map(
            recebidas.map(
              (academia) => [
                String(
                  academia.id
                ),
                academia,
              ]
            )
          );

        const ordenadas =
          idsSelecionados
            .map(
              (id) =>
                porId.get(
                  String(id)
                )
            )
            .filter(
              (
                academia
              ): academia is AcademiaComparacao =>
                Boolean(
                  academia
                )
            );

        if (!ativo) {
          return;
        }

        setAcademias(
          ordenadas
        );

        if (
          ordenadas.length ===
          0
        ) {
          setMensagem(
            'Nenhuma academia selecionada está disponível para comparação.'
          );
        }
      } catch (error) {
        console.error(
          'Erro ao carregar comparação:',
          error
        );

        if (!ativo) {
          return;
        }

        setAcademias([]);

        setMensagem(
          error instanceof
              Error &&
            error.message
            ? error.message
            : 'Não foi possível carregar a comparação.'
        );
      } finally {
        if (ativo) {
          setCarregandoComparacao(
            false
          );
        }
      }
    }

    carregarComparacao();

    return () => {
      ativo = false;
    };
  }, [
    carregandoEstado,
    idsChave,
    usuario?.nivelAcesso,
  ]);

  const criterios =
    useMemo(
      () =>
        criarLinhas(
          academias,
          'criterios'
        ),
      [academias]
    );

  const categorias =
    useMemo(
      () =>
        criarLinhas(
          academias,
          'categorias'
        ),
      [academias]
    );

  const facilidades =
    useMemo(
      () =>
        criarLinhas(
          academias,
          'facilidades'
        ),
      [academias]
    );

  const maiorNota =
    useMemo(() => {
      const notas =
        academias
          .map(
            (academia) =>
              academia.nota
          )
          .filter(
            (nota) =>
              nota !== null &&
              nota !== undefined &&
              Number.isFinite(
                Number(nota)
              )
          )
          .map(Number);

      return notas.length >
        0
        ? Math.max(
            ...notas
          )
        : null;
    }, [academias]);

  const menorDistancia =
    useMemo(() => {
      const distancias =
        academias
          .map(
            (academia) =>
              academia.distanciaKm
          )
          .filter(
            (distancia) =>
              distancia !==
                null &&
              distancia !==
                undefined &&
              Number.isFinite(
                Number(
                  distancia
                )
              )
          )
          .map(Number);

      return distancias.length >
        0
        ? Math.min(
            ...distancias
          )
        : null;
    }, [academias]);

  function encontrarCriterio(
    academia:
      AcademiaComparacao,
    chave: string
  ) {
    return (
      academia.criterios ||
      []
    ).find(
      (criterio) =>
        String(
          criterio.id ??
            criterio.nome
        ) === chave
    );
  }

  function maiorMediaDoCriterio(
    chave: string
  ) {
    const medias =
      academias
        .map(
          (academia) =>
            encontrarCriterio(
              academia,
              chave
            )?.media
        )
        .filter(
          (media) =>
            media !== null &&
            media !== undefined &&
            Number.isFinite(
              Number(media)
            )
        )
        .map(Number);

    return medias.length >
      0
      ? Math.max(
          ...medias
        )
      : null;
  }

  async function removerAcademia(
    academiaId:
      | string
      | number
  ) {
    const atualizadas =
      await removerAcademiaDaComparacao(
        academiaId
      );

    setSelecionadas(
      atualizadas
    );
  }

  const cardSecao = {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 3,
  };

  if (carregandoEstado) {
    return (
      <LogymBackground>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <ActivityIndicator
            color="#f97316"
          />
          <Text
            style={{
              color: '#333',
              marginTop: 10,
              fontWeight: '700',
            }}
          >
            Preparando comparação...
          </Text>
        </View>
      </LogymBackground>
    );
  }

  if (
    !ehUsuarioComum(
      usuario
    )
  ) {
    return (
      <LogymBackground>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              ...cardSecao,
              width: '100%',
              maxWidth: 420,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#000',
                fontSize: 23,
                fontWeight: '900',
                textAlign: 'center',
              }}
            >
              Comparação de academias
            </Text>

            <Text
              style={{
                color: '#666',
                marginTop: 10,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              Esta funcionalidade está disponível apenas para usuários comuns.
            </Text>
          </View>

          <BottomTabBar
            usuario={usuario}
          />
        </View>
      </LogymBackground>
    );
  }

  return (
    <LogymBackground>
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          alignSelf: 'center',
        }}
        contentContainerStyle={{
          paddingTop: 14,
          paddingHorizontal: 14,
          paddingBottom: 110,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() =>
            router.replace(
              '/academias'
            )
          }
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#000',
            borderRadius: 7,
            paddingVertical: 9,
            paddingHorizontal: 12,
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              color: '#fff',
              fontSize: 12,
              fontWeight: '900',
            }}
          >
            ← Voltar para academias
          </Text>
        </TouchableOpacity>

        <View
          style={{
            ...cardSecao,
            borderTopWidth: 4,
            borderTopColor: '#f97316',
          }}
        >
          <Text
            style={{
              color: '#000',
              fontSize: 27,
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Comparar academias
          </Text>

          <Text
            style={{
              color: '#666',
              marginTop: 5,
              lineHeight: 20,
              fontSize: 13,
            }}
          >
            Compare nota, distância, categorias, facilidades e avaliações por critério.
          </Text>
        </View>

        {selecionadas.length <
        2 ? (
          <View
            style={cardSecao}
          >
            <Text
              style={{
                color: '#111',
                fontSize: 16,
                fontWeight: '900',
                textAlign: 'center',
              }}
            >
              Selecione pelo menos 2 academias.
            </Text>
            <Text
              style={{
                color: '#666',
                fontSize: 13,
                lineHeight: 19,
                textAlign: 'center',
                marginTop: 6,
              }}
            >
              Você pode comparar até 3 academias ao mesmo tempo.
            </Text>
          </View>
        ) : carregandoComparacao ? (
          <View
            style={{
              ...cardSecao,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator
              color="#f97316"
            />
            <Text
              style={{
                color: '#333',
                marginTop: 10,
              }}
            >
              Carregando comparação...
            </Text>
          </View>
        ) : mensagem ? (
          <View
            style={{
              ...cardSecao,
              backgroundColor: '#fff1f2',
              borderColor: '#fecdd3',
            }}
          >
            <Text
              style={{
                color: '#9f1239',
                textAlign: 'center',
              }}
            >
              {mensagem}
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 10,
                paddingBottom: 14,
              }}
            >
              {academias.map(
                (academia) => {
                  const notaValida =
                    academia.nota !==
                      null &&
                    academia.nota !==
                      undefined &&
                    Number.isFinite(
                      Number(
                        academia.nota
                      )
                    );

                  const distanciaValida =
                    academia.distanciaKm !==
                      null &&
                    academia.distanciaKm !==
                      undefined &&
                    Number.isFinite(
                      Number(
                        academia.distanciaKm
                      )
                    );

                  const notaEmDestaque =
                    notaValida &&
                    maiorNota !==
                      null &&
                    Number(
                      academia.nota
                    ) ===
                      maiorNota;

                  const distanciaEmDestaque =
                    distanciaValida &&
                    menorDistancia !==
                      null &&
                    Number(
                      academia.distanciaKm
                    ) ===
                      menorDistancia;

                  const fotoUrl =
                    getFotoPrincipalAcademiaUrl(
                      academia.fotoPrincipal
                    );

                  return (
                    <View
                      key={String(
                        academia.id
                      )}
                      style={{
                        width: 265,
                        overflow: 'hidden',
                        backgroundColor: '#fff',
                        borderWidth: 1,
                        borderColor: '#e2e2e2',
                        borderRadius: 16,
                        shadowColor: '#000',
                        shadowOpacity: 0.06,
                        shadowRadius: 8,
                        elevation: 3,
                      }}
                    >
                      {fotoUrl ? (
                        <Image
                          source={{
                            uri: fotoUrl,
                          }}
                          style={{
                            width: '100%',
                            height: 145,
                            backgroundColor: '#eee',
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <AcademiaSemFoto
                          nome={
                            academia.nome
                          }
                        />
                      )}

                      <View
                        style={{
                          padding: 13,
                        }}
                      >
                        <Text
                          style={{
                            color: '#000',
                            fontSize: 19,
                            fontWeight: '900',
                            marginBottom: 10,
                          }}
                        >
                          {academia.nome}
                        </Text>

                        <Text
                          style={{
                            color: '#777',
                            fontSize: 11,
                            fontWeight: '800',
                            marginBottom: 4,
                          }}
                        >
                          NOTA
                        </Text>

                        <Valor
                          destaque={
                            notaEmDestaque
                          }
                          texto={
                            notaValida
                              ? `${formatarNumero(
                                  academia.nota
                                )} ⭐`
                              : 'Sem avaliações'
                          }
                        />

                        <Text
                          style={{
                            color: '#777',
                            fontSize: 11,
                            fontWeight: '800',
                            marginTop: 9,
                            marginBottom: 4,
                          }}
                        >
                          DISTÂNCIA
                        </Text>

                        <Valor
                          destaque={
                            distanciaEmDestaque
                          }
                          texto={
                            formatarDistancia(
                              academia.distanciaKm
                            )
                          }
                        />

                        <Text
                          style={{
                            color: '#777',
                            fontSize: 11,
                            fontWeight: '800',
                            marginTop: 9,
                            marginBottom: 4,
                          }}
                        >
                          LOCALIZAÇÃO
                        </Text>

                        <Text
                          style={{
                            color: '#333',
                            fontSize: 12,
                            lineHeight: 18,
                          }}
                        >
                          {montarEndereco(
                            academia
                          )}
                        </Text>

                        <View
                          style={{
                            flexDirection: 'row',
                            gap: 7,
                            marginTop: 12,
                          }}
                        >
                          <TouchableOpacity
                            onPress={() =>
                              router.push({
                                pathname:
                                  '/detalhes',
                                params: {
                                  id: String(
                                    academia.id
                                  ),
                                },
                              })
                            }
                            style={{
                              flex: 1,
                              backgroundColor: '#000',
                              borderRadius: 7,
                              paddingVertical: 9,
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={{
                                color: '#fff',
                                fontSize: 11,
                                fontWeight: '900',
                              }}
                            >
                              Ver academia
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() =>
                              removerAcademia(
                                academia.id
                              )
                            }
                            style={{
                              flex: 1,
                              backgroundColor: '#fff',
                              borderWidth: 1,
                              borderColor: '#f97316',
                              borderRadius: 7,
                              paddingVertical: 9,
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={{
                                color: '#000',
                                fontSize: 11,
                                fontWeight: '900',
                              }}
                            >
                              Remover
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                }
              )}
            </ScrollView>

            <View
              style={cardSecao}
            >
              <Text
                style={{
                  color: '#000',
                  fontSize: 20,
                  fontWeight: '900',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                }}
              >
                Avaliações por critério
              </Text>

              {criterios.length ===
              0 ? (
                <Text
                  style={{
                    color: '#666',
                  }}
                >
                  Nenhuma informação disponível.
                </Text>
              ) : (
                criterios.map(
                  (linha) => {
                    const maiorMedia =
                      maiorMediaDoCriterio(
                        linha.chave
                      );

                    return (
                      <View
                        key={
                          linha.chave
                        }
                        style={{
                          paddingVertical: 10,
                          borderTopWidth: 1,
                          borderTopColor: '#ededed',
                        }}
                      >
                        <Text
                          style={{
                            color: '#111',
                            fontWeight: '900',
                            marginBottom: 8,
                          }}
                        >
                          {linha.nome}
                        </Text>

                        <View
                          style={{
                            gap: 6,
                          }}
                        >
                          {academias.map(
                            (
                              academia
                            ) => {
                              const criterio =
                                encontrarCriterio(
                                  academia,
                                  linha.chave
                                );

                              const mediaValida =
                                criterio?.media !==
                                  null &&
                                criterio?.media !==
                                  undefined &&
                                Number.isFinite(
                                  Number(
                                    criterio.media
                                  )
                                );

                              const destaque =
                                mediaValida &&
                                maiorMedia !==
                                  null &&
                                Number(
                                  criterio.media
                                ) ===
                                  maiorMedia;

                              return (
                                <View
                                  key={String(
                                    academia.id
                                  )}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                  }}
                                >
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      flex: 1,
                                      color: '#555',
                                      fontSize: 12,
                                      fontWeight: '700',
                                    }}
                                  >
                                    {academia.nome}
                                  </Text>

                                  <Valor
                                    destaque={
                                      destaque
                                    }
                                    texto={
                                      mediaValida
                                        ? formatarNumero(
                                            criterio.media
                                          )
                                        : '—'
                                    }
                                  />
                                </View>
                              );
                            }
                          )}
                        </View>
                      </View>
                    );
                  }
                )
              )}
            </View>

            {[
              {
                titulo:
                  'Categorias e modalidades',
                linhas:
                  categorias,
                propriedade:
                  'categorias' as const,
              },
              {
                titulo:
                  'Facilidades',
                linhas:
                  facilidades,
                propriedade:
                  'facilidades' as const,
              },
            ].map(
              (secao) => (
                <View
                  key={
                    secao.titulo
                  }
                  style={
                    cardSecao
                  }
                >
                  <Text
                    style={{
                      color: '#000',
                      fontSize: 20,
                      fontWeight: '900',
                      marginBottom: 12,
                      textTransform: 'uppercase',
                    }}
                  >
                    {secao.titulo}
                  </Text>

                  {secao.linhas.length ===
                  0 ? (
                    <Text
                      style={{
                        color: '#666',
                      }}
                    >
                      Nenhuma informação disponível.
                    </Text>
                  ) : (
                    secao.linhas.map(
                      (linha) => (
                        <View
                          key={
                            linha.chave
                          }
                          style={{
                            paddingVertical: 9,
                            borderTopWidth: 1,
                            borderTopColor: '#ededed',
                          }}
                        >
                          <Text
                            style={{
                              color: '#111',
                              fontWeight: '900',
                              marginBottom: 7,
                            }}
                          >
                            {linha.nome}
                          </Text>

                          <View
                            style={{
                              gap: 5,
                            }}
                          >
                            {academias.map(
                              (
                                academia
                              ) => {
                                const possui =
                                  academiaPossuiItem(
                                    academia,
                                    secao.propriedade,
                                    linha.chave
                                  );

                                return (
                                  <View
                                    key={String(
                                      academia.id
                                    )}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 8,
                                    }}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      style={{
                                        flex: 1,
                                        color: '#555',
                                        fontSize: 12,
                                        fontWeight: '700',
                                      }}
                                    >
                                      {academia.nome}
                                    </Text>

                                    <Text
                                      style={{
                                        color: possui
                                          ? '#16a34a'
                                          : '#999',
                                        fontSize: 17,
                                        fontWeight: '900',
                                      }}
                                    >
                                      {possui
                                        ? '✓'
                                        : '—'}
                                    </Text>
                                  </View>
                                );
                              }
                            )}
                          </View>
                        </View>
                      )
                    )
                  )}
                </View>
              )
            )}
          </>
        )}
      </ScrollView>

      <BottomTabBar
        usuario={usuario}
      />
    </LogymBackground>
  );
}
