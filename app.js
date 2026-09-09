/**
 * PHRYX Silk Studio — Frontend Application Logic
 * ($0 Infrastructure • Zero-Trust Ephemeral Mesh Controller)
 */

// State
const state = {
  activeTab: 'dashboard',
  apiBase: window.location.origin.includes('localhost') ? window.location.origin : '',
  isLocalServer: window.location.origin.includes('localhost'),
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
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initForms();
  loadAllData();

  // Polling every 5 seconds for live status
  setInterval(refreshStatus, 5000);
});

// Navigation Handling
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
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
    storage: 'Storage Vault (.phryx-storage)',
    settings: 'Settings & Secrets',
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
  };
  renderStatus();
}

function renderStatus() {
  if (!state.status) return;

  setText('stat-active-tunnels', state.status.tunnels.active);
  setText('stat-servers', state.status.caseshell.registeredServers);
  setText('stat-rules', state.status.reach.activeRules);
  setText('stat-probes', state.status.geolarva.totalProbes);
  setText('tunnel-active-badge', state.status.tunnels.active);
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
          <td><code>${s.caPublicKeyFingerprint}</code></td>
          <td>${new Date(s.registeredAt).toLocaleDateString()}</td>
          <td>
            <button class="btn btn-primary btn-xs" onclick="quickMintCert('${s.alias}')">⚡ Mint Cert</button>
          </td>
        </tr>
      `
        )
        .join('');
    }
  }
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

  const saved = localStorage.getItem('phryx_geo_history');
  state.geoHistory = saved ? JSON.parse(saved) : [];
  renderGeoHistory();
}

function renderGeoHistory() {
  const tbody = document.getElementById('tbody-geo-history');
  if (!tbody) return;

  if (state.geoHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No probe history recorded yet.</td></tr>';
  } else {
    tbody.innerHTML = state.geoHistory
      .slice(0, 10)
      .map(
        (m) => `
      <tr>
        <td>${new Date(m.timestamp).toLocaleTimeString()}</td>
        <td><code>${m.url}</code></td>
        <td><span class="text-success">${m.summary.fastestRegion}</span></td>
        <td><span class="text-warning">${m.summary.slowestRegion}</span></td>
        <td><strong>${m.summary.avgLatencyMs}ms</strong></td>
        <td><span class="badge">${m.summary.globalSuccessRate}%</span></td>
      </tr>
    `
      )
      .join('');
  }
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

// ==================== Forms & Event Handlers ====================
function initForms() {
  // Tunnel Form
  document.getElementById('tunnel-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const port = Number(document.getElementById('tun-port').value);
    const protocol = document.getElementById('tun-protocol').value;
    const timeoutMinutes = Number(document.getElementById('tun-timeout').value);
    const subdomain = document.getElementById('tun-subdomain').value;
    const authToken = document.getElementById('tun-auth').value;

    const payload = { port, protocol, timeoutMinutes, subdomain, authToken };

    if (state.isLocalServer) {
      const res = await fetch(`${state.apiBase}/api/tunnels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const session = await res.json();
        state.tunnels.unshift(session);
      }
    } else {
      // Mock tunnel creation for online demo
      const id = `phryx_tun_${Date.now()}`;
      const sub = subdomain || `tun-${Math.random().toString(36).substring(2, 6)}`;
      const session = {
        id,
        port,
        protocol,
        publicUrl: `https://${sub}.ballom.terra.mesh`,
        localUrl: `http://127.0.0.1:${port}`,
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + timeoutMinutes * 60000).toISOString(),
        status: 'active',
        authTokenConfigured: Boolean(authToken),
        totalRequests: 0,
        recentLogs: [],
        metrics: { totalBytes: 0, avgLatencyMs: 24, errorCount: 0 },
      };
      state.tunnels.unshift(session);
      localStorage.setItem('phryx_tunnels', JSON.stringify(state.tunnels));
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

  // SSH Register Form
  document.getElementById('caseshell-register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alias = document.getElementById('ssh-alias').value;
    const host = document.getElementById('ssh-host').value;
    const user = document.getElementById('ssh-user').value;
    const port = Number(document.getElementById('ssh-port').value);

    let setupSnippet = '';

    if (state.isLocalServer) {
      const res = await fetch(`${state.apiBase}/api/ssh/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias, host, user, port }),
      });
      if (res.ok) {
        const data = await res.json();
        setupSnippet = data.setupSnippet;
        state.servers.push(data.server);
      }
    } else {
      const server = {
        alias,
        host,
        user,
        port,
        registeredAt: new Date().toISOString(),
        caPublicKeyFingerprint: 'ed25519_fingerprint_live',
      };
      state.servers.push(server);
      localStorage.setItem('phryx_servers', JSON.stringify(state.servers));

      setupSnippet = `# Setup PHRYX Zero-Trust CA on server [${alias}] (${host})
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... phryx_ca@terra" | sudo tee /etc/ssh/phryx_ca.pub
echo "TrustedUserCAKeys /etc/ssh/phryx_ca.pub" | sudo tee -a /etc/ssh/sshd_config
sudo systemctl restart ssh
echo "✔ Ready for ephemeral 60-min Zero-Trust SSH!"`;
    }

    renderServers();
    refreshStatus();

    const box = document.getElementById('ssh-setup-box');
    const code = document.getElementById('ssh-setup-code');
    if (box && code) {
      code.textContent = setupSnippet;
      box.classList.remove('hidden');
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

    const principal = document.getElementById('cert-principal').value;
    const duration = Number(document.getElementById('cert-duration').value);
    const sourceIp = document.getElementById('cert-source-ip').value;
    const forceCommand = document.getElementById('cert-force-command').value;

    let certData = null;

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
        }),
      });
      if (res.ok) {
        certData = await res.json();
      }
    } else {
      certData = {
        serial: `phryx_cert_${Date.now()}`,
        durationMinutes: duration,
        validBefore: new Date(Date.now() + duration * 60000).toISOString(),
      };
    }

    const resultBox = document.getElementById('cert-result-box');
    const cmdInput = document.getElementById('cert-ssh-cmd');
    const expiresTag = document.getElementById('cert-expires-tag');

    if (resultBox && cmdInput) {
      cmdInput.value = `phryx ssh ${serverAlias}`;
      if (expiresTag) expiresTag.textContent = `${duration}m lifetime`;
      resultBox.classList.remove('hidden');
    }
  });

  // GeoLarva Probe Form
  document.getElementById('geo-probe-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = document.getElementById('geo-url').value;
    const region = document.getElementById('geo-region-select').value;
    const btn = document.getElementById('btn-run-probe');
    const statusTag = document.getElementById('geo-matrix-status');
    const container = document.getElementById('geo-results-container');

    if (btn) btn.disabled = true;
    if (statusTag) statusTag.textContent = 'Probing Edge Mesh...';

    let matrix = null;

    if (state.isLocalServer) {
      const res = await fetch(`${state.apiBase}/api/geo/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, all: region === 'all', region }),
      });
      if (res.ok) {
        const data = await res.json();
        matrix = region === 'all' ? data : { probes: [data], summary: { fastestRegion: region, avgLatencyMs: data.latencyMs, globalSuccessRate: 100 } };
      }
    } else {
      // Mock probe results
      const probes = state.regions.map((r, idx) => ({
        region: r.code,
        regionName: r.name,
        status: 200,
        statusText: 'OK',
        latencyMs: Math.round(28 + idx * 35 + Math.random() * 15),
        ttfbMs: Math.round(18 + idx * 25),
        dnsLookupMs: 14,
        contentLength: 4820,
        success: true,
      }));
      matrix = {
        id: `mat_${Date.now()}`,
        url,
        timestamp: new Date().toISOString(),
        probes: region === 'all' ? probes : probes.filter((p) => p.region === region),
        summary: {
          fastestRegion: 'west-europe',
          slowestRegion: 'south-africa',
          avgLatencyMs: 98,
          globalSuccessRate: 100,
        },
      };
      state.geoHistory.unshift(matrix);
      localStorage.setItem('phryx_geo_history', JSON.stringify(state.geoHistory));
    }

    if (btn) btn.disabled = false;
    if (statusTag) statusTag.textContent = 'Probe Completed';

    if (container && matrix) {
      const maxLat = Math.max(...matrix.probes.map((p) => p.latencyMs), 1);
      container.innerHTML = `
        <div class="probe-bars-list">
          ${matrix.probes
            .map((p) => {
              const r = state.regions.find((reg) => reg.code === p.region) || { flag: '🌐', name: p.region };
              const widthPct = Math.round((p.latencyMs / maxLat) * 100);
              return `
              <div class="probe-bar-row">
                <div class="probe-bar-label">${r.flag} ${r.name}</div>
                <div class="probe-bar-track">
                  <div class="probe-bar-fill" style="width: ${widthPct}%;"></div>
                </div>
                <div class="probe-bar-val">${p.latencyMs}ms</div>
              </div>
            `;
            })
            .join('')}
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
  const text = isInput ? el.value : el.textContent;
  navigator.clipboard.writeText(text);
  alert('Copied to clipboard!');
}
