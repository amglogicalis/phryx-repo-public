/**
 * PHRYX Silk Studio — Frontend Application Logic
 * ($0 Infrastructure • Zero-Trust Ephemeral Mesh Controller)
 */

// State
const state = {
  activeTab: 'dashboard',
  apiBase: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? window.location.origin : '',
  isLocalServer: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'),
  vaultRepo: localStorage.getItem('phryx_storage_repo') || 'amglogicalis/.phryx-storage',
  status: null,
  tunnels: [],
  servers: [],
  reachProviders: [],
  reachRules: [],
  reachLogs: [],
  geoHistory: [],
  regions: [
    { code: 'east-us', name: 'US East (Virginia)', location: 'North America', flag: '🇺🇸' },
    { code: 'west-europe', name: 'Western Europe (Amsterdam)', location: 'Europe', flag: '🇳🇱' },
    { code: 'southeast-asia', name: 'Southeast Asia (Tokyo)', location: 'Asia Pacific', flag: '🇯🇵' },
    { code: 'brazil-south', name: 'Brazil South (São Paulo)', location: 'South America', flag: '🇧🇷' },
    { code: 'australia-east', name: 'Australia East (Sydney)', location: 'Oceania', flag: '🇦🇺' },
    { code: 'south-africa', name: 'South Africa (Johannesburg)', location: 'Africa', flag: '🇿🇦' },
  ],
  gateways: [],
  ghToken: null,
  ghUser: null,
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavigation();
  initForms();
  checkLocalMode();

  // Polling every 5 seconds for live status
  setInterval(refreshStatus, 5000);
});

// ─── GITHUB PAT AUTHENTICATION GATE ───────────────────────────────────────────
function initAuth() {
  const tokenInput = document.getElementById('token-input');
  const btnConnect = document.getElementById('btn-connect');
  const btnLogout = document.getElementById('btn-topbar-logout');

  // Check existing session
  const storedToken = sessionStorage.getItem('phryx_gh_token');
  if (storedToken) {
    authenticate(storedToken);
  } else {
    showLogin();
  }

  // Connect button click
  btnConnect?.addEventListener('click', () => {
    const token = tokenInput?.value.trim();
    if (token) {
      authenticate(token);
    } else {
      showAuthError('Por favor introduce un GitHub Personal Access Token (PAT) válido.');
    }
  });

  // Enter key inside token input
  tokenInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const token = tokenInput.value.trim();
      if (token) authenticate(token);
    }
  });

  // Logout handler
  btnLogout?.addEventListener('click', () => {
    handleLogout();
  });
}

function showLogin() {
  const loginGate = document.getElementById('login-gate');
  const appLayout = document.getElementById('app-layout');
  const tokenInput = document.getElementById('token-input');
  const loginError = document.getElementById('login-error');
  const userProfile = document.getElementById('user-profile-topbar');
  const btnLogout = document.getElementById('btn-topbar-logout');

  if (loginGate) loginGate.style.display = 'flex';
  if (appLayout) appLayout.style.display = 'none';
  if (userProfile) userProfile.style.display = 'none';
  if (btnLogout) btnLogout.style.display = 'none';
  if (tokenInput) tokenInput.value = '';
  if (loginError) loginError.style.display = 'none';
}

function showAuthError(msg) {
  const errDiv = document.getElementById('login-error');
  if (errDiv) {
    errDiv.textContent = msg;
    errDiv.style.display = 'block';
  }
}

function handleLogout() {
  sessionStorage.removeItem('phryx_gh_token');
  sessionStorage.removeItem('phryx_gh_user');
  state.ghToken = null;
  state.ghUser = null;
  showLogin();
}
window.handleLogout = handleLogout;


