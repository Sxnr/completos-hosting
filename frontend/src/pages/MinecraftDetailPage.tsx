// =========================================================
// MINECRAFT DETAIL PAGE — Detalle de instancia
// Tabs: Info · Configuración · Archivos
// =========================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { api } from "../services/api";
import "../styles/minecraft-detail.css";
import { DownloadJarModal } from "../components/DownloadJarModal";

// ── Tipos ─────────────────────────────────────────────────

interface McInstance {
  id: number;
  name: string;
  description?: string;
  software: string;
  version: string;
  edition: string;
  port: number;
  ram_mb: number;
  java_flags: string | null;
  properties: Record<string, string> | null;
  status: string;
  playerCount: number;
  players: string[];
  folder_name: string;
  created_at: string;
}

interface FileEntry {
  name: string;
  isDir: boolean;
  size: number | null;
  modified: string;
}

interface FileContentResponse {
  path: string;
  content?: string;
  binary?: boolean;
  binary_file?: boolean;
}

// ── Helpers ───────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  online: "status-dot--online",
  offline: "status-dot--offline",
  starting: "status-dot--starting",
  stopping: "status-dot--stopping",
};

const STATUS_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  starting: "Iniciando...",
  stopping: "Deteniendo...",
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  });

type Tab = "info" | "config" | "files";

// =========================================================
// SCHEMA DE PROPIEDADES CONOCIDAS
// =========================================================

type PropType = "boolean" | "select" | "number" | "text" | "url";

interface PropSchema {
  label: string;
  description: string;
  type: PropType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  group: string;
}

