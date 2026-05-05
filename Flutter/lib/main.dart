import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'constants/theme.dart';
import 'models/models.dart';
import 'state/app_state.dart';
import 'screens/main_shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final appState = AppState();
  await appState.load();
  runApp(
    ChangeNotifierProvider<AppState>.value(
      value: appState,
      child: const CheckMasterApp(),
    ),
  );
}

class CheckMasterApp extends StatelessWidget {
  const CheckMasterApp({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = context.select<AppState, AppSettings>((s) => s.settings);

    return MaterialApp(
      title: 'CheckMaster',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(dark: false),
      darkTheme: buildTheme(dark: true),
      themeMode: settings.systemDarkMode
          ? ThemeMode.system
          : (settings.darkMode ? ThemeMode.dark : ThemeMode.light),
      home: const MainShell(),
    );
  }
}
