# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.


## Navbar superior no padrão Web

Esta versão inclui uma navbar preta global no topo, inspirada diretamente no
Header do LOGYM Web, com o mesmo símbolo laranja/cinza e o nome LOGYM em branco.

Arquivos desta alteração:
- CRIAR: `components/TopNavbar.tsx`
- CRIAR: `assets/images/logo-navbar.png`
- ALTERAR: `app/_layout.tsx`
- ALTERAR: `app/academias.tsx`

A BottomTabBar continua sendo a navegação principal do aplicativo em telas
autenticadas.


## Ajustes finais desta versão

- Navbar superior preta mantida nas telas do aplicativo, mas removida da tela de Login.
- Navbar inferior preta com:
  - USER: Academias / Favoritos / Perfil
  - MANAGER e ADMIN: Academias / Painel / Perfil
- Removido o texto "Localize. Compare. Treine." da Home.
- Comparação restaurada no Mobile:
  - botão Comparar nos cards no mesmo padrão branco/preto/laranja do Web;
  - botão Adicionar à comparação nos detalhes;
  - máximo de 3 academias;
  - barra de comparação;
  - tela /comparar-academias.
- Paginação da Home em blocos de 16 academias:
  - Anterior
  - páginas numeradas
  - Próxima
  - mesma lógica de páginas visíveis do Web.
