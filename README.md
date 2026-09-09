<p align="center">
  <img src="assets/logo_phryx.png" alt="PHRYX Phantom Mesh Logo" width="180" />
</p>

<h1 align="center">PHRYX: The Phantom Mesh</h1>

<p align="center">
  <strong>Infraestructura de Red Privada Efímera, Tunelado Zero-Trust y Acceso Seguro a Coste $0</strong><br />
  <em>Parte del Ecosistema Terra • Cero Servidores en Reposo • Cero Huella Permanente</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/terra-phryx"><img src="https://img.shields.io/badge/npm-terra--phryx-803cff.svg" alt="npm package" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-a87ffb.svg" alt="License" /></a>
  <a href="https://github.com/amglogicalis/Terra"><img src="https://img.shields.io/badge/ecosystem-Terra%20%240-5e17eb.svg" alt="Terra Ecosystem" /></a>
  <a href="https://amglogicalis.github.io/phryx-repo-public/"><img src="https://img.shields.io/badge/console-PHRYX%20Silk%20Studio-803cff.svg" alt="Web Console" /></a>
</p>

---

## 🌊 Visión y Filosofía

Inspirado en la larva de la frigánea (*Phryganea* / Trichoptera) —un insecto acuático que teje con su propia seda un tubo protector portátil adherido con granos de arena y ramitas del entorno, el cual arrastra para protegerse y abandona al metamorfosearse sin dejar rastro—, **PHRYX** construye túneles cifrados y perímetros defensivos efímeros utilizando las primitivas gratuitas de **GitHub Actions**.

Los utiliza el tiempo estrictamente necesario y los autodestruye al terminar. **Cero infraestructura fija, cero costes operativos ($0), cero claves permanentes.**

```
                            🦟 PHRYX ENGINE
              (The Phantom Mesh — Red Privada Efímera Terra)
                                     │
        ┌────────────────┬───────────┴────────────┬──────────────────┐
        ▼                ▼                        ▼                  ▼
   🌐 PhryxTunnel   🔗 PhryxReach           🐚 CaseShell       🌍 GeoLarva
   (Localhost →     (Actions →              (Zero-Trust        (Exit Node
    URL Pública     Infra Privada)          SSH Efímero)        Geográfico)
    Efímera)             │
                    [SilkFilter]
                    (ACL Dinámica
                     Interna Ghost)
```

---

## 🐚 Las 4 Especies Deterministas

### 1. 🌐 PhryxTunnel — El *ngrok-killer* de Terra
Expone cualquier servicio local (`localhost:3000`, `localhost:8080`) al mundo exterior mediante una URL pública efímera respaldada por runners de GitHub Actions y proxying Ballom (Feromask).
- **Timeouts configurables:** desde 5 minutos hasta 6 horas.
- **Autenticación opcional:** cabecera `X-Phryx-Token` para restringir el acceso a clientes autorizados.
- **Sin cuentas de pago ni límites arbitrarios:** $0 compute, auditoría de tráfico y auto-cierre.

### 2. 🔗 PhryxReach & SilkFilter — Acceso Seguro a Infra Privada en CI/CD
Los runners de GitHub Actions tienen IPs dinámicas de Azure que cambian en cada job. **SilkFilter** resuelve esto sin abrir el firewall al mundo:
1. Detecta la IP pública del runner al inicio del job (`curl ifconfig.me`).
2. Inyecta temporalmente la IP en el Security Group / Firewall del proveedor cloud.
3. Ejecuta los tests o despliegues contra la base de datos o VPS privada.
4. **Purga garantizada:** Mediante un hook `if: always()`, elimina la regla al terminar (incluso si el job falla o aborta). Cero huecos de seguridad residuales.
- *Proveedores soportados:* AWS Security Groups, Cloudflare WAF, DigitalOcean Firewall, Hetzner Cloud, Supabase Network, MongoDB Atlas, Railway.

