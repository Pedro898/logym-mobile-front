import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import BottomTabBar from '../components/BottomTabBar';
import LogymBackground from '../components/LogymBackground';
import UserAvatarPlaceholder from '../components/UserAvatarPlaceholder';
import { ehUsuarioComum as usuarioEhComum } from '@/lib/permissoes';

import {
  atualizarFotoPerfil,
  atualizarPerfilUsuario,
  buscarEnderecoPorCep,
  buscarUsuarioAutenticado,
  formatarCep,
  formatarNomeUsuario,
  getFotoUsuarioUrl,
  inativarUsuario,
  limparCep,
  logout,
  type Usuario,
} from '@/lib/api';

export default function Perfil() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [nome, setNome] = useState('');
  const [cep, setCep] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');

  // Igual ao Web: usamos os valores inicialmente carregados para saber
  // se CEP ou número mudaram. Só nesses casos o endereço completo
  // precisa ser enviado ao backend para uma nova geocodificação.
  const enderecoInicialRef = useRef({
    cep: '',
    numero: '',
  });

  // Guardamos os valores carregados do perfil para saber se o usuário
  // realmente alterou algum campo durante a edição.
  const perfilInicialRef = useRef({
    nome: '',
    cep: '',
    numero: '',
    complemento: '',
  });

  const [endereco, setEndereco] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  const [cepValido, setCepValido] = useState(false);
  const [editando, setEditando] = useState(false);

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [inativando, setInativando] = useState(false);

  const [mensagem, setMensagem] = useState('');

  const [fotoVersao, setFotoVersao] = useState(Date.now());

  // Quando a foto não existe no banco, a URL ainda é criada por causa do usuario.id.
  // Então usamos esse controle para trocar para o bonequinho quando a imagem falhar.
  const [fotoPerfilErro, setFotoPerfilErro] = useState(false);

  const nomeUsuario = formatarNomeUsuario(usuario);

  const ehUsuarioComum = usuarioEhComum(usuario);

  const deveMostrarCamposEndereco =
    ehUsuarioComum &&
    limparCep(cep).length === 8 &&
    (cepValido || !!endereco || !!bairro || !!cidade || !!estado || buscandoCep);

  const houveAlteracao =
    editando &&
    (nome.trim() !== perfilInicialRef.current.nome.trim() ||
      (ehUsuarioComum &&
        (limparCep(cep) !== limparCep(perfilInicialRef.current.cep) ||
          String(numero || '').trim() !== perfilInicialRef.current.numero.trim() ||
          String(complemento || '').trim() !== perfilInicialRef.current.complemento.trim())));

  const fotoUrlBase = getFotoUsuarioUrl(usuario?.id);
  const fotoUrl = fotoUrlBase ? `${fotoUrlBase}?mobile=${fotoVersao}` : null;
  const deveMostrarFotoPerfil = fotoUrl && !fotoPerfilErro;

  function limparEnderecoViaCep() {
    setEndereco('');
    setBairro('');
    setCidade('');
    setEstado('');
    setCepValido(false);
  }

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

    return 'http://localhost:5173';
  }

  function abrirAlterarSenhaWeb() {
    const webUrl = buscarWebUrl();
    const redirectFormatado = encodeURIComponent('/profile');

    Linking.openURL(`${webUrl}/login?redirect=${redirectFormatado}`);
  }

  async function carregarEnderecoPeloCep(
    cepInformado: string,
    mostrarMensagem = true
  ) {
    const cepLimpo = limparCep(cepInformado);

    if (cepLimpo.length !== 8) {
      limparEnderecoViaCep();
      return false;
    }

    try {
      setBuscandoCep(true);

      const enderecoEncontrado = await buscarEnderecoPorCep(cepLimpo);

      setEndereco(enderecoEncontrado.endereco);
      setBairro(enderecoEncontrado.bairro);
      setCidade(enderecoEncontrado.cidade);
      setEstado(enderecoEncontrado.estado);
      setCep(formatarCep(enderecoEncontrado.cep));
      setCepValido(true);

      if (mostrarMensagem) {
        setMensagem('Endereço encontrado pelo CEP.');
      }

      return true;
    } catch (error) {
      console.error(error);

      limparEnderecoViaCep();

      if (mostrarMensagem) {
        if (error instanceof Error) {
          setMensagem(error.message);
        } else {
          setMensagem('CEP inválido ou não encontrado.');
        }
      }

      return false;
    } finally {
      setBuscandoCep(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      async function carregarUsuario() {
        setMensagem('');

        try {
          setCarregando(true);

          // A sessão do Spring é a fonte verdadeira da identidade.
          const usuarioBanco = await buscarUsuarioAutenticado();

          await AsyncStorage.setItem('usuario', JSON.stringify(usuarioBanco));

          setUsuario(usuarioBanco);
          setNome(usuarioBanco.nome || '');
          setCep(formatarCep(usuarioBanco.cep || ''));
          setNumero(
            usuarioBanco.numero === null || usuarioBanco.numero === undefined
              ? ''
              : String(usuarioBanco.numero)
          );
          setComplemento(usuarioBanco.complemento || '');

          enderecoInicialRef.current = {
            cep: limparCep(usuarioBanco.cep || ''),
            numero:
              usuarioBanco.numero === null || usuarioBanco.numero === undefined
                ? ''
                : String(usuarioBanco.numero),
          };

          perfilInicialRef.current = {
            nome: usuarioBanco.nome || '',
            cep: limparCep(usuarioBanco.cep || ''),
            numero:
              usuarioBanco.numero === null || usuarioBanco.numero === undefined
                ? ''
                : String(usuarioBanco.numero),
            complemento: usuarioBanco.complemento || '',
          };

          if (
            usuarioEhComum(usuarioBanco) &&
            usuarioBanco.cep
          ) {
            await carregarEnderecoPeloCep(usuarioBanco.cep, false);
          } else {
            limparEnderecoViaCep();
          }

          setFotoVersao(Date.now());
          setFotoPerfilErro(false);
        } catch (error) {
          console.error('Sessão inválida ou expirada:', error);

          await AsyncStorage.removeItem('usuario');
          setUsuario(null);
          setNome('');
          setCep('');
          setNumero('');
          setComplemento('');
          enderecoInicialRef.current = {
            cep: '',
            numero: '',
          };
          perfilInicialRef.current = {
            nome: '',
            cep: '',
            numero: '',
            complemento: '',
          };
          limparEnderecoViaCep();
          setFotoPerfilErro(true);
          router.replace('/login');
        } finally {
          setCarregando(false);
        }
      }

      carregarUsuario();
    }, [])
  );

  async function alterarCep(valor: string) {
    setMensagem('');

    const cepFormatado = formatarCep(valor);
    const cepLimpo = limparCep(cepFormatado);

    setCep(cepFormatado);

    if (cepLimpo.length < 8) {
      limparEnderecoViaCep();
      return;
    }

    if (cepLimpo.length === 8) {
      await carregarEnderecoPeloCep(cepLimpo, true);
    }
  }

  async function escolherFotoPerfil() {
    setMensagem('');

    if (!usuario?.id) {
      setMensagem('Usuário não encontrado. Faça login novamente.');
      return;
    }

    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissao.granted) {
      setMensagem('Permissão negada para acessar suas fotos.');
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (resultado.canceled) {
      return;
    }

    const imagem = resultado.assets[0];

    if (!imagem?.uri) {
      setMensagem('Não foi possível carregar a imagem selecionada.');
      return;
    }

    try {
      setSalvandoFoto(true);

      await atualizarFotoPerfil(
        usuario.id,
        imagem.uri,
        imagem.mimeType || 'image/jpeg'
      );

      setFotoVersao(Date.now());
      setFotoPerfilErro(false);

      const usuarioAtualizado = await buscarUsuarioAutenticado();

      await AsyncStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));

      setUsuario(usuarioAtualizado);
      setMensagem('Foto de perfil atualizada!');
    } catch (error) {
      console.error(error);

      if (error instanceof Error) {
        setMensagem(error.message);
      } else {
        setMensagem('Erro ao atualizar foto de perfil.');
      }
    } finally {
      setSalvandoFoto(false);
    }
  }

  async function salvarPerfil() {
    setMensagem('');

    if (!usuario?.id) {
      setMensagem('Usuário não encontrado. Faça login novamente.');
      return;
    }

    if (!nome.trim()) {
      setMensagem('Informe o nome do usuário.');
      return;
    }

    const dadosAtualizados: {
      nome: string;
      cep?: string;
      numero?: string;
      complemento?: string;
      endereco?: string;
      bairro?: string;
      cidade?: string;
      estado?: string;
    } = {
      nome: nome.trim(),
    };

    if (ehUsuarioComum) {
      const cepLimpo = limparCep(cep);
      const numeroNormalizado = String(numero || '').trim();
      const complementoNormalizado = String(complemento || '').trim();

      if (cepLimpo.length !== 8) {
        setMensagem('O CEP precisa ter 8 números.');
        return;
      }

      if (!/^\d+$/.test(numeroNormalizado)) {
        setMensagem('O número deve conter apenas dígitos não negativos.');
        return;
      }

      let enderecoEncontrado;

      try {
        setBuscandoCep(true);

        enderecoEncontrado = await buscarEnderecoPorCep(cepLimpo);

        setEndereco(enderecoEncontrado.endereco);
        setBairro(enderecoEncontrado.bairro);
        setCidade(enderecoEncontrado.cidade);
        setEstado(enderecoEncontrado.estado);
        setCep(formatarCep(enderecoEncontrado.cep));
        setCepValido(true);
      } catch (error) {
        console.error(error);

        limparEnderecoViaCep();

        if (error instanceof Error) {
          setMensagem(error.message);
        } else {
          setMensagem('CEP inválido ou não encontrado.');
        }

        return;
      } finally {
        setBuscandoCep(false);
      }

      if (
        !enderecoEncontrado.endereco ||
        !enderecoEncontrado.cidade ||
        !enderecoEncontrado.estado
      ) {
        setMensagem('Informe um CEP válido.');
        return;
      }

      dadosAtualizados.cep = cepLimpo;
      dadosAtualizados.numero = numeroNormalizado;
      dadosAtualizados.complemento = complementoNormalizado;

      const cepOuNumeroAlterados =
        cepLimpo !== enderecoInicialRef.current.cep ||
        numeroNormalizado !== enderecoInicialRef.current.numero;

      // Mesmo comportamento do Web:
      // o endereço completo é necessário quando CEP ou número mudam,
      // pois o backend vai chamar a geocodificação do Google.
      if (cepOuNumeroAlterados) {
        dadosAtualizados.endereco = enderecoEncontrado.endereco;
        dadosAtualizados.bairro = enderecoEncontrado.bairro;
        dadosAtualizados.cidade = enderecoEncontrado.cidade;
        dadosAtualizados.estado = enderecoEncontrado.estado;
      }
    }

    try {
      setSalvando(true);

      const usuarioAtualizado = await atualizarPerfilUsuario(
        usuario.id,
        dadosAtualizados
      );

      await AsyncStorage.setItem('usuario', JSON.stringify(usuarioAtualizado));

      setUsuario(usuarioAtualizado);
      setNome(usuarioAtualizado.nome || '');
      setCep(formatarCep(usuarioAtualizado.cep || ''));
      setNumero(
        usuarioAtualizado.numero === null || usuarioAtualizado.numero === undefined
          ? ''
          : String(usuarioAtualizado.numero)
      );
      setComplemento(usuarioAtualizado.complemento || '');

      enderecoInicialRef.current = {
        cep: limparCep(usuarioAtualizado.cep || ''),
        numero:
          usuarioAtualizado.numero === null || usuarioAtualizado.numero === undefined
            ? ''
            : String(usuarioAtualizado.numero),
      };

      perfilInicialRef.current = {
        nome: usuarioAtualizado.nome || '',
        cep: limparCep(usuarioAtualizado.cep || ''),
        numero:
          usuarioAtualizado.numero === null || usuarioAtualizado.numero === undefined
            ? ''
            : String(usuarioAtualizado.numero),
        complemento: usuarioAtualizado.complemento || '',
      };

      if (
        usuarioEhComum(usuarioAtualizado) &&
        usuarioAtualizado.cep
      ) {
        await carregarEnderecoPeloCep(usuarioAtualizado.cep, false);
      } else {
        limparEnderecoViaCep();
      }

      setEditando(false);
      setMensagem('Perfil atualizado!');
    } catch (error) {
      console.error(error);

      if (error instanceof Error && error.message) {
        setMensagem(error.message);
      } else {
        setMensagem('Erro ao atualizar informações.');
      }
    } finally {
      setSalvando(false);
    }
  }

  async function cancelarEdicao() {
    setMensagem('');

    setNome(perfilInicialRef.current.nome);
    setCep(formatarCep(perfilInicialRef.current.cep));
    setNumero(perfilInicialRef.current.numero);
    setComplemento(perfilInicialRef.current.complemento);

    if (ehUsuarioComum && perfilInicialRef.current.cep) {
      await carregarEnderecoPeloCep(perfilInicialRef.current.cep, false);
    } else {
      limparEnderecoViaCep();
    }

    setEditando(false);
  }

  async function executarInativacaoConta() {
    setMensagem('');

    if (!usuario?.id) {
      setMensagem('Usuário não encontrado. Faça login novamente.');
      return;
    }

    try {
      setInativando(true);

      await inativarUsuario(usuario.id);

      try {
        await logout();
      } catch (error) {
        console.error(
          'A conta foi inativada, mas houve erro ao encerrar a sessão no backend:',
          error
        );
      }

      await AsyncStorage.removeItem('usuario');
      setUsuario(null);

      if (Platform.OS === 'web') {
        window.alert('Conta inativada com sucesso.');
        router.replace('/login');
        return;
      }

      Alert.alert(
        'Conta inativada',
        'Sua conta foi inativada com sucesso.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ],
        {
          cancelable: false,
        }
      );
    } catch (error) {
      console.error('Erro ao inativar conta:', error);

      if (error instanceof Error && error.message) {
        setMensagem(error.message);
      } else {
        setMensagem('Erro ao inativar conta.');
      }
    } finally {
      setInativando(false);
    }
  }

  function confirmarInativacaoConta() {
    if (!usuario?.id || inativando) {
      return;
    }

    setMensagem('');

    if (Platform.OS === 'web') {
      const confirmou = window.confirm(
        'Tem certeza que deseja inativar sua conta?'
      );

      if (confirmou) {
        executarInativacaoConta();
      }

      return;
    }

    Alert.alert(
      'Confirmar inativação',
      'Tem certeza que deseja inativar sua conta?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sim, inativar',
          style: 'destructive',
          onPress: executarInativacaoConta,
        },
      ]
    );
  }

  async function sair() {
    try {
      // Encerra também a sessão real do Spring Security.
      await logout();
    } catch (error) {
      console.error('Erro ao encerrar sessão no backend:', error);
    } finally {
      await AsyncStorage.removeItem('usuario');
      router.replace('/login');
    }
  }

  return (
    <LogymBackground>
      <KeyboardAvoidingView
        style={{
          flex: 1,
          width: '100%',
          alignSelf: 'center',
        }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: 18,
            paddingHorizontal: 14,
            paddingBottom: 130,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.97)',
              borderWidth: 1,
              borderColor: '#111',
              borderRadius: 22,
              padding: 18,
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <TouchableOpacity
              onPress={() => router.replace('/academias')}
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name="arrow-back" size={21} color="#f97316" />
              <Text style={{ color: '#111', fontWeight: '800', marginLeft: 5 }}>
                Voltar
              </Text>
            </TouchableOpacity>

            <View style={{ alignItems: 'center', marginBottom: 18 }}>
              {deveMostrarFotoPerfil ? (
                <Image
                  source={{ uri: fotoUrl }}
                  onError={() => setFotoPerfilErro(true)}
                  style={{
                    width: 122,
                    height: 122,
                    borderRadius: 61,
                    backgroundColor: '#f3f4f6',
                    borderWidth: 3,
                    borderColor: '#f97316',
                  }}
                />
              ) : (
                <UserAvatarPlaceholder size={122} />
              )}

              <TouchableOpacity
                onPress={escolherFotoPerfil}
                disabled={salvandoFoto}
                style={{
                  backgroundColor: salvandoFoto ? '#555' : '#000',
                  paddingVertical: 9,
                  paddingHorizontal: 15,
                  borderRadius: 999,
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {salvandoFoto ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '900', marginLeft: 7, fontSize: 12 }}>
                      Alterar foto
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text
                style={{
                  color: '#000',
                  fontSize: 24,
                  fontWeight: '900',
                  marginTop: 10,
                  textAlign: 'center',
                }}
              >
                {nomeUsuario}
              </Text>
              <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>
                Gerencie seus dados pessoais
              </Text>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: '#e5e5e5',
                marginBottom: 18,
              }}
            />

            <Text
              style={{
                color: '#000',
                fontSize: 22,
                fontWeight: '900',
                marginBottom: 16,
                letterSpacing: 0.5,
              }}
            >
              SEUS DADOS PESSOAIS
            </Text>

            {carregando ? (
              <View style={{ marginBottom: 15 }}>
                <ActivityIndicator color="#f97316" />
                <Text style={{ color: '#555', textAlign: 'center', marginTop: 8 }}>
                  Buscando dados do banco...
                </Text>
              </View>
            ) : null}

            {mensagem ? (
              <View
                style={{
                  backgroundColor:
                    mensagem.includes('atualizada') ||
                    mensagem.includes('atualizado') ||
                    mensagem.includes('Endereço encontrado')
                      ? '#f0fdf4'
                      : '#fff1f2',
                  borderWidth: 1,
                  borderColor:
                    mensagem.includes('atualizada') ||
                    mensagem.includes('atualizado') ||
                    mensagem.includes('Endereço encontrado')
                      ? '#bbf7d0'
                      : '#fecdd3',
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 15,
                }}
              >
                <Text
                  style={{
                    color:
                      mensagem.includes('atualizada') ||
                      mensagem.includes('atualizado') ||
                      mensagem.includes('Endereço encontrado')
                        ? '#166534'
                        : '#9f1239',
                    textAlign: 'center',
                  }}
                >
                  {mensagem}
                </Text>
              </View>
            ) : null}

            <Text style={{ color: '#111', fontSize: 14, fontWeight: '800', marginBottom: 6 }}>
              Nome
            </Text>
            <TextInput
              value={nome}
              onChangeText={setNome}
              editable={editando}
              placeholder="Digite seu nome"
              placeholderTextColor="#888"
              style={{
                backgroundColor: editando ? '#fff' : '#f3f4f6',
                color: '#111',
                paddingHorizontal: 14,
                minHeight: 49,
                borderRadius: 10,
                fontSize: 15,
                marginBottom: 15,
                borderWidth: 1,
                borderColor: editando ? '#111' : '#d1d5db',
              }}
            />

            <Text style={{ color: '#111', fontSize: 14, fontWeight: '800', marginBottom: 6 }}>
              Usuário / E-mail
            </Text>
            <TextInput
              value={usuario?.username || ''}
              editable={false}
              style={{
                backgroundColor: '#f3f4f6',
                color: '#555',
                paddingHorizontal: 14,
                minHeight: 49,
                borderRadius: 10,
                fontSize: 15,
                marginBottom: 15,
                borderWidth: 1,
                borderColor: '#d1d5db',
              }}
            />

            {ehUsuarioComum ? (
              <View
                style={{
                  backgroundColor: '#fffaf5',
                  borderWidth: 1,
                  borderColor: '#fed7aa',
                  borderRadius: 14,
                  padding: 13,
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="location-outline" size={20} color="#f97316" />
                  <Text style={{ color: '#111', fontSize: 16, fontWeight: '900', marginLeft: 6 }}>
                    Endereço
                  </Text>
                </View>

                <Text style={{ color: '#111', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>CEP</Text>
                <TextInput
                  value={cep}
                  onChangeText={alterarCep}
                  editable={editando && !buscandoCep}
                  keyboardType="numeric"
                  maxLength={9}
                  placeholder="00000-000"
                  placeholderTextColor="#888"
                  style={{
                    backgroundColor: editando ? '#fff' : '#f3f4f6',
                    color: '#111',
                    paddingHorizontal: 13,
                    minHeight: 47,
                    borderRadius: 9,
                    fontSize: 15,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: editando ? '#f97316' : '#d1d5db',
                  }}
                />

                {buscandoCep ? (
                  <View style={{ marginBottom: 12 }}>
                    <ActivityIndicator color="#f97316" />
                    <Text style={{ color: '#555', textAlign: 'center', marginTop: 6, fontSize: 12 }}>
                      Buscando endereço pelo CEP...
                    </Text>
                  </View>
                ) : null}

                <Text style={{ color: '#111', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>Número</Text>
                <TextInput
                  value={numero}
                  onChangeText={(valor) => {
                    setMensagem('');
                    setNumero(valor.replace(/\D/g, ''));
                  }}
                  editable={editando}
                  keyboardType="numeric"
                  placeholder="Número"
                  placeholderTextColor="#888"
                  style={{
                    backgroundColor: editando ? '#fff' : '#f3f4f6',
                    color: '#111',
                    paddingHorizontal: 13,
                    minHeight: 47,
                    borderRadius: 9,
                    fontSize: 15,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: editando ? '#f97316' : '#d1d5db',
                  }}
                />

                <Text style={{ color: '#111', fontSize: 13, fontWeight: '800', marginBottom: 6 }}>Complemento</Text>
                <TextInput
                  value={complemento}
                  onChangeText={(valor) => {
                    setMensagem('');
                    setComplemento(valor);
                  }}
                  editable={editando}
                  placeholder="Ex.: Apto 12, Bloco B"
                  placeholderTextColor="#888"
                  style={{
                    backgroundColor: editando ? '#fff' : '#f3f4f6',
                    color: '#111',
                    paddingHorizontal: 13,
                    minHeight: 47,
                    borderRadius: 9,
                    fontSize: 15,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: editando ? '#f97316' : '#d1d5db',
                  }}
                />

                {deveMostrarCamposEndereco ? (
                  <>
                    {[
                      ['Endereço', endereco],
                      ['Bairro', bairro],
                      ['Cidade', cidade],
                      ['Estado', estado],
                    ].map(([rotulo, valor]) => (
                      <View key={rotulo} style={{ marginBottom: 10 }}>
                        <Text style={{ color: '#555', fontSize: 11, fontWeight: '800', marginBottom: 3 }}>
                          {rotulo.toUpperCase()}
                        </Text>
                        <View
                          style={{
                            backgroundColor: '#fff',
                            borderWidth: 1,
                            borderColor: '#e5e7eb',
                            borderRadius: 8,
                            paddingHorizontal: 11,
                            paddingVertical: 10,
                          }}
                        >
                          <Text style={{ color: '#333', fontSize: 13 }}>
                            {valor || '—'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                ) : null}
              </View>
            ) : null}

            {!editando ? (
              <TouchableOpacity
                onPress={() => {
                  setMensagem('');
                  setEditando(true);
                }}
                style={{
                  backgroundColor: '#000',
                  minHeight: 49,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                  Editar perfil
                </Text>
              </TouchableOpacity>
            ) : houveAlteracao ? (
              <TouchableOpacity
                onPress={salvarPerfil}
                disabled={salvando || buscandoCep}
                style={{
                  backgroundColor: salvando || buscandoCep ? '#777' : '#f97316',
                  minHeight: 49,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                {salvando ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={{ color: '#000', fontWeight: '900', fontSize: 14 }}>
                    Salvar alterações
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={cancelarEdicao}
                disabled={buscandoCep}
                style={{
                  backgroundColor: '#000',
                  minHeight: 49,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                  opacity: buscandoCep ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
                  Cancelar edição
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={abrirAlterarSenhaWeb}
              style={{
                backgroundColor: '#fff',
                minHeight: 49,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#111',
                marginBottom: 10,
              }}
            >
              <Text style={{ color: '#111', fontWeight: '900', fontSize: 14 }}>
                Alterar senha
              </Text>
            </TouchableOpacity>

           <TouchableOpacity
  onPress={confirmarInativacaoConta}
  disabled={inativando}
  style={{
    backgroundColor: '#f97316',
    minHeight: 49,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f97316',
    marginBottom: 10,
    opacity: inativando ? 0.65 : 1,
  }}
>
  {inativando ? (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator color="#000" />

      <Text
        style={{
          color: '#000',
          fontWeight: '900',
          fontSize: 14,
          marginLeft: 8,
        }}
      >
        Inativando...
      </Text>
    </View>
  ) : (
    <Text
      style={{
        color: '#000',
        fontWeight: '900',
        fontSize: 14,
      }}
    >
      Inativar conta
    </Text>
  )}
</TouchableOpacity>

            <TouchableOpacity
              onPress={sair}
              disabled={inativando}
              style={{
                backgroundColor: '#fff1f2',
                minHeight: 49,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#fecdd3',
                opacity: inativando ? 0.65 : 1,
              }}
            >
              <Text style={{ color: '#be123c', fontWeight: '900', fontSize: 14 }}>
                Sair da conta
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <BottomTabBar usuario={usuario} />
      </KeyboardAvoidingView>
    </LogymBackground>
  );
}