const PROP_SCHEMA: Record<string, PropSchema> = {
  motd: {
    label: "Mensaje del día (MOTD)",
    description:
      "Texto que aparece debajo del nombre del servidor en la lista de servidores.",
    type: "text",
    group: "General",
  },
  "server-port": {
    label: "Puerto del servidor",
    description: "Puerto TCP/UDP donde escucha el servidor. Por defecto 25565.",
    type: "number",
    min: 1024,
    max: 65535,
    group: "General",
  },
  "server-ip": {
    label: "IP del servidor",
    description:
      "Deja en blanco para escuchar en todas las interfaces de red disponibles.",
    type: "text",
    group: "General",
  },
  "online-mode": {
    label: "Modo online",
    description:
      "Verifica cuentas con los servidores de Mojang. Desactívalo solo en redes privadas o con proxy (Velocity, BungeeCord).",
    type: "boolean",
    group: "General",
  },
  "white-list": {
    label: "Whitelist",
    description:
      "Solo los jugadores en la whitelist pueden conectarse al servidor.",
    type: "boolean",
    group: "General",
  },
  "enforce-whitelist": {
    label: "Forzar whitelist",
    description:
      "Expulsa automáticamente a jugadores que no estén en la whitelist cuando se activa.",
    type: "boolean",
    group: "General",
  },

  "max-players": {
    label: "Máximo de jugadores",
    description: "Número máximo de jugadores conectados simultáneamente.",
    type: "number",
    min: 1,
    max: 1000,
    group: "Jugadores",
  },
  pvp: {
    label: "PvP (Jugador vs Jugador)",
    description:
      "Permite que los jugadores se ataquen entre sí en el servidor.",
    type: "boolean",
    group: "Jugadores",
  },
  "allow-flight": {
    label: "Permitir vuelo",
    description:
      "Permite volar en modo supervivencia. Actívalo si usas mods de vuelo para evitar expulsiones.",
    type: "boolean",
    group: "Jugadores",
  },
  gamemode: {
    label: "Modo de juego por defecto",
    description:
      "Modo de juego asignado a los nuevos jugadores al conectarse por primera vez.",
    type: "select",
    group: "Jugadores",
    options: [
      { value: "survival", label: "Supervivencia" },
      { value: "creative", label: "Creativo" },
      { value: "adventure", label: "Aventura" },
      { value: "spectator", label: "Espectador" },
    ],
  },
  "force-gamemode": {
    label: "Forzar modo de juego",
    description:
      "Fuerza el modo de juego por defecto cada vez que un jugador se reconecta.",
    type: "boolean",
    group: "Jugadores",
  },
  difficulty: {
    label: "Dificultad",
    description:
      "Nivel de dificultad del servidor. Afecta el daño de monstruos y el hambre.",
    type: "select",
    group: "Jugadores",
    options: [
      { value: "peaceful", label: "Pacífico — sin monstruos hostiles" },
      { value: "easy", label: "Fácil" },
      { value: "normal", label: "Normal" },
      { value: "hard", label: "Difícil" },
    ],
  },
  hardcore: {
    label: "Modo Hardcore",
    description:
      "Al morir, el jugador queda en modo espectador permanentemente. Dificultad forzada a Difícil.",
    type: "boolean",
    group: "Jugadores",
  },
  "player-idle-timeout": {
    label: "Tiempo de inactividad (minutos)",
    description:
      "Expulsa jugadores inactivos tras este tiempo en minutos. 0 = desactivado.",
    type: "number",
    min: 0,
    group: "Jugadores",
  },

  "level-name": {
    label: "Nombre del mundo",
    description: "Nombre de la carpeta donde se guardan los datos del mundo.",
    type: "text",
    group: "Mundo",
  },
  "level-seed": {
    label: "Semilla del mundo",
    description:
      "Semilla para la generación del terreno. Déjalo vacío para usar una semilla aleatoria.",
    type: "text",
    group: "Mundo",
  },
  "level-type": {
    label: "Tipo de mundo",
    description: "Controla cómo se genera el terreno del mundo.",
    type: "select",
    group: "Mundo",
    options: [
      { value: "minecraft:normal", label: "Normal" },
      { value: "minecraft:flat", label: "Plano" },
      { value: "minecraft:large_biomes", label: "Biomas grandes" },
      { value: "minecraft:amplified", label: "Amplificado" },
    ],
  },
  "spawn-protection": {
    label: "Radio de protección del spawn",
    description:
      "Bloquea modificaciones de bloques en un radio alrededor del punto de spawn. 0 = desactivado.",
    type: "number",
    min: 0,
    max: 100,
    group: "Mundo",
  },
  "allow-nether": {
    label: "Permitir el Nether",
    description:
      "Permite que los jugadores entren al Nether a través de portales.",
    type: "boolean",
    group: "Mundo",
  },
  "generate-structures": {
    label: "Generar estructuras",
    description:
      "Genera aldeas, templos, fortalezas del Nether y otras estructuras al crear el mundo.",
    type: "boolean",
    group: "Mundo",
  },
  "spawn-animals": {
    label: "Generar animales",
    description:
      "Permite que aparezcan animales pasivos como vacas, ovejas y cerdos.",
    type: "boolean",
    group: "Mundo",
  },
  "spawn-monsters": {
    label: "Generar monstruos",
    description:
      "Permite que aparezcan monstruos hostiles como zombies, esqueletos y creepers.",
    type: "boolean",
    group: "Mundo",
  },
  "spawn-npcs": {
    label: "Generar aldeanos",
    description: "Permite que aparezcan aldeanos (NPCs) en el mundo.",
    type: "boolean",
    group: "Mundo",
  },

  "enable-command-block": {
    label: "Bloques de comandos",
    description:
      "Activa el uso de bloques de comandos en el mundo. Necesario para mapas de aventura y minijuegos.",
    type: "boolean",
    group: "Comandos",
  },
  "op-permission-level": {
    label: "Nivel de permisos OP",
    description: "Define qué pueden hacer los operadores del servidor.",
    type: "select",
    group: "Comandos",
    options: [
      { value: "1", label: "Nivel 1 — Ignorar límite de spawn" },
      { value: "2", label: "Nivel 2 — Comandos básicos (recomendado)" },
      { value: "3", label: "Nivel 3 — Banear, expulsar y cambiar modos" },
      { value: "4", label: "Nivel 4 — Acceso total al servidor" },
    ],
  },
  "function-permission-level": {
    label: "Nivel de permisos de funciones",
    description:
      "Nivel mínimo requerido para ejecutar funciones de data packs.",
    type: "select",
    group: "Comandos",
    options: [
      { value: "1", label: "Nivel 1" },
      { value: "2", label: "Nivel 2 (por defecto)" },
      { value: "3", label: "Nivel 3" },
      { value: "4", label: "Nivel 4" },
    ],
  },
  "enable-rcon": {
    label: "Habilitar RCON",
    description:
      "Permite el control remoto del servidor mediante protocolo RCON por TCP.",
    type: "boolean",
    group: "Comandos",
  },
  "rcon.port": {
    label: "Puerto RCON",
    description: "Puerto TCP para conexiones RCON. Por defecto 25575.",
    type: "number",
    min: 1024,
    max: 65535,
    group: "Comandos",
  },
  "enable-query": {
    label: "Habilitar Query",
    description:
      "Permite consultas de estado del servidor mediante protocolo GameSpy4.",
    type: "boolean",
    group: "Comandos",
  },

  "view-distance": {
    label: "Distancia de visualización",
    description:
      "Chunks cargados alrededor de cada jugador (3–32). Valores altos consumen más RAM y CPU.",
    type: "number",
    min: 3,
    max: 32,
    group: "Rendimiento",
  },
  "simulation-distance": {
    label: "Distancia de simulación",
    description:
      "Distancia en chunks donde se simulan entidades y mecánicas de bloques. Menor = mejor rendimiento.",
    type: "number",
    min: 3,
    max: 32,
    group: "Rendimiento",
  },
  "max-tick-time": {
    label: "Tiempo máximo de tick (ms)",
    description:
      "Si un tick tarda más de este tiempo, el servidor se detiene como medida de seguridad. -1 = desactivado.",
    type: "number",
    min: -1,
    group: "Rendimiento",
  },
  "network-compression-threshold": {
    label: "Umbral de compresión de red (bytes)",
    description:
      "Comprime paquetes mayores a este tamaño. Reduce el ancho de banda pero aumenta el uso de CPU. -1 = sin compresión.",
    type: "number",
    min: -1,
    group: "Rendimiento",
  },
  "max-world-size": {
    label: "Tamaño máximo del mundo (bloques)",
    description:
      "Radio máximo en bloques del mundo desde el centro. Por defecto 29999984.",
    type: "number",
    min: 1,
    group: "Rendimiento",
  },
  "entity-broadcast-range-percentage": {
    label: "Rango de entidades visible (%)",
    description:
      "Porcentaje de la distancia de visualización donde se envían actualizaciones de entidades al cliente.",
    type: "number",
    min: 10,
    max: 1000,
    group: "Rendimiento",
  },
  "rate-limit": {
    label: "Límite de paquetes por segundo",
    description: "Máximo de paquetes por segundo por cliente. 0 = sin límite.",
    type: "number",
    min: 0,
    group: "Rendimiento",
  },

  "resource-pack": {
    label: "URL del resource pack",
    description:
      "Enlace directo al archivo .zip del resource pack que se envía a los jugadores al conectarse.",
    type: "url",
    group: "Resource Pack",
  },
  "resource-pack-sha1": {
    label: "SHA1 del resource pack",
    description:
      "Hash SHA1 del archivo .zip para verificar la integridad. Si no coincide, el cliente rechaza la descarga.",
    type: "text",
    group: "Resource Pack",
  },
  "require-resource-pack": {
    label: "Requerir resource pack",
    description:
      "Expulsa a los jugadores que rechacen instalar el resource pack del servidor.",
    type: "boolean",
    group: "Resource Pack",
  },
  "resource-pack-prompt": {
    label: "Mensaje al pedir el resource pack",
    description:
      "Texto que se muestra al jugador en el diálogo de instalación del resource pack.",
    type: "text",
    group: "Resource Pack",
  },
};

