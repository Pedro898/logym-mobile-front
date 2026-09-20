import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomTabBar from '../components/BottomTabBar';
import ComparisonBar from '../components/ComparisonBar';
import LogymBackground from '../components/LogymBackground';
import NearbyAcademiesMap from '../components/NearbyAcademiesMap';
import UserAvatarPlaceholder from '../components/UserAvatarPlaceholder';

import {
  alternarFavoritoNoBanco,
  buscarAcademias,
  buscarAcademiasProximas,
  buscarCategoriasAtivas,
  buscarFacilidadesAtivas,
  buscarFavoritosDoUsuario,
  buscarUsuarioAutenticado,
  extrairIdsAcademiasFavoritas,
  formatarNomeUsuario,
  getFotoPrincipalAcademiaUrl,
  getFotoUsuarioUrl,
  normalizarCategorias,
  normalizarFacilidades,

  type Academia,
  type AcademiaProxima,
  type Categoria,
  type Facilidade,
  type Usuario,
} from '@/lib/api';
import { ehUsuarioComum } from '@/lib/permissoes';
import {
  academiaEstaSelecionadaParaComparacao,
  alternarAcademiaNaComparacao,
  buscarAcademiasSelecionadasComparacao,
  limparComparacao,
  removerAcademiaDaComparacao,
  type AcademiaSelecionadaComparacao,
} from '@/lib/comparacao';

// ================================================================
// ACADEMIA COM FOTO
// ================================================================

type AcademiaComFoto = Academia & {
  fotoUrl?: string | null;
};

type AcademiaListaItem = AcademiaComFoto & {
  distanciaKm?: number | string | null;
};

// ================================================================
// PEGA A PRIMEIRA LETRA DO NOME DA ACADEMIA
//
// Exemplo:
// Smart Fit -> S
// BlueFit   -> B
// ================================================================

function getInicialAcademia(nome?: string) {
  const nomeLimpo = String(nome || 'A').trim();

  if (!nomeLimpo) {
    return 'A';
  }

  return nomeLimpo.charAt(0).toUpperCase();
}

// ================================================================
// NORMALIZA TEXTOS
//
// Essa função ajuda na pesquisa.
//
// Por exemplo:
//
// "Musculação"
// "musculacao"
//
// passam a ser tratados de forma semelhante.
// ================================================================

function normalizarTexto(texto?: string) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ================================================================
// COORDENADAS VÁLIDAS
//
// Mesma validação usada no Web antes de exibir o mapa.
// ================================================================

function possuiCoordenadasValidas(
  latitude?: string | number | null,
  longitude?: string | number | null
) {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    String(latitude).trim() === '' ||
    String(longitude).trim() === ''
  ) {
    return false;
  }

  const latitudeNumerica = Number(latitude);
  const longitudeNumerica = Number(longitude);

  return (
    Number.isFinite(latitudeNumerica) &&
    Number.isFinite(longitudeNumerica) &&
    latitudeNumerica >= -90 &&
    latitudeNumerica <= 90 &&
    longitudeNumerica >= -180 &&
    longitudeNumerica <= 180
  );
}

// ================================================================
// DISTÂNCIA
//
// O Web mostra a distância com no máximo uma casa decimal e somente
// quando a academia faz parte da resposta de academias próximas.
// ================================================================

function formatarDistancia(
  distanciaKm?: number | string | null
) {
  if (
    distanciaKm === null ||
    distanciaKm === undefined
  ) {
    return null;
  }

  const distancia = Number(distanciaKm);

  if (!Number.isFinite(distancia) || distancia < 0) {
    return null;
  }

  return `${new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 1,
  }).format(distancia)} km de você`;
}

// ================================================================
// CEP
//
// Exibe o CEP no padrão brasileiro 00000-000 sem alterar o valor
// original recebido do backend.
// ================================================================

function formatarCep(cep?: string | number | null) {
  if (cep === null || cep === undefined) {
    return '';
  }

  const valorOriginal = String(cep).trim();
  const numeros = valorOriginal.replace(/\D/g, '');

  if (numeros.length !== 8) {
    return valorOriginal;
  }

  return `${numeros.slice(0, 5)}-${numeros.slice(5)}`;
}

// ================================================================
// FALLBACK DA FOTO DA ACADEMIA
//
// Se a academia não possuir uma foto cadastrada,
// mostramos o mesmo estilo usado no projeto:
// fundo degradê + círculo branco + inicial da academia.
// ================================================================

