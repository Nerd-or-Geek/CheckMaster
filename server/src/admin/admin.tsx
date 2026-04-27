const { useState, useEffect } = React;

type User = {
  id: string;
  username: string;
  displayName: string;
  createdAt: number;
};

type ApiKeyResponse = {
  keys: string[];
};

type ApiLogEntry = {
  time: string;
  ip: string;
  method: string;
  path: string;
  status: number;
  ms: number;
};

type ServerLogEntry = {
  time: string;
  level: string;
  message: string;
};

type AppState = 'dashboard' | 'users' | 'apikeys' | 'data' | 'apilog' | 'serverlogs';

let adminToken = localStorage.getItem('admin_token') || '';

function fetchJson(path: string, opts: RequestInit = {}) {
  opts.headers = {
    ...(opts.headers || {}),
    Authorization: `Bearer ${adminToken}`,
  };
  return fetch(path, opts).then(async (res) => {
    if (!res.ok) {
      const payload = await res.text();
      throw new Error(payload || res.statusText);
    }
    return res.json();
  });
}

function login() {
  const password = prompt('Admin password:');
  if (!password) return;
  adminToken = password;
  localStorage.setItem('admin_token', password);
}

function App() {
  const [tab, setTab] = useState<AppState>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [dataJson, setDataJson] = useState('');
  const [checklistCount, setChecklistCount] = useState(0);
  const [folderCount, setFolderCount] = useState(0);
  const [shareCount, setShareCount] = useState(0);
  const [apiLog, setApiLog] = useState<ApiLogEntry[]>([]);
  const [serverLogs, setServerLogs] = useState<ServerLogEntry[]>([]);
  const [error, setError] = useState('');
  const [siteUrl, setSiteUrl] = useState(window.location.origin);

  useEffect(() => {
    autoLogin();
  }, []);

  function autoLogin() {
    if (!adminToken) {
      login();
      if (!adminToken) return;
    }
    fetchJson('/api/admin/ping')
      .then(() => loadAll())
      .catch(() => {
        adminToken = '';
        localStorage.removeItem('admin_token');
        login();
        if (adminToken) loadAll();
      });
  }

  function loadAll() {
    loadUsers();
    loadApiKeys();
    loadData();
    loadApiLog();
    loadServerLogs();
    setSiteUrl(window.location.origin);
  }

  function loadUsers() {
    fetchJson('/api/admin/users')
      .then((d) => setUsers(d.users || []))
      .catch((err) => setError(err.message));
  }

  function loadApiKeys() {
    fetchJson('/api/admin/apikeys')
      .then((d: ApiKeyResponse) => setApiKeys(d.keys || []))
      .catch((err) => setError(err.message));
  }

  function loadData() {
    fetchJson('/api/admin/alldata')
      .then((d) => {
        setDataJson(JSON.stringify(d, null, 2));
        setChecklistCount(Array.isArray(d.checklists) ? d.checklists.length : 0);
        setFolderCount(Array.isArray(d.folders) ? d.folders.length : 0);
        setShareCount(Array.isArray(d.shares) ? d.shares.length : 0);
      })
      .catch((err) => setError(err.message));
  }

  function loadApiLog() {
    fetchJson('/api/admin/apilog')
      .then((d) => setApiLog(d.log || []))
      .catch((err) => setError(err.message));
  }

  function loadServerLogs() {
    fetchJson('/api/admin/serverlogs')
      .then((d) => setServerLogs(d.logs || []))
      .catch((err) => setError(err.message));
  }

  function refresh() {
    setError('');
    loadAll();
  }

  function addApiKey() {
    const key = prompt('New API key:');
    if (!key) return;
    fetchJson('/api/admin/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    })
      .then(loadApiKeys)
      .catch((err) => setError(err.message));
  }

  function deleteApiKey(key: string) {
    fetchJson(`/api/admin/apikeys/${encodeURIComponent(key)}`, { method: 'DELETE' })
      .then(loadApiKeys)
      .catch((err) => setError(err.message));
  }

  function deleteUser(id: string) {
    if (!confirm('Delete user?')) return;
    fetchJson(`/api/admin/users/${id}`, { method: 'DELETE' })
      .then(loadUsers)
      .catch((err) => setError(err.message));
  }

  function editUser(id: string) {
    const name = prompt('New display name:');
    if (!name) return;
    fetchJson(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name }),
    })
      .then(loadUsers)
      .catch((err) => setError(err.message));
  }

  function saveData() {
    try {
      const parsed = JSON.parse(dataJson);
      fetchJson('/api/admin/alldata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
        .then(loadData)
        .catch((err) => setError(err.message));
    } catch (err: any) {
      setError('Invalid JSON: ' + err.message);
    }
  }

  const dashboardStats = [
    { label: 'Users', value: users.length },
    { label: 'Checklists', value: checklistCount },
    { label: 'Folders', value: folderCount },
    { label: 'Shares', value: shareCount },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>CheckMaster Admin</h1>
        <nav>
          {['dashboard', 'users', 'apikeys', 'data', 'apilog', 'serverlogs'].map((item) => (
            <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item as AppState)}>
              {item === 'apikeys' ? 'API Keys' : item === 'serverlogs' ? 'Server Logs' : item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <strong>Server URL:</strong> {siteUrl}
          </div>
          <button className="cta" onClick={refresh}>Refresh</button>
        </div>
        {error && <div className="panel"><strong style={{ color: '#d946ef' }}>Error:</strong> {error}</div>}
        {tab === 'dashboard' && (
          <>
            <div className="card-grid">
              {dashboardStats.map((stat) => (
                <div key={stat.label} className="card">
                  <h2>{stat.label}</h2>
                  <p className="value">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="panel">
              <h2>Server Info</h2>
              <p><strong>Site URL:</strong> {siteUrl}</p>
            </div>
          </>
        )}
        {tab === 'users' && (
          <div className="panel">
            <h2>Users</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>ID</th><th>Username</th><th>Display Name</th><th>Created</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>{user.displayName}</td>
                      <td>{new Date(user.createdAt).toLocaleString()}</td>
                      <td>
                        <button onClick={() => editUser(user.id)}>Edit</button>{' '}
                        <button onClick={() => deleteUser(user.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'apikeys' && (
          <div className="panel">
            <h2>API Keys</h2>
            <button className="cta" onClick={addApiKey}>Add Key</button>
            <div style={{ marginTop: 16 }}>
              {apiKeys.map((key) => (
                <div key={key} style={{ marginBottom: 10 }}>
                  <span className="api-key">{key}</span>{' '}
                  <button onClick={() => deleteApiKey(key)}>Delete</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'data' && (
          <div className="panel">
            <h2>All Data</h2>
            <textarea value={dataJson} onChange={(e) => setDataJson(e.target.value)} />
            <div style={{ marginTop: 12 }}>
              <button className="cta" onClick={saveData}>Save</button>
            </div>
          </div>
        )}
        {tab === 'apilog' && (
          <div className="panel">
            <h2>API Log</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Time</th><th>IP</th><th>Method</th><th>Path</th><th>Status</th><th>ms</th></tr>
                </thead>
                <tbody>
                  {apiLog.map((item, index) => (
                    <tr key={`${item.time}-${index}`}>
                      <td>{item.time}</td>
                      <td>{item.ip}</td>
                      <td>{item.method}</td>
                      <td>{item.path}</td>
                      <td>{item.status}</td>
                      <td>{item.ms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'serverlogs' && (
          <div className="panel">
            <h2>Server Logs</h2>
            <pre>{serverLogs.slice().reverse().map((log) => `${log.time} [${log.level.toUpperCase()}] ${log.message}`).join('\n')}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
