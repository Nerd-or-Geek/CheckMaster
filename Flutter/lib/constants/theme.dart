import 'package:flutter/material.dart';

// ─── Hex color helper ──────────────────────────────────────────────────────────

Color hexColor(String hex, {double opacity = 1.0}) {
  final h = hex.replaceAll('#', '');
  final value = int.parse(h.length == 6 ? 'FF$h' : h, radix: 16);
  return Color(value).withOpacity(opacity);
}

// ─── App color palette ─────────────────────────────────────────────────────────

class AppColors {
  // Light theme
  static const Color lightBackground = Color(0xFFF9FAFB);
  static const Color lightCard       = Colors.white;
  static const Color lightBorder     = Color(0xFFE5E7EB);
  static const Color lightText       = Color(0xFF111827);
  static const Color lightSubtext    = Color(0xFF6B7280);
  static const Color lightMuted      = Color(0xFF9CA3AF);
  static const Color lightInput      = Color(0xFFF3F4F6);

  // Dark theme
  static const Color darkBackground  = Color(0xFF111827);
  static const Color darkCard        = Color(0xFF1F2937);
  static const Color darkBorder      = Color(0xFF374151);
  static const Color darkText        = Color(0xFFF9FAFB);
  static const Color darkSubtext     = Color(0xFF9CA3AF);
  static const Color darkMuted       = Color(0xFF6B7280);
  static const Color darkInput       = Color(0xFF374151);

  // Semantic
  static const Color primary   = Color(0xFF3B82F6);
  static const Color success   = Color(0xFF10B981);
  static const Color warning   = Color(0xFFF59E0B);
  static const Color danger    = Color(0xFFEF4444);
  static const Color purple    = Color(0xFF8B5CF6);
  static const Color pink      = Color(0xFFEC4899);
  static const Color cyan      = Color(0xFF06B6D4);
  static const Color orange    = Color(0xFFF97316);

  // Category colors
  static const Map<String, Color> category = {
    'shopping':    Color(0xFF3B82F6),
    'health':      Color(0xFF10B981),
    'work':        Color(0xFFF59E0B),
    'travel':      Color(0xFF8B5CF6),
    'home':        Color(0xFFEC4899),
    'safety':      Color(0xFFEF4444),
    'clothing':    Color(0xFF06B6D4),
    'electronics': Color(0xFFF97316),
    'general':     Color(0xFF6B7280),
  };

  static Color forCategory(String cat) =>
      category[cat.toLowerCase()] ?? const Color(0xFF6B7280);
}

// ─── Theme colors accessor ─────────────────────────────────────────────────────

class ThemeColors {
  final Color background;
  final Color card;
  final Color border;
  final Color text;
  final Color subtext;
  final Color muted;
  final Color input;
  final Color success;
  final Color danger;
  final Color primary;
  final bool isDark;

  const ThemeColors({
    required this.background,
    required this.card,
    required this.border,
    required this.text,
    required this.subtext,
    required this.muted,
    required this.input,
    required this.success,
    required this.danger,
    required this.primary,
    required this.isDark,
  });

  static ThemeColors of(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return dark ? _dark : _light;
  }

  static const ThemeColors _light = ThemeColors(
    background: AppColors.lightBackground,
    card:       AppColors.lightCard,
    border:     AppColors.lightBorder,
    text:       AppColors.lightText,
    subtext:    AppColors.lightSubtext,
    muted:      AppColors.lightMuted,
    input:      AppColors.lightInput,
    success:    AppColors.success,
    danger:     AppColors.danger,
    primary:    AppColors.primary,
    isDark:     false,
  );

  static const ThemeColors _dark = ThemeColors(
    background: AppColors.darkBackground,
    card:       AppColors.darkCard,
    border:     AppColors.darkBorder,
    text:       AppColors.darkText,
    subtext:    AppColors.darkSubtext,
    muted:      AppColors.darkMuted,
    input:      AppColors.darkInput,
    success:    AppColors.success,
    danger:     AppColors.danger,
    primary:    AppColors.primary,
    isDark:     true,
  );
}

// ─── Material ThemeData ────────────────────────────────────────────────────────

ThemeData buildTheme({required bool dark}) {
  final base = dark ? ThemeData.dark(useMaterial3: true) : ThemeData.light(useMaterial3: true);
  final bg   = dark ? AppColors.darkBackground  : AppColors.lightBackground;
  final card = dark ? AppColors.darkCard        : AppColors.lightCard;
  final text = dark ? AppColors.darkText        : AppColors.lightText;

  return base.copyWith(
    colorScheme: base.colorScheme.copyWith(
      primary:   AppColors.primary,
      secondary: AppColors.cyan,
      error:     AppColors.danger,
      surface:   card,
    ),
    scaffoldBackgroundColor: bg,
    cardColor: card,
    dividerColor: dark ? AppColors.darkBorder : AppColors.lightBorder,
    appBarTheme: AppBarTheme(
      backgroundColor: card,
      foregroundColor: text,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? AppColors.darkInput : AppColors.lightInput,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: dark ? AppColors.darkBorder : AppColors.lightBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: dark ? AppColors.darkBorder : AppColors.lightBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: AppColors.primary),
    ),
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
  );
}

// ─── Folder / status colour swatches ──────────────────────────────────────────

const List<String> kFolderColors = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

const List<String> kStatusColors = [
  '#6B7280', '#F59E0B', '#3B82F6', '#10B981',
  '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4',
];