function AcademiaSemFoto({
  nome,
}: {
  nome?: string;
}) {
  return (
    <LinearGradient
      colors={['#1a0700', '#f97316']}
      start={{
        x: 0,
        y: 0,
      }}
      end={{
        x: 1,
        y: 1,
      }}
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

// ================================================================
// PAGINAÇÃO
//
// Igual ao Web: 16 academias por página.
// ================================================================

const ACADEMIAS_POR_PAGINA = 16;

// ================================================================
// TELA PRINCIPAL DE ACADEMIAS
// ================================================================

export default function Academias() {
  const router = useRouter();

  // ==============================================================
  // PESQUISA
  // ==============================================================

  const [busca, setBusca] = useState('');

  // ==============================================================
  // CATEGORIAS
  // ==============================================================

  const [categorias, setCategorias] =
    useState<Categoria[]>([]);

  const [
    categoriasSelecionadas,
    setCategoriasSelecionadas,
  ] = useState<string[]>([]);

  // ==============================================================
  // FACILIDADES
  // ==============================================================

  const [facilidades, setFacilidades] =
    useState<Facilidade[]>([]);

  const [
    facilidadesSelecionadas,
    setFacilidadesSelecionadas,
  ] = useState<string[]>([]);

  // ==============================================================
  // CARREGAMENTO DOS FILTROS
  // ==============================================================

  const [
    carregandoFiltros,
    setCarregandoFiltros,
  ] = useState(false);

  const [erroFiltros, setErroFiltros] =
    useState('');

  // ==============================================================
  // FAVORITOS
  // ==============================================================

  const [favoritos, setFavoritos] =
    useState<string[]>([]);

  // ==============================================================
  // COMPARAÇÃO
  // ==============================================================

  const [
    academiasComparacao,
    setAcademiasComparacao,
  ] = useState<
    AcademiaSelecionadaComparacao[]
  >([]);

  // ==============================================================
  // PAGINAÇÃO
  // ==============================================================

  const [
    paginaAtual,
    setPaginaAtual,
  ] = useState(0);

  // ==============================================================
  // USUÁRIO
  // ==============================================================

  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  // Se a foto falhar, mostramos o avatar padrão.
  const [
    fotoUsuarioErro,
    setFotoUsuarioErro,
  ] = useState(false);

  // ==============================================================
  // VERSÃO DA FOTO DO USUÁRIO
  //
  // Esse estado serve somente para evitar o cache da imagem.
  //
  // Quando entramos novamente nesta tela, depois de alterar a
  // foto no Perfil, mudamos esse número.
  //
  // Exemplo:
  //
  // /usuarios/1/foto?v=123
  //
  // depois:
  //
  // /usuarios/1/foto?v=456
  //
  // Como a URL ficou diferente, o React Native busca novamente
  // a imagem no backend.
  //
  // IMPORTANTE:
  // Date.now() NÃO fica dentro de getFotoUsuarioUrl().
  //
  // Assim a foto não fica piscando a cada renderização.
  // ==============================================================

  const [
    fotoUsuarioVersao,
    setFotoUsuarioVersao,
  ] = useState(Date.now());

  // ==============================================================
  // ACADEMIAS
  // ==============================================================

  const [academias, setAcademias] =
    useState<AcademiaComFoto[]>([]);

  const [
    carregandoAcademias,
    setCarregandoAcademias,
  ] = useState(false);

  const [
    erroAcademias,
    setErroAcademias,
  ] = useState('');

  // ==============================================================
  // ACADEMIAS PRÓXIMAS
  //
  // Esta lista é separada da lista principal, igual ao Web.
  // Ela serve para o mapa, para ordenar as academias próximas antes
  // das demais e para mostrar a distância no card.
  // ==============================================================

  const [
    academiasProximas,
    setAcademiasProximas,
  ] = useState<AcademiaProxima[]>([]);

  const [
    carregandoAcademiasProximas,
    setCarregandoAcademiasProximas,
  ] = useState(false);

  const [
    mensagemAcademiasProximas,
    setMensagemAcademiasProximas,
  ] = useState('');

  // ==============================================================
  // CARREGA OS DADOS SEMPRE QUE A TELA RECEBE FOCO
  //
  // Isso é importante porque podemos sair para:
  //
  // - Perfil
  // - Favoritos
  // - Detalhes
  //
  // e depois voltar.
  //
  // Ao voltar, atualizamos novamente os dados necessários.
  // ==============================================================

  useFocusEffect(
    useCallback(() => {
      async function carregarDados() {
        // ========================================================
        // ATUALIZA A VERSÃO DA FOTO
        //
        // Essa é a correção para a foto alterada no Perfil.
        //
        // Quando voltamos para a tela principal, a URL da imagem
        // muda e o cache antigo deixa de ser utilizado.
        // ========================================================

        setFotoUsuarioVersao(Date.now());

        // Tentamos carregar novamente a foto.
        setFotoUsuarioErro(false);

        // ========================================================
        // USUÁRIO AUTENTICADO
        //
        // A fonte verdadeira da autenticação é a sessão do Spring.
        // Assim, ao atualizar a página no navegador, não usamos um
        // usuário antigo do AsyncStorage por engano.
        // ========================================================

        let usuarioLogado: Usuario | null = null;

        try {
          usuarioLogado = await buscarUsuarioAutenticado();

          await AsyncStorage.setItem(
            'usuario',
            JSON.stringify(usuarioLogado)
          );

          setUsuario(usuarioLogado);

          if (ehUsuarioComum(usuarioLogado)) {
            setAcademiasComparacao(
              await buscarAcademiasSelecionadasComparacao()
            );
          } else {
            setAcademiasComparacao([]);
          }

        } catch (error) {
          console.error('Sessão inválida ou expirada:', error);

          await AsyncStorage.removeItem('usuario');
          setUsuario(null);
          router.replace('/login');
          return;
        }

        // ========================================================
        // CATEGORIAS E FACILIDADES
        // ========================================================

        try {
          setCarregandoFiltros(true);

          setErroFiltros('');

          const [
            categoriasBanco,
            facilidadesBanco,
          ] = await Promise.all([
            buscarCategoriasAtivas(),
            buscarFacilidadesAtivas(),
          ]);

          setCategorias(
            Array.isArray(categoriasBanco)
              ? categoriasBanco
              : []
          );

          setFacilidades(
            Array.isArray(facilidadesBanco)
              ? facilidadesBanco
              : []
          );
        } catch (error) {
          console.error(
            'Erro ao carregar categorias e facilidades:',
            error
          );

          setCategorias([]);

          setFacilidades([]);

          setErroFiltros(
            'Não foi possível carregar os filtros.'
          );
        } finally {
          setCarregandoFiltros(false);
        }

        // ========================================================
        // ACADEMIAS PRÓXIMAS
        //
        // Igual ao Web atual:
        // - somente USER consulta /academias/proximas;
        // - o backend usa a sessão para identificar o usuário;
        // - a resposta contém apenas academias em até 5 km;
        // - falha nessa parte NÃO impede a lista geral de carregar.
        // ========================================================

        if (ehUsuarioComum(usuarioLogado)) {
          if (
            !possuiCoordenadasValidas(
              usuarioLogado.latitude,
              usuarioLogado.longitude
            )
          ) {
            setAcademiasProximas([]);
            setCarregandoAcademiasProximas(false);
            setMensagemAcademiasProximas(
              'Atualize seu endereço no perfil para encontrar academias próximas.'
            );
          } else {
            try {
              setCarregandoAcademiasProximas(true);
              setMensagemAcademiasProximas('');

              const proximas =
                await buscarAcademiasProximas();

              if (Array.isArray(proximas)) {
                setAcademiasProximas(proximas);
              } else {
                setAcademiasProximas([]);
                setMensagemAcademiasProximas(
                  'Não foi possível carregar as academias próximas.'
                );
              }
            } catch (error) {
              console.error(
                'Erro ao carregar academias próximas:',
                error
              );

              setAcademiasProximas([]);
              setMensagemAcademiasProximas(
                'Não foi possível carregar as academias próximas agora.'
              );
            } finally {
              setCarregandoAcademiasProximas(false);
            }
          }
        } else {
          setAcademiasProximas([]);
          setMensagemAcademiasProximas('');
          setCarregandoAcademiasProximas(false);
        }

        // ========================================================
        // ACADEMIAS
        // ========================================================

        try {
          setCarregandoAcademias(true);

          setErroAcademias('');

          // ======================================================
          // FAVORITOS
          // ======================================================

          if (usuarioLogado?.id && ehUsuarioComum(usuarioLogado)) {
            try {
              const academiasFavoritas =
                await buscarFavoritosDoUsuario(
                  usuarioLogado.id
                );

              setFavoritos(
                extrairIdsAcademiasFavoritas(
                  academiasFavoritas
                )
              );
            } catch (error) {
              console.error(
                'Erro ao buscar favoritos:',
                error
              );

              setFavoritos([]);
            }
          } else {
            setFavoritos([]);
          }

          // ======================================================
          // BUSCA DAS ACADEMIAS
          //
          // Mesmo fluxo da Home Web atual:
          // GET /academias carrega todas as academias ativas para
          // os cards, independentemente do nível de acesso.
          //
          // A rota de proximidade NÃO substitui essa lista. Ela
          // será usada separadamente na etapa do mapa/distância.
          // ======================================================

          const lista =
            await buscarAcademias();

          // ======================================================
          // FOTO PRINCIPAL
          //
          // O backend atual já envia fotoPrincipal junto com cada
          // academia. Assim como no Web, não precisamos fazer uma
          // requisição adicional de fotos para cada card.
          // ======================================================

          const listaComFotos =
            lista.map(
              (academia) => ({
                ...academia,
                fotoUrl:
                  getFotoPrincipalAcademiaUrl(
                    academia.fotoPrincipal
                  ),
              })
            );

          setAcademias(listaComFotos);
        } catch (error) {
          console.error(
            'Erro ao carregar academias:',
            error
          );

          setErroAcademias(
            'Não foi possível carregar as academias do banco.'
          );
        } finally {
          setCarregandoAcademias(false);
        }
      }

      carregarDados();
    }, [])
  );

  // ==============================================================
  // ALTERAR CATEGORIA SELECIONADA
  // ==============================================================

  function alternarCategoria(
    id: string | number
  ) {
    const idString = String(id);

    setCategoriasSelecionadas(
      (listaAtual) => {
        if (
          listaAtual.includes(
            idString
          )
        ) {
          return listaAtual.filter(
            (item) =>
              item !== idString
          );
        }

        return [
          ...listaAtual,
          idString,
        ];
      }
    );
  }

  // ==============================================================
  // ALTERAR FACILIDADE SELECIONADA
  // ==============================================================

  function alternarFacilidade(
    id: string | number
  ) {
    const idString = String(id);

    setFacilidadesSelecionadas(
      (listaAtual) => {
        if (
          listaAtual.includes(
            idString
          )
        ) {
          return listaAtual.filter(
            (item) =>
              item !== idString
          );
        }

        return [
          ...listaAtual,
          idString,
        ];
      }
    );
  }

  // ==============================================================
  // LIMPAR PESQUISA E FILTROS
  // ==============================================================

  function limparFiltros() {
    setCategoriasSelecionadas([]);

    setFacilidadesSelecionadas([]);

    setBusca('');

    setPaginaAtual(0);
  }

  useEffect(() => {
    setPaginaAtual(0);
  }, [
    busca,
    categoriasSelecionadas,
    facilidadesSelecionadas,
  ]);

  // ==============================================================
  // VERIFICA SE A ACADEMIA POSSUI UMA CATEGORIA
  // ==============================================================

  function academiaPossuiCategoria(
    academia: Academia,
    categoria: Categoria
  ) {
    // ============================================================
    // MODELO NOVO - IDS
    // ============================================================

    if (
      Array.isArray(
        academia.categoriaIds
      ) &&
      academia.categoriaIds
        .length > 0
    ) {
      return academia.categoriaIds.some(
        (id) =>
          String(id) ===
          String(categoria.id)
      );
    }

    // ============================================================
    // MODELO NOVO - OBJETOS VINCULADOS
    // ============================================================

    if (
      Array.isArray(
        academia.categoriasVinculadas
      ) &&
      academia
        .categoriasVinculadas
        .length > 0
    ) {
      return academia.categoriasVinculadas.some(
        (item) =>
          String(item.id) ===
            String(categoria.id) ||
          normalizarTexto(
            item.nome
          ) ===
            normalizarTexto(
              categoria.nome
            )
      );
    }

    // ============================================================
    // MODELO ANTIGO - STRING
    // ============================================================

    const antigas =
      normalizarCategorias(
        academia.categorias
      );

    return antigas.some(
      (nome) =>
        normalizarTexto(
          nome
        ) ===
        normalizarTexto(
          categoria.nome
        )
    );
  }

  // ==============================================================
  // VERIFICA SE A ACADEMIA POSSUI UMA FACILIDADE
  // ==============================================================

  function academiaPossuiFacilidade(
    academia: Academia,
    facilidade: Facilidade
  ) {
    // ============================================================
    // MODELO NOVO - IDS
    // ============================================================

    if (
      Array.isArray(
        academia.facilidadeIds
      ) &&
      academia.facilidadeIds
        .length > 0
    ) {
      return academia.facilidadeIds.some(
        (id) =>
          String(id) ===
          String(
            facilidade.id
          )
      );
    }

    // ============================================================
    // MODELO NOVO - OBJETOS VINCULADOS
    // ============================================================

    if (
      Array.isArray(
        academia.facilidadesVinculadas
      ) &&
      academia
        .facilidadesVinculadas
        .length > 0
    ) {
      return academia.facilidadesVinculadas.some(
        (item) =>
          String(item.id) ===
            String(
              facilidade.id
            ) ||
          normalizarTexto(
            item.nome
          ) ===
            normalizarTexto(
              facilidade.nome
            )
      );
    }

    // ============================================================
    // MODELO ANTIGO - STRING
    // ============================================================

    const antigas =
      normalizarFacilidades(
        academia.facilidades
      );

    return antigas.some(
      (nome) =>
        normalizarTexto(
          nome
        ) ===
        normalizarTexto(
          facilidade.nome
        )
    );
  }

  // ==============================================================
  // CRIA O TEXTO UTILIZADO NA PESQUISA
  // ==============================================================

  function criarTextoPesquisavel(
    academia: Academia
  ) {
    const nomesCategorias = [
      ...(
        academia.categoriasVinculadas ||
        []
      ).map(
        (item) => item.nome
      ),

      ...normalizarCategorias(
        academia.categorias
      ),
    ].join(' ');

    const nomesFacilidades = [
      ...(
        academia.facilidadesVinculadas ||
        []
      ).map(
        (item) => item.nome
      ),

      ...normalizarFacilidades(
        academia.facilidades
      ),
    ].join(' ');

    return normalizarTexto(`
      ${academia.nome}
      ${academia.endereco}
      ${academia.numero || ''}
      ${academia.complemento || ''}
      ${academia.bairro || ''}
      ${academia.cidade}
      ${academia.estado || ''}
      ${academia.cep}
      ${academia.descricao || ''}
      ${nomesCategorias}
      ${nomesFacilidades}
    `);
  }

  // ==============================================================
  // FILTRAGEM DAS ACADEMIAS
  // ==============================================================

  const academiasFiltradas =
    academias.filter(
      (academia) => {
        // ========================================================
        // PESQUISA
        // ========================================================

        const termoBusca =
          normalizarTexto(
            busca.trim()
          );

        const correspondeBusca =
          termoBusca
            ? criarTextoPesquisavel(
                academia
              ).includes(
                termoBusca
              )
            : true;

        // ========================================================
        // CATEGORIAS
        // ========================================================

        const correspondeCategorias =
          categoriasSelecionadas
            .length > 0
            ? categoriasSelecionadas.every(
                (
                  categoriaId
                ) => {
                  const categoria =
                    categorias.find(
                      (item) =>
                        String(
                          item.id
                        ) ===
                        categoriaId
                    );

                  return categoria
                    ? academiaPossuiCategoria(
                        academia,
                        categoria
                      )
                    : false;
                }
              )
            : true;

        // ========================================================
        // FACILIDADES
        // ========================================================

        const correspondeFacilidades =
          facilidadesSelecionadas
            .length > 0
            ? facilidadesSelecionadas.every(
                (
                  facilidadeId
                ) => {
                  const facilidade =
                    facilidades.find(
                      (item) =>
                        String(
                          item.id
                        ) ===
                        facilidadeId
                    );

                  return facilidade
                    ? academiaPossuiFacilidade(
                        academia,
                        facilidade
                      )
                    : false;
                }
              )
            : true;

        return (
          correspondeBusca &&
          correspondeCategorias &&
          correspondeFacilidades
        );
      }
    );

  // ==============================================================
  // ACADEMIAS UNIFICADAS
  //
  // Mesmo comportamento do Web:
  // 1. academias próximas que também passaram pelos filtros;
  // 2. demais academias filtradas;
  // 3. distanciaKm fica disponível somente nas academias próximas.
  // ==============================================================

  const academiasUnificadas = useMemo<AcademiaListaItem[]>(() => {
    const academiasFiltradasPorId = new Map(
      academiasFiltradas.map((academia) => [
        String(academia.id),
        academia,
      ])
    );

    const idsAcademiasProximas = new Set<string>();
    const proximas: AcademiaListaItem[] = [];

    academiasProximas.forEach(
      ({ academia, distanciaKm }) => {
        if (
          academia?.id === null ||
          academia?.id === undefined
        ) {
          return;
        }

        const idAcademia = String(academia.id);
        const academiaFiltrada =
          academiasFiltradasPorId.get(idAcademia);

        if (
          !academiaFiltrada ||
          idsAcademiasProximas.has(idAcademia)
        ) {
          return;
        }

        idsAcademiasProximas.add(idAcademia);

        proximas.push({
          ...academiaFiltrada,
          distanciaKm,
        });
      }
    );

    const restantes: AcademiaListaItem[] =
      academiasFiltradas
        .filter(
          (academia) =>
            !idsAcademiasProximas.has(
              String(academia.id)
            )
        )
        .map((academia) => ({
          ...academia,
          distanciaKm: null,
        }));

    return [...proximas, ...restantes];
  }, [academiasFiltradas, academiasProximas]);

  const totalPaginas =
    Math.ceil(
      academiasUnificadas.length /
        ACADEMIAS_POR_PAGINA
    );

  useEffect(() => {
    if (
      totalPaginas > 0 &&
      paginaAtual >= totalPaginas
    ) {
      setPaginaAtual(
        totalPaginas - 1
      );
    }
  }, [
    paginaAtual,
    totalPaginas,
  ]);

  const academiasPaginaAtual =
    useMemo(
      () => {
        const inicio =
          paginaAtual *
          ACADEMIAS_POR_PAGINA;

        return academiasUnificadas.slice(
          inicio,
          inicio +
            ACADEMIAS_POR_PAGINA
        );
      },
      [
        academiasUnificadas,
        paginaAtual,
      ]
    );

  const paginasVisiveis =
    useMemo<
      Array<number | string>
    >(
      () => {
        if (totalPaginas <= 7) {
          return Array.from(
            {
              length:
                totalPaginas,
            },
            (
              _,
              index
            ) => index
          );
        }

        const paginas =
          new Set<number>([
            0,
            totalPaginas - 1,
            paginaAtual - 1,
            paginaAtual,
            paginaAtual + 1,
          ]);

        const ordenadas =
          [...paginas]
            .filter(
              (pagina) =>
                pagina >= 0 &&
                pagina <
                  totalPaginas
            )
            .sort(
              (a, b) =>
                a - b
            );

        return ordenadas.reduce<
          Array<
            number |
            string
          >
        >(
          (
            itens,
            pagina,
            index
          ) => {
            if (
              index > 0 &&
              pagina -
                ordenadas[
                  index - 1
                ] >
                1
            ) {
              itens.push(
                `ellipsis-${pagina}`
              );
            }

            itens.push(
              pagina
            );

            return itens;
          },
          []
        );
      },
      [
        paginaAtual,
        totalPaginas,
      ]
    );

  function trocarPagina(
    novaPagina: number
  ) {
    if (
      novaPagina < 0 ||
      novaPagina >=
        totalPaginas ||
      novaPagina ===
        paginaAtual
    ) {
      return;
    }

    setPaginaAtual(
      novaPagina
    );
  }

  // ==============================================================
  // FAVORITAR / DESFAVORITAR
  // ==============================================================

  async function alternarFavorito(
    id: string | number
  ) {
    if (!usuario?.id || !ehUsuarioComum(usuario)) {
      return;
    }

    const idString =
      String(id);

    const favoritosAnteriores =
      favoritos;

    const novosFavoritos =
      favoritos.includes(
        idString
      )
        ? favoritos.filter(
            (favoritoId) =>
              favoritoId !==
              idString
          )
        : [
            ...favoritos,
            idString,
          ];

    // Atualização visual imediata.
    setFavoritos(
      novosFavoritos
    );

    try {
      await alternarFavoritoNoBanco(
        usuario.id,
        id
      );
    } catch (error) {
      console.error(
        'Erro ao atualizar favorito:',
        error
      );

      // Volta ao estado anterior caso o backend dê erro.
      setFavoritos(
        favoritosAnteriores
      );
    }
  }

  // ==============================================================
  // COMPARAÇÃO
  // ==============================================================

  async function alternarComparacao(
    academia: Academia
  ) {
    if (
      !ehUsuarioComum(
        usuario
      )
    ) {
      return;
    }

    const resultado =
      await alternarAcademiaNaComparacao(
        {
          id: academia.id,
          nome: academia.nome,
        }
      );

    if (
      resultado.limiteAtingido
    ) {
      Alert.alert(
        'Comparação',
        'Você pode comparar até 3 academias.'
      );

      return;
    }

    setAcademiasComparacao(
      resultado.academias
    );
  }

  async function removerDaComparacao(
    academiaId:
      | string
      | number
  ) {
    setAcademiasComparacao(
      await removerAcademiaDaComparacao(
        academiaId
      )
    );
  }

  async function limparAcademiasComparacao() {
    setAcademiasComparacao(
      await limparComparacao()
    );
  }

  function abrirComparacao() {
    if (
      academiasComparacao.length <
      2
    ) {
      return;
    }

    router.push(
      '/comparar-academias' as any
    );
  }

  // ==============================================================
  // INFORMAÇÕES DO USUÁRIO
  // ==============================================================

  const nomeUsuario =
    formatarNomeUsuario(
      usuario
    );

  // ==============================================================
  // URL BASE DA FOTO
  //
  // getFotoUsuarioUrl continua SEM Date.now().
  // Isso evita a imagem piscando continuamente.
  // ==============================================================

  const fotoUsuarioBaseUrl =
    getFotoUsuarioUrl(
      usuario?.id
    );

  // ==============================================================
  // URL COM VERSÃO
  //
  // A versão muda somente quando a tela recebe foco novamente.
  //
  // Portanto, ao voltar do Perfil, o Mobile força uma nova busca
  // da imagem e mostra imediatamente a foto recém-alterada.
  // ==============================================================

  const fotoUsuarioUrl =
    fotoUsuarioBaseUrl
      ? `${fotoUsuarioBaseUrl}?v=${fotoUsuarioVersao}`
      : null;

  const deveMostrarFotoUsuario =
    fotoUsuarioUrl &&
    !fotoUsuarioErro;

  // ==============================================================
  // INTERFACE
  // ==============================================================

  return (
    <LogymBackground>
      <View
        style={{
          flex: 1,
          width: '100%',
          alignSelf: 'center',
          paddingTop: 12,
          paddingHorizontal: 14,
          paddingBottom: 86,
        }}
      >
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderWidth: 1,
            borderColor: '#d7d7d7',
            borderRadius: 20,
            padding: 14,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.10,
            shadowRadius: 10,
            elevation: 5,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                flex: 1,
                paddingRight: 12,
              }}
            >
              <Text
                style={{
                  color: '#f97316',
                  fontSize: 11,
                  fontWeight: '900',
                  letterSpacing: 0.8,
                }}
              >
                BEM-VINDO AO LOGYM
              </Text>

              <Text
                numberOfLines={1}
                style={{
                  color: '#111',
                  fontSize: 20,
                  fontWeight: '900',
                  marginTop: 2,
                }}
              >
                {nomeUsuario}
              </Text>

            </View>

            <View style={{ alignItems: 'center' }}>
              {deveMostrarFotoUsuario ? (
                <Image
                  source={{ uri: fotoUsuarioUrl }}
                  onError={() => setFotoUsuarioErro(true)}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: '#f3f4f6',
                    borderWidth: 2,
                    borderColor: '#f97316',
                  }}
                />
              ) : (
                <UserAvatarPlaceholder size={46} />
              )}
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.97)',
            borderWidth: 1,
            borderColor: '#111111',
            borderRadius: 18,
            padding: 13,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: '#000',
              fontSize: 20,
              fontWeight: '900',
              letterSpacing: 0.4,
              marginBottom: 10,
            }}
          >
            ENCONTRE SUA ACADEMIA
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fafafa',
              borderRadius: 12,
              paddingHorizontal: 13,
              borderWidth: 1,
              borderColor: '#bdbdbd',
            }}
          >
            <Ionicons name="search" size={20} color="#f97316" />
            <TextInput
              placeholder="Nome, endereço, cidade..."
              placeholderTextColor="#888"
              value={busca}
              onChangeText={setBusca}
              style={{
                flex: 1,
                color: '#111',
                marginLeft: 9,
                minHeight: 46,
              }}
            />
          </View>

          <View
            style={{
              marginTop: 13,
              marginBottom: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: '#111', fontWeight: '900', fontSize: 14 }}>
              Filtros rápidos
            </Text>
            {(categoriasSelecionadas.length > 0 ||
              facilidadesSelecionadas.length > 0 ||
              busca.length > 0) && (
              <TouchableOpacity onPress={limparFiltros}>
                <Text style={{ color: '#ea580c', fontWeight: '900' }}>
                  Limpar
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {carregandoFiltros ? (
            <Text style={{ color: '#666', marginBottom: 8, fontSize: 13 }}>
              Carregando filtros...
            </Text>
          ) : null}

          {erroFiltros ? (
            <Text style={{ color: '#b91c1c', marginBottom: 8, fontSize: 13 }}>
              {erroFiltros}
            </Text>
          ) : null}

          {!carregandoFiltros ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
            >
              {categorias.map((categoria) => {
                const selecionada = categoriasSelecionadas.includes(
                  String(categoria.id)
                );
                return (
                  <TouchableOpacity
                    key={`categoria-${categoria.id}`}
                    onPress={() => alternarCategoria(categoria.id)}
                    style={{
                      backgroundColor: selecionada ? '#f97316' : '#fff',
                      borderColor: selecionada ? '#f97316' : '#111',
                      borderRadius: 999,
                      borderWidth: 1,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    {selecionada ? (
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color="#000"
                        style={{ marginRight: 4 }}
                      />
                    ) : null}
                    <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>
                      {categoria.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {facilidades.map((facilidade) => {
                const selecionada = facilidadesSelecionadas.includes(
                  String(facilidade.id)
                );
                return (
                  <TouchableOpacity
                    key={`facilidade-${facilidade.id}`}
                    onPress={() => alternarFacilidade(facilidade.id)}
                    style={{
                      backgroundColor: selecionada ? '#f97316' : '#fff',
                      borderColor: selecionada ? '#f97316' : '#111',
                      borderRadius: 999,
                      borderWidth: 1,
                      paddingHorizontal: 13,
                      paddingVertical: 7,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    {selecionada ? (
                      <Ionicons
                        name="checkmark"
                        size={15}
                        color="#000"
                        style={{ marginRight: 4 }}
                      />
                    ) : null}
                    <Text style={{ color: '#000', fontWeight: '800', fontSize: 12 }}>
                      {facilidade.nome}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : null}

          <View
            style={{
              marginTop: 4,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: '#555', fontSize: 13 }}>
              {academiasUnificadas.length} academia(s) encontrada(s)
            </Text>
          </View>
        </View>

        {carregandoAcademias ? (
          <View
            style={{
              marginTop: 25,
              backgroundColor: '#fff',
              padding: 20,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#ddd',
            }}
          >
            <ActivityIndicator color="#f97316" />
            <Text style={{ color: '#333', textAlign: 'center', marginTop: 10 }}>
              Carregando academias do banco...
            </Text>
          </View>
        ) : erroAcademias ? (
          <View
            style={{
              marginTop: 18,
              backgroundColor: '#fff1f2',
              borderWidth: 1,
              borderColor: '#fecdd3',
              padding: 16,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: '#9f1239', textAlign: 'center' }}>
              {erroAcademias}
            </Text>
          </View>
        ) : academiasUnificadas.length === 0 ? (
          <View
            style={{
              marginTop: 18,
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#ddd',
              padding: 18,
              borderRadius: 14,
            }}
          >
            <Text style={{ color: '#555', textAlign: 'center' }}>
              Nenhuma academia encontrada com esses filtros.
            </Text>
          </View>
        ) : (
          <FlatList
            data={academiasPaginaAtual}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              ehUsuarioComum(usuario) ? (
                <View
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.97)',
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: '#ddd',
                    padding: 10,
                    marginBottom: 13,
                    shadowColor: '#000',
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: 8,
                      paddingHorizontal: 3,
                    }}
                  >
                    <Ionicons name="location" size={18} color="#f97316" />
                    <Text
                      style={{
                        color: '#111',
                        fontWeight: '900',
                        fontSize: 14,
                        marginLeft: 5,
                      }}
                    >
                      Academias próximas de você
                    </Text>
                  </View>

                  {carregandoAcademiasProximas ? (
                    <View
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        backgroundColor: '#fff7ed',
                        borderWidth: 1,
                        borderColor: '#f97316',
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ color: '#000', textAlign: 'center', fontSize: 13 }}>
                        Carregando academias próximas...
                      </Text>
                    </View>
                  ) : mensagemAcademiasProximas ? (
                    <View
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        backgroundColor: '#fff7ed',
                        borderWidth: 1,
                        borderColor: '#f97316',
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ color: '#000', textAlign: 'center', fontSize: 13 }}>
                        {mensagemAcademiasProximas}
                      </Text>
                    </View>
                  ) : academiasProximas.length === 0 ? (
                    <View
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        backgroundColor: '#fff7ed',
                        borderWidth: 1,
                        borderColor: '#f97316',
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ color: '#000', textAlign: 'center', fontSize: 13 }}>
                        Nenhuma academia encontrada em até 5 km da sua localização.
                      </Text>
                    </View>
                  ) : (
                    <NearbyAcademiesMap
                      userLatitude={usuario?.latitude}
                      userLongitude={usuario?.longitude}
                      academiasProximas={academiasProximas}
                      onAcademiaPress={(academiaId) =>
                        router.push({
                          pathname: '/detalhes',
                          params: { id: String(academiaId) },
                        })
                      }
                    />
                  )}
                </View>
              ) : null
            }
            contentContainerStyle={{
              paddingBottom:
                ehUsuarioComum(usuario) &&
                academiasComparacao.length > 0
                  ? 190
                  : 100,
            }}
            ListFooterComponent={
              totalPaginas > 1 ? (
                <View
                  style={{
                    marginTop: 8,
                    marginBottom: 4,
                    backgroundColor: '#fff',
                    borderWidth: 1,
                    borderColor: '#dedede',
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() =>
                        trocarPagina(
                          paginaAtual - 1
                        )
                      }
                      disabled={
                        paginaAtual === 0
                      }
                      style={{
                        minHeight: 34,
                        paddingHorizontal: 10,
                        borderRadius: 7,
                        borderWidth: 1,
                        borderColor:
                          paginaAtual === 0
                            ? '#d4d4d4'
                            : '#000',
                        backgroundColor:
                          paginaAtual === 0
                            ? '#f4f4f4'
                            : '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity:
                          paginaAtual === 0
                            ? 0.55
                            : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: '#000',
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        Anterior
                      </Text>
                    </TouchableOpacity>

                    {paginasVisiveis.map(
                      (itemPagina) =>
                        typeof itemPagina ===
                        'string' ? (
                          <Text
                            key={itemPagina}
                            style={{
                              color: '#777',
                              fontSize: 15,
                              paddingHorizontal: 2,
                            }}
                          >
                            …
                          </Text>
                        ) : (
                          <TouchableOpacity
                            key={
                              itemPagina
                            }
                            onPress={() =>
                              trocarPagina(
                                itemPagina
                              )
                            }
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 7,
                              borderWidth: 1,
                              borderColor:
                                itemPagina ===
                                paginaAtual
                                  ? '#f97316'
                                  : '#000',
                              backgroundColor:
                                itemPagina ===
                                paginaAtual
                                  ? '#f97316'
                                  : '#fff',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text
                              style={{
                                color: '#000',
                                fontSize: 12,
                                fontWeight: '900',
                              }}
                            >
                              {
                                itemPagina +
                                1
                              }
                            </Text>
                          </TouchableOpacity>
                        )
                    )}

                    <TouchableOpacity
                      onPress={() =>
                        trocarPagina(
                          paginaAtual + 1
                        )
                      }
                      disabled={
                        paginaAtual ===
                        totalPaginas - 1
                      }
                      style={{
                        minHeight: 34,
                        paddingHorizontal: 10,
                        borderRadius: 7,
                        borderWidth: 1,
                        borderColor:
                          paginaAtual ===
                          totalPaginas - 1
                            ? '#d4d4d4'
                            : '#000',
                        backgroundColor:
                          paginaAtual ===
                          totalPaginas - 1
                            ? '#f4f4f4'
                            : '#fff',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity:
                          paginaAtual ===
                          totalPaginas - 1
                            ? 0.55
                            : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: '#000',
                          fontSize: 11,
                          fontWeight: '800',
                        }}
                      >
                        Próxima
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={{
                      marginTop: 8,
                      color: '#777',
                      fontSize: 10,
                      textAlign: 'center',
                    }}
                  >
                    Página {
                      paginaAtual + 1
                    } de {totalPaginas}
                  </Text>
                </View>
              ) : null
            }
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
                  backgroundColor: '#ffffff',
                  borderRadius: 16,
                  marginBottom: 12,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: '#d7d7d7',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.10,
                  shadowRadius: 7,
                  elevation: 4,
                }}
              >
                {item.fotoUrl ? (
                  <Image
                    source={{ uri: item.fotoUrl }}
                    style={{
                      width: 132,
                      height: '100%',
                      backgroundColor: '#f3f4f6',
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <AcademiaSemFoto nome={item.nome} />
                )}

                <View
                  style={{
                    flex: 1,
                    paddingHorizontal: 9,
                    paddingVertical: 7,
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: '#000000',
                        fontSize: 15,
                        lineHeight: 18,
                        fontWeight: '900',
                      }}
                    >
                      {item.nome}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: '#555', fontSize: 11, lineHeight: 14, marginTop: 1 }}
                    >
                      {item.endereco}{item.numero ? `, ${item.numero}` : ''}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: '#666', fontSize: 11, lineHeight: 14 }}
                    >
                      {item.bairro ? `${item.bairro} - ` : ''}{item.cidade}
                      {item.estado ? `, ${item.estado}` : ''}
                    </Text>

                    <View style={{ height: 15, justifyContent: 'center' }}>
                      {formatarDistancia(item.distanciaKm) ? (
                        <Text
                          numberOfLines={1}
                          style={{ color: '#111', fontWeight: '800', fontSize: 11, lineHeight: 14 }}
                        >
                          {formatarDistancia(item.distanciaKm)}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        style={{ color: '#ea580c', fontSize: 10, lineHeight: 13, flexShrink: 1 }}
                      >
                        CEP: {formatarCep(item.cep)}
                      </Text>
                      {item.nota !== null && item.nota !== undefined ? (
                        <Text
                          numberOfLines={1}
                          style={{ color: '#111', fontSize: 11, lineHeight: 13, fontWeight: '900' }}
                        >
                          {Number(item.nota).toFixed(1)} ⭐
                        </Text>
                      ) : (
                        <Text numberOfLines={1} style={{ color: '#888', fontSize: 10, lineHeight: 13 }}>
                          Sem avaliações
                        </Text>
                      )}
                    </View>
                  </View>

                  {ehUsuarioComum(usuario) ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 7,
                      }}
                    >
                      <TouchableOpacity
                        onPress={(event) => {
                          event.stopPropagation();
                          alternarComparacao(item);
                        }}
                        style={{
                          flex: 1,
                          minHeight: 29,
                          borderWidth: 1,
                          borderColor:
                            academiaEstaSelecionadaParaComparacao(
                              academiasComparacao,
                              item.id
                            )
                              ? '#f97316'
                              : '#000',
                          borderRadius: 6,
                          backgroundColor:
                            academiaEstaSelecionadaParaComparacao(
                              academiasComparacao,
                              item.id
                            )
                              ? '#f97316'
                              : '#fff',
                          paddingHorizontal: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.72}
                          style={{
                            color: '#000',
                            fontSize: 10,
                            fontWeight: '900',
                          }}
                        >
                          {academiaEstaSelecionadaParaComparacao(
                            academiasComparacao,
                            item.id
                          )
                            ? 'Remover da comparação'
                            : 'Comparar'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={(event) => {
                          event.stopPropagation();
                          alternarFavorito(item.id);
                        }}
                        style={{
                          width: 29,
                          height: 29,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#fff7ed',
                          borderRadius: 15,
                          borderWidth: 1,
                          borderColor: '#fed7aa',
                        }}
                      >
                        <Ionicons
                          name={
                            favoritos.includes(
                              String(item.id)
                            )
                              ? 'star'
                              : 'star-outline'
                          }
                          size={20}
                          color="#f59e0b"
                        />
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
          />
        )}

        {ehUsuarioComum(usuario) &&
        academiasComparacao.length > 0 ? (
          <ComparisonBar
            academiasSelecionadas={
              academiasComparacao
            }
            onRemover={
              removerDaComparacao
            }
            onLimpar={
              limparAcademiasComparacao
            }
            onComparar={
              abrirComparacao
            }
            bottom={92}
          />
        ) : null}

        <BottomTabBar usuario={usuario} />
      </View>
    </LogymBackground>
  );

}
