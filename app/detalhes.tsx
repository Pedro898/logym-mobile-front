import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  alternarFavoritoNoBanco,
  avaliacaoEstaSuspensa,
  avaliacaoPertenceAoUsuario,
  buscarAcademiaPorId,
  buscarAvaliacoesDaAcademia,
  buscarFavoritosDoUsuario,
  buscarFotosAcademia,
  buscarItensAvaliacao,
  buscarUsuarioAutenticado,
  criarAvaliacao,
  extrairIdsAcademiasFavoritas,
  getFotoAcademiaUrl,
  getFotoPrincipalAcademiaUrl,
  getNomeUsuarioAvaliacao,
  getNotaItemAvaliacao,
  inativarAvaliacao,
  montarItensAvaliacaoParaEnvio,
  normalizarCategorias,
  normalizarFacilidades,
  todosItensAvaliados,

  type Academia,
  type Avaliacao,
  type FotoAcademia,
  type ItemAvaliacao,
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
import AcademyMap from '@/components/AcademyMap';
import BottomTabBar from '@/components/BottomTabBar';
import ComparisonBar from '@/components/ComparisonBar';
import LogymBackground from '@/components/LogymBackground';

// ================================================================
// FOTO DA GALERIA
//
// Guardamos a URL pronta no estado.
//
// Isso é importante porque getFotoAcademiaUrl() adiciona Date.now()
// para evitar cache de fotos antigas.
//
// Se chamássemos getFotoAcademiaUrl() diretamente dentro do JSX,
// cada renderização poderia gerar uma URL diferente.
// ================================================================

type FotoGaleria = {
  id: string | number;
  url: string;
};

// ================================================================
// PRIMEIRA LETRA DA ACADEMIA
// ================================================================

function getInicialAcademia(nome?: string) {
  const nomeLimpo = String(nome || 'A').trim();

  if (!nomeLimpo) {
    return 'A';
  }

  return nomeLimpo
    .charAt(0)
    .toUpperCase();
}


function formatarCEP(cep?: string | number | null) {
  if (cep === null || cep === undefined) {
    return 'Não informado';
  }

  const numeros = String(cep).replace(/\D/g, '');

  if (numeros.length !== 8) {
    return String(cep);
  }

  return numeros.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

function formatarCNPJ(cnpj?: string | null) {
  if (!cnpj) {
    return 'Não informado';
  }

  const numeros = String(cnpj).replace(/\D/g, '');

  if (numeros.length !== 14) {
    return String(cnpj);
  }

  return numeros.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

function montarEnderecoCompleto(academia: Academia) {
  const linha1 = [
    academia.endereco,
    academia.numero ? `nº ${academia.numero}` : null,
    academia.complemento,
  ]
    .filter(Boolean)
    .join(', ');

  const linha2 = [
    academia.bairro,
    academia.cidade,
    academia.estado,
  ]
    .filter(Boolean)
    .join(' - ');

  if (linha1 && linha2) {
    return `${linha1}, ${linha2}`;
  }

  return linha1 || linha2 || 'Endereço não informado';
}

function LinhaInformacao({
  icone,
  rotulo,
  valor,
}: {
  icone: any;
  rotulo: string;
  valor?: string | number | null;
}) {
  const texto =
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ''
      ? 'Não informado'
      : String(valor);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 7,
      }}
    >
      <Ionicons
        name={icone}
        size={18}
        color="#f97316"
        style={{
          marginTop: 1,
          marginRight: 8,
        }}
      />

      <Text
        style={{
          flex: 1,
          color: '#333',
          fontSize: 15,
          lineHeight: 22,
        }}
      >
        <Text
          style={{
            color: '#000',
            fontWeight: '900',
          }}
        >
          {rotulo}:{' '}
        </Text>
        {texto}
      </Text>
    </View>
  );
}

// ================================================================
// FALLBACK QUANDO NÃO EXISTE FOTO
// ================================================================

