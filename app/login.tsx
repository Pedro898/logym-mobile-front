import {
  buscarUsuarioAutenticado,
  login,
  verificarStatusLogin,
  type Usuario,
} from '@/lib/api';

import AsyncStorage from '@react-native-async-storage/async-storage';

import Constants from 'expo-constants';

import { useRouter } from 'expo-router';

import { useState } from 'react';

import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import LogymBackground from '../components/LogymBackground';

// ================================================================
// LOGIN
// ================================================================

export default function Login() {
  const router =
    useRouter();

  // ==============================================================
  // ESTADOS
  // ==============================================================

  const [
    username,
    setUsername,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    carregando,
    setCarregando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState('');

  // ==============================================================
  // URL DA WEB
  //
  // Usada somente para:
  //
  // - Cadastro
  // - Esqueci minha senha
  // ==============================================================

  function buscarWebUrl() {
    if (
      process.env
        .EXPO_PUBLIC_WEB_URL
    ) {
      return process.env
        .EXPO_PUBLIC_WEB_URL
        .replace(
          /\/$/,
          ''
        );
    }

    // Expo Web.
    if (
      Platform.OS ===
      'web'
    ) {
      return 'http://localhost:5173';
    }

    // Dispositivo físico.
    const hostUri =
      Constants.expoConfig
        ?.hostUri ||
      (Constants as any)
        .manifest
        ?.debuggerHost ||
      (Constants as any)
        .manifest2
        ?.extra
        ?.expoClient
        ?.hostUri;

    const host =
      hostUri?.split(
        ':'
      )[0];

    if (
      host &&
      host !==
        'localhost' &&
      host !==
        '127.0.0.1'
    ) {
      return `http://${host}:5173`;
    }

    return 'http://localhost:5173';
  }

  const WEB_URL =
    buscarWebUrl();

  // ==============================================================
  // ESQUECI MINHA SENHA - WEB
  // ==============================================================

  function abrirEsqueciSenhaWeb() {
    Linking.openURL(
      `${WEB_URL}/esqueci-minha-senha`
    );
  }

  // ==============================================================
  // CADASTRO WEB
  // ==============================================================

  function abrirCadastroWeb() {
    Linking.openURL(
      `${WEB_URL}/cadastrar`
    );
  }

  // ==============================================================
  // MENSAGEM DE ERRO
  // ==============================================================

  function tratarErroLogin(
    error: unknown
  ) {
    if (
      !(error instanceof Error)
    ) {
      return 'Não foi possível realizar o login.';
    }

    const mensagem =
      error.message || '';

    const mensagemMinuscula =
      mensagem.toLowerCase();

    // ============================================================
    // PROBLEMA DE CONEXÃO
    // ============================================================

    if (
      mensagem.includes(
        'Failed to fetch'
      ) ||
      mensagem.includes(
        'Network request failed'
      ) ||
      mensagem.includes(
        'Tempo esgotado'
      )
    ) {
      return 'Não foi possível conectar ao backend. Confira se o servidor está rodando e se o celular está na mesma rede.';
    }

    // ============================================================
    // CONTA SUSPENSA
    // ============================================================

    if (
      mensagemMinuscula.includes(
        'suspens'
      )
    ) {
      return 'Sua conta foi suspensa pelo administrador. Entre em contato com o suporte.';
    }

    // ============================================================
    // CONTA INATIVA
    // ============================================================

    if (
      mensagemMinuscula.includes(
        'inativ'
      )
    ) {
      return 'Sua conta está inativa. Entre em contato com o suporte.';
    }

    // ============================================================
    // CREDENCIAIS
    // ============================================================

    if (
      mensagemMinuscula.includes(
        'senha'
      ) ||
      mensagemMinuscula.includes(
        'e-mail'
      ) ||
      mensagemMinuscula.includes(
        'email'
      ) ||
      mensagemMinuscula.includes(
        'credenciais'
      )
    ) {
      return mensagem;
    }

    return (
      mensagem ||
      'Erro ao fazer login. Verifique suas credenciais.'
    );
  }

  // ==============================================================
  // ENTRAR
  // ==============================================================

  async function entrar() {
    setErro('');

    // ============================================================
    // VALIDAÇÃO
    // ============================================================

    if (
      !username.trim()
    ) {
      setErro(
        'Digite seu e-mail.'
      );

      return;
    }

    if (!password) {
      setErro(
        'Digite sua senha.'
      );

      return;
    }

    if (
      password.length < 6
    ) {
      setErro(
        'A senha deve ter pelo menos 6 caracteres.'
      );

      return;
    }

    try {
      setCarregando(
        true
      );

      // ==========================================================
      // PASSO 1
      //
      // Mesma verificação feita pelo Web.
      //
      // Antes do login, verificamos se a conta:
      //
      // ATIVO
      // INATIVO
      // SUSPENSO
      // ==========================================================

      const statusLogin =
        await verificarStatusLogin(
          username
        );

      if (
        statusLogin
          ?.podeLogar ===
        false
      ) {
        setErro(
          statusLogin
            .message ||
            'Esta conta não pode acessar o sistema.'
        );

        return;
      }

      // ==========================================================
      // PASSO 2
      //
      // Login REAL do Spring Security.
      //
      // POST /login
      //
      // Esta chamada cria a sessão do usuário.
      // ==========================================================

      await login(
        username,
        password
      );

      // ==========================================================
      // PASSO 3
      //
      // Busca o usuário da sessão.
      //
      // GET /usuarios/me
      //
      // Se esta chamada funcionar, temos a confirmação de que
      // o backend reconhece o Mobile como autenticado.
      // ==========================================================

      const usuarioBackend =
        await buscarUsuarioAutenticado();

      // ==========================================================
      // SEGURANÇA EXTRA
      //
      // Não salvamos usuário fake/local.
      //
      // O usuário necessariamente precisa ter vindo do backend.
      // ==========================================================

      if (
        !usuarioBackend ||
        !usuarioBackend.id
      ) {
        throw new Error(
          'O backend não retornou os dados do usuário autenticado.'
        );
      }

      // ==========================================================
      // USUÁRIO QUE SERÁ SALVO LOCALMENTE
      // ==========================================================

      const usuarioParaSalvar: Usuario =
        {
          id:
            usuarioBackend.id,

          nome:
            usuarioBackend.nome ||
            usuarioBackend.username ||
            username.trim(),

          username:
            usuarioBackend.username ||
            username
              .trim()
              .toLowerCase(),

          nivelAcesso:
            usuarioBackend.nivelAcesso,

          statusUsuario:
            usuarioBackend.statusUsuario,

          cep:
            usuarioBackend.cep ||
            '',
        };

      // ==========================================================
      // SALVA NO ASYNC STORAGE
      //
      // AsyncStorage não é a autenticação.
      //
      // Ele serve apenas para o Mobile lembrar quem é o usuário.
      //
      // A autenticação verdadeira está na sessão do backend.
      // ==========================================================

      await AsyncStorage.setItem(
        'usuario',
        JSON.stringify(
          usuarioParaSalvar
        )
      );

      // ==========================================================
      // REDIRECIONAMENTO
      // ==========================================================

      router.replace(
        '/academias'
      );
    } catch (error) {
      console.error(
        'Erro no login:',
        error
      );

      setErro(
        tratarErroLogin(
          error
        )
      );
    } finally {
      setCarregando(
        false
      );
    }
  }

  // ==============================================================
  // INTERFACE
  // ==============================================================

  return (
    <LogymBackground>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 22,
          paddingVertical: 30,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 430,
            alignSelf: 'center',
            backgroundColor: '#ffffff',
            borderWidth: 1,
            borderColor: '#111111',
            borderRadius: 22,
            paddingHorizontal: 22,
            paddingBottom: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.16,
            shadowRadius: 18,
            elevation: 12,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: 6,
              backgroundColor: '#f97316',
              marginHorizontal: -22,
              marginBottom: 8,
            }}
          />

          <Image
            source={require('../assets/images/logoSimples.png')}
            style={{
              width: 125,
              height: 125,
              alignSelf: 'center',
              marginBottom: -12,
            }}
            resizeMode="contain"
          />

          <Text
            style={{
              color: '#000000',
              fontSize: 28,
              fontWeight: '900',
              textAlign: 'center',
              letterSpacing: 1.2,
            }}
          >
            ENTRAR NO LOGYM
          </Text>

          <Text
            style={{
              color: '#555555',
              fontSize: 13,
              textAlign: 'center',
              marginTop: 5,
              marginBottom: 22,
              lineHeight: 19,
            }}
          >
            Encontre academias, compare opções e acompanhe suas favoritas.
          </Text>

          <Text style={{ color: '#111', fontWeight: '800', marginBottom: 7 }}>
            E-mail
          </Text>
          <TextInput
            placeholder="Digite seu e-mail"
            placeholderTextColor="#8a8a8a"
            value={username}
            onChangeText={(texto) => {
              setUsername(texto);
              if (erro) setErro('');
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={{
              backgroundColor: '#fafafa',
              color: '#111111',
              paddingHorizontal: 14,
              minHeight: 50,
              borderRadius: 10,
              marginBottom: 15,
              borderWidth: 1,
              borderColor: '#bdbdbd',
            }}
          />

          <Text style={{ color: '#111', fontWeight: '800', marginBottom: 7 }}>
            Senha
          </Text>
          <TextInput
            placeholder="Digite sua senha"
            placeholderTextColor="#8a8a8a"
            secureTextEntry
            value={password}
            onChangeText={(texto) => {
              setPassword(texto);
              if (erro) setErro('');
            }}
            style={{
              backgroundColor: '#fafafa',
              color: '#111111',
              paddingHorizontal: 14,
              minHeight: 50,
              borderRadius: 10,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: '#bdbdbd',
            }}
          />

          {erro ? (
            <View
              style={{
                backgroundColor: '#fff1f2',
                borderWidth: 1,
                borderColor: '#fecdd3',
                borderRadius: 10,
                padding: 10,
                marginTop: 6,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: '#9f1239', lineHeight: 19 }}>{erro}</Text>
            </View>
          ) : null}

          <Text
            onPress={abrirEsqueciSenhaWeb}
            style={{
              color: '#ea580c',
              textAlign: 'right',
              marginBottom: 17,
              fontWeight: '800',
            }}
          >
            Esqueceu a senha?
          </Text>

          <TouchableOpacity
            onPress={entrar}
            disabled={carregando}
            style={{
              backgroundColor: carregando ? '#555555' : '#000000',
              minHeight: 52,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#f97316',
              shadowOpacity: carregando ? 0 : 0.28,
              shadowRadius: 10,
              marginBottom: 15,
              opacity: carregando ? 0.8 : 1,
            }}
          >
            {carregando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                Entrar
              </Text>
            )}
          </TouchableOpacity>

          <Text style={{ color: '#555', textAlign: 'center', lineHeight: 20 }}>
            Ainda não possui uma conta?{' '}
            <Text
              onPress={abrirCadastroWeb}
              style={{ color: '#ea580c', fontWeight: '900' }}
            >
              Cadastre-se
            </Text>
          </Text>
        </View>
      </View>
    </LogymBackground>
  );
}