const GROUP_ORDER = [
  "General",
  "Jugadores",
  "Mundo",
  "Comandos",
  "Rendimiento",
  "Resource Pack",
];

// =========================================================
// TAB: INFO
// =========================================================

function TabInfo({
  instance,
  onAction,
  actionLoading,
}: {
  instance: McInstance;
  onAction: (act: "start" | "stop" | "restart") => void;
  actionLoading: string | null;
}) {
  const busy = actionLoading !== null;

  return (
    <div className="mcd-tab-content">
      <div className="mcd-section">
        <h2 className="mcd-section-title">Estado del servidor</h2>
        <div className="mcd-status-row">
          <div className="mcd-status-badge">
            <span
              className={`status-dot ${STATUS_CLASS[instance.status] ?? "status-dot--offline"}`}
            />
            <span className="mcd-status-label">
              {STATUS_LABEL[instance.status] ?? instance.status}
            </span>
          </div>
          <div className="mcd-status-players">
            {instance.playerCount} jugador
            {instance.playerCount !== 1 ? "es" : ""}
            {instance.players.length > 0 && (
              <span className="mcd-players-list">
                {" "}
                — {instance.players.join(", ")}
              </span>
            )}
          </div>
        </div>

        <div className="mcd-actions">
          {instance.status === "offline" && (
            <button
              className="mc-btn mc-btn--success"
              onClick={() => onAction("start")}
              disabled={busy}
            >
              {actionLoading === "start" ? "Iniciando..." : "▶ Iniciar servidor"}
            </button>
          )}
          {instance.status === "online" && (
            <>
              <button
                className="mc-btn mc-btn--warning"
                onClick={() => onAction("restart")}
                disabled={busy}
              >
                {actionLoading === "restart" ? "Reiniciando..." : "↺ Reiniciar"}
              </button>
              <button
                className="mc-btn mc-btn--danger"
                onClick={() => onAction("stop")}
                disabled={busy}
              >
                {actionLoading === "stop" ? "Deteniendo..." : "■ Detener"}
              </button>
            </>
          )}
          {(instance.status === "starting" ||
            instance.status === "stopping") && (
            <span className="mcd-busy-label">
              {STATUS_LABEL[instance.status]}
            </span>
          )}
        </div>
      </div>

      <div className="mcd-section">
        <h2 className="mcd-section-title">Información general</h2>
        <div className="mcd-info-grid">
          <div className="mcd-info-item">
            <span className="mcd-info-label">Nombre</span>
            <span className="mcd-info-value">{instance.name}</span>
          </div>
          {instance.description && (
            <div className="mcd-info-item mcd-info-item--full">
              <span className="mcd-info-label">Descripción</span>
              <span className="mcd-info-value">{instance.description}</span>
            </div>
          )}
          <div className="mcd-info-item">
            <span className="mcd-info-label">Software</span>
            <span className="mcd-info-value mcd-capitalize">
              {instance.software}
            </span>
          </div>
          <div className="mcd-info-item">
            <span className="mcd-info-label">Versión</span>
            <span className="mcd-info-value">{instance.version}</span>
          </div>
          <div className="mcd-info-item">
            <span className="mcd-info-label">Edición</span>
            <span className="mcd-info-value mcd-capitalize">
              {instance.edition}
            </span>
          </div>
          <div className="mcd-info-item">
            <span className="mcd-info-label">Puerto</span>
            <span className="mcd-info-value">{instance.port}</span>
          </div>
          <div className="mcd-info-item">
            <span className="mcd-info-label">RAM asignada</span>
            <span className="mcd-info-value">{instance.ram_mb} MB</span>
          </div>
          <div className="mcd-info-item">
            <span className="mcd-info-label">Carpeta</span>
            <span className="mcd-info-value mcd-mono">
              {instance.folder_name}
            </span>
          </div>
          <div className="mcd-info-item">
            <span className="mcd-info-label">Creado</span>
            <span className="mcd-info-value">
              {formatDate(instance.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// PROP ROW
// =========================================================

function PropRow({
  propKey,
  value,
  onChange,
}: {
  propKey: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const schema = PROP_SCHEMA[propKey];

  if (!schema) {
    const isBool = value === "true" || value === "false";
    const isNum = !isBool && !isNaN(Number(value)) && value !== "";
    return (
      <div className="mcd-prop-row mcd-prop-row--unknown">
        <div className="mcd-prop-header">
          <label className="mcd-prop-key">{propKey}</label>
        </div>
        {isBool ? (
          <div className="mcd-prop-toggle">
            <button
              className={`mcd-toggle ${value === "true" ? "mcd-toggle--on" : ""}`}
              onClick={() => onChange(value === "true" ? "false" : "true")}
            >
              <span className="mcd-toggle-thumb" />
            </button>
            <span className="mcd-toggle-label">
              {value === "true" ? "true" : "false"}
            </span>
          </div>
        ) : isNum ? (
          <input
            type="number"
            className="mcd-prop-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            type="text"
            className="mcd-prop-input mcd-prop-input--wide"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mcd-prop-row mcd-prop-row--known">
      <div className="mcd-prop-header">
        <label className="mcd-prop-label">{schema.label}</label>
        <span className="mcd-prop-key-small">{propKey}</span>
      </div>
      <p className="mcd-prop-desc">{schema.description}</p>
      <div className="mcd-prop-control">
        {schema.type === "boolean" && (
          <div className="mcd-prop-toggle">
            <button
              className={`mcd-toggle ${value === "true" ? "mcd-toggle--on" : ""}`}
              onClick={() => onChange(value === "true" ? "false" : "true")}
            >
              <span className="mcd-toggle-thumb" />
            </button>
            <span
              className={`mcd-toggle-label-lg ${value === "true" ? "mcd-toggle-label--on" : ""}`}
            >
              {value === "true" ? "Activado" : "Desactivado"}
            </span>
          </div>
        )}

        {schema.type === "select" && (
          <select
            className="mcd-prop-select"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {schema.options!.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {schema.type === "number" && (
          <input
            type="number"
            className="mcd-prop-input"
            value={value}
            min={schema.min}
            max={schema.max}
            onChange={(e) => onChange(e.target.value)}
          />
        )}

        {schema.type === "text" && (
          <input
            type="text"
            className="mcd-prop-input mcd-prop-input--wide"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        )}

        {schema.type === "url" && (
          <input
            type="url"
            className="mcd-prop-input mcd-prop-input--wide"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://ejemplo.com/pack.zip"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}

// =========================================================
// TAB: CONFIGURACIÓN
// =========================================================

function TabConfig({
  instance,
  onSaved,
}: {
  instance: McInstance;
  onSaved: () => void;
}) {
  const [props, setProps] = useState<Record<string, string>>(
    instance.properties ?? {},
  );
  const [ramMb, setRamMb] = useState(instance.ram_mb);
  const [javaFlags, setJavaFlags] = useState(instance.java_flags ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

  const setProp = (k: string, v: string) =>
    setProps((prev) => ({ ...prev, [k]: v }));

  const allKeys = Object.keys(props);

  const filtered = search
    ? allKeys.filter(
        (k) =>
          k.toLowerCase().includes(search.toLowerCase()) ||
          String(props[k]).toLowerCase().includes(search.toLowerCase()) ||
          (PROP_SCHEMA[k]?.label ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
    : allKeys;

  const groups: Record<string, string[]> = {};
  const unknown: string[] = [];

  for (const k of filtered) {
    const g = PROP_SCHEMA[k]?.group;
    if (g) {
      if (!groups[g]) groups[g] = [];
      groups[g].push(k);
    } else {
      unknown.push(k);
    }
  }

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.put(`/api/minecraft/${instance.id}/config`, {
        properties: props,
        ramMb,
        javaFlags: javaFlags || null,
      });
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Error al guardar";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mcd-tab-content">
      <div className="mcd-section">
        <h2 className="mcd-section-title">Recursos del servidor</h2>
        <div className="mcd-config-grid">
          <div className="mcd-form-row">
            <label>RAM asignada</label>
            <select
              value={ramMb}
              onChange={(e) => setRamMb(parseInt(e.target.value))}
            >
              {[512, 1024, 2048, 4096, 8192].map((mb) => (
                <option key={mb} value={mb}>
                  {mb} MB
                </option>
              ))}
            </select>
          </div>
          <div className="mcd-form-row mcd-form-row--full">
            <label>
              Java flags adicionales{" "}
              <span className="mcd-optional">(opcional)</span>
            </label>
            <input
              className="mcd-mono-input"
              value={javaFlags}
              onChange={(e) => setJavaFlags(e.target.value)}
              placeholder="-XX:+UseG1GC -XX:MaxGCPauseMillis=50"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      <div className="mcd-section">
        <div className="mcd-section-header">
          <h2 className="mcd-section-title">server.properties</h2>
          <input
            className="mcd-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar propiedad..."
          />
        </div>

        {allKeys.length === 0 && (
          <p className="mcd-empty-text">
            No hay propiedades cargadas. El archivo server.properties se genera
            al iniciar el servidor por primera vez.
          </p>
        )}

        {GROUP_ORDER.filter((g) => groups[g]?.length > 0).map((groupName) => (
          <div key={groupName} className="mcd-prop-group">
            <div className="mcd-prop-group-title">{groupName}</div>
            <div className="mcd-props-cards">
              {groups[groupName].map((k) => (
                <PropRow
                  key={k}
                  propKey={k}
                  value={props[k] ?? ""}
                  onChange={(v) => setProp(k, v)}
                />
              ))}
            </div>
          </div>
        ))}

        {unknown.length > 0 && (
          <div className="mcd-prop-group">
            <div className="mcd-prop-group-title">Otras propiedades</div>
            <div className="mcd-props-cards mcd-props-cards--compact">
              {unknown.map((k) => (
                <PropRow
                  key={k}
                  propKey={k}
                  value={props[k] ?? ""}
                  onChange={(v) => setProp(k, v)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mcd-save-bar">
        {error && <span className="mcd-save-error">{error}</span>}
        {saved && (
          <span className="mcd-save-ok">
            ✓ Guardado. Reinicia el servidor para aplicar.
          </span>
        )}
        <button
          className="mc-btn mc-btn--primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

// =========================================================
// TAB: ARCHIVOS
// =========================================================

function TabFiles({ instance }: { instance: McInstance }) {
  const [path, setPath] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileDeleting, setFileDeleting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isBinaryFile, setIsBinaryFile] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorSavedOk, setEditorSavedOk] = useState(false);

  // ── Un solo input que sirve tanto para archivos sueltos como para carpetas
  // El truco: alternamos el atributo `webkitdirectory` antes de hacer .click()
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const uploadWorldRef = useRef<HTMLInputElement | null>(null);

  const loadDir = useCallback(
    async (dir: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ path: string; files: FileEntry[] }>(
          `/api/minecraft/${instance.id}/files`,
          { params: { dir } },
        );
        setFiles(res.data.files ?? []);
        setPath(dir);
      } catch (err: unknown) {
        setError(
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ?? "Error al cargar archivos",
        );
      } finally {
        setLoading(false);
      }
    },
    [instance.id],
  );

  useEffect(() => {
    loadDir("");
  }, [loadDir]);

  const openFile = async (filePath: string) => {
    setSelectedFile(filePath);
    setFileLoading(true);
    setFileError(null);
    setIsBinaryFile(false);
    setEditorDirty(false);
    setEditorSavedOk(false);

    try {
      const res = await api.get<FileContentResponse>(
        `/api/minecraft/${instance.id}/file`,
        { params: { path: filePath } },
      );

      const binary = Boolean(res.data.binary || res.data.binary_file);
      setIsBinaryFile(binary);
      setFileContent(binary ? "" : (res.data.content ?? ""));
    } catch (err: unknown) {
      setFileError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Error al abrir archivo",
      );
      setFileContent("");
    } finally {
      setFileLoading(false);
    }
  };

  const saveFile = async () => {
    if (!selectedFile || isBinaryFile) return;
    setFileSaving(true);
    setFileError(null);
    setEditorSavedOk(false);
    try {
      await api.put(`/api/minecraft/${instance.id}/file`, {
        path: selectedFile,
        content: fileContent,
      });
      setEditorDirty(false);
      setEditorSavedOk(true);
      setTimeout(() => setEditorSavedOk(false), 2500);
    } catch (err: unknown) {
      setFileError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Error al guardar archivo",
      );
    } finally {
      setFileSaving(false);
    }
  };

  const deleteFile = async () => {
    if (!selectedFile) return;
    if (
      !window.confirm(
        `¿Eliminar "${selectedFile}"? Esta acción no se puede deshacer.`,
      )
    )
      return;

    setFileDeleting(true);
    setFileError(null);
    try {
      await api.delete(`/api/minecraft/${instance.id}/file`, {
        params: { path: selectedFile },
      });
      setSelectedFile(null);
      setFileContent("");
      setIsBinaryFile(false);
      setEditorDirty(false);
      setEditorSavedOk(false);
      await loadDir(path);
    } catch (err: unknown) {
      setFileError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Error al eliminar archivo",
      );
    } finally {
      setFileDeleting(false);
    }
  };

  // ── Subida unificada: archivos sueltos o carpeta completa
  const triggerUpload = (asFolder: boolean) => {
    const inp = uploadRef.current;
    if (!inp) return;
    // Alternar modo carpeta/archivo
    if (asFolder) {
      inp.setAttribute("webkitdirectory", "");
      inp.setAttribute("mozdirectory", "");
      inp.removeAttribute("multiple");
    } else {
      inp.removeAttribute("webkitdirectory");
      inp.removeAttribute("mozdirectory");
      inp.setAttribute("multiple", "");
    }
    inp.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;

    setError(null);
    try {
      const form = new FormData();
      form.append("dir", path);
      for (const file of picked) {
        form.append("files", file);
        const relPath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name;
        form.append("relativePaths", relPath);
      }
      await api.post(`/api/minecraft/${instance.id}/upload`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await loadDir(path);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Error al subir archivos",
      );
    } finally {
      e.target.value = "";
    }
  };

  const handleUploadWorld = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("world", file);

    setError(null);
    try {
      await api.post(`/api/minecraft/${instance.id}/world`, form);
      await loadDir("");
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Error al subir mundo",
      );
    } finally {
      e.target.value = "";
    }
  };

  const breadcrumbs = path
    ? path
        .split("/")
        .filter(Boolean)
        .map((part, i, arr) => ({
          label: part,
          path: arr.slice(0, i + 1).join("/"),
        }))
    : [];

  const goUp = () => {
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    loadDir(parts.join("/"));
  };

  return (
    <div className="mcd-tab-content">
      <div className="mcd-section">
        {/* Breadcrumb */}
        <div className="mcd-breadcrumb">
          <button className="mcd-breadcrumb-item" onClick={() => loadDir("")}>
            /
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.path} className="mcd-breadcrumb-sep">
              <span className="mcd-breadcrumb-slash">/</span>
              <button
                className="mcd-breadcrumb-item"
                onClick={() => loadDir(crumb.path)}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mcd-files-toolbar">
          <button
            className="mc-btn mc-btn--ghost mc-btn--sm"
            onClick={goUp}
            disabled={!path || loading}
          >
            ↑ Subir
          </button>

          <button
            className="mc-btn mc-btn--ghost mc-btn--sm"
            onClick={() => loadDir(path)}
            disabled={loading}
          >
            ↺ Actualizar
          </button>

          {/* Botón "Subir archivo" — abre selector de archivos sueltos */}
          <button
            className="mc-btn mc-btn--primary mc-btn--sm"
            onClick={() => triggerUpload(false)}
          >
            ⬆ Subir archivo
          </button>

          {/* Botón "Subir carpeta" — el mismo input, pero con webkitdirectory */}
          <button
            className="mc-btn mc-btn--primary mc-btn--sm"
            onClick={() => triggerUpload(true)}
          >
            📂 Subir carpeta
          </button>

          <button
            className="mc-btn mc-btn--warning mc-btn--sm"
            onClick={() => uploadWorldRef.current?.click()}
          >
            🌍 Subir mundo ZIP
          </button>

          <span className="mcd-files-count">{files.length} elementos</span>

          {/* Input unificado: archivo o carpeta según triggerUpload() */}
          <input
            ref={uploadRef}
            type="file"
            hidden
            onChange={handleUpload}
          />

          {/* Input exclusivo para mundo .zip */}
          <input
            ref={uploadWorldRef}
            type="file"
            hidden
            accept=".zip"
            onChange={handleUploadWorld}
          />
        </div>

        {/* Error de directorio */}
        {error && <div className="mcd-files-error">{error}</div>}

        {/* Layout dos columnas: explorador + editor */}
        <div className="mcd-files-layout">
          {/* ── Columna izquierda: lista de archivos ── */}
          <div>
            {loading ? (
              <div className="mcd-files-list">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="mcd-file-row mcd-file-row--skeleton">
                    <div className="skeleton" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />
                    <div className="skeleton" style={{ flex: 1, height: 14, borderRadius: 4 }} />
                    <div className="skeleton" style={{ width: 60, height: 14, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="mcd-files-list">
                {files.length === 0 && (
                  <div className="mcd-files-empty">Carpeta vacía</div>
                )}
                {files.map((file) => {
                  const fullPath = path ? `${path}/${file.name}` : file.name;
                  const isSelected = selectedFile === fullPath;
                  return (
                    <div
                      key={fullPath}
                      className={`mcd-file-row${file.isDir ? " mcd-file-row--dir" : ""}${isSelected ? " mcd-file-row--active" : ""}`}
                    >
                      <div className="mcd-file-main" onClick={() => file.isDir && loadDir(fullPath)}>
                        <span className="mcd-file-icon">
                          {file.isDir ? "📁" : "📄"}
                        </span>
                        <span className="mcd-file-name">{file.name}</span>
                      </div>
                      <span className="mcd-file-meta">
                        {file.size !== null ? formatBytes(file.size) : "—"}
                      </span>
                      <span className="mcd-file-date">
                        {formatDate(file.modified)}
                      </span>
                      <div className="mcd-file-actions">
                        {file.isDir ? (
                          <button
                            className="mc-btn mc-btn--ghost mc-btn--sm"
                            onClick={() => loadDir(fullPath)}
                          >
                            Abrir
                          </button>
                        ) : (
                          <button
                            className={`mc-btn mc-btn--sm${isSelected ? " mc-btn--primary" : " mc-btn--ghost"}`}
                            onClick={() => openFile(fullPath)}
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Columna derecha: editor ── */}
          <div className="mcd-editor-panel">
            {!selectedFile && (
              <>
                <h3 className="mcd-editor-title">Editor de archivos</h3>
                <p className="mcd-empty-text">
                  Selecciona un archivo de texto de la lista para editarlo aquí.
                </p>
              </>
            )}

            {selectedFile && (
              <>
                <h3 className="mcd-editor-title">
                  {selectedFile.split("/").pop()}
                </h3>
                <p className="mcd-editor-subtitle">{selectedFile}</p>

                {fileLoading && (
                  <div className="mcd-empty-text">Cargando archivo...</div>
                )}

                {fileError && (
                  <div className="mcd-files-error" style={{ marginBottom: 12 }}>
                    {fileError}
                  </div>
                )}

                {!fileLoading && isBinaryFile && (
                  <div className="mcd-empty-text">
                    Este archivo es binario y no se puede editar desde el panel.
                  </div>
                )}

                {!fileLoading && !isBinaryFile && (
                  <>
                    <textarea
                      className="mcd-editor-textarea"
                      value={fileContent}
                      onChange={(e) => {
                        setFileContent(e.target.value);
                        setEditorDirty(true);
                        setEditorSavedOk(false);
                      }}
                      spellCheck={false}
                    />

                    <div className="mcd-editor-actions">
                      <span
                        className={`mcd-editor-status${editorSavedOk ? " mcd-editor-status--saved" : editorDirty ? " mcd-editor-status--dirty" : ""}`}
                      >
                        {editorSavedOk
                          ? "✓ Guardado"
                          : editorDirty
                            ? "● Cambios sin guardar"
                            : "Sin cambios"}
                      </span>

                      <div className="mcd-inline-actions">
                        <button
                          className="mc-btn mc-btn--danger mc-btn--sm"
                          onClick={deleteFile}
                          disabled={fileDeleting || fileSaving}
                        >
                          {fileDeleting ? "Eliminando..." : "Eliminar"}
                        </button>
                        <button
                          className="mc-btn mc-btn--primary mc-btn--sm"
                          onClick={saveFile}
                          disabled={fileSaving || fileDeleting}
                        >
                          {fileSaving ? "Guardando..." : "Guardar"}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// PÁGINA PRINCIPAL
// =========================================================

export default function MinecraftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const instanceId = parseInt(id ?? "0");

  const [instance, setInstance] = useState<McInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [downloadModal, setDownloadModal] = useState<{
    instanceId: number;
    software: string;
    version: string;
  } | null>(null);

  const notify = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadInstance = useCallback(async () => {
    try {
      const res = await api.get<McInstance>(`/api/minecraft/${instanceId}`);
      setInstance(res.data);
    } catch {
      navigate("/minecraft");
    } finally {
      setLoading(false);
    }
  }, [instanceId, navigate]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get<McInstance>(`/api/minecraft/${instanceId}`);
        setInstance((prev) =>
          prev
            ? {
                ...prev,
                status: res.data.status,
                playerCount: res.data.playerCount,
                players: res.data.players,
              }
            : null,
        );
      } catch {
        // silencioso
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, [instanceId]);

  const handleAction = async (act: "start" | "stop" | "restart") => {
    if (!instance) return;
    setActionLoading(act);
    try {
      const res = await api.post(`/api/minecraft/${instance.id}/${act}`);
      notify(res.data.message ?? "OK");
      loadInstance();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string } } })
        ?.response?.data;

      if (
        data?.message?.includes("JAR_DOWNLOADING") ||
        data?.message?.includes("Descargando")
      ) {
        setDownloadModal({
          instanceId: instance.id,
          software: instance.software,
          version: instance.version,
        });
        return;
      }

      notify(data?.message ?? "Error", "err");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard-content">
          <div className="mcd-skeleton-header">
            <div className="skeleton" style={{ width: 120, height: 16 }} />
            <div
              className="skeleton skeleton-heading"
              style={{ width: 240 }}
            />
          </div>
          <div
            className="skeleton"
            style={{ height: 44, borderRadius: 8, marginBottom: 24 }}
          />
          <div className="card" style={{ minHeight: 300 }}>
            <div
              className="skeleton skeleton-heading"
              style={{ width: "30%" }}
            />
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text" style={{ width: "70%" }} />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!instance) return null;

  const TABS: { id: Tab; label: string }[] = [
    { id: "info", label: "Información" },
    { id: "config", label: "Configuración" },
    { id: "files", label: "Archivos" },
  ];

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="page-header">
          <div>
            <button
              className="mcd-back-btn"
              onClick={() => navigate("/minecraft")}
            >
              ← Minecraft
            </button>
            <h1 className="page-title">{instance.name}</h1>
            <p className="page-subtitle">
              {instance.software} {instance.version} · Puerto {instance.port}
            </p>
          </div>
          <div className="mcd-header-status">
            <span
              className={`status-dot ${STATUS_CLASS[instance.status] ?? "status-dot--offline"}`}
            />
            <span className="mcd-status-label">
              {STATUS_LABEL[instance.status] ?? instance.status}
            </span>
          </div>
        </div>

        <div className="mcd-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`mcd-tab ${activeTab === tab.id ? "mcd-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "info" && (
          <TabInfo
            instance={instance}
            onAction={handleAction}
            actionLoading={actionLoading}
          />
        )}
        {activeTab === "config" && (
          <TabConfig instance={instance} onSaved={loadInstance} />
        )}
        {activeTab === "files" && <TabFiles instance={instance} />}
      </div>

      {toast && (
        <div className={`mc-toast mc-toast--${toast.type}`}>{toast.msg}</div>
      )}

      {downloadModal && (
        <DownloadJarModal
          instanceId={downloadModal.instanceId}
          software={downloadModal.software}
          version={downloadModal.version}
          onDone={() => {
            setDownloadModal(null);
            handleAction("start");
          }}
          onClose={() => setDownloadModal(null)}
        />
      )}
    </DashboardLayout>
  );
}