function AcademiaSemFotoGrande({
  nome,
}: {
  nome?: string;
}) {
  return (
    <LinearGradient
      colors={['#000000', '#f97316']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 280,
        height: 190,
        alignSelf: 'center',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#000',
      }}
    >
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: '#fff',
          borderWidth: 3,
          borderColor: '#f97316',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#000',
            fontSize: 42,
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
// TELA
// ================================================================

export default function Detalhes() {
  const router = useRouter();

  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  // ==============================================================
  // USUÁRIO
  // ==============================================================

  const [
    usuario,
    setUsuario,
  ] =
    useState<Usuario | null>(
      null
    );

  // ==============================================================
  // ACADEMIA
  // ==============================================================

  const [
    academia,
    setAcademia,
  ] =
    useState<Academia | null>(
      null
    );

  // ==============================================================
  // GALERIA DE FOTOS
  //
  // Antes tínhamos apenas:
  //
  // const [fotoUrl, setFotoUrl] = ...
  //
  // Agora guardamos TODAS as fotos.
  // ==============================================================

  const [
    fotosAcademia,
    setFotosAcademia,
  ] = useState<
    FotoGaleria[]
  >([]);

  // Foto atualmente selecionada.
  const [
    fotoAtualIndex,
    setFotoAtualIndex,
  ] = useState(0);

  // ==============================================================
  // FAVORITOS
  // ==============================================================

  const [
    favoritos,
    setFavoritos,
  ] =
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
  // AVALIAÇÕES
  // ==============================================================

  const [
    avaliacoes,
    setAvaliacoes,
  ] =
    useState<Avaliacao[]>([]);

  // ==============================================================
  // CRITÉRIOS DE AVALIAÇÃO
  // ==============================================================

  const [
    itensAvaliacao,
    setItensAvaliacao,
  ] = useState<
    ItemAvaliacao[]
  >([]);

  // ==============================================================
  // NOTAS SELECIONADAS
  //
  // Exemplo:
  //
  // {
  //   "1": 5,
  //   "2": 4
  // }
  // ==============================================================

  const [
    notasSelecionadas,
    setNotasSelecionadas,
  ] = useState<
    Record<string, number>
  >({});

  // ==============================================================
  // EDIÇÃO
  // ==============================================================

  const [
    editandoAvaliacao,
    setEditandoAvaliacao,
  ] = useState(false);

  // ==============================================================
  // CARREGAMENTOS
  // ==============================================================

  const [
    enviandoAvaliacao,
    setEnviandoAvaliacao,
  ] = useState(false);

  const [
    excluindoAvaliacao,
    setExcluindoAvaliacao,
  ] = useState(false);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState('');

  // ==============================================================
  // AVALIAÇÕES INATIVADAS LOCALMENTE
  // ==============================================================

  const [
    idsAvaliacoesInativadas,
    setIdsAvaliacoesInativadas,
  ] = useState<string[]>(
    []
  );

  // ==============================================================
  // FOTO ATUAL DA GALERIA
  // ==============================================================

  const fotoAtual =
    fotosAcademia[
      fotoAtualIndex
    ] || null;

  // ==============================================================
  // EXISTE MAIS DE UMA FOTO?
  // ==============================================================

  const possuiVariasFotos =
    fotosAcademia.length > 1;

  // ==============================================================
  // FOTO ANTERIOR
  //
  // Fazemos a galeria circular:
  //
  // foto 1
  // ←
  // vai para a última
  // ==============================================================

  function fotoAnterior() {
    if (
      fotosAcademia.length <= 1
    ) {
      return;
    }

    setFotoAtualIndex(
      (indiceAtual) => {
        if (
          indiceAtual === 0
        ) {
          return (
            fotosAcademia.length -
            1
          );
        }

        return (
          indiceAtual - 1
        );
      }
    );
  }

  // ==============================================================
  // PRÓXIMA FOTO
  //
  // Também é circular:
  //
  // última foto
  // →
  // volta para a primeira
  // ==============================================================

  function proximaFoto() {
    if (
      fotosAcademia.length <= 1
    ) {
      return;
    }

    setFotoAtualIndex(
      (indiceAtual) => {
        if (
          indiceAtual ===
          fotosAcademia.length -
            1
        ) {
          return 0;
        }

        return (
          indiceAtual + 1
        );
      }
    );
  }

  // ==============================================================
  // AVALIAÇÕES VISÍVEIS
  // ==============================================================

  const avaliacoesAtivas =
    useMemo(() => {
      return avaliacoes.filter(
        (avaliacao) => {
          const status =
            String(
              avaliacao.statusAvaliacao ||
                'ATIVO'
            ).toUpperCase();

          const foiInativadaLocalmente =
            idsAvaliacoesInativadas.includes(
              String(
                avaliacao.id
              )
            );

          return (
            status !==
              'INATIVO' &&
            !foiInativadaLocalmente
          );
        }
      );
    }, [
      avaliacoes,
      idsAvaliacoesInativadas,
    ]);

  // ==============================================================
  // MINHA AVALIAÇÃO
  // ==============================================================

  const minhaAvaliacao =
    useMemo(() => {
      if (!usuario?.id) {
        return null;
      }

      return (
        avaliacoesAtivas.find(
          (avaliacao) =>
            avaliacaoPertenceAoUsuario(
              avaliacao,
              usuario.id
            )
        ) || null
      );
    }, [
      avaliacoesAtivas,
      usuario?.id,
    ]);

  // ==============================================================
  // MINHA AVALIAÇÃO ESTÁ SUSPENSA?
  // ==============================================================

  const minhaAvaliacaoSuspensa =
    avaliacaoEstaSuspensa(
      minhaAvaliacao
    );

  // ==============================================================
  // MOSTRAR FORMULÁRIO
  // ==============================================================

  const deveMostrarFormularioAvaliacao =
    ehUsuarioComum(usuario) &&
    (!minhaAvaliacao ||
      editandoAvaliacao) &&
    !minhaAvaliacaoSuspensa;

  // ==============================================================
  // BUSCAR AVALIAÇÕES
  // ==============================================================

  async function carregarAvaliacoes(
    academiaId:
      | string
      | number,

    usuarioId?:
      | string
      | number
  ) {
    try {
      const avaliacoesBanco =
        await buscarAvaliacoesDaAcademia(
          academiaId,
          usuarioId
        );

      setAvaliacoes(
        Array.isArray(
          avaliacoesBanco
        )
          ? avaliacoesBanco
          : []
      );
    } catch (error) {
      console.error(
        'Erro ao buscar avaliações:',
        error
      );

      setAvaliacoes([]);
    }
  }

  // ==============================================================
  // BUSCAR CRITÉRIOS
  // ==============================================================

  async function carregarItensAvaliacao() {
    try {
      const itens =
        await buscarItensAvaliacao();

      setItensAvaliacao(
        Array.isArray(itens)
          ? itens
          : []
      );
    } catch (error) {
      console.error(
        'Erro ao carregar critérios de avaliação:',
        error
      );

      setItensAvaliacao([]);
    }
  }

  // ==============================================================
  // BUSCAR TODAS AS FOTOS DA ACADEMIA
  // ==============================================================

  async function carregarFotosAcademia(
    academiaId:
      | string
      | number
  ) {
    try {
      const fotosBanco =
        await buscarFotosAcademia(
          academiaId
        );

      if (
        !Array.isArray(
          fotosBanco
        ) ||
        fotosBanco.length === 0
      ) {
        setFotosAcademia(
          []
        );

        setFotoAtualIndex(
          0
        );

        return;
      }

      // ==========================================================
      // FILTRAMOS FOTOS INATIVAS CASO O BACKEND AS RETORNE
      //
      // Se statusFotoAcademia não vier no objeto, mantemos a foto.
      // ==========================================================

      const fotosDisponiveis =
        fotosBanco.filter(
          (
            foto: FotoAcademia
          ) => {
            if (
              !foto.statusFotoAcademia
            ) {
              return true;
            }

            return (
              String(
                foto.statusFotoAcademia
              ).toUpperCase() !==
              'INATIVO'
            );
          }
        );

      // ==========================================================
      // MONTA AS URLS UMA ÚNICA VEZ
      //
      // Assim elas permanecem estáveis durante a renderização.
      // ==========================================================

      const galeria =
        fotosDisponiveis
          .map(
            (
              foto: FotoAcademia
            ) => {
              const url =
                getFotoAcademiaUrl(
                  foto.id
                );

              if (!url) {
                return null;
              }

              return {
                id: foto.id,
                url,
              };
            }
          )
          .filter(
            (
              foto
            ): foto is FotoGaleria =>
              foto !== null
          );

      setFotosAcademia(
        galeria
      );

      // Sempre inicia pela primeira.
      setFotoAtualIndex(
        0
      );
    } catch (error) {
      console.error(
        'Erro ao carregar fotos da academia:',
        error
      );

      setFotosAcademia(
        []
      );

      setFotoAtualIndex(
        0
      );
    }
  }

  // ==============================================================
  // ATUALIZA A SELEÇÃO DE COMPARAÇÃO AO VOLTAR PARA A TELA
  // ==============================================================

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      buscarAcademiasSelecionadasComparacao().then((selecionadas) => {
        if (ativo) {
          setAcademiasComparacao(selecionadas);
        }
      });

      return () => {
        ativo = false;
      };
    }, [])
  );

  // ==============================================================
  // CARREGA A TELA
  // ==============================================================

  useEffect(() => {
    async function carregarDetalhes() {
      try {
        setCarregando(true);

        setErro('');

        // ========================================================
        // USUÁRIO AUTENTICADO
        //
        // Validamos a sessão real antes de carregar favoritos e
        // avaliações. Isso mantém o Mobile consistente após F5.
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
        // ID DA ACADEMIA
        // ========================================================

        if (!id) {
          setErro(
            'Academia não encontrada.'
          );

          return;
        }

        // ========================================================
        // ACADEMIA
        // ========================================================

        const academiaBanco =
          await buscarAcademiaPorId(
            id
          );

        setAcademia(
          academiaBanco
        );

        // ========================================================
        // FAVORITOS
        // ========================================================

        if (
          usuarioLogado?.id &&
          ehUsuarioComum(usuarioLogado)
        ) {
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

            setFavoritos(
              []
            );
          }
        } else {
          setFavoritos([]);
        }

        // ========================================================
        // AVALIAÇÕES + CRITÉRIOS + TODAS AS FOTOS
        // ========================================================

        await Promise.all([
          carregarAvaliacoes(
            id,
            usuarioLogado?.id
          ),

          carregarItensAvaliacao(),

          carregarFotosAcademia(
            id
          ),
        ]);
      } catch (error) {
        console.error(
          'Erro ao carregar detalhes:',
          error
        );

        setErro(
          'Erro ao carregar os detalhes da academia.'
        );
      } finally {
        setCarregando(
          false
        );
      }
    }

    carregarDetalhes();
  }, [id]);

  // ==============================================================
  // FAVORITAR
  // ==============================================================

  async function favoritarAcademia() {
    if (
      !academia ||
      !usuario?.id ||
      !ehUsuarioComum(usuario)
    ) {
      return;
    }

    const academiaId =
      String(
        academia.id
      );

    const favoritosAnteriores =
      favoritos;

    const novosFavoritos =
      favoritos.includes(
        academiaId
      )
        ? favoritos.filter(
            (
              favoritoId
            ) =>
              favoritoId !==
              academiaId
          )
        : [
            ...favoritos,
            academiaId,
          ];

    setFavoritos(
      novosFavoritos
    );

    try {
      await alternarFavoritoNoBanco(
        usuario.id,
        academia.id
      );
    } catch (error) {
      console.error(
        'Erro ao atualizar favorito:',
        error
      );

      setFavoritos(
        favoritosAnteriores
      );
    }
  }

  // ==============================================================
  // COMPARAÇÃO
  // ==============================================================

  async function alternarComparacao() {
    if (
      !academia ||
      !ehUsuarioComum(usuario)
    ) {
      return;
    }

    const resultado =
      await alternarAcademiaNaComparacao({
        id: academia.id,
        nome: academia.nome,
      });

    if (resultado.limiteAtingido) {
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
    academiaId: string | number
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
      academiasComparacao.length < 2
    ) {
      return;
    }

    router.push(
      '/comparar-academias' as any
    );
  }

  // ==============================================================
  // SELECIONAR NOTA
  // ==============================================================

  function selecionarNota(
    itemId:
      | string
      | number,

    nota: number
  ) {
    setNotasSelecionadas(
      (
        notasAtuais
      ) => ({
        ...notasAtuais,

        [String(
          itemId
        )]: nota,
      })
    );
  }

  // ==============================================================
  // INICIAR EDIÇÃO DA AVALIAÇÃO
  // ==============================================================

  function iniciarEdicaoAvaliacao(
    avaliacao: Avaliacao
  ) {
    if (!ehUsuarioComum(usuario)) {
      return;
    }

    if (
      avaliacaoEstaSuspensa(
        avaliacao
      )
    ) {
      Alert.alert(
        'Avaliação suspensa',
        'Esta avaliação foi suspensa e não pode ser editada.'
      );

      return;
    }

    const notasExistentes:
      Record<
        string,
        number
      > = {};

    itensAvaliacao.forEach(
      (item) => {
        notasExistentes[
          String(item.id)
        ] =
          getNotaItemAvaliacao(
            avaliacao,
            item.id
          );
      }
    );

    setNotasSelecionadas(
      notasExistentes
    );

    setEditandoAvaliacao(
      true
    );
  }

  // ==============================================================
  // CANCELAR EDIÇÃO
  // ==============================================================

  function cancelarEdicaoAvaliacao() {
    setNotasSelecionadas(
      {}
    );

    setEditandoAvaliacao(
      false
    );
  }

  // ==============================================================
  // ENVIAR AVALIAÇÃO
  // ==============================================================

  async function enviarAvaliacao() {
    if (!ehUsuarioComum(usuario)) {
      Alert.alert(
        'Ação não disponível',
        'Gerentes e administradores podem consultar as avaliações, mas não podem avaliar academias.'
      );
      return;
    }

    if (
      !academia ||
      !usuario?.id
    ) {
      Alert.alert(
        'Atenção',
        'Usuário não encontrado. Faça login novamente.'
      );

      return;
    }

    // ============================================================
    // ACADEMIA SUSPENSA
    // ============================================================

    if (
      String(
        academia.statusAcademia ||
          ''
      ).toUpperCase() ===
      'SUSPENSA'
    ) {
      Alert.alert(
        'Academia suspensa',
        'Não é possível avaliar uma academia suspensa.'
      );

      return;
    }

    // ============================================================
    // SEM CRITÉRIOS
    // ============================================================

    if (
      itensAvaliacao.length ===
      0
    ) {
      Alert.alert(
        'Atenção',
        'Nenhum critério de avaliação está disponível no momento.'
      );

      return;
    }

    // ============================================================
    // TODOS PRECISAM SER AVALIADOS
    // ============================================================

    if (
      !todosItensAvaliados(
        itensAvaliacao,
        notasSelecionadas
      )
    ) {
      Alert.alert(
        'Atenção',
        'Avalie todos os critérios antes de enviar.'
      );

      return;
    }

    try {
      setEnviandoAvaliacao(
        true
      );

      const itensParaEnvio =
        montarItensAvaliacaoParaEnvio(
          itensAvaliacao,
          notasSelecionadas
        );

      await criarAvaliacao(
        usuario.id,
        academia.id,
        {
          itens:
            itensParaEnvio,
        }
      );

      setIdsAvaliacoesInativadas(
        []
      );

      setNotasSelecionadas(
        {}
      );

      const estavaEditando =
        editandoAvaliacao;

      setEditandoAvaliacao(
        false
      );

      await carregarAvaliacoes(
        academia.id,
        usuario.id
      );

      // Atualiza os dados da academia imediatamente para refletir
      // a nova média/nota sem precisar recarregar a página.
      const academiaAtualizada =
        await buscarAcademiaPorId(
          academia.id
        );

      setAcademia(
        academiaAtualizada
      );

      Alert.alert(
        'Sucesso',

        estavaEditando
          ? 'Avaliação atualizada com sucesso.'
          : 'Avaliação enviada com sucesso.'
      );
    } catch (error) {
      console.error(
        'Erro ao enviar avaliação:',
        error
      );

      if (
        error instanceof
        Error
      ) {
        Alert.alert(
          'Erro',
          error.message
        );
      } else {
        Alert.alert(
          'Erro',
          'Não foi possível enviar sua avaliação.'
        );
      }
    } finally {
      setEnviandoAvaliacao(
        false
      );
    }
  }

  // ==============================================================
  // EXECUTA A EXCLUSÃO
  // ==============================================================

  async function executarExclusaoAvaliacao() {
    if (
      !usuario?.id ||
      !minhaAvaliacao ||
      !academia
    ) {
      Alert.alert(
        'Erro',
        'Não foi possível identificar sua avaliação.'
      );

      return;
    }

    if (
      avaliacaoEstaSuspensa(
        minhaAvaliacao
      )
    ) {
      Alert.alert(
        'Avaliação suspensa',
        'Uma avaliação suspensa não pode ser excluída pelo usuário.'
      );

      return;
    }

    try {
      setExcluindoAvaliacao(
        true
      );

      const idAvaliacaoExcluida =
        String(
          minhaAvaliacao.id
        );

      await inativarAvaliacao(
        minhaAvaliacao.id,
        usuario.id
      );

      setAvaliacoes(
        (
          listaAtual
        ) =>
          listaAtual.filter(
            (
              avaliacao
            ) =>
              String(
                avaliacao.id
              ) !==
              idAvaliacaoExcluida
          )
      );

      setIdsAvaliacoesInativadas(
        (
          listaAtual
        ) => [
          ...listaAtual,
          idAvaliacaoExcluida,
        ]
      );

      setNotasSelecionadas(
        {}
      );

      setEditandoAvaliacao(
        false
      );

      await carregarAvaliacoes(
        academia.id,
        usuario.id
      );

      // Atualiza os dados da academia imediatamente para refletir
      // a nova média/nota sem precisar recarregar a página.
      const academiaAtualizada =
        await buscarAcademiaPorId(
          academia.id
        );

      setAcademia(
        academiaAtualizada
      );

      Alert.alert(
        'Sucesso',
        'Avaliação excluída com sucesso.'
      );
    } catch (error) {
      console.error(
        'Erro ao excluir avaliação:',
        error
      );

      if (
        error instanceof
        Error
      ) {
        Alert.alert(
          'Erro',
          error.message
        );
      } else {
        Alert.alert(
          'Erro',
          'Não foi possível excluir sua avaliação.'
        );
      }
    } finally {
      setExcluindoAvaliacao(
        false
      );
    }
  }

  // ==============================================================
  // CONFIRMAÇÃO DE EXCLUSÃO
  // ==============================================================

  function excluirMinhaAvaliacao() {
    if (!ehUsuarioComum(usuario)) {
      return;
    }

    if (
      !usuario?.id ||
      !minhaAvaliacao ||
      !academia
    ) {
      Alert.alert(
        'Erro',
        'Não foi possível identificar sua avaliação.'
      );

      return;
    }

    if (
      avaliacaoEstaSuspensa(
        minhaAvaliacao
      )
    ) {
      Alert.alert(
        'Avaliação suspensa',
        'Uma avaliação suspensa não pode ser excluída pelo usuário.'
      );

      return;
    }

    // ============================================================
    // WEB
    // ============================================================

    if (
      Platform.OS ===
      'web'
    ) {
      const confirmou =
        window.confirm(
          'Tem certeza que deseja excluir sua avaliação?'
        );

      if (confirmou) {
        executarExclusaoAvaliacao();
      }

      return;
    }

    // ============================================================
    // ANDROID / IOS
    // ============================================================

    Alert.alert(
      'Excluir avaliação',

      'Tem certeza que deseja excluir sua avaliação?',

      [
        {
          text:
            'Cancelar',

          style:
            'cancel',
        },

        {
          text:
            'Excluir',

          style:
            'destructive',

          onPress:
            executarExclusaoAvaliacao,
        },
      ]
    );
  }

  // ==============================================================
  // CARREGANDO
  // ==============================================================

  if (carregando) {
    return (
      <LogymBackground>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#e5e5e5',
              borderRadius: 16,
              paddingVertical: 22,
              paddingHorizontal: 26,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <ActivityIndicator color="#f97316" />
            <Text
              style={{
                color: '#444',
                marginTop: 12,
                textAlign: 'center',
                fontWeight: '700',
              }}
            >
              Carregando detalhes da academia...
            </Text>
          </View>
        </View>
      </LogymBackground>
    );
  }

  // ==============================================================
  // ERRO
  // ==============================================================

  if (
    erro ||
    !academia
  ) {
    return (
      <LogymBackground>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: '#fff',
              borderWidth: 1,
              borderColor: '#fecdd3',
              borderRadius: 16,
              padding: 20,
              alignItems: 'center',
            }}
          >
            <Ionicons name="alert-circle-outline" size={34} color="#dc2626" />
            <Text
              style={{
                color: '#991b1b',
                fontSize: 15,
                lineHeight: 21,
                textAlign: 'center',
                marginTop: 8,
                marginBottom: 18,
                fontWeight: '700',
              }}
            >
              {erro || 'Academia não encontrada.'}
            </Text>

            <TouchableOpacity
              onPress={() => router.replace('/academias')}
              style={{
                backgroundColor: '#000',
                paddingVertical: 11,
                paddingHorizontal: 22,
                borderRadius: 9,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>
                Voltar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LogymBackground>
    );
  }

  const nivelAcessoAtual = String(
    usuario?.nivelAcesso || ''
  ).toUpperCase();

  const ehAdmin =
    nivelAcessoAtual === 'ADMIN';

  const academiaSuspensa =
    String(
      academia.statusAcademia || ''
    ).toUpperCase() === 'SUSPENSA';

  // ==============================================================
  // ACADEMIA SUSPENSA
  // ==============================================================

  if (
    academiaSuspensa &&
    !ehAdmin
  ) {
    return (
      <LogymBackground>
        <View
          style={{
            flex: 1,
            paddingTop: 20,
            paddingHorizontal: 20,
          }}
        >
        {/* ========================================================
            VOLTAR
        ======================================================== */}

        <TouchableOpacity
          onPress={() =>
            router.replace(
              '/academias'
            )
          }
          style={{
            alignSelf:
              'flex-start',

            marginBottom: 35,
          }}
        >
          <Ionicons
            name="arrow-back"
            size={32}
            color="#f97316"
          />
        </TouchableOpacity>

        {/* ========================================================
            AVISO
        ======================================================== */}

        <View
          style={{
            backgroundColor: '#ffffff',

            borderRadius: 22,

            borderWidth: 1,

            borderColor:
              '#f97316',

            paddingVertical:
              28,

            paddingHorizontal:
              22,
          }}
        >
          <View
            style={{
              width: 62,

              height: 62,

              borderRadius: 31,

              backgroundColor: '#fff7ed',

              alignItems:
                'center',

              justifyContent:
                'center',

              alignSelf:
                'center',

              marginBottom: 18,
            }}
          >
            <Ionicons
              name="alert-circle-outline"
              size={38}
              color="#f97316"
            />
          </View>

          <Text
            style={{
              color:
                '#f97316',

              fontSize: 24,

              fontWeight:
                'bold',

              textAlign:
                'center',

              marginBottom:
                14,
            }}
          >
            Academia suspensa
          </Text>

          <Text
            style={{
              color: '#fff',

              fontSize: 16,

              textAlign:
                'center',

              lineHeight: 23,
            }}
          >
            Esta academia foi suspensa pela administração da LOGYM.
            Ela não está disponível para usuários comuns no momento.
          </Text>

          <Text
            style={{
              color: '#aaa',

              fontSize: 15,

              textAlign:
                'center',

              lineHeight: 22,

              marginTop: 14,
            }}
          >
            Para mais informações, entre em contato com o suporte.
          </Text>

          <TouchableOpacity
            onPress={() =>
              router.replace(
                '/academias'
              )
            }
            style={{
              backgroundColor:
                '#f97316',

              paddingVertical:
                14,

              borderRadius:
                14,

              alignItems:
                'center',

              marginTop: 24,
            }}
          >
            <Text
              style={{
                color: '#fff',

                fontWeight:
                  'bold',

                fontSize: 16,
              }}
            >
              Voltar para academias
            </Text>
          </TouchableOpacity>
        </View>
        </View>
      </LogymBackground>
    );
  }

  // ==============================================================
  // ID DA ACADEMIA
  // ==============================================================

  const academiaId =
    String(
      academia.id
    );

  // ==============================================================
  // CATEGORIAS
  // ==============================================================

  const categorias =
    academia
      .categoriasVinculadas &&
    academia
      .categoriasVinculadas
      .length > 0
      ? academia.categoriasVinculadas.map(
          (
            categoria
          ) =>
            categoria.nome
        )
      : normalizarCategorias(
          academia.categorias
        );

  // ==============================================================
  // FACILIDADES
  // ==============================================================

  const facilidades =
    academia
      .facilidadesVinculadas &&
    academia
      .facilidadesVinculadas
      .length > 0
      ? academia.facilidadesVinculadas.map(
          (
            facilidade
          ) =>
            facilidade.nome
        )
      : normalizarFacilidades(
          academia.facilidades
        );

  // ==============================================================
  // INTERFACE
  // ==============================================================

  const fotoPrincipalDetalhesUrl =
    getFotoPrincipalAcademiaUrl(
      academia.fotoPrincipal
    ) || fotoAtual?.url || null;

  const tituloSecao = {
    color: '#111',
    fontSize: 20,
    fontWeight: '900' as const,
    marginBottom: 12,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#ededed',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  };

  const cardSecao = {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#e7e7e7',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  };

  return (
    <LogymBackground>
      <ScrollView
        style={{
          flex: 1,
          width: '100%',
          alignSelf: 'center',
          backgroundColor: 'transparent',
        }}
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: 16,
          paddingBottom:
            ehUsuarioComum(usuario) &&
            academiasComparacao.length > 0
              ? 205
              : 110,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* VOLTAR */}
        <TouchableOpacity
          onPress={() =>
            router.replace('/academias')
          }
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#000',
            borderRadius: 6,
            paddingVertical: 10,
            paddingHorizontal: 14,
            marginBottom: 18,
          }}
        >
          <Ionicons
            name="arrow-back"
            size={19}
            color="#fff"
          />
          <Text
            style={{
              color: '#fff',
              fontWeight: '900',
              fontSize: 13,
              marginLeft: 6,
              textTransform: 'uppercase',
              letterSpacing: 0.7,
            }}
          >
            Voltar para a busca
          </Text>
        </TouchableOpacity>

        {/* AVISO DE ACADEMIA SUSPENSA PARA ADMIN */}
        {academiaSuspensa && ehAdmin ? (
          <View
            style={{
              backgroundColor: '#fff7ed',
              borderWidth: 1,
              borderColor: '#f97316',
              borderRadius: 8,
              padding: 13,
              marginBottom: 18,
              flexDirection: 'row',
              alignItems: 'flex-start',
            }}
          >
            <Ionicons
              name="warning-outline"
              size={21}
              color="#f97316"
            />
            <Text
              style={{
                flex: 1,
                color: '#333',
                fontSize: 13,
                lineHeight: 19,
                marginLeft: 8,
                fontWeight: '700',
              }}
            >
              Esta academia está suspensa. Somente administradores conseguem visualizá-la normalmente.
            </Text>
          </View>
        ) : null}

        {/* CABEÇALHO - MESMA IDEIA DO WEB */}
        <View
          style={{
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          {fotoPrincipalDetalhesUrl ? (
            <Image
              source={{
                uri: fotoPrincipalDetalhesUrl,
              }}
              style={{
                width: 280,
                height: 190,
                borderRadius: 14,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#ddd',
              }}
              resizeMode="cover"
            />
          ) : (
            <AcademiaSemFotoGrande
              nome={academia.nome}
            />
          )}

          <Text
            style={{
              color: '#000',
              fontSize: 29,
              lineHeight: 35,
              fontWeight: '900',
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginTop: 18,
            }}
          >
            {academia.nome}
          </Text>

          <Text
            style={{
              color: '#333',
              fontSize: 15,
              lineHeight: 22,
              textAlign: 'center',
              marginTop: 5,
              paddingHorizontal: 8,
            }}
          >
            {montarEnderecoCompleto(academia)}
          </Text>

          <Text
            style={{
              color: '#333',
              fontSize: 16,
              fontWeight: '700',
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            {academia.nota !== null &&
            academia.nota !== undefined
              ? `Avaliação: ${Number(academia.nota).toFixed(1)} ⭐`
              : 'Sem avaliações'}
          </Text>

          {ehUsuarioComum(usuario) ? (
            <View
              style={{
                width: '100%',
                marginTop: 16,
                gap: 9,
              }}
            >
              <TouchableOpacity
                onPress={favoritarAcademia}
                style={{
                  width: '100%',
                  minHeight: 45,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: '#000',
                  backgroundColor:
                    favoritos.includes(academiaId)
                      ? '#f97316'
                      : '#fff',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 12,
                }}
              >
                <Text
                  style={{
                    color: '#000',
                    fontSize: 14,
                    fontWeight: '800',
                  }}
                >
                  {favoritos.includes(academiaId)
                    ? 'Favorita'
                    : 'Adicionar aos favoritos'}
                </Text>
                <Ionicons
                  name={
                    favoritos.includes(academiaId)
                      ? 'star'
                      : 'star-outline'
                  }
                  size={19}
                  color="#000"
                  style={{ marginLeft: 7 }}
                />
              </TouchableOpacity>

              
              <TouchableOpacity
                onPress={alternarComparacao}
                style={{
                  width: '100%',
                  minHeight: 45,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor:
                    academiaEstaSelecionadaParaComparacao(
                      academiasComparacao,
                      academia.id
                    )
                      ? '#f97316'
                      : '#000',
                  backgroundColor:
                    academiaEstaSelecionadaParaComparacao(
                      academiasComparacao,
                      academia.id
                    )
                      ? '#f97316'
                      : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 12,
                }}
              >
                <Text
                  style={{
                    color: '#000',
                    fontSize: 14,
                    fontWeight: '800',
                  }}
                >
                  {academiaEstaSelecionadaParaComparacao(
                    academiasComparacao,
                    academia.id
                  )
                    ? 'Remover da comparação'
                    : 'Adicionar à comparação'}
                </Text>
              </TouchableOpacity>

            </View>
          ) : null}
        </View>

        {/* SOBRE A ACADEMIA */}
        <View style={cardSecao}>
          <Text style={tituloSecao}>
            Sobre a Academia
          </Text>
          <Text
            style={{
              color: '#333',
              fontSize: 15,
              lineHeight: 25,
            }}
          >
            {academia.descricao ||
              'Nenhuma descrição informada.'}
          </Text>
        </View>

        {/* INFORMAÇÕES */}
        <View style={cardSecao}>
          <Text style={tituloSecao}>
            Informações da Academia
          </Text>

          <LinhaInformacao
            icone="business-outline"
            rotulo="CNPJ"
            valor={formatarCNPJ(academia.cnpj)}
          />
          <LinhaInformacao
            icone="navigate-outline"
            rotulo="CEP"
            valor={formatarCEP(academia.cep)}
          />
          <LinhaInformacao
            icone="location-outline"
            rotulo="Endereço"
            valor={montarEnderecoCompleto(academia)}
          />
        </View>

        {/* LOCALIZAÇÃO */}
        <View style={cardSecao}>
          <Text style={tituloSecao}>
            Localização
          </Text>
          <View
            style={{
              overflow: 'hidden',
              borderRadius: 6,
            }}
          >
            <AcademyMap
              latitude={academia.latitude}
              longitude={academia.longitude}
              nome={academia.nome}
              endereco={montarEnderecoCompleto(academia)}
            />
          </View>
        </View>

        {/* CONTATO */}
        <View style={cardSecao}>
          <Text style={tituloSecao}>
            Informações de Contato
          </Text>

          <LinhaInformacao
            icone="call-outline"
            rotulo="Telefone"
            valor={academia.telefone}
          />
          <LinhaInformacao
            icone="phone-portrait-outline"
            rotulo="Celular"
            valor={academia.celular}
          />
          <LinhaInformacao
            icone="mail-outline"
            rotulo="E-mail"
            valor={academia.email}
          />
        </View>

        {/* CATEGORIAS */}
        <View style={cardSecao}>
          <Text style={tituloSecao}>
            Categorias
          </Text>

          {categorias.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {categorias.map((categoria, index) => (
                <View
                  key={`${categoria}-${index}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#fff8f3',
                    borderWidth: 1,
                    borderColor: '#f7bb8d',
                    borderRadius: 999,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#f97316"
                  />
                  <Text
                    style={{
                      color: '#8a3706',
                      fontSize: 13,
                      fontWeight: '800',
                      marginLeft: 5,
                    }}
                  >
                    {categoria}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: '#666', fontSize: 15 }}>
              Nenhuma categoria informada.
            </Text>
          )}
        </View>

        {/* FACILIDADES */}
        <View style={cardSecao}>
          <Text style={tituloSecao}>
            Facilidades
          </Text>

          {facilidades.length > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {facilidades.map((facilidade, index) => (
                <View
                  key={`${facilidade}-${index}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#fafafa',
                    borderWidth: 1,
                    borderColor: '#dedede',
                    borderRadius: 999,
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#f97316"
                  />
                  <Text
                    style={{
                      color: '#333',
                      fontSize: 13,
                      fontWeight: '700',
                      marginLeft: 5,
                    }}
                  >
                    {facilidade}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: '#666', fontSize: 15 }}>
              Nenhuma facilidade informada.
            </Text>
          )}
        </View>

        {/* GALERIA DE FOTOS */}
        <View style={cardSecao}>
          <Text style={tituloSecao}>
            Galeria de Fotos
          </Text>

          {fotosAcademia.length === 0 ? (
            <Text
              style={{
                color: '#666',
                fontSize: 15,
              }}
            >
              Esta academia ainda não possui fotos cadastradas.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                gap: 12,
                paddingBottom: 2,
              }}
            >
              {fotosAcademia.map((foto) => (
                <TouchableOpacity
                  key={String(foto.id)}
                  onPress={() => {
                    const indice =
                      fotosAcademia.findIndex(
                        (item) =>
                          String(item.id) ===
                          String(foto.id)
                      );

                    if (indice >= 0) {
                      setFotoAtualIndex(indice);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: foto.url }}
                    style={{
                      width: 210,
                      height: 150,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor:
                        String(foto.id) === String(fotoAtual?.id)
                          ? '#f97316'
                          : '#e5e5e5',
                      backgroundColor: '#f5f5f5',
                    }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* FORMULÁRIO / SUA AVALIAÇÃO - SOMENTE USER */}
        {ehUsuarioComum(usuario) ? (
          <View
            style={{
              ...cardSecao,
              borderColor: '#000',
            }}
          >
            <Text style={tituloSecao}>
              {minhaAvaliacao
                ? editandoAvaliacao
                  ? 'Editar Avaliação'
                  : 'Sua Avaliação'
                : 'Avaliar Academia'}
            </Text>

            {minhaAvaliacaoSuspensa ? (
              <View
                style={{
                  backgroundColor: '#fff5f5',
                  borderWidth: 1,
                  borderColor: '#dc3545',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <Text
                  style={{
                    color: '#b91c1c',
                    fontWeight: '800',
                    fontSize: 14,
                    lineHeight: 20,
                  }}
                >
                  Sua avaliação foi suspensa pela administração. Ela não aparece para outros usuários e não conta na média da academia.
                </Text>
              </View>
            ) : minhaAvaliacao &&
              !editandoAvaliacao ? (
              <View>
                <Text
                  style={{
                    color: '#333',
                    fontSize: 14,
                    lineHeight: 21,
                  }}
                >
                  Você já avaliou esta academia. Para alterar as notas dos critérios, toque em Editar minha avaliação.
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    iniciarEdicaoAvaliacao(
                      minhaAvaliacao
                    )
                  }
                  style={{
                    backgroundColor: '#000',
                    borderWidth: 1,
                    borderColor: '#000',
                    borderRadius: 8,
                    paddingVertical: 12,
                    alignItems: 'center',
                    marginTop: 12,
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 14,
                      fontWeight: '800',
                    }}
                  >
                    Editar minha avaliação
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text
                  style={{
                    color: '#333',
                    fontSize: 14,
                    lineHeight: 21,
                    marginBottom: 14,
                  }}
                >
                  Avalie todos os critérios abaixo. Nenhum item pode ficar sem nota.
                </Text>

                {itensAvaliacao.length === 0 ? (
                  <Text
                    style={{
                      color: '#666',
                      fontSize: 14,
                    }}
                  >
                    Nenhum critério de avaliação disponível.
                  </Text>
                ) : (
                  itensAvaliacao.map((item) => {
                    const notaAtual = Number(
                      notasSelecionadas[
                        String(item.id)
                      ] || 0
                    );

                    return (
                      <View
                        key={String(item.id)}
                        style={{
                          backgroundColor: '#fafafa',
                          borderWidth: 1,
                          borderColor: '#e5e5e5',
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 10,
                        }}
                      >
                        <Text
                          style={{
                            color: '#000',
                            fontSize: 15,
                            fontWeight: '800',
                          }}
                        >
                          {item.nome}
                        </Text>

                        {item.descricao ? (
                          <Text
                            style={{
                              color: '#666',
                              fontSize: 12,
                              lineHeight: 18,
                              marginTop: 4,
                            }}
                          >
                            {item.descricao}
                          </Text>
                        ) : null}

                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            marginTop: 9,
                          }}
                        >
                          {[1, 2, 3, 4, 5].map(
                            (nota) => (
                              <TouchableOpacity
                                key={nota}
                                onPress={() =>
                                  selecionarNota(
                                    item.id,
                                    nota
                                  )
                                }
                                style={{
                                  marginRight: 5,
                                }}
                              >
                                <Ionicons
                                  name={
                                    nota <= notaAtual
                                      ? 'star'
                                      : 'star-outline'
                                  }
                                  size={30}
                                  color="#f97316"
                                />
                              </TouchableOpacity>
                            )
                          )}
                        </View>
                      </View>
                    );
                  })
                )}

                <TouchableOpacity
                  onPress={enviarAvaliacao}
                  disabled={
                    enviandoAvaliacao ||
                    itensAvaliacao.length === 0
                  }
                  style={{
                    backgroundColor: '#000',
                    borderWidth: 1,
                    borderColor: '#000',
                    borderRadius: 8,
                    paddingVertical: 12,
                    alignItems: 'center',
                    marginTop: 4,
                    opacity:
                      enviandoAvaliacao ||
                      itensAvaliacao.length === 0
                        ? 0.6
                        : 1,
                  }}
                >
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 15,
                      fontWeight: '800',
                    }}
                  >
                    {enviandoAvaliacao
                      ? 'Salvando...'
                      : editandoAvaliacao
                        ? 'Salvar Alterações'
                        : 'Enviar Avaliação'}
                  </Text>
                </TouchableOpacity>

                {editandoAvaliacao ? (
                  <TouchableOpacity
                    onPress={cancelarEdicaoAvaliacao}
                    disabled={enviandoAvaliacao}
                    style={{
                      backgroundColor: '#fff',
                      borderWidth: 1,
                      borderColor: '#000',
                      borderRadius: 8,
                      paddingVertical: 12,
                      alignItems: 'center',
                      marginTop: 9,
                    }}
                  >
                    <Text
                      style={{
                        color: '#000',
                        fontSize: 15,
                        fontWeight: '800',
                      }}
                    >
                      Cancelar edição
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {/* AVALIAÇÕES */}
        <View style={cardSecao}>
          <Text style={tituloSecao}>
            Avaliações
          </Text>

          {avaliacoesAtivas.length === 0 ? (
            <Text
              style={{
                color: '#666',
                fontSize: 15,
              }}
            >
              Essa academia ainda não possui avaliações.
            </Text>
          ) : (
            avaliacoesAtivas.map((avaliacao) => {
              const pertenceAoUsuario =
                avaliacaoPertenceAoUsuario(
                  avaliacao,
                  usuario?.id
                );

              const suspensa =
                avaliacaoEstaSuspensa(
                  avaliacao
                );

              return (
                <View
                  key={String(avaliacao.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: suspensa
                      ? '#dc3545'
                      : pertenceAoUsuario
                        ? '#f97316'
                        : '#000',
                    borderRadius: 8,
                    padding: 13,
                    marginBottom: 12,
                    backgroundColor: '#fff',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 9,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        color: '#000',
                        fontSize: 15,
                        fontWeight: '800',
                        marginRight: 8,
                      }}
                    >
                      {getNomeUsuarioAvaliacao(
                        avaliacao
                      )}
                      {pertenceAoUsuario
                        ? ' (você)'
                        : ''}
                    </Text>

                    <Text
                      style={{
                        color: '#f97316',
                        fontSize: 14,
                        fontWeight: '900',
                      }}
                    >
                      {Number(
                        avaliacao.nota
                      ).toFixed(1)}{' '}
                      ⭐
                    </Text>
                  </View>

                  {suspensa ? (
                    <Text
                      style={{
                        color: '#b91c1c',
                        fontSize: 12,
                        fontWeight: '800',
                        marginBottom: 8,
                      }}
                    >
                      Avaliação suspensa
                    </Text>
                  ) : null}

                  {Array.isArray(avaliacao.itens) &&
                  avaliacao.itens.length > 0 ? (
                    <View>
                      {avaliacao.itens.map(
                        (item, index) => (
                          <View
                            key={`${avaliacao.id}-${item.itemId}-${index}`}
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingVertical: 7,
                              borderBottomWidth:
                                index <
                                avaliacao.itens!.length -
                                  1
                                  ? 1
                                  : 0,
                              borderBottomColor: '#eee',
                            }}
                          >
                            <Text
                              style={{
                                flex: 1,
                                color: '#333',
                                fontSize: 13,
                                marginRight: 8,
                              }}
                            >
                              {item.itemNome ||
                                `Critério ${
                                  index + 1
                                }`}
                            </Text>
                            <Text
                              style={{
                                color: '#f97316',
                                fontSize: 13,
                                fontWeight: '800',
                              }}
                            >
                              {Number(
                                item.nota
                              ).toFixed(0)}{' '}
                              ⭐
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  ) : (
                    <Text
                      style={{
                        color: '#666',
                        fontSize: 13,
                      }}
                    >
                      Detalhes dos critérios não disponíveis.
                    </Text>
                  )}

                  {ehUsuarioComum(usuario) &&
                  pertenceAoUsuario &&
                  !suspensa ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 9,
                        marginTop: 12,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          iniciarEdicaoAvaliacao(
                            avaliacao
                          )
                        }
                        disabled={excluindoAvaliacao}
                        style={{
                          flex: 1,
                          backgroundColor: '#000',
                          borderRadius: 6,
                          paddingVertical: 10,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: '800',
                          }}
                        >
                          Editar
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={excluirMinhaAvaliacao}
                        disabled={excluindoAvaliacao}
                        style={{
                          flex: 1,
                          backgroundColor: '#fff',
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#dc3545',
                          paddingVertical: 10,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: '#dc3545',
                            fontSize: 13,
                            fontWeight: '800',
                          }}
                        >
                          {excluindoAvaliacao
                            ? 'Excluindo...'
                            : 'Excluir'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

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

      <BottomTabBar
        usuario={usuario}
      />
    </LogymBackground>
  );
}