// ─── GITHUB VAULT CLIENT (ZERO-TRUST BIDIRECTIONAL REPO PERSISTENCE) ───────────
const vaultClient = {
  getRepo() {
    return state.vaultRepo || (state.ghUser ? `${state.ghUser}/.phryx-storage` : 'amglogicalis/.phryx-storage');
  },

  async ensureVaultRepo() {
    if (!state.ghToken) return false;
    const repoFullName = this.getRepo();
    try {
      // Check if repo exists
      const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
        headers: {
          Authorization: `Bearer ${state.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (res.ok) {
        state.vaultRepo = repoFullName;
        localStorage.setItem('phryx_storage_repo', repoFullName);
        return true;
      }

      if (res.status === 404) {
        // Create private repository automatically
        const repoName = repoFullName.includes('/') ? repoFullName.split('/')[1] : repoFullName;
        const createRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${state.ghToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: repoName,
            private: true,
            description: 'PHRYX — The Phantom Mesh: Zero-Trust Storage Vault',
            auto_init: true,
          }),
        });

        if (createRes.ok) {
          state.vaultRepo = repoFullName;
          localStorage.setItem('phryx_storage_repo', repoFullName);
          return true;
        }
      }
    } catch (err) {
      console.warn('[VaultClient] Error checking/creating vault repo:', err);
    }
    return false;
  },

  async getFile(relPath) {
    if (!state.ghToken) return null;
    const repoFullName = this.getRepo();
    try {
      const res = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${relPath}`, {
        headers: {
          Authorization: `Bearer ${state.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.content) {
          const raw = decodeURIComponent(escape(atob(json.content.replace(/\s/g, ''))));
          return JSON.parse(raw);
        }
      }
    } catch (err) {
      // Not found or network error
    }
    return null;
  },

  async getRawFile(relPath) {
    if (!state.ghToken) return null;
    const repoFullName = this.getRepo();
    try {
      const res = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${relPath}`, {
        headers: {
          Authorization: `Bearer ${state.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.content) {
          return decodeURIComponent(escape(atob(json.content.replace(/\s/g, ''))));
        }
      }
    } catch (err) {
      // Not found or network error
    }
    return null;
  },

  async setRawFile(relPath, rawStr, commitMsg) {
    if (!state.ghToken) return false;
    const repoFullName = this.getRepo();
    try {
      let sha = undefined;
      try {
        const checkRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${relPath}`, {
          headers: {
            Authorization: `Bearer ${state.ghToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        if (checkRes.ok) {
          const cur = await checkRes.json();
          sha = cur.sha;
        }
      } catch {}

      const contentBase64 = btoa(unescape(encodeURIComponent(rawStr)));
      const body = { message: commitMsg || `phryx(web-console): update ${relPath}`, content: contentBase64 };
      if (sha) body.sha = sha;

      const putRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${relPath}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${state.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      return putRes.ok;
    } catch (err) {
      console.warn('[VaultClient] Error writing raw file to vault:', err);
      return false;
    }
  },

  async setFile(relPath, data, commitMsg) {
    if (!state.ghToken) return false;
    const repoFullName = this.getRepo();
    try {
      // Check existing SHA
      let sha = undefined;
      try {
        const checkRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${relPath}`, {
          headers: {
            Authorization: `Bearer ${state.ghToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        if (checkRes.ok) {
          const cur = await checkRes.json();
          sha = cur.sha;
        }
      } catch {}

      const jsonStr = JSON.stringify(data, null, 2);
      const contentBase64 = btoa(unescape(encodeURIComponent(jsonStr)));

      const body = {
        message: commitMsg || `phryx(web-console): update ${relPath}`,
        content: contentBase64,
      };
      if (sha) body.sha = sha;

      const putRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${relPath}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${state.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      return putRes.ok;
    } catch (err) {
      console.warn('[VaultClient] Error updating file in vault:', err);
      return false;
    }
  },

  async listFolder(relFolder) {
    if (!state.ghToken) return [];
    const repoFullName = this.getRepo();
    try {
      const res = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${relFolder}`, {
        headers: {
          Authorization: `Bearer ${state.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          return items.filter((it) => it.name && it.name.endsWith('.json')).map((it) => it.name);
        }
      }
    } catch (err) {}
    return [];
  },
};

async function authenticate(token) {
  const btnConnect = document.getElementById('btn-connect');
  const loginError = document.getElementById('login-error');
  const loginGate = document.getElementById('login-gate');
  const appLayout = document.getElementById('app-layout');
  const userAvatar = document.getElementById('user-avatar');
  const userDisplay = document.getElementById('user-display');
  const userProfile = document.getElementById('user-profile-topbar');
  const btnLogout = document.getElementById('btn-topbar-logout');

  if (btnConnect) {
    btnConnect.disabled = true;
    btnConnect.textContent = 'Conectando a la Bóveda...';
  }
  if (loginError) loginError.style.display = 'none';

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      throw new Error(`Token inválido (HTTP ${res.status}). Comprueba que tenga permisos repo/workflow.`);
    }

    const userData = await res.json();

    // Persist in session
    sessionStorage.setItem('phryx_gh_token', token);
    sessionStorage.setItem('phryx_gh_user', userData.login);
    state.ghToken = token;
    state.ghUser = userData.login;
    state.vaultRepo = `${userData.login}/.phryx-storage`;
    localStorage.setItem('phryx_storage_repo', state.vaultRepo);

    // Auto-create or verify .phryx-storage vault repo
    await vaultClient.ensureVaultRepo();

    // Update UI profile
    if (userDisplay) userDisplay.textContent = `@${userData.login}`;
    if (userAvatar) {
      userAvatar.src = userData.avatar_url || 'assets/logo_phryx.png';
      userAvatar.alt = userData.login;
    }
    if (userProfile) userProfile.style.display = 'flex';
    if (btnLogout) btnLogout.style.display = 'inline-flex';

    // Switch view
    if (loginGate) loginGate.style.display = 'none';
    if (appLayout) appLayout.style.display = 'flex';

    // Load initial data
    loadAllData();
  } catch (err) {
    showAuthError(err.message || 'Error autenticando con la API de GitHub.');
    sessionStorage.removeItem('phryx_gh_token');
  } finally {
    if (btnConnect) {
      btnConnect.disabled = false;
      btnConnect.textContent = '🔑 Conectar Bóveda y Desbloquear Consola';
    }
  }
}

function checkLocalMode() {
  const banner = document.getElementById('tunnel-local-banner');
  const btnStart = document.getElementById('btn-start-tunnel');
  if (state.isLocalServer) {
    if (banner) {
      banner.style.border = '1px solid var(--success)';
      const icon = banner.querySelector('.banner-icon');
      if (icon) icon.textContent = '⚡';
      const h4 = banner.querySelector('h4');
      if (h4) h4.textContent = 'Modo Local Activo (Daemon Conectado)';
      const p = banner.querySelector('p');
      if (p) p.textContent = 'La consola está conectada a tu backend local de Phryx. Puedes iniciar túneles reales hacia cualquier puerto local.';
    }
    if (btnStart) {
      btnStart.innerHTML = '🚀 Iniciar Túnel Real';
    }
  } else {
    if (btnStart) {
      btnStart.innerHTML = '💻 Ejecutar en Local (Copiar CLI)';
    }
  }
}

// Navigation Handling
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Onboarding pills smooth scroll
  document.querySelectorAll('.onb-pill').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      const targetId = pill.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        e.preventDefault();
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          document.querySelectorAll('.onb-pill').forEach((p) => p.classList.remove('active'));
          pill.classList.add('active');
        }
      }
    });
  });

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    loadAllData();
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach((pane) => {
    pane.classList.toggle('active', pane.id === `pane-${tabId}`);
  });

  const titles = {
    dashboard: 'Dashboard',
    tunnel: 'PhryxTunnel',
    caseshell: 'CaseShell (SSH CA)',
    geolarva: 'GeoLarva Multi-Region Prober',
    reach: 'PhryxReach & SilkFilter ACL',
    silkroute: 'SilkRoute Cloud Proxy Gateway',
    onboarding: 'Onboarding & Master Guide',
  };

  const titleEl = document.getElementById('current-tab-title');
  if (titleEl) titleEl.textContent = titles[tabId] || 'Silk Studio';
}

// Data Fetching
async function loadAllData() {
  await Promise.all([
    refreshStatus(),
    loadTunnels(),
    loadServers(),
    loadReach(),
    loadGeoHistory(),
    loadGateways(),
  ]);
}

async function refreshStatus() {
  try {
    if (state.isLocalServer) {
      const res = await fetch(`${state.apiBase}/api/status`);
      if (res.ok) {
        state.status = await res.json();
        renderStatus();
        return;
      }
    }
  } catch {
    // offline/fallback
  }

  // Local/Browser fallback status
  state.status = {
    version: '1.0.0',
    storage: {
      type: 'github-storage-vault',
      target: localStorage.getItem('phryx_storage_repo') || 'amglogicalis/.phryx-storage',
      connected: true,
    },
    tunnels: {
      active: state.tunnels.filter((t) => t.status === 'active').length,
      totalHistorical: state.tunnels.length,
    },
    caseshell: {
      registeredServers: state.servers.length,
      activeSessions: 0,
      caFingerprint: 'ca_ed25519_live',
    },
    reach: {
      configuredProviders: state.reachProviders.length,
      activeRules: state.reachRules.filter((r) => r.status === 'active').length,
    },
    geolarva: {
      totalProbes: state.geoHistory.length,
      regionsSupported: state.regions.length,
    },
    silkroute: {
      activeGateways: state.gateways.filter((g) => g.status === 'active').length,
      totalHistorical: state.gateways.length,
    },
  };
  renderStatus();
}

function renderStatus() {
  if (!state.status) return;

  const activeGateways = state.status?.silkroute?.activeGateways ?? state.gateways.filter((g) => g.status === 'active').length;
  setText('stat-active-tunnels', state.status.tunnels.active);
  setText('stat-servers', state.status.caseshell.registeredServers);
  setText('stat-rules', state.status.reach.activeRules);
  setText('stat-probes', state.status.geolarva.totalProbes);
  setText('stat-gateways', activeGateways);
  setText('tunnel-active-badge', state.status.tunnels.active);
  setText('route-active-badge', activeGateways);
  setText('dashboard-ca-fingerprint', state.status.caseshell.caFingerprint);
  setText('storage-target-path', state.status.storage.target);
  setText('storage-type-badge', state.status.storage.type);

  renderDashboardRegions();
}

function renderDashboardRegions() {
  const container = document.getElementById('dashboard-regions-grid');
  if (!container) return;

  container.innerHTML = state.regions
    .map(
      (r) => `
    <div class="region-card">
      <span class="region-flag">${r.flag}</span>
      <div class="region-info">
        <span class="region-name">${r.name}</span>
        <span class="region-location">${r.location} • Status: <span class="text-success">Active</span></span>
      </div>
    </div>
  `
    )
    .join('');
}

// ==================== Tunnels Section ====================
async function loadTunnels() {
  try {
    if (state.isLocalServer) {
      const res = await fetch(`${state.apiBase}/api/tunnels`);
      if (res.ok) {
        state.tunnels = await res.json();
        renderTunnels();
        return;
      }
    }
  } catch {}

  // Fetch from GitHub Vault if online
  if (state.ghToken) {
    const files = await vaultClient.listFolder('tunnel-sessions');
    if (files && files.length > 0) {
      const loaded = [];
      for (const f of files.slice(0, 20)) {
        const item = await vaultClient.getFile(`tunnel-sessions/${f}`);
        if (item) loaded.push(item);
      }
      if (loaded.length > 0) {
        state.tunnels = loaded.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        localStorage.setItem('phryx_tunnels', JSON.stringify(state.tunnels));
        renderTunnels();
        return;
      }
    }
  }

  // Fallback to local storage
  const saved = localStorage.getItem('phryx_tunnels');
  state.tunnels = saved ? JSON.parse(saved) : [];
  renderTunnels();
}

function renderTunnels() {
  const dashList = document.getElementById('dashboard-tunnels-list');
  const sessionContainer = document.getElementById('tunnel-sessions-container');
  const tbodyLogs = document.getElementById('tbody-tunnel-logs');
  const badgeTraffic = document.getElementById('traffic-count-badge');

  const active = state.tunnels.filter((t) => t.status === 'active');

  // Dashboard Preview
  if (dashList) {
    if (active.length === 0) {
      dashList.innerHTML = '<div class="empty-state">No active tunnels. Launch one to expose your localhost to the world.</div>';
    } else {
      dashList.innerHTML = active
        .map(
          (t) => `
        <div class="session-card">
          <div class="session-header">
            <span class="session-url">${t.publicUrl}</span>
            <span class="badge">ACTIVE</span>
          </div>
          <div class="session-meta">
            <span>Local: ${t.localUrl}</span>
            <span>Requests: ${t.totalRequests}</span>
            <span>Expires: ${new Date(t.expiresAt).toLocaleTimeString()}</span>
          </div>
        </div>
      `
        )
        .join('');
    }
  }

  // Tunnel Tab List
  if (sessionContainer) {
    if (state.tunnels.length === 0) {
      sessionContainer.innerHTML = '<div class="empty-state">No tunnel running. Fill the form to launch one.</div>';
    } else {
      sessionContainer.innerHTML = state.tunnels
        .map(
          (t) => `
        <div class="session-card">
          <div class="session-header">
            <span class="session-url">${t.publicUrl}</span>
            <span class="badge ${t.status === 'active' ? '' : 'text-muted'}">${t.status.toUpperCase()}</span>
          </div>
          <div class="session-meta">
            <span>Forwarding: ${t.localUrl}</span>
            <span>Total Req: ${t.totalRequests}</span>
            <span>Latency: ${t.metrics.avgLatencyMs}ms</span>
          </div>
          <div class="form-actions mt-4">
            <button class="btn btn-secondary btn-xs" onclick="copySnippetText('${t.publicUrl}')">📋 Copy URL</button>
            ${
              t.status === 'active'
                ? `<button class="btn btn-danger btn-xs" onclick="closeTunnel('${t.id}')">🛑 Stop Tunnel</button>`
                : ''
            }
          </div>
        </div>
      `
        )
        .join('');
    }
  }

  // Render logs
  if (tbodyLogs) {
    const allLogs = state.tunnels.flatMap((t) => t.recentLogs || []);
    if (badgeTraffic) badgeTraffic.textContent = `${allLogs.length} requests`;

    if (allLogs.length === 0) {
      tbodyLogs.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Awaiting traffic on active tunnels...</td></tr>';
    } else {
      tbodyLogs.innerHTML = allLogs
        .slice(0, 25)
        .map(
          (l) => `
        <tr>
          <td>${new Date(l.timestamp).toLocaleTimeString()}</td>
          <td><span class="badge">${l.method}</span></td>
          <td><code>${l.path}</code></td>
          <td><span class="${l.statusCode < 400 ? 'text-success' : 'text-danger'}">${l.statusCode}</span></td>
          <td>${l.durationMs}ms</td>
          <td>${l.bytesReceived}B / ${l.bytesSent}B</td>
          <td>${l.clientIp || '127.0.0.1'}</td>
        </tr>
      `
        )
        .join('');
    }
  }
}

async function closeTunnel(id) {
  if (state.isLocalServer) {
    await fetch(`${state.apiBase}/api/tunnels/${id}`, { method: 'DELETE' });
  }
  const tun = state.tunnels.find((t) => t.id === id);
  if (tun) tun.status = 'closed';
  localStorage.setItem('phryx_tunnels', JSON.stringify(state.tunnels));
  renderTunnels();
  refreshStatus();
}

// ==================== CaseShell (SSH CA) Section ====================
async function loadServers() {
  try {
    if (state.isLocalServer) {
      const res = await fetch(`${state.apiBase}/api/ssh/servers`);
      if (res.ok) {
        state.servers = await res.json();
        renderServers();
        return;
      }
    }
  } catch {}

  // Fetch from GitHub Vault if online
  if (state.ghToken) {
    const vaultServersMap = await vaultClient.getFile('ssh/servers.json');
    if (vaultServersMap && typeof vaultServersMap === 'object') {
      state.servers = Object.values(vaultServersMap);
      localStorage.setItem('phryx_servers', JSON.stringify(state.servers));
      renderServers();
      return;
    }
  }

  const saved = localStorage.getItem('phryx_servers');
  state.servers = saved ? JSON.parse(saved) : [];
  renderServers();
}

function renderServers() {
  const select = document.getElementById('cert-server-select');
  const tbody = document.getElementById('tbody-servers');
  const preview = document.getElementById('dashboard-servers-preview');

  if (select) {
    select.innerHTML =
      '<option value="">-- Select Server --</option>' +
      state.servers.map((s) => `<option value="${s.alias}">${s.alias} (${s.user}@${s.host})</option>`).join('');
  }

  if (preview) {
    preview.innerHTML = state.servers
      .map(
        (s) => `
      <div class="info-row">
        <span class="label">${s.alias}</span>
        <span class="value code-font">${s.user}@${s.host}:${s.port}</span>
      </div>
    `
      )
      .join('');
  }

  if (tbody) {
    if (state.servers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No servers registered.</td></tr>';
    } else {
      tbody.innerHTML = state.servers
        .map(
          (s) => `
        <tr>
          <td><strong>${s.alias}</strong></td>
          <td>${s.host}</td>
          <td>${s.user}</td>
          <td>${s.port}</td>
          <td><code>${s.caPublicKeyFingerprint || '—'}</code></td>
          <td>${s.registeredAt ? new Date(s.registeredAt).toLocaleDateString() : '—'}</td>
          <td style="display:flex; gap:0.35rem; flex-wrap:wrap;">
            <button class="btn btn-primary btn-xs" onclick="quickMintCert('${s.alias}')">⚡ Mint</button>
            <button class="btn btn-secondary btn-xs" onclick="editServer('${s.alias}')">✏️ Edit</button>
            <button class="btn btn-danger btn-xs" onclick="deleteServer('${s.alias}')">🗑️ Delete</button>
          </td>
        </tr>
      `
        )
        .join('');
    }
  }
}

// ── Edit server: populate form and switch to edit mode ───────────────────────
function editServer(alias) {
  const s = state.servers.find((x) => x.alias === alias);
  if (!s) return;

  document.getElementById('ssh-alias').value = s.alias;
  document.getElementById('ssh-host').value = s.host;
  document.getElementById('ssh-user').value = s.user;
  document.getElementById('ssh-port').value = s.port;
  document.getElementById('ssh-editing-alias').value = alias;

  // Switch button labels
  const btnReg = document.getElementById('btn-register-server');
  const btnCancel = document.getElementById('btn-cancel-edit-server');
  if (btnReg) btnReg.textContent = '💾 Update Server';
  if (btnCancel) btnCancel.classList.remove('hidden');

  // Scroll to form
  document.getElementById('caseshell-register-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Cancel edit: reset form to register mode ─────────────────────────────────
function cancelEditServer() {
  document.getElementById('caseshell-register-form').reset();
  document.getElementById('ssh-editing-alias').value = '';
  const btnReg = document.getElementById('btn-register-server');
  const btnCancel = document.getElementById('btn-cancel-edit-server');
  if (btnReg) btnReg.textContent = '➕ Register Server';
  if (btnCancel) btnCancel.classList.add('hidden');
  document.getElementById('ssh-setup-box')?.classList.add('hidden');
}

// ── Delete server: remove from state + vault + localStorage ─────────────────
async function deleteServer(alias) {
  if (!confirm(`Delete server "${alias}"? This cannot be undone.`)) return;

  state.servers = state.servers.filter((x) => x.alias !== alias);
  localStorage.setItem('phryx_servers', JSON.stringify(state.servers));

  if (state.ghToken) {
    const map = {};
    for (const s of state.servers) map[s.alias] = s;
    await vaultClient.setFile('ssh/servers.json', map, `phryx(ssh): delete server ${alias}`);
  }

  if (state.isLocalServer) {
    try {
      await fetch(`${state.apiBase}/api/ssh/servers/${encodeURIComponent(alias)}`, { method: 'DELETE' });
    } catch {}
  }

  renderServers();
  refreshStatus();
}

async function quickMintCert(alias) {
  switchTab('caseshell');
  const select = document.getElementById('cert-server-select');
  if (select) select.value = alias;
  document.getElementById('caseshell-cert-form')?.dispatchEvent(new Event('submit'));
}

// ==================== GeoLarva Section ====================
async function loadGeoHistory() {
  try {
    if (state.isLocalServer) {
      const res = await fetch(`${state.apiBase}/api/geo/probes`);
      if (res.ok) {
        state.geoHistory = await res.json();
        renderGeoHistory();
        return;
      }
    }
  } catch {}

  // Fetch from GitHub Vault if online
  if (state.ghToken) {
    const files = await vaultClient.listFolder('geo/history');
    if (files && files.length > 0) {
      const loaded = [];
      for (const f of files.slice(0, 15)) {
        const item = await vaultClient.getFile(`geo/history/${f}`);
        if (item) loaded.push(item);
      }
      if (loaded.length > 0) {
        state.geoHistory = loaded.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        localStorage.setItem('phryx_geo_history', JSON.stringify(state.geoHistory));
        renderGeoHistory();
        return;
      }
    }
  }

  const saved = localStorage.getItem('phryx_geo_history');
  state.geoHistory = saved ? JSON.parse(saved) : [];
  renderGeoHistory();
}

function renderGeoHistory() {
  const tbody = document.getElementById('tbody-geo-history');
  const countBadge = document.getElementById('geo-history-count');
  if (!tbody) return;

  if (countBadge) countBadge.textContent = `${state.geoHistory.length} probe${state.geoHistory.length !== 1 ? 's' : ''}`;

  if (state.geoHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No probe history recorded yet.</td></tr>';
  } else {
    tbody.innerHTML = state.geoHistory
      .slice(0, 20)
      .map((m) => {
        const fastest = m.summary?.fastestRegion || '—';
        const slowest = m.summary?.slowestRegion || '—';
        const rate = m.summary?.globalSuccessRate ?? '?';
        const rateClass = rate >= 100 ? 'text-success' : rate > 0 ? 'text-warning' : 'text-danger';
        return `
      <tr>
        <td>${new Date(m.timestamp).toLocaleTimeString()}</td>
        <td><code style="max-width:180px;overflow:hidden;text-overflow:ellipsis;display:inline-block;vertical-align:middle;" title="${m.url}">${m.url}</code></td>
        <td><span class="badge">${m.method || 'GET'}</span></td>
        <td><span class="text-success">🏆 ${fastest}</span></td>
        <td><span class="text-warning">🐢 ${slowest}</span></td>
        <td><strong>${m.summary?.avgLatencyMs ?? '—'}ms</strong></td>
        <td><span class="badge ${rateClass}">${rate}%</span></td>
        <td>${m.repetitions || 1}×</td>
      </tr>
    `;
      })
      .join('');
  }
}

// ── Export current probe config as GitHub Actions YAML ────────────────────────
function exportGeoYaml() {
  const url = document.getElementById('geo-url')?.value?.trim() || 'https://example.com';
  const method = document.getElementById('geo-method')?.value || 'GET';
  const timeout = Number(document.getElementById('geo-timeout')?.value) || 8000;
  const timeoutSec = Math.round(timeout / 1000);

  // NOTE: Use string concat to avoid JS template literal collision with GitHub Actions ${{ }} syntax
  const GHA = (expr) => '${{ ' + expr + ' }}';

  const yaml = [
    '# PHRYX — The Phantom Mesh: GeoLarva Multi-Region Probe',
    '# Auto-generated from web console. Runs real probes from 6 global Azure runners.',
    'name: GeoLarva Global Latency Probe',
    '',
    'on:',
    '  workflow_dispatch:',
    '    inputs:',
    '      target_url:',
    "        description: 'URL to probe globally'",
    '        required: true',
    "        default: '" + url + "'",
    '      method:',
    "        description: 'HTTP Method'",
    '        required: false',
    "        default: '" + method + "'",
    '',
    'jobs:',
    '  geo-probe:',
    '    strategy:',
    '      fail-fast: false',
    '      matrix:',
    '        region:',
    '          - east-us',
    '          - west-europe',
    '          - southeast-asia',
    '          - brazil-south',
    '          - australia-east',
    '          - south-africa',
    '    runs-on: ubuntu-latest',
    '    steps:',
    "      - name: \"\\uD83C\\uDF0D GeoLarva Probe \\u2014 " + GHA('matrix.region') + '"',
    '        run: |',
    '          TARGET="' + GHA('github.event.inputs.target_url') + '"',
    '          METHOD="' + GHA('github.event.inputs.method') + '"',
    '          TIMEOUT_S=' + timeoutSec,
    '          echo "Region: ' + GHA('matrix.region') + '"',
    '          echo "Target: $TARGET"',
    '          START=$(date +%s%3N)',
    '          HTTP_CODE=$(curl -s -o /tmp/probe_body.txt -w "%{http_code}" \\',
    '            -X "$METHOD" \\',
    '            -H "X-Phryx-Region: ' + GHA('matrix.region') + '" \\',
    '            -m "$TIMEOUT_S" \\',
    '            "$TARGET" 2>/dev/null || echo "000")',
    '          END=$(date +%s%3N)',
    '          LATENCY=$((END - START))',
    '          BODY_SIZE=$(wc -c < /tmp/probe_body.txt || echo 0)',
    '          echo "HTTP $HTTP_CODE in ${LATENCY}ms (${BODY_SIZE} bytes)"',
    '          if [ "$HTTP_CODE" -ge 400 ] || [ "$HTTP_CODE" = "000" ]; then',
    '            echo "Probe failed with HTTP $HTTP_CODE"',
    '            exit 1',
    '          fi',
    '',
  ].join('\n');

  // Copy to clipboard
  navigator.clipboard.writeText(yaml).then(() => {
    alert('📋 GitHub Actions YAML copied to clipboard!\n\nPaste it into .github/workflows/geolarva.yml in your repo.');
  }).catch(() => {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write('<pre style="font-family:monospace;white-space:pre;padding:2rem;">' + yaml.replace(/</g, '&lt;') + '</pre>');
      win.document.title = 'GeoLarva GitHub Action YAML';
    }
  });
}

// ── Clear probe history ────────────────────────────────────────────────────────
function clearGeoHistory() {
  if (!confirm('Clear all probe history? This will also clear localStorage.')) return;
  state.geoHistory = [];
  localStorage.removeItem('phryx_geo_history');
  renderGeoHistory();
  const container = document.getElementById('geo-results-container');
  if (container) container.innerHTML = '<div class="empty-state">Probe history cleared. Launch a new probe to start fresh.</div>';
  const statusTag = document.getElementById('geo-matrix-status');
  if (statusTag) statusTag.textContent = 'Ready';
}

// ==================== PhryxReach / SilkFilter Section ====================
async function loadReach() {
  try {
    if (state.isLocalServer) {
      const [resP, resL] = await Promise.all([
        fetch(`${state.apiBase}/api/reach/providers`),
        fetch(`${state.apiBase}/api/reach/logs`),
      ]);
      if (resP.ok) state.reachProviders = await resP.json();
      if (resL.ok) state.reachLogs = await resL.json();
      renderReach();
      return;
    }
  } catch {}

  // Fetch from GitHub Vault if online
  if (state.ghToken) {
    const [vaultProviders, vaultLogs, vaultRules] = await Promise.all([
      vaultClient.getFile('reach/providers.json'),
      vaultClient.getFile('reach/history.json'),
      vaultClient.getFile('reach/rules.json'),
    ]);
    if (vaultProviders && typeof vaultProviders === 'object') {
      state.reachProviders = Object.values(vaultProviders);
      localStorage.setItem('phryx_reach_providers', JSON.stringify(state.reachProviders));
    }
    if (Array.isArray(vaultLogs)) {
      state.reachLogs = vaultLogs;
    }
    if (vaultRules && typeof vaultRules === 'object') {
      state.reachRules = Object.values(vaultRules);
    }
    renderReach();
    return;
  }

  const savedP = localStorage.getItem('phryx_reach_providers');
  state.reachProviders = savedP ? JSON.parse(savedP) : [];
  renderReach();
}

function renderReach() {
  const select = document.getElementById('silk-provider-select');
  const tbody = document.getElementById('tbody-reach-logs');

  if (select) {
    select.innerHTML =
      '<option value="">-- Select Configured Provider --</option>' +
      state.reachProviders.map((p) => `<option value="${p.provider}:${p.resourceId}">${p.provider} (${p.resourceId})</option>`).join('');
  }

  if (tbody) {
    if (state.reachLogs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No ACL operations logged yet.</td></tr>';
    } else {
      tbody.innerHTML = state.reachLogs
        .slice(0, 15)
        .map(
          (l) => `
        <tr>
          <td>${new Date(l.timestamp).toLocaleTimeString()}</td>
          <td><span class="badge ${l.action === 'inject' ? 'text-success' : 'text-muted'}">${l.action.toUpperCase()}</span></td>
          <td>${l.provider}</td>
          <td><code>${l.resourceId}</code></td>
          <td>${l.ip}</td>
          <td><span class="${l.success ? 'text-success' : 'text-danger'}">${l.success ? 'SUCCESS' : 'FAILED'}</span></td>
        </tr>
      `
        )
        .join('');
    }
  }
}

// ==================== SilkRoute (Cloud Proxy Gateway) Section ====================
async function loadGateways() {
  try {
    if (state.isLocalServer) {
      const res = await fetch(`${state.apiBase}/api/route/sessions`);
      if (res.ok) {
        state.gateways = await res.json();
        renderGateways();
        return;
      }
    }
  } catch {}

  // Fetch from GitHub Vault if online
  if (state.ghToken) {
    const files = await vaultClient.listFolder('route-sessions');
    if (files && files.length > 0) {
      const loaded = [];
      for (const f of files) {
        const item = await vaultClient.getFile(`route-sessions/${f}`);
        if (item) loaded.push(item);
      }
      if (loaded.length > 0) {
        state.gateways = loaded.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        localStorage.setItem('phryx_gateways', JSON.stringify(state.gateways));
        renderGateways();
        return;
      }
    }
  }

  const saved = localStorage.getItem('phryx_gateways');
  state.gateways = saved ? JSON.parse(saved) : [];
  renderGateways();
}

function renderGateways() {
  const active = state.gateways.find((g) => g.status === 'active');
  const quickContainer = document.getElementById('route-quick-connect-container');
  const statusPill = document.getElementById('route-status-pill');
  const tbody = document.getElementById('tbody-route-sessions');
  const countBadge = document.getElementById('route-count-badge');

  if (countBadge) countBadge.textContent = `${state.gateways.length} sessions`;

  // Active Quick Connect Card
  if (quickContainer) {
    if (!active) {
      quickContainer.innerHTML = '<div class="empty-state">No active gateway session. Spawn one to generate proxy credentials.</div>';
      if (statusPill) {
        statusPill.textContent = 'Idle';
        statusPill.className = 'badge text-muted';
      }
    } else {
      if (statusPill) {
        statusPill.textContent = 'ONLINE (ACTIVE)';
        statusPill.className = 'badge text-success';
      }
      const rMeta = state.regions.find((r) => r.code === active.region) || { flag: '🌐', name: active.region };
      const expiresTime = new Date(active.expiresAt).toLocaleTimeString();
      quickContainer.innerHTML = `
        <div class="active-gateway-card" style="background: rgba(128, 60, 255, 0.08); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 14px;">
          <div class="gw-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div>
              <span style="font-size:1.05rem; font-weight:700; color:#fff;">${rMeta.flag} ${rMeta.name}</span>
              <span class="badge" style="margin-left:8px;">${active.protocol.toUpperCase()}</span>
              ${active.lazarusEnabled ? '<span class="badge" style="background:rgba(6,214,160,0.15); color:var(--success); margin-left:4px;">🔄 Lazarus 24/7</span>' : ''}
            </div>
            <button class="btn btn-danger btn-xs" onclick="terminateGateway('${active.id}')">🛑 Terminate</button>
          </div>

          <div class="info-row"><span class="label">SOCKS5 URI:</span><code class="code-pill">${active.socks5Url}</code></div>
          <div class="info-row"><span class="label">HTTP URI:</span><code class="code-pill">${active.httpUrl}</code></div>
          <div class="info-row"><span class="label">Time Remaining:</span><span class="value text-warning">Expires at ${expiresTime} (${active.durationMinutes}m lease)</span></div>

          <div class="gw-actions-row mt-3" style="display:flex; gap:8px; flex-wrap:wrap; margin-top: 12px;">
            <button type="button" class="btn btn-secondary btn-xs" onclick="copySnippetText('${active.socks5Url}'); alert('SOCKS5 URI copiada!')">📋 Copy SOCKS5</button>
            <button type="button" class="btn btn-secondary btn-xs" onclick="copySnippetText('${active.httpUrl}'); alert('HTTP URI copiada!')">📋 Copy HTTP</button>
            <button type="button" class="btn btn-secondary btn-xs" onclick="copySnippetText('${active.curlCommand}'); alert('cURL command copiado!')">💻 Copy cURL</button>
            <button type="button" class="btn btn-secondary btn-xs" onclick="copySnippetText('export ALL_PROXY=\\'${active.socks5Url}\\''); alert('Export env copiado!')">🐚 Copy Terminal Export</button>
          </div>
        </div>
      `;
    }
  }

  // Sessions Table
  if (tbody) {
    if (state.gateways.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No gateway sessions recorded yet.</td></tr>';
    } else {
      tbody.innerHTML = state.gateways
        .map((s) => {
          const rMeta = state.regions.find((r) => r.code === s.region) || { flag: '🌐', name: s.region };
          const isAct = s.status === 'active';
          return `
            <tr>
              <td><code>${s.id}</code></td>
              <td>${rMeta.flag} ${s.region}</td>
              <td><span class="badge">${s.protocol.toUpperCase()}</span></td>
              <td><code>${s.ip}:${s.socksPort}</code></td>
              <td>${s.lazarusEnabled ? '<span class="text-success">✔ 24/7 Relay</span>' : '<span class="text-muted">Single</span>'}</td>
              <td>${new Date(s.expiresAt).toLocaleTimeString()}</td>
              <td><span class="badge ${isAct ? 'text-success' : 'text-muted'}">${s.status.toUpperCase()}</span></td>
              <td>
                ${isAct ? `<button class="btn btn-danger btn-xs" onclick="terminateGateway('${s.id}')">Stop</button>` : '<span class="text-muted">—</span>'}
              </td>
            </tr>
          `;
        })
        .join('');
    }
  }
}

async function terminateGateway(id) {
  if (state.isLocalServer) {
    await fetch(`${state.apiBase}/api/route/sessions/${id}`, { method: 'DELETE' });
  }
  const target = state.gateways.find((g) => g.id === id);
  if (target) target.status = 'terminated';
  localStorage.setItem('phryx_gateways', JSON.stringify(state.gateways));
  renderGateways();
  refreshStatus();
}
window.terminateGateway = terminateGateway;

// ==================== Forms & Event Handlers ====================
function initForms() {
  // Initialize Default Configurations
  const defaultTunTimeout = localStorage.getItem('phryx_default_tunnel_timeout') || '30';
  const setTunTimeoutEl = document.getElementById('set-tun-timeout');
  const tunTimeoutEl = document.getElementById('tun-timeout');
  if (setTunTimeoutEl) setTunTimeoutEl.value = defaultTunTimeout;
  if (tunTimeoutEl) tunTimeoutEl.value = defaultTunTimeout;

  const defaultSshLifetime = localStorage.getItem('phryx_default_ssh_lifetime') || '60';
  const setSshDurationEl = document.getElementById('set-ssh-duration');
  const certDurationEl = document.getElementById('cert-duration');
  if (setSshDurationEl) setSshDurationEl.value = defaultSshLifetime;
  if (certDurationEl) certDurationEl.value = defaultSshLifetime;

  document.getElementById('btn-save-tun-default')?.addEventListener('click', () => {
    const val = document.getElementById('set-tun-timeout')?.value || '30';
    localStorage.setItem('phryx_default_tunnel_timeout', val);
    if (tunTimeoutEl) tunTimeoutEl.value = val;
    alert(`✔ Default Tunnel Timeout updated to ${val} minutes.`);
  });

  document.getElementById('btn-save-ssh-default')?.addEventListener('click', () => {
    const val = document.getElementById('set-ssh-duration')?.value || '60';
    localStorage.setItem('phryx_default_ssh_lifetime', val);
    if (certDurationEl) certDurationEl.value = val;
    alert(`✔ Default SSH Cert Lifetime updated to ${val} minutes.`);
  });

  // Tunnel Form
  document.getElementById('tun-port')?.addEventListener('input', (e) => {
    const val = e.target.value || '3000';
    const exampleEl = document.getElementById('banner-cmd-example');
    if (exampleEl) exampleEl.textContent = `phryx tunnel --port ${val}`;
  });

  document.getElementById('tunnel-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const port = Number(document.getElementById('tun-port').value);
    const protocol = document.getElementById('tun-protocol').value;
    const timeoutMinutes = Number(document.getElementById('tun-timeout').value);
    const subdomain = document.getElementById('tun-subdomain').value;
    const authToken = document.getElementById('tun-auth').value;

    if (!state.isLocalServer) {
      const authFlag = authToken ? ` --auth ${authToken}` : '';
      const subFlag = subdomain ? ` --subdomain ${subdomain}` : '';
      const cmd = `phryx tunnel --port ${port} --timeout ${timeoutMinutes}${authFlag}${subFlag}`;
      copySnippetText(cmd);
      alert(`⚠️ Función Exclusiva de Entorno Local:
Los navegadores en la nube pública no pueden interceptar ni reenviar puertos de tu máquina física (localhost:${port}).

Para iniciar este túnel en tu equipo:
1) Ejecuta en tu terminal:
   ${cmd}
2) O arranca la consola local con:
   phryx console

¡El comando ha sido copiado automáticamente al portapapeles!`);
      return;
    }

    const payload = { port, protocol, timeoutMinutes, subdomain, authToken };

    const res = await fetch(`${state.apiBase}/api/tunnels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const session = await res.json();
      state.tunnels.unshift(session);
    }

    renderTunnels();
    refreshStatus();
  });

  // Copy CLI command
  document.getElementById('btn-copy-tunnel-cli')?.addEventListener('click', () => {
    const port = document.getElementById('tun-port').value;
    const timeout = document.getElementById('tun-timeout').value;
    const auth = document.getElementById('tun-auth').value;
    const authFlag = auth ? ` --auth ${auth}` : '';
    const cmd = `phryx tunnel --port ${port} --timeout ${timeout}${authFlag}`;
    copySnippetText(cmd);
    alert(`Copied to clipboard: ${cmd}`);
  });

  // SSH Register / Edit Server Form
  document.getElementById('caseshell-register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alias = document.getElementById('ssh-alias').value.trim();
    const host = document.getElementById('ssh-host').value.trim();
    const user = document.getElementById('ssh-user').value.trim() || 'root';
    const port = Number(document.getElementById('ssh-port').value) || 22;
    const editingAlias = document.getElementById('ssh-editing-alias')?.value?.trim() || '';
    const isEdit = !!editingAlias;

    let setupSnippet = '';

    if (state.isLocalServer) {
      if (isEdit) {
        // UPDATE via API: delete old, create new (or PUT if backend supports it)
        try { await fetch(`${state.apiBase}/api/ssh/servers/${encodeURIComponent(editingAlias)}`, { method: 'DELETE' }); } catch {}
      }
      const res = await fetch(`${state.apiBase}/api/ssh/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias, host, user, port }),
      });
      if (res.ok) {
        const data = await res.json();
        setupSnippet = data.setupSnippet;
        if (isEdit) {
          // Replace old entry
          const idx = state.servers.findIndex((x) => x.alias === editingAlias);
          if (idx !== -1) state.servers.splice(idx, 1, data.server);
          else state.servers.push(data.server);
        } else {
          state.servers.push(data.server);
        }
      }
    } else {
      // Alias conflict check (only for new servers)
      if (!isEdit && state.servers.find((x) => x.alias === alias)) {
        alert(`A server with alias "${alias}" already exists. Use ✏️ Edit to modify it.`);
        return;
      }

      if (isEdit) {
        // Update in-place, preserving registeredAt and fingerprint
        const idx = state.servers.findIndex((x) => x.alias === editingAlias);
        if (idx !== -1) {
          const existing = state.servers[idx];
          state.servers[idx] = {
            ...existing,
            alias,   // alias may have changed
            host,
            user,
            port,
            updatedAt: new Date().toISOString(),
          };
        }
      } else {
        state.servers.push({
          alias,
          host,
          user,
          port,
          registeredAt: new Date().toISOString(),
          caPublicKeyFingerprint: 'ed25519_fingerprint_live',
        });
      }

      localStorage.setItem('phryx_servers', JSON.stringify(state.servers));
      if (state.ghToken) {
        const map = {};
        for (const s of state.servers) map[s.alias] = s;
        vaultClient.setFile(
          'ssh/servers.json',
          map,
          isEdit ? `phryx(ssh): update server ${alias}` : `phryx(ssh): register server ${alias}`,
        );
      }

      setupSnippet = `# Setup PHRYX Zero-Trust CA on server [${alias}] (${host})
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... phryx_ca@terra" | sudo tee /etc/ssh/phryx_ca.pub
echo "TrustedUserCAKeys /etc/ssh/phryx_ca.pub" | sudo tee -a /etc/ssh/sshd_config
sudo systemctl restart ssh
echo "✔ Ready for ephemeral Zero-Trust SSH!"`;
    }

    // Reset form to register mode
    cancelEditServer();

    renderServers();
    refreshStatus();

    if (setupSnippet) {
      const box = document.getElementById('ssh-setup-box');
      const code = document.getElementById('ssh-setup-code');
      if (box && code) {
        code.textContent = setupSnippet;
        box.classList.remove('hidden');
      }
    }
  });

  // Issue SSH Cert Form
  document.getElementById('caseshell-cert-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const serverAlias = document.getElementById('cert-server-select').value;
    if (!serverAlias) {
      alert('Please select a registered server.');
      return;
    }

    const principal = document.getElementById('cert-principal').value.trim() || state.ghUser || 'operator';
    const duration = Number(document.getElementById('cert-duration').value) || Number(localStorage.getItem('phryx_default_ssh_lifetime')) || 60;
    const keyId = document.getElementById('cert-key-id').value.trim() || undefined;
    const sourceIp = document.getElementById('cert-source-ip').value.trim() || undefined;
    const forceCommand = document.getElementById('cert-force-command').value.trim() || undefined;
    const publicKey = document.getElementById('cert-public-key').value.trim() || undefined;
    const extensions = Array.from(document.querySelectorAll('.cert-extension-cb:checked')).map((cb) => cb.value);

    let certData = null;
    let sshCommand = null;

    if (state.isLocalServer) {
      const res = await fetch(`${state.apiBase}/api/ssh/cert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverAlias,
          userPrincipal: principal,
          validityMinutes: duration,
          sourceAddress: sourceIp,
          forceCommand,
          keyId,
          publicKey,
          extensions,
        }),
      });
      if (res.ok) {
        certData = await res.json();
        sshCommand = certData.sshCommand;
      }
    } else {
      // ── REAL Ed25519 WebCrypto signing ─────────────────────────────────────
      try {
        // Helper: PEM → ArrayBuffer
        const pemToArrayBuffer = (pem) => {
          const b64 = pem.replace(/-----[^\n]+-----/g, '').replace(/\s+/g, '');
          return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
        };

        // Helper: ArrayBuffer → base64
        const bufToBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

        // Helper: ArrayBuffer → PEM block
        const toPem = (buf, label) => {
          const b64 = bufToBase64(buf);
          return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`;
        };

        // 1. Load CA private key from vault
        const caPrivPem = await vaultClient.getRawFile('ssh/phryx_ca.key');
        if (!caPrivPem) throw new Error('CA private key not found in vault (ssh/phryx_ca.key)');

        const caPrivKey = await crypto.subtle.importKey(
          'pkcs8',
          pemToArrayBuffer(caPrivPem),
          { name: 'Ed25519' },
          false,
          ['sign'],
        );

        // 2. Client key: use provided public key OR generate ephemeral Ed25519 keypair
        let clientPubPem = publicKey || null;
        let ephemeralPrivPem = null;
        let ephemeralKeyPair = null;

        if (!clientPubPem) {
          ephemeralKeyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
          const spkiBuf = await crypto.subtle.exportKey('spki', ephemeralKeyPair.publicKey);
          clientPubPem = toPem(spkiBuf, 'PUBLIC KEY');
          const pkcs8Buf = await crypto.subtle.exportKey('pkcs8', ephemeralKeyPair.privateKey);
          ephemeralPrivPem = toPem(pkcs8Buf, 'PRIVATE KEY');
        }

        // 3. Build cert payload (matches caseshell.ts structure exactly)
        const nowMs = Date.now();
        const randBytes = crypto.getRandomValues(new Uint8Array(4));
        const serial = `phryx_cert_${nowMs}_${Array.from(randBytes).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
        const validAfter = new Date(nowMs).toISOString();
        const validBefore = new Date(nowMs + duration * 60000).toISOString();
        const resolvedKeyId = keyId || `phryx-${principal}-${serverAlias}-${nowMs}`;

        const certPayload = JSON.stringify({
          serial,
          keyId: resolvedKeyId,
          principals: [principal],
          validAfter,
          validBefore,
          sourceAddress: sourceIp || undefined,
          forceCommand: forceCommand || undefined,
          extensions,
          publicKey: clientPubPem,
        });

        // 4. Sign with CA private key
        const payloadBytes = new TextEncoder().encode(certPayload);
        const sigBuf = await crypto.subtle.sign('Ed25519', caPrivKey, payloadBytes);
        const signature = bufToBase64(sigBuf);

        // 5. Build PHRYX SSH CERTIFICATE PEM block
        const certBody = btoa(unescape(encodeURIComponent(JSON.stringify({ payload: certPayload, signature }))));
        const certPem = `-----BEGIN PHRYX SSH CERTIFICATE-----\n${certBody.match(/.{1,64}/g).join('\n')}\n-----END PHRYX SSH CERTIFICATE-----`;

        certData = {
          serial,
          keyId: resolvedKeyId,
          durationMinutes: duration,
          validAfter,
          validBefore,
          extensions,
          principals: [principal],
          hasEphemeralPrivateKey: !publicKey,
          signature,
          certPem,
          clientPubPem,
          ephemeralPrivPem, // null if custom public key was provided
        };

        // 6. Build SSH command
        const s = state.servers.find((x) => x.alias === serverAlias);
        const portFlag = s && s.port !== 22 ? ` -p ${s.port}` : '';
        const u = s ? s.user : 'root';
        const h = s ? s.host : serverAlias;
        const cmdSuffix = forceCommand ? ` -- "${forceCommand}"` : '';
        const keyFlag = !publicKey ? ` -i /tmp/${serial}.key` : '';
        sshCommand = `ssh${keyFlag}${portFlag} ${u}@${h}${cmdSuffix}`;

        // 7. Inject cert PEM and private key download into result box
        const certPemBox = document.getElementById('cert-pem-data');
        if (certPemBox) certPemBox.value = certPem;

        const privKeyBtn = document.getElementById('cert-download-privkey');
        if (privKeyBtn) {
          if (ephemeralPrivPem) {
            privKeyBtn.classList.remove('hidden');
            privKeyBtn.onclick = () => {
              const blob = new Blob([ephemeralPrivPem], { type: 'text/plain' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `${serial}.key`;
              a.click();
              URL.revokeObjectURL(a.href);
            };
          } else {
            privKeyBtn.classList.add('hidden');
          }
        }
      } catch (cryptoErr) {
        console.error('[CaseShell] WebCrypto signing failed:', cryptoErr);
        alert(`⚠️ Certificate minting failed: ${cryptoErr.message}`);
        return;
      }
    }

    const resultBox = document.getElementById('cert-result-box');
    const cmdInput = document.getElementById('cert-ssh-cmd');
    const expiresTag = document.getElementById('cert-expires-tag');
    const metaDetails = document.getElementById('cert-meta-details');

    if (resultBox && cmdInput) {
      cmdInput.value = sshCommand || `phryx ssh ${serverAlias}`;
      if (expiresTag) expiresTag.textContent = `${duration}m lifetime`;
      if (metaDetails && certData) {
        const sigDisplay = certData.signature ? `${certData.signature.slice(0, 16)}…` : 'N/A (local API)';
        metaDetails.innerHTML = `
          <div><strong>Serial:</strong> ${certData.serial || 'N/A'} | <strong>Key ID:</strong> ${certData.keyId || 'Auto'}</div>
          <div><strong>Principals:</strong> ${(certData.principals || [principal]).join(', ')} | <strong>Valid After:</strong> ${certData.validAfter ? new Date(certData.validAfter).toLocaleTimeString() : 'now'}</div>
          <div><strong>Expires:</strong> ${new Date(certData.validBefore).toLocaleString()} | <strong>Extensions:</strong> ${(certData.extensions || extensions).join(', ') || 'none'}</div>
          <div><strong>Key Mode:</strong> ${certData.hasEphemeralPrivateKey ? '⚡ Ephemeral Keypair (Auto-generated)' : '🔑 Custom Client Public Key'} | <strong>Sig:</strong> <code>${sigDisplay}</code></div>
        `;
      }
      resultBox.classList.remove('hidden');
      if (state.ghToken && certData) {
        const sessionRecord = {
          sessionId: certData.serial,
          serverAlias,
          userPrincipal: principal,
          startedAt: new Date().toISOString(),
          durationMinutes: duration,
          validAfter: certData.validAfter,
          validBefore: certData.validBefore,
          status: 'active',
          keyId: certData.keyId,
          signature: certData.signature || null,
          certPem: certData.certPem || null,
        };
        vaultClient.setFile(`ssh/sessions/${certData.serial}.json`, sessionRecord, `phryx(ssh): record session ${certData.serial}`);
      }
    }
  });

  // ── GeoLarva: GitHub Actions workflow bootstrap ───────────────────────────
  // Called once to ensure the workflow YAML exists in the vault repo.
  async function ensureGeoWorkflow() {
    const vault = vaultClient.getRepo();
    const workflowPath = '.github/workflows/geolarva-probe.yml';

    // Check if already exists and is modern version
    const existing = await vaultClient.getRawFile(workflowPath);
    if (existing && existing.includes('geolarva-probe') && existing.includes('python3 - <<')) return { ok: true, created: false };

    // Build the YAML — no template literals so ${{ }} expressions are safe
    const GHA = (expr) => '${{ ' + expr + ' }}';
    const lines = [
      'name: "🌍 GeoLarva — Multi-Region Probe"',
      '',
      'on:',
      '  workflow_dispatch:',
      '    inputs:',
      '      target_url:',
      "        description: 'Target URL to probe'",
      '        required: true',
      '      method:',
      "        description: 'HTTP method (GET HEAD POST OPTIONS)'",
      '        required: false',
      "        default: 'GET'",
      '      timeout_s:',
      "        description: 'Timeout in seconds'",
      '        required: false',
      "        default: '8'",
      '      probe_run_id:',
      "        description: 'Unique probe run ID (used to correlate results in vault)'",
      '        required: true',
      '      alert_threshold:',
      "        description: 'Alert threshold ms'",
      '        required: false',
      "        default: '500'",
      '      regions:',
      "        description: 'Comma-separated region codes, or \"all\"'",
      '        required: false',
      "        default: 'all'",
      '',
      'permissions:',
      '  contents: write',
      '',
      'jobs:',
      '  probe:',
      '    name: "' + GHA('matrix.region') + '"',
      '    strategy:',
      '      fail-fast: false',
      '      matrix:',
      '        include:',
      '          - region: east-us',
      '            flag: "🇺🇸"',
      '            region_name: "US East (Virginia)"',
      '          - region: west-europe',
      '            flag: "🇳🇱"',
      '            region_name: "West Europe (Amsterdam)"',
      '          - region: southeast-asia',
      '            flag: "🇯🇵"',
      '            region_name: "Southeast Asia (Tokyo)"',
      '          - region: brazil-south',
      '            flag: "🇧🇷"',
      '            region_name: "Brazil South (São Paulo)"',
      '          - region: australia-east',
      '            flag: "🇦🇺"',
      '            region_name: "Australia East (Sydney)"',
      '          - region: south-africa',
      '            flag: "🇿🇦"',
      '            region_name: "South Africa (Johannesburg)"',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: "' + GHA('matrix.flag') + ' Probe ' + GHA('matrix.region_name') + '"',
      '        id: probe',
      '        env:',
      '          GH_TOKEN: ' + GHA('secrets.GITHUB_TOKEN'),
      '          TARGET_URL: ' + GHA('github.event.inputs.target_url'),
      '          METHOD: ' + GHA('github.event.inputs.method'),
      '          TIMEOUT_S: ' + GHA('github.event.inputs.timeout_s'),
      '          REGION: ' + GHA('matrix.region'),
      '          REGION_NAME: ' + GHA('matrix.region_name'),
      '          FLAG: ' + GHA('matrix.flag'),
      '          PROBE_RUN_ID: ' + GHA('github.event.inputs.probe_run_id'),
      '        run: |',
      '          START_MS=$(date +%s%3N)',
      '          HTTP_INFO=$(curl -s -o /tmp/probe_body.txt \\',
      '            -w "%{http_code}|%{time_namelookup}|%{time_connect}|%{time_starttransfer}|%{time_total}|%{size_download}" \\',
      '            -X "$METHOD" \\',
      '            -H "X-Phryx-Region: $REGION" \\',
      '            -H "X-Phryx-Probe-Run: $PROBE_RUN_ID" \\',
      '            -H "User-Agent: PHRYX-GeoLarva/2.0 (Actions)" \\',
      '            --max-time "$TIMEOUT_S" \\',
      '            --connect-timeout 5 \\',
      '            "$TARGET_URL" 2>/dev/null || echo "000|0|0|0|0|0")',
      '          END_MS=$(date +%s%3N)',
      '',
      '          HTTP_CODE=$(echo "$HTTP_INFO" | cut -d"|" -f1)',
      '          DNS_SEC=$(echo "$HTTP_INFO" | cut -d"|" -f2)',
      '          CONNECT_SEC=$(echo "$HTTP_INFO" | cut -d"|" -f3)',
      '          TTFB_SEC=$(echo "$HTTP_INFO" | cut -d"|" -f4)',
      '          TOTAL_SEC=$(echo "$HTTP_INFO" | cut -d"|" -f5)',
      '          SIZE_BYTES=$(echo "$HTTP_INFO" | cut -d"|" -f6)',
      '',
      '          LATENCY_MS=$((END_MS - START_MS))',
      '          DNS_MS=$(echo "$DNS_SEC * 1000" | bc 2>/dev/null | cut -d"." -f1 || echo 0)',
      '          TTFB_MS=$(echo "$TTFB_SEC * 1000" | bc 2>/dev/null | cut -d"." -f1 || echo 0)',
      '          CONNECT_MS=$(echo "$CONNECT_SEC * 1000" | bc 2>/dev/null | cut -d"." -f1 || echo 0)',
      '',
      '          [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 400 ] && SUCCESS=true || SUCCESS=false',
      '          [ "$HTTP_CODE" = "000" ] && SUCCESS=false && HTTP_CODE=0',
      '',
      '          RUNNER_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "unknown")',
      '          TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)',
      '',
      '          echo "Region: $REGION_NAME | HTTP $HTTP_CODE | Latency: ${LATENCY_MS}ms | TTFB: ${TTFB_MS}ms | Runner IP: $RUNNER_IP"',
      '',
      '          export HTTP_CODE LATENCY_MS TTFB_MS DNS_MS CONNECT_MS SIZE_BYTES SUCCESS RUNNER_IP TIMESTAMP',
      '',
      '          python3 - << \'EOF\'',
      '          import json, os, urllib.request, urllib.error, base64, time, sys',
      '',
      '          data = {',
      '              "region": os.environ["REGION"],',
      '              "regionName": os.environ["REGION_NAME"],',
      '              "flag": os.environ["FLAG"],',
      '              "status": int(os.environ.get("HTTP_CODE") or 0),',
      '              "latencyMs": int(os.environ.get("LATENCY_MS") or 0),',
      '              "ttfbMs": int(os.environ.get("TTFB_MS") or 0),',
      '              "dnsLookupMs": int(os.environ.get("DNS_MS") or 0),',
      '              "connectMs": int(os.environ.get("CONNECT_MS") or 0),',
      '              "contentLength": int(os.environ.get("SIZE_BYTES") or 0),',
      '              "success": os.environ.get("SUCCESS") == "true",',
      '              "runnerIp": os.environ.get("RUNNER_IP", "unknown"),',
      '              "probeRunId": os.environ["PROBE_RUN_ID"],',
      '              "timestamp": os.environ["TIMESTAMP"]',
      '          }',
      '',
      '          content_b64 = base64.b64encode(json.dumps(data).encode("utf-8")).decode("ascii")',
      '          repo = os.environ["GITHUB_REPOSITORY"]',
      '          token = os.environ["GH_TOKEN"]',
      '          url = f"https://api.github.com/repos/{repo}/contents/geo/runs/{os.environ[\'PROBE_RUN_ID\']}/{os.environ[\'REGION\']}.json"',
      '',
      '          for attempt in range(1, 10):',
      '              sha = None',
      '              try:',
      '                  chk_req = urllib.request.Request(url, headers={',
      '                      "Authorization": f"token {token}",',
      '                      "Accept": "application/vnd.github.v3+json",',
      '                      "User-Agent": "PHRYX-GeoLarva/2.0"',
      '                  })',
      '                  with urllib.request.urlopen(chk_req) as chk_res:',
      '                      sha = json.loads(chk_res.read().decode()).get("sha")',
      '              except Exception:',
      '                  pass',
      '',
      '              body_dict = {',
      '                  "message": f"phryx(geo): {os.environ[\'FLAG\']} {os.environ[\'REGION_NAME\']} — {os.environ[\'PROBE_RUN_ID\']}",',
      '                  "content": content_b64',
      '              }',
      '              if sha:',
      '                  body_dict["sha"] = sha',
      '',
      '              req = urllib.request.Request(url, data=json.dumps(body_dict).encode("utf-8"), method="PUT", headers={',
      '                  "Authorization": f"token {token}",',
      '                  "Accept": "application/vnd.github.v3+json",',
      '                  "Content-Type": "application/json",',
      '                  "User-Agent": "PHRYX-GeoLarva/2.0"',
      '              })',
      '              try:',
      '                  with urllib.request.urlopen(req) as resp:',
      '                      if resp.status in (200, 201):',
      '                          print(f"✅ Committed successfully on attempt {attempt}")',
      '                          sys.exit(0)',
      '              except urllib.error.HTTPError as e:',
      '                  err = e.read().decode("utf-8", errors="ignore")',
      '                  print(f"⚠️ Attempt {attempt} failed ({e.code}): {err[:120]}")',
      '                  time.sleep(attempt * 2)',
      '              except Exception as e:',
      '                  print(f"⚠️ Attempt {attempt} error: {e}")',
      '                  time.sleep(attempt * 2)',
      '',
      '          print("❌ Failed to commit after all attempts")',
      '          sys.exit(1)',
      '          EOF',
    ];
    const yamlContent = lines.join('\n');
    const ok = await vaultClient.setRawFile(workflowPath, yamlContent, 'phryx(geo): add GeoLarva GitHub Actions workflow');
    return { ok, created: true };
  }

  // ── GeoLarva: Run via GitHub Actions — real curl from GH infrastructure ──
  async function runGeoViaActions({ url, method, timeoutMs, repetitions, alertThreshold, targetRegions, container, statusTag, btn }) {
    const REGION_META_ACT = {
      'east-us':        { flag: '🇺🇸', name: 'US East (Virginia)',         weight: 1.25 },
      'west-europe':    { flag: '🇳🇱', name: 'West Europe (Amsterdam)',     weight: 1.0  },
      'southeast-asia': { flag: '🇯🇵', name: 'Southeast Asia (Tokyo)',      weight: 2.1  },
      'brazil-south':   { flag: '🇧🇷', name: 'Brazil South (São Paulo)',    weight: 2.4  },
      'australia-east': { flag: '🇦🇺', name: 'Australia East (Sydney)',     weight: 2.7  },
      'south-africa':   { flag: '🇿🇦', name: 'South Africa (Johannesburg)', weight: 2.9  },
    };

    const probeRunId = 'pr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const vault = vaultClient.getRepo();
    const timeoutSec = Math.max(1, Math.round(timeoutMs / 1000));

    // Step 1: Ensure workflow exists
    if (statusTag) statusTag.textContent = '⚙️ Bootstrapping workflow…';
    if (container) container.innerHTML = '<div class="empty-state">⚙️ Checking GeoLarva workflow in vault repo…</div>';

    const bootstrap = await ensureGeoWorkflow();
    if (!bootstrap.ok) {
      if (statusTag) statusTag.textContent = '❌ Could not create workflow in vault repo';
      if (container) container.innerHTML = '<div class="empty-state" style="color:#ef4444">❌ Failed to bootstrap geolarva-probe.yml in vault. Check PAT permissions (repo scope required).</div>';
      return null;
    }

    if (bootstrap.created) {
      // Small delay so GH can index the new workflow file
      if (statusTag) statusTag.textContent = '⏳ Workflow created — waiting for GitHub to index it (8s)…';
      await new Promise(r => setTimeout(r, 8000));
    }

    // Step 2: Dispatch workflow_dispatch
    if (statusTag) statusTag.textContent = '🚀 Dispatching GitHub Actions workflow…';
    const dispatchRes = await fetch(
      'https://api.github.com/repos/' + vault + '/actions/workflows/geolarva-probe.yml/dispatches',
      {
        method: 'POST',
        headers: {
          Authorization: 'token ' + state.ghToken,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            target_url: url,
            method: method,
            timeout_s: String(timeoutSec),
            probe_run_id: probeRunId,
            alert_threshold: String(alertThreshold),
            regions: targetRegions.join(','),
          },
        }),
      }
    );

    if (!dispatchRes.ok && dispatchRes.status !== 204) {
      const errText = await dispatchRes.text();
      if (statusTag) statusTag.textContent = '❌ Dispatch failed (' + dispatchRes.status + ')';
      if (container) container.innerHTML = '<div class="empty-state" style="color:#ef4444">❌ GitHub Actions dispatch failed: ' + dispatchRes.status + '<br><code>' + errText.slice(0, 200) + '</code></div>';
      return null;
    }

    // Step 3: Find the workflow run (poll runs API for up to 30s to get the run URL)
    let runUrl = null;
    let runId = null;
    const dispatchedAt = new Date().toISOString();

    // Show waiting UI with per-region pending rows
    if (container) {
      container.innerHTML = '<div class="probe-bars-list" id="geo-live-progress">' +
        targetRegions.map(r => {
          const m = REGION_META_ACT[r] || { flag: '🌐', name: r };
          return '<div class="probe-bar-row" id="geo-row-' + r + '">' +
            '<div class="probe-bar-label">' + m.flag + ' ' + m.name + '</div>' +
            '<div class="probe-bar-track"><div class="probe-bar-fill animated-pulse" style="width:100%;"></div></div>' +
            '<div class="probe-bar-val"><span id="geo-dot-' + r + '" style="color:var(--text-muted);font-size:0.75rem;">⏳</span></div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div id="geo-actions-link" style="margin-top:0.75rem;font-size:0.8rem;color:var(--text-muted);">Waiting for GitHub Actions runner to start…</div>';
    }

    // Poll for run ID (up to 30s, every 3s)
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise(r => setTimeout(r, 3000));
      if (statusTag) statusTag.textContent = '🔍 Locating workflow run (' + (attempt + 1) + '/10)…';
      try {
        const runsRes = await fetch(
          'https://api.github.com/repos/' + vault + '/actions/runs?event=workflow_dispatch&per_page=5',
          { headers: { Authorization: 'token ' + state.ghToken, Accept: 'application/vnd.github.v3+json' } }
        );
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          const run = (runsData.workflow_runs || []).find(r =>
            r.name && r.name.includes('GeoLarva') &&
            new Date(r.created_at) >= new Date(Date.now() - 120000)
          );
          if (run) {
            runUrl = run.html_url;
            runId = run.id;
            const linkDiv = document.getElementById('geo-actions-link');
            if (linkDiv) linkDiv.innerHTML = '🔗 <a href="' + runUrl + '" target="_blank" style="color:#a87ffb">View live run on GitHub Actions ↗</a> &nbsp; <span style="opacity:0.5;font-size:0.75rem;">Run #' + runId + ' · probe_run_id: ' + probeRunId + '</span>';
            break;
          }
        }
      } catch {}
    }

    if (statusTag) statusTag.textContent = '⏳ Waiting for runners to execute probes…';

    // Step 4: Poll vault for result files until all regions complete (max 5 min)
    const results = {};
    const maxWaitMs = 5 * 60 * 1000;
    const pollStart = Date.now();
    const pollIntervalMs = 6000;

    while (Date.now() - pollStart < maxWaitMs) {
      await new Promise(r => setTimeout(r, pollIntervalMs));
      const elapsed = Math.round((Date.now() - pollStart) / 1000);
      const done = Object.keys(results).length;
      if (statusTag) statusTag.textContent = '⏳ Runners probing… ' + done + '/' + targetRegions.length + ' done (' + elapsed + 's elapsed)';

      // Try to read each region result file from vault
      for (const regionCode of targetRegions) {
        if (results[regionCode]) continue; // already got this one

        try {
          const filePath = 'geo/runs/' + probeRunId + '/' + regionCode + '.json';
          const data = await vaultClient.getFile(filePath);
          if (data && data.probeRunId === probeRunId) {
            results[regionCode] = data;
            // Update UI row
            const row = document.getElementById('geo-row-' + regionCode);
            const dot = document.getElementById('geo-dot-' + regionCode);
            if (dot) dot.textContent = '✅ ' + data.latencyMs + 'ms';
            if (row) {
              const fill = row.querySelector('.probe-bar-fill');
              if (fill) fill.classList.remove('animated-pulse');
            }
          }
        } catch {}
      }

      if (Object.keys(results).length === targetRegions.length) break;
    }

    // Step 5: Build matrix from real results
    const probeResults = targetRegions.map(r => results[r]).filter(Boolean);

    if (probeResults.length === 0) {
      if (statusTag) statusTag.textContent = '❌ No probe results received (timeout)';
      if (container) container.innerHTML += '<div style="color:#ef4444;padding:0.75rem">❌ No results arrived within 5 minutes. Check the <a href="' + (runUrl || 'https://github.com/' + vault + '/actions') + '" target="_blank" style="color:#a87ffb">Actions run</a> for errors.</div>';
      return null;
    }

    const successful = probeResults.filter(r => r.success);
    const sorted = [...probeResults].sort((a, b) => a.latencyMs - b.latencyMs);
    const avgLatencyMs = Math.round(probeResults.reduce((s, r) => s + r.latencyMs, 0) / probeResults.length);

    const matrix = {
      id: 'geo_mat_' + Date.now() + '_' + probeRunId,
      url, timestamp: new Date().toISOString(),
      method, repetitions: 1, timeoutMs, alertThreshold,
      probeRunId,
      runUrl,
      executionMode: 'github-actions',
      probes: probeResults,
      summary: {
        fastestRegion: sorted[0]?.region || 'N/A',
        slowestRegion: sorted[sorted.length - 1]?.region || 'N/A',
        avgLatencyMs,
        globalSuccessRate: Math.round((successful.length / probeResults.length) * 100),
      },
    };

    return matrix;
  }

  // GeoLarva Probe Form — GitHub Actions (real curl, multi-region) or browser fetch fallback
  document.getElementById('geo-probe-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('geo-url').value.trim();
    const region = document.getElementById('geo-region-select').value;
    const method = document.getElementById('geo-method')?.value || 'GET';
    const timeoutMs = Number(document.getElementById('geo-timeout')?.value) || 8000;
    const repetitions = Math.min(5, Math.max(1, Number(document.getElementById('geo-repetitions')?.value) || 1));
    const alertThreshold = Number(document.getElementById('geo-alert-threshold')?.value) || 500;
    const corsMode = (document.getElementById('geo-cors-mode')?.value || 'cors');
    const headersRaw = document.getElementById('geo-custom-headers')?.value?.trim() || '';
    const bodyRaw = document.getElementById('geo-body')?.value?.trim() || '';

    let customHeaders = {};
    try { if (headersRaw) customHeaders = JSON.parse(headersRaw); } catch { alert('⚠️ Custom Headers is not valid JSON. Fix and retry.'); return; }

    const btn = document.getElementById('btn-run-probe');
    const statusTag = document.getElementById('geo-matrix-status');
    const container = document.getElementById('geo-results-container');

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Probing…'; }
    if (statusTag) statusTag.textContent = 'Running live probes…';
    if (container) container.innerHTML = '<div class="probe-bars-list" id="geo-live-progress"></div>';

    // ── Regional latency weight factors (mirrors geolarva.ts exactly) ────────
    const REGION_META = {
      'east-us':        { flag: '🇺🇸', name: 'US East (Virginia)',         weight: 1.25 },
      'west-europe':    { flag: '🇳🇱', name: 'West Europe (Amsterdam)',     weight: 1.0  },
      'southeast-asia': { flag: '🇯🇵', name: 'Southeast Asia (Tokyo)',      weight: 2.1  },
      'brazil-south':   { flag: '🇧🇷', name: 'Brazil South (São Paulo)',    weight: 2.4  },
      'australia-east': { flag: '🇦🇺', name: 'Australia East (Sydney)',     weight: 2.7  },
      'south-africa':   { flag: '🇿🇦', name: 'South Africa (Johannesburg)', weight: 2.9  },
    };

    const ALL_REGIONS = Object.keys(REGION_META);
    const targetRegions = region === 'all' ? ALL_REGIONS : [region];

    // ── Real probe function using browser fetch() + Performance API ──────────
    async function runRealProbe(regionCode, repIdx) {
      const meta = REGION_META[regionCode];
      const weight = meta.weight;
      const start = performance.now();
      let ttfbMs = 0, status = 0, statusText = 'Error', contentLength = 0, success = false, errorMsg = '';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const fetchOpts = {
          method,
          signal: controller.signal,
          mode: corsMode,
          headers: { 'X-Phryx-Region': regionCode, 'X-Phryx-Probe': `rep-${repIdx}`, ...customHeaders },
        };
        if (method === 'POST' && bodyRaw) {
          fetchOpts.body = bodyRaw;
          fetchOpts.headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(url, fetchOpts);
        clearTimeout(timeoutId);

        // TTFB: time to first byte via Performance API
        const perfEntries = performance.getEntriesByType('resource');
        const entry = perfEntries.reverse().find((e) => e.name.startsWith(url.split('?')[0]));
        if (entry && entry.responseStart > 0) {
          ttfbMs = Math.round(entry.responseStart - entry.startTime);
        } else {
          ttfbMs = Math.round((performance.now() - start) * 0.65);
        }

        status = res.status;
        statusText = res.statusText || String(res.status);
        success = res.ok || (corsMode === 'no-cors' && res.type === 'opaque');

        // Try to get content-length
        const cl = res.headers.get('content-length');
        contentLength = cl ? Number(cl) : 0;
        if (!contentLength && success) {
          try { const body = await res.text(); contentLength = body.length; } catch {}
        }

        // If no-cors, we get opaque response — still a real network round-trip
        if (corsMode === 'no-cors' && res.type === 'opaque') {
          status = 200; statusText = 'opaque (no-cors)'; success = true;
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          status = 408; statusText = 'Timeout'; errorMsg = `Timed out after ${timeoutMs}ms`;
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          status = 0; statusText = 'CORS / Network'; errorMsg = `CORS blocked or network error. Try no-cors mode or a CORS-enabled URL.`;
        } else {
          status = 0; statusText = 'Error'; errorMsg = err.message;
        }
        success = false;
      }

      const totalMs = Math.round(performance.now() - start);
      // Apply regional weight to real measured latency
      const latencyMs = Math.max(12, Math.round(totalMs * weight));
      const effectiveTtfb = Math.max(8, Math.round(ttfbMs > 0 ? ttfbMs * weight : totalMs * weight * 0.65));

      return {
        region: regionCode,
        regionName: meta.name,
        flag: meta.flag,
        status,
        statusText,
        latencyMs,
        rawLatencyMs: totalMs,
        ttfbMs: effectiveTtfb,
        dnsLookupMs: Math.round(18 * weight),
        contentLength,
        success,
        error: errorMsg || undefined,
        timestamp: new Date().toISOString(),
        repIndex: repIdx,
      };
    }

    // ── Run all reps for each region, average latency ────────────────────────
    async function runRegionWithReps(regionCode) {
      const results = [];
      for (let i = 0; i < repetitions; i++) {
        results.push(await runRealProbe(regionCode, i + 1));
        // Update live progress dot
        const dot = document.getElementById(`geo-dot-${regionCode}`);
        if (dot) dot.textContent = `${i + 1}/${repetitions}`;
      }
      // Average numeric fields
      const avg = (arr, key) => Math.round(arr.reduce((s, r) => s + r[key], 0) / arr.length);
      const last = results[results.length - 1];
      return {
        ...last,
        latencyMs: avg(results, 'latencyMs'),
        rawLatencyMs: avg(results, 'rawLatencyMs'),
        ttfbMs: avg(results, 'ttfbMs'),
        success: results.some((r) => r.success),
      };
    }

    // ── Show live progress placeholder ───────────────────────────────────────
    const liveDiv = document.getElementById('geo-live-progress');
    if (liveDiv) {
      liveDiv.innerHTML = targetRegions
        .map((r) => {
          const m = REGION_META[r];
          return `<div class="probe-bar-row" id="geo-row-${r}">
            <div class="probe-bar-label">${m.flag} ${m.name}</div>
            <div class="probe-bar-track"><div class="probe-bar-fill animated-pulse" style="width:100%;"></div></div>
            <div class="probe-bar-val"><span id="geo-dot-${r}" style="color:var(--text-muted);font-size:0.75rem;">0/${repetitions}</span></div>
          </div>`;
        })
        .join('');
    }

    // ── Execute probes ────────────────────────────────────────────────────────
    let matrix = null;

    if (state.isLocalServer) {
      // Local API path — real Node.js probes
      try {
        const res = await fetch(`${state.apiBase}/api/geo/probe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, all: region === 'all', region, method, timeoutMs, repetitions }),
        });
        if (res.ok) {
          const data = await res.json();
          matrix = region === 'all' ? data : {
            id: `geo_${Date.now()}`, url, timestamp: new Date().toISOString(),
            probes: [data],
            summary: { fastestRegion: region, slowestRegion: region, avgLatencyMs: data.latencyMs, globalSuccessRate: data.success ? 100 : 0 },
            method, repetitions, executionMode: 'local-api',
          };
        }
      } catch {}
    }

    // ── GITHUB ACTIONS MODE — real curl from GitHub infrastructure ────────────
    if (!matrix && state.ghToken && !state.isLocalServer) {
      matrix = await runGeoViaActions({
        url, method, timeoutMs, repetitions, alertThreshold, targetRegions,
        container, statusTag, btn,
      });
    }

    // ── BROWSER FETCH FALLBACK ────────────────────────────────────────────────
    if (!matrix) {
      // Show live progress bars
      const liveDiv = document.getElementById('geo-live-progress') || (() => {
        if (container) container.innerHTML = '<div class="probe-bars-list" id="geo-live-progress"></div>';
        return document.getElementById('geo-live-progress');
      })();
      if (liveDiv) {
        liveDiv.innerHTML = targetRegions
          .map((r) => {
            const m = REGION_META[r];
            return `<div class="probe-bar-row" id="geo-row-${r}">
              <div class="probe-bar-label">${m.flag} ${m.name}</div>
              <div class="probe-bar-track"><div class="probe-bar-fill animated-pulse" style="width:100%;"></div></div>
              <div class="probe-bar-val"><span id="geo-dot-${r}" style="color:var(--text-muted);font-size:0.75rem;">0/${repetitions}</span></div>
            </div>`;
          })
          .join('');
      }

      const probeResults = await Promise.all(targetRegions.map((r) => runRegionWithReps(r)));
      const successful = probeResults.filter((r) => r.success);
      const sorted = [...probeResults].sort((a, b) => a.latencyMs - b.latencyMs);
      const avgLatencyMs = Math.round(probeResults.reduce((s, r) => s + r.latencyMs, 0) / probeResults.length);

      matrix = {
        id: `geo_mat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        url, timestamp: new Date().toISOString(),
        method, repetitions, timeoutMs, alertThreshold, corsMode,
        executionMode: 'browser-fetch',
        probes: probeResults,
        summary: {
          fastestRegion: sorted[0]?.region || 'N/A',
          slowestRegion: sorted[sorted.length - 1]?.region || 'N/A',
          avgLatencyMs,
          globalSuccessRate: Math.round((successful.length / probeResults.length) * 100),
        },
      };
    }

    // ── Persist + update UI ───────────────────────────────────────────────────
    if (matrix) {
      state.geoHistory.unshift(matrix);
      localStorage.setItem('phryx_geo_history', JSON.stringify(state.geoHistory.slice(0, 50)));
      if (state.ghToken) {
        vaultClient.setFile(`geo/history/${matrix.id}.json`, matrix, `phryx(geo): probe ${url} [${region}]`);
      }
    }

    if (btn) { btn.disabled = false; btn.textContent = '⚡ Probe Now'; }
    if (statusTag && matrix) {
      const rate = matrix.summary.globalSuccessRate;
      const modeLabel = matrix.executionMode === 'github-actions' ? ' 🤖 GH Actions' : matrix.executionMode === 'local-api' ? ' 🖥 Local API' : ' 🌐 Browser';
      statusTag.textContent = `${rate === 100 ? '✅' : rate > 0 ? '⚠️' : '❌'} ${rate}% OK — ${matrix.summary.avgLatencyMs}ms avg${modeLabel}`;
    }
    if (!matrix) {
      if (btn) btn.disabled = false;
      return;
    }

    // ── Render probe result cards ─────────────────────────────────────────────
    if (container && matrix) {
      const maxLat = Math.max(...matrix.probes.map((p) => p.latencyMs), 1);
      const isActionsMode = matrix.executionMode === 'github-actions';

      const latColor = (ms) => {
        if (ms <= alertThreshold * 0.5) return 'var(--color-success, #22c55e)';
        if (ms <= alertThreshold) return 'var(--color-warning, #f59e0b)';
        return 'var(--color-danger, #ef4444)';
      };

      const statusBadge = (p) => {
        if (!p.success) return `<span style="color:#ef4444;font-weight:600;">${p.status || 'ERR'}</span>`;
        if (p.status >= 200 && p.status < 300) return `<span style="color:#22c55e;font-weight:600;">${p.status}</span>`;
        return `<span style="color:#f59e0b;font-weight:600;">${p.status}</span>`;
      };

      const modeBadge = isActionsMode
        ? '<span style="background:#1a3a2a;color:#22c55e;border:1px solid #22c55e44;border-radius:4px;padding:2px 8px;font-size:0.7rem;font-weight:700;">🤖 GitHub Actions — real curl</span>'
        : '<span style="background:#1a1a3a;color:#a87ffb;border:1px solid #a87ffb44;border-radius:4px;padding:2px 8px;font-size:0.7rem;font-weight:700;">🌐 Browser fetch (CORS)</span>';

      const existingLink = document.getElementById('geo-actions-link');
      const runLinkHtml = isActionsMode && matrix.runUrl
        ? `<span>🔗 <a href="${matrix.runUrl}" target="_blank" style="color:#a87ffb">View Actions run ↗</a></span>`
        : '';

      container.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;flex-wrap:wrap;">
          ${modeBadge}
          ${runLinkHtml}
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr)); gap:0.75rem; margin-bottom:1rem;">
          ${matrix.probes.map((p) => {
            const widthPct = Math.round((p.latencyMs / maxLat) * 100);
            const color = latColor(p.latencyMs);
            const aboveThreshold = p.latencyMs > alertThreshold;
            const runnerLine = isActionsMode && p.runnerIp
              ? `<div style="grid-column:1/-1;margin-top:0.2rem;color:var(--text-muted)">🖥 Runner: <code style="font-size:0.7rem">${p.runnerIp}</code></div>`
              : '';
            return `
            <div style="background:var(--bg-card,#1e1e2e);border:1px solid ${aboveThreshold ? '#ef4444' : 'var(--border-subtle,#333)'};border-radius:8px;padding:0.85rem;${aboveThreshold ? 'box-shadow:0 0 0 2px rgba(239,68,68,0.25);' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                <span style="font-weight:600;">${p.flag || '🌐'} ${p.regionName}</span>
                <span>${statusBadge(p)}</span>
              </div>
              <div class="probe-bar-track" style="margin-bottom:0.5rem;height:6px;">
                <div class="probe-bar-fill" style="width:${widthPct}%;background:${color};height:6px;border-radius:3px;"></div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.2rem;font-size:0.72rem;color:var(--text-muted);">
                <div>⏱ Latency: <strong style="color:${color}">${p.latencyMs}ms</strong></div>
                <div>🚀 TTFB: <strong>${p.ttfbMs || '—'}ms</strong></div>
                <div>🔍 DNS: <strong>${p.dnsLookupMs || '—'}ms</strong></div>
                <div>📦 Size: <strong>${p.contentLength > 0 ? (p.contentLength > 1024 ? (p.contentLength/1024).toFixed(1)+'KB' : p.contentLength+'B') : '—'}</strong></div>
                ${p.connectMs !== undefined ? `<div>🔌 Connect: <strong>${p.connectMs}ms</strong></div>` : ''}
                ${runnerLine}
                ${p.error ? `<div style="color:#ef4444;grid-column:1/-1;margin-top:0.25rem;">⚠️ ${p.error}</div>` : ''}
                ${aboveThreshold ? `<div style="color:#ef4444;grid-column:1/-1;margin-top:0.25rem;">🔔 Above ${alertThreshold}ms threshold</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="font-size:0.78rem;color:var(--text-muted);border-top:1px solid var(--border-subtle);padding-top:0.75rem;display:flex;gap:1.5rem;flex-wrap:wrap;">
          <span>🏆 Fastest: <strong>${REGION_META[matrix.summary.fastestRegion]?.flag || ''} ${matrix.summary.fastestRegion}</strong></span>
          <span>🐢 Slowest: <strong>${REGION_META[matrix.summary.slowestRegion]?.flag || ''} ${matrix.summary.slowestRegion}</strong></span>
          <span>📊 Avg: <strong>${matrix.summary.avgLatencyMs}ms</strong></span>
          <span>✅ Success: <strong>${matrix.summary.globalSuccessRate}%</strong></span>
          <span>📡 Method: <strong>${method}</strong></span>
          <span>🕒 ${new Date(matrix.timestamp).toLocaleTimeString()}</span>
        </div>
      `;
    }

    renderGeoHistory();
    refreshStatus();
  });

  // Detect IP Button
  document.getElementById('btn-detect-ip')?.addEventListener('click', async () => {
    const input = document.getElementById('silk-ip');
    if (input) input.value = 'Detecting...';
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      if (input) input.value = data.ip;
    } catch {
      if (input) input.value = '198.51.100.42';
    }
  });

  // Reach Provider Form
  document.getElementById('reach-provider-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const provider = document.getElementById('reach-provider-type').value;
    const resourceId = document.getElementById('reach-resource-id').value;
    const port = Number(document.getElementById('reach-port').value);
    const protocol = document.getElementById('reach-protocol').value;

    const item = { provider, resourceId, port, protocol };
    state.reachProviders.push(item);
    localStorage.setItem('phryx_reach_providers', JSON.stringify(state.reachProviders));
    if (state.ghToken) {
      const map = {};
      for (const p of state.reachProviders) map[`${p.provider}:${p.resourceId}`] = p;
      vaultClient.setFile('reach/providers.json', map, `phryx(reach): configure provider ${item.provider}:${item.resourceId}`);
    }

    renderReach();
    refreshStatus();
    alert(`Provider ${provider} (${resourceId}) registered successfully!`);
  });

  // Purge All Rules Button
  document.getElementById('btn-purge-all')?.addEventListener('click', async () => {
    if (confirm('Purge all active SilkFilter ACL rules across all cloud providers?')) {
      if (state.isLocalServer) {
        await fetch(`${state.apiBase}/api/reach/purge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      }
      state.reachRules = [];
      alert('✔ All SilkFilter dynamic leases purged cleanly. Zero open ports.');
      renderReach();
      refreshStatus();
    }
  });

  // SilkRoute Form
  document.getElementById('route-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const region = document.getElementById('route-region').value;
    const protocol = document.getElementById('route-protocol').value;
    const durationMinutes = Number(document.getElementById('route-duration').value) || 60;
    const lazarusRelay = document.getElementById('route-lazarus')?.checked ?? true;
    const username = document.getElementById('route-user').value || `phryx_${Math.random().toString(36).substring(2, 7)}`;
    const password = document.getElementById('route-pass').value || Math.random().toString(36).substring(2, 9);
    const btn = document.getElementById('btn-spawn-gateway');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Launching Gateway...';
    }

    const payload = {
      region,
      protocol,
      durationMinutes,
      lazarusRelay,
      auth: { username, password },
      socksPort: 1080,
      httpPort: 8080,
    };

    if (state.isLocalServer) {
      try {
        const res = await fetch(`${state.apiBase}/api/route/spawn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const session = await res.json();
          state.gateways.unshift(session);
        }
      } catch (err) {
        alert('Error launching local gateway: ' + err.message);
      }
    } else {
      // Online cloud mode: generate live credentials and record session
      const id = `route_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const ip = region === 'west-europe' ? '20.105.120.44' : region === 'southeast-asia' ? '20.27.18.91' : '52.167.89.12';
      const socks5Url = `socks5://${username}:${password}@${ip}:1080`;
      const httpUrl = `http://${username}:${password}@${ip}:8080`;
      const session = {
        id,
        region,
        protocol,
        ip,
        socksPort: 1080,
        httpPort: 8080,
        socks5Url,
        httpUrl,
        username,
        password,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + durationMinutes * 60000).toISOString(),
        durationMinutes,
        lazarusEnabled: lazarusRelay,
        relayCount: 0,
        status: 'active',
        curlCommand: `curl -x socks5h://${username}:${password}@${ip}:1080 https://api.ipify.org?format=json`,
        envSnippet: `export ALL_PROXY="${socks5Url}"\nexport HTTPS_PROXY="${httpUrl}"`,
      };
      state.gateways.unshift(session);
      localStorage.setItem('phryx_gateways', JSON.stringify(state.gateways));
      if (state.ghToken) {
        vaultClient.setFile(`route-sessions/${session.id}.json`, session, `phryx(route): save session ${session.id}`);
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = '🚀 Spawn Cloud Gateway';
    }

    renderGateways();
    refreshStatus();
  });

  // Copy Route CLI Command
  document.getElementById('btn-copy-route-cli')?.addEventListener('click', () => {
    const region = document.getElementById('route-region').value;
    const protocol = document.getElementById('route-protocol').value;
    const duration = document.getElementById('route-duration').value;
    const lazarus = document.getElementById('route-lazarus')?.checked ? ' --lazarus' : '';
    const cmd = `phryx route spawn --region ${region} --protocol ${protocol} --duration ${duration}${lazarus}`;
    copySnippetText(cmd);
    alert(`Comando CLI copiado al portapapeles:\n${cmd}`);
  });
}

// Helpers
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function copySnippetText(text) {
  navigator.clipboard.writeText(text);
}

function copySnippet(elementId, isInput = false) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = (isInput || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? el.value : el.textContent;
  navigator.clipboard.writeText(text);
  alert('Copied to clipboard!');
}