### 3. 🐚 CaseShell — SSH Zero-Trust con Certificados Efímeros de 60 Minutos
SSH sin claves fijas ni `authorized_keys` compartidos.
- PHRYX actúa como **SSH Certificate Authority (CA)** criptográfica.
- Configuras el servidor una única vez añadiendo la clave pública de la CA a `TrustedUserCAKeys /etc/ssh/phryx_ca.pub`.
- Al conectar (`phryx ssh myserver`), PHRYX firma un certificado OpenSSH de 60 minutos vinculado a tu identidad de GitHub y opcionalmente a tu IP origen (`source-address`).
- Al expirar los 60 minutos, el certificado queda revocado automáticamente. Audit trail criptográfico inmutable.

### 4. 🌍 GeoLarva — Red de Exit Nodes Geográficos Multi-Región
Enruta peticiones HTTP y benchmarks a través de runners de GitHub Actions distribuidos por el mundo (regiones de Azure):
- Regiones soportadas: `east-us` (Virginia), `west-europe` (Ámsterdam), `southeast-asia` (Tokio), `brazil-south` (São Paulo), `australia-east` (Sídney), `south-africa` (Johannesburgo).
- Comparativa en matriz paralela (`phryx geo --all <url>`) midiendo DNS, TTFB, latencia total y disponibilidad global.
- Sinergia directa con **Termes** para eludir bloqueos geográficos o validar geofencing de CDNs.

---

## 💻 Instalación y Uso de la CLI

El paquete CLI y SDK no tiene dependencias externas de ejecución (utiliza las APIs nativas de Node.js):

```bash
# Instalación global vía npm
npm install -g terra-phryx

# O ejecutar directamente con npx
npx terra-phryx status
```

### Comandos Principales

```bash
# 🌐 PhryxTunnel
phryx tunnel --port 3000 --timeout 60 --auth MI_TOKEN
phryx tunnel list
phryx tunnel stop phryx_tun_1725880000

# 🔗 PhryxReach / SilkFilter
phryx reach add --provider aws-sg --resource sg-0abc123 --port 5432
phryx reach list
phryx reach test --host db.miempresa.internal --port 5432
phryx reach purge <ruleId>

# 🐚 CaseShell (SSH CA)
phryx ssh register --alias prod-db --host 10.0.0.15 --user ubuntu
phryx ssh cert prod-db --duration 60
phryx ssh prod-db
phryx ssh list

# 🌍 GeoLarva
phryx geo https://api.midominio.com/health --region southeast-asia
phryx geo https://api.midominio.com/health --all
phryx geo history

# 🎛️ Consola Web Local
phryx console --port 7461

# 📊 Estado Global
phryx status
```

---

## 🎛️ Consola Web Online — PHRYX Silk Studio

Accede al centro de mando unificado desplegado en GitHub Pages con estética cian bioluminiscente / aquatic cyberpunk:

👉 **[Entrar a PHRYX Silk Studio Online](https://amglogicalis.github.io/phryx-repo-public/)**

---

## 🗄️ Persistencia — `.phryx-storage`

El estado de los túneles, servidores registrados, matrices de latencia y logs de auditoría de SilkFilter se guardan en el repositorio privado de almacenamiento sintético `.phryx-storage` a través de la Git Database API de GitHub:

```
.phryx-storage/
├── tunnel-sessions/     # Sesiones y métricas de tráfico
├── ssh/
│   ├── servers.json     # Servidores registrados y clave CA
│   └── sessions/        # Certificados efímeros emitidos
├── reach/
│   ├── providers.json   # Firewalls y Security Groups
│   ├── rules.json       # Leases activos
│   └── history.json     # Registro inmutable de auditoría
└── geo/
    └── history/         # Matrices de sondas geográficas multi-región
```

---

<p align="center">
  <sub>Desarrollado bajo la filosofía Terra • Infraestructura Efímera de Coste Económico $0</sub>
</p>
