import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/theme.dart';
import '../models/models.dart';
import '../state/app_state.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _urlCtrl = TextEditingController();
  final _keyCtrl = TextEditingController();
  bool _serverBusy = false;
  String? _serverMsg;
  bool _showConnectForm = false;

  // Auth modal state
  bool _showAuthModal = false;
  bool _isLogin = true;
  final _authUserCtrl   = TextEditingController();
  final _authPassCtrl   = TextEditingController();
  final _authDisplayCtrl = TextEditingController();
  bool _authBusy = false;
  String? _authMsg;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final s = context.read<AppState>().settings;
    if (_urlCtrl.text.isEmpty) _urlCtrl.text = s.serverUrl;
    if (_keyCtrl.text.isEmpty) _keyCtrl.text = s.serverApiKey;
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _keyCtrl.dispose();
    _authUserCtrl.dispose();
    _authPassCtrl.dispose();
    _authDisplayCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state    = context.watch<AppState>();
    final settings = state.settings;
    final tc       = ThemeColors.of(context);
    final isConnected = state.isServerConnected;

    return Scaffold(
      backgroundColor: tc.background,
      appBar: AppBar(
        title: Text('Settings', style: TextStyle(color: tc.text)),
        backgroundColor: tc.card,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _SectionHeader('Appearance', tc: tc),
          _SettingCard(tc: tc, child: Column(
            children: [
              SwitchListTile(
                title: Text('Follow System Dark Mode', style: TextStyle(color: tc.text)),
                value: settings.systemDarkMode,
                activeColor: AppColors.primary,
                onChanged: (v) => state.updateSettings((s) => s.copyWith(systemDarkMode: v)),
              ),
              if (!settings.systemDarkMode)
                SwitchListTile(
                  title: Text('Dark Mode', style: TextStyle(color: tc.text)),
                  value: settings.darkMode,
                  activeColor: AppColors.primary,
                  onChanged: (v) => state.updateSettings((s) => s.copyWith(darkMode: v)),
                ),
              _DivRow(tc: tc),
              ListTile(
                title: Text('Density', style: TextStyle(color: tc.text)),
                trailing: _DropDown<Density>(
                  value: settings.density,
                  items: const [
                    DropdownMenuItem(value: Density.comfortable, child: Text('Comfortable')),
                    DropdownMenuItem(value: Density.compact,     child: Text('Compact')),
                  ],
                  onChanged: (v) => state.updateSettings((s) => s.copyWith(density: v)),
                  tc: tc,
                ),
              ),
            ],
          )),

          const SizedBox(height: 16),
          _SectionHeader('Charts & Stats', tc: tc),
          _SettingCard(tc: tc, child: Column(
            children: [
              ListTile(
                title: Text('Default Chart Type', style: TextStyle(color: tc.text)),
                trailing: _DropDown<ChartType>(
                  value: settings.chartType,
                  items: const [
                    DropdownMenuItem(value: ChartType.pie, child: Text('Pie')),
                    DropdownMenuItem(value: ChartType.bar, child: Text('Bar')),
                  ],
                  onChanged: (v) => state.updateSettings((s) => s.copyWith(chartType: v)),
                  tc: tc,
                ),
              ),
              _DivRow(tc: tc),
              ListTile(
                title: Text('Default View', style: TextStyle(color: tc.text)),
                trailing: _DropDown<DefaultView>(
                  value: settings.defaultView,
                  items: const [
                    DropdownMenuItem(value: DefaultView.interactive, child: Text('Interactive')),
                    DropdownMenuItem(value: DefaultView.stats,       child: Text('Stats')),
                  ],
                  onChanged: (v) => state.updateSettings((s) => s.copyWith(defaultView: v)),
                  tc: tc,
                ),
              ),
            ],
          )),

          const SizedBox(height: 16),
          _SectionHeader('Storage & Sync', tc: tc),
          _SettingCard(tc: tc, child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ListTile(
                title: Text('Storage Mode', style: TextStyle(color: tc.text)),
                trailing: _DropDown<StorageMode>(
                  value: settings.storageMode,
                  items: const [
                    DropdownMenuItem(value: StorageMode.local,  child: Text('Local')),
                    DropdownMenuItem(value: StorageMode.server, child: Text('Self-Hosted Server')),
                    DropdownMenuItem(value: StorageMode.cloud,  child: Text('Cloud (Paid)')),
                  ],
                  onChanged: (v) => state.updateSettings((s) => s.copyWith(storageMode: v)),
                  tc: tc,
                ),
              ),
              if (settings.storageMode == StorageMode.server) ...[
                _DivRow(tc: tc),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!_showConnectForm && isConnected) ...[
                        Row(children: [
                          const Icon(Icons.check_circle, color: AppColors.success, size: 16),
                          const SizedBox(width: 6),
                          Expanded(child: Text('Connected: ${settings.serverUrl}',
                              style: TextStyle(color: tc.subtext, fontSize: 12),
                              overflow: TextOverflow.ellipsis)),
                        ]),
                        const SizedBox(height: 8),
                        if (settings.serverUsername != null)
                          Text('User: ${settings.serverDisplayName ?? settings.serverUsername}',
                              style: TextStyle(color: tc.subtext, fontSize: 12)),
                        const SizedBox(height: 8),
                        Row(children: [
                          Expanded(child: OutlinedButton.icon(
                            icon: const Icon(Icons.edit, size: 14),
                            label: const Text('Edit'),
                            onPressed: () => setState(() => _showConnectForm = true),
                          )),
                          const SizedBox(width: 8),
                          Expanded(child: ElevatedButton.icon(
                            icon: const Icon(Icons.sync, size: 14),
                            label: const Text('Sync'),
                            onPressed: _serverBusy ? null : _handleSync,
                          )),
                        ]),
                        if (settings.serverUsername == null)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: ElevatedButton.icon(
                              icon: const Icon(Icons.person_add, size: 14),
                              label: const Text('Create / Login Account'),
                              onPressed: () => setState(() { _showAuthModal = true; _isLogin = false; }),
                            ),
                          ),
                        if (settings.lastSyncTime != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text('Last sync: ${_fmtTime(settings.lastSyncTime!)}',
                                style: TextStyle(fontSize: 11, color: tc.muted)),
                          ),
                      ] else ...[
                        Text('Server URL', style: TextStyle(fontSize: 12, color: tc.subtext)),
                        const SizedBox(height: 4),
                        TextField(
                          controller: _urlCtrl,
                          style: TextStyle(color: tc.text, fontSize: 14),
                          decoration: const InputDecoration(hintText: 'https://your-server.com'),
                        ),
                        const SizedBox(height: 10),
                        Text('API Key', style: TextStyle(fontSize: 12, color: tc.subtext)),
                        const SizedBox(height: 4),
                        TextField(
                          controller: _keyCtrl,
                          obscureText: true,
                          style: TextStyle(color: tc.text, fontSize: 14),
                          decoration: const InputDecoration(hintText: 'Enter API key'),
                        ),
                        const SizedBox(height: 10),
                        if (_serverMsg != null)
                          Text(_serverMsg!, style: TextStyle(fontSize: 12, color: tc.subtext)),
                        Row(children: [
                          Expanded(child: OutlinedButton(
                            onPressed: () => setState(() { _showConnectForm = false; _serverMsg = null; }),
                            child: const Text('Cancel'),
                          )),
                          const SizedBox(width: 8),
                          Expanded(child: ElevatedButton(
                            onPressed: _serverBusy ? null : _handleConnect,
                            child: _serverBusy
                                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Text('Connect'),
                          )),
                        ]),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          )),

          const SizedBox(height: 16),
          _SectionHeader('Data', tc: tc),
          _SettingCard(tc: tc, child: ListTile(
            leading: const Icon(Icons.delete_forever, color: AppColors.danger),
            title: const Text('Delete All Data', style: TextStyle(color: AppColors.danger)),
            subtitle: Text('Resets to initial data', style: TextStyle(fontSize: 12, color: tc.muted)),
            onTap: () => _confirmDeleteAll(context, state),
          )),

          const SizedBox(height: 16),
          Center(child: Text('CheckMaster v1.0.0', style: TextStyle(fontSize: 12, color: tc.muted))),
          const SizedBox(height: 32),
        ],
      ),
      // Auth modal overlay
      bottomSheet: _showAuthModal ? _buildAuthModal(context, state, tc) : null,
    );
  }

  Widget _buildAuthModal(BuildContext context, AppState state, ThemeColors tc) {
    return Container(
      color: tc.card,
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Text(_isLogin ? 'Login' : 'Create Account',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: tc.text)),
            const Spacer(),
            IconButton(icon: const Icon(Icons.close), onPressed: () => setState(() => _showAuthModal = false)),
          ]),
          const SizedBox(height: 12),
          TextField(
            controller: _authUserCtrl,
            style: TextStyle(color: tc.text),
            decoration: const InputDecoration(labelText: 'Username'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _authPassCtrl,
            obscureText: true,
            style: TextStyle(color: tc.text),
            decoration: const InputDecoration(labelText: 'Password'),
          ),
          if (!_isLogin) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _authDisplayCtrl,
              style: TextStyle(color: tc.text),
              decoration: const InputDecoration(labelText: 'Display name (optional)'),
            ),
          ],
          if (_authMsg != null) Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(_authMsg!, style: TextStyle(fontSize: 12, color: tc.subtext)),
          ),
          const SizedBox(height: 12),
          Row(children: [
            TextButton(
              onPressed: () => setState(() { _isLogin = !_isLogin; _authMsg = null; }),
              child: Text(_isLogin ? 'Need an account?' : 'Already have account?'),
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: _authBusy ? null : () => _handleAuth(state),
              child: _authBusy
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_isLogin ? 'Login' : 'Register'),
            ),
          ]),
        ],
      ),
    );
  }

  Future<void> _handleConnect() async {
    final url = _urlCtrl.text.trim().replaceAll(RegExp(r'/$'), '');
    final key = _keyCtrl.text.trim();
    if (url.isEmpty || key.isEmpty) {
      setState(() => _serverMsg = 'Enter URL and API key');
      return;
    }
    setState(() { _serverBusy = true; _serverMsg = 'Testing connection…'; });
    final state = context.read<AppState>();
    state.updateSettings((s) => s.copyWith(serverUrl: url, serverApiKey: key, storageMode: StorageMode.server));
    final result = await state.testSyncServer();
    if (mounted) {
      setState(() {
        _serverBusy = false;
        _showConnectForm = false;
        _serverMsg = result.ok ? null : result.error;
      });
    }
  }

  Future<void> _handleSync() async {
    setState(() => _serverBusy = true);
    final state = context.read<AppState>();
    await state.pushDataToServer();
    if (mounted) setState(() => _serverBusy = false);
  }

  Future<void> _handleAuth(AppState state) async {
    final user = _authUserCtrl.text.trim();
    final pass = _authPassCtrl.text.trim();
    if (user.isEmpty || pass.isEmpty) {
      setState(() => _authMsg = 'Enter username and password');
      return;
    }
    setState(() { _authBusy = true; _authMsg = null; });
    final result = _isLogin
        ? await state.loginServerProfile(user, pass)
        : await state.registerServerProfile(user, pass, displayName: _authDisplayCtrl.text.trim());
    if (mounted) {
      setState(() {
        _authBusy = false;
        if (result.ok) { _showAuthModal = false; }
        else           { _authMsg = result.error; }
      });
    }
  }

  void _confirmDeleteAll(BuildContext context, AppState state) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete All Data?'),
        content: const Text('This will reset the app to its default data. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () {
              Navigator.pop(context);
              state.deleteAllData();
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  String _fmtTime(int ms) {
    final dt = DateTime.fromMillisecondsSinceEpoch(ms);
    return '${dt.year}-${_pad(dt.month)}-${_pad(dt.day)} ${_pad(dt.hour)}:${_pad(dt.minute)}';
  }

  String _pad(int n) => n.toString().padLeft(2, '0');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final ThemeColors tc;
  const _SectionHeader(this.title, {required this.tc});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(title.toUpperCase(),
        style: TextStyle(fontSize: 11, letterSpacing: 1, fontWeight: FontWeight.w600, color: tc.muted)),
  );
}

class _SettingCard extends StatelessWidget {
  final ThemeColors tc;
  final Widget child;
  const _SettingCard({required this.tc, required this.child});

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: tc.card,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: tc.border),
    ),
    child: child,
  );
}

class _DivRow extends StatelessWidget {
  final ThemeColors tc;
  const _DivRow({required this.tc});

  @override
  Widget build(BuildContext context) => Divider(height: 1, color: tc.border, indent: 16, endIndent: 16);
}

class _DropDown<T> extends StatelessWidget {
  final T value;
  final List<DropdownMenuItem<T>> items;
  final ValueChanged<T?> onChanged;
  final ThemeColors tc;

  const _DropDown({required this.value, required this.items, required this.onChanged, required this.tc});

  @override
  Widget build(BuildContext context) => DropdownButton<T>(
    value: value,
    items: items,
    onChanged: onChanged,
    underline: const SizedBox(),
    dropdownColor: tc.card,
    style: TextStyle(color: tc.text, fontSize: 14),
  );
}
