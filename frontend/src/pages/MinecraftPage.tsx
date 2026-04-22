// =========================================================
// MINECRAFT PAGE — Gestión de servidores Minecraft
// =========================================================

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import { useMinecraftConsole } from "../hooks/useMinecraftConsole";
import "../styles/minecraft.css";
import { DownloadJarModal } from "../components/DownloadJarModal";

const FALLBACK_HOST = "172.22.165.77";

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
  status: string;
  playerCount: number;
  players: string[];
  folder_name: string;
  tunnel_address?: string;
}

// ── Helpers ───────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  online: "Online",
  offline: "Offline",
  starting: "Iniciando...",
  stopping: "Deteniendo...",
};

const STATUS_CLASS: Record<string, string> = {
  online: "status-dot--online",
  offline: "status-dot--offline",
  starting: "status-dot--starting",
  stopping: "status-dot--stopping",
};

const api = (path: string, opts?: RequestInit) =>
  fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionStorage.getItem("token")}`,
      ...(opts?.headers ?? {}),
    },
  });

// ── Subcomponente: Panel de consola ───────────────────────

function ConsolePanel({ instance }: { instance: McInstance }) {
  const {
    lines,
    status,
    playerCount,
    players,
    connected,
    sendCommand,
    clearConsole,
  } = useMinecraftConsole(instance.id);

  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const handleSend = () => {
    const cmd = input.trim();
    if (!cmd) return;
    sendCommand(cmd);
    setCmdHistory((prev) => [cmd, ...prev.slice(0, 49)]);
    setHistIdx(-1);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(idx);
      setInput(cmdHistory[idx] ?? "");
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? "" : cmdHistory[idx]);
    }
  };

  const lineClass = (text: unknown) => {
    const t = typeof text === "string" ? text : JSON.stringify(text);
    if (t.startsWith("[Sistema]")) return "console-line--system";
    if (t.startsWith("[Error]")) return "console-line--error";
    if (/WARN/i.test(t)) return "console-line--warn";
    if (/ERROR|SEVERE/i.test(t)) return "console-line--error";
    if (/joined the game/i.test(t)) return "console-line--join";
    if (/left the game/i.test(t)) return "console-line--leave";
    return "";
  };

  return (
    <div className="mc-console-panel">
      <div className="mc-console-header">
        <div className="mc-console-meta">
          <span
            className={`status-dot ${STATUS_CLASS[status] ?? "status-dot--offline"}`}
          />
          <span className="mc-console-status">
            {STATUS_LABEL[status] ?? status}
          </span>
          <span className="mc-console-sep">·</span>
          <span className="mc-console-players">
            {playerCount} jugador{playerCount !== 1 ? "es" : ""}
            {players.length > 0 && `: ${players.join(", ")}`}
          </span>
          <span className="mc-console-sep">·</span>
          <span
            className={`mc-console-ws ${connected ? "connected" : "disconnected"}`}
          >
            {connected ? "● Conectado" : "○ Desconectado"}
          </span>
        </div>
        <button
          className="mc-btn mc-btn--ghost mc-btn--sm"
          onClick={clearConsole}
        >
          Limpiar
        </button>
      </div>

      <div className="mc-console-output">
        {lines.length === 0 && (
          <div className="mc-console-empty">
            {connected
              ? "Esperando output del servidor..."
              : "Conectando a la consola..."}
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className={`console-line ${lineClass(l.text)}`}>
            <span className="console-line-text">
              {typeof l.text === "string" ? l.text : JSON.stringify(l.text)}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mc-console-input-row">
        <span className="mc-console-prompt">&gt;</span>
        <input
          ref={inputRef}
          className="mc-console-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            status === "online"
              ? "Escribe un comando..."
              : "El servidor no está corriendo"
          }
          disabled={status !== "online"}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="mc-btn mc-btn--primary mc-btn--sm"
          onClick={handleSend}
          disabled={status !== "online" || !input.trim()}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

// ── Subcomponente: Card de instancia ──────────────────────

function InstanceCard({
  instance,
  selected,
  onSelect,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onDetail,
  actionLoading,
}: {
  instance: McInstance;
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onDetail: () => void; // ← nuevo
  actionLoading: string | null;
}) {
  const busy = actionLoading !== null;

  return (
    <div
      className={`mc-instance-card ${selected ? "mc-instance-card--selected" : ""}`}
      onClick={onSelect}
    >
      <div className="mc-instance-card-header">
        <div className="mc-instance-info">
          <span
            className={`status-dot ${STATUS_CLASS[instance.status] ?? "status-dot--offline"}`}
          />
          <div>
            <div className="mc-instance-name">{instance.name}</div>
            <div className="mc-instance-meta">
              {instance.software} {instance.version}
            </div>
          </div>
        </div>
        <div className="mc-instance-badges">
          <span className="badge badge-software">{instance.software}</span>
          <span className="badge badge-edition">{instance.edition}</span>
        </div>
      </div>

      <div className="mc-instance-connection">
        <span className="mc-connection-label">IP:</span>
        <code className="mc-connection-addr">
          {instance.tunnel_address ?? `${FALLBACK_HOST}:${instance.port}`}
        </code>
        <button
          className="mc-btn mc-btn--ghost mc-btn--xs"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(
              instance.tunnel_address ?? `172.22.165.77:${instance.port}`,
            );
          }}
          title="Copiar IP"
        >
          📋
        </button>
      </div>

      {instance.description && (
        <p className="mc-instance-desc">{instance.description}</p>
      )}

      <div className="mc-instance-stats">
        <span>RAM: {instance.ram_mb} MB</span>
        <span>·</span>
        <span>{instance.playerCount} jugadores</span>
        <span>·</span>
        <span className={`mc-status-text mc-status-text--${instance.status}`}>
          {STATUS_LABEL[instance.status] ?? instance.status}
        </span>
      </div>

      {/* Acciones */}
      <div className="mc-instance-actions" onClick={(e) => e.stopPropagation()}>
        {instance.status === "offline" && (
          <button
            className="mc-btn mc-btn--success mc-btn--sm"
            onClick={onStart}
            disabled={busy}
          >
            {actionLoading === "start" ? "..." : "▶ Iniciar"}
          </button>
        )}
        {instance.status === "online" && (
          <>
            <button
              className="mc-btn mc-btn--warning mc-btn--sm"
              onClick={onRestart}
              disabled={busy}
            >
              {actionLoading === "restart" ? "..." : "↺ Reiniciar"}
            </button>
            <button
              className="mc-btn mc-btn--danger mc-btn--sm"
              onClick={onStop}
              disabled={busy}
            >
              {actionLoading === "stop" ? "..." : "■ Detener"}
            </button>
          </>
        )}
        {(instance.status === "starting" || instance.status === "stopping") && (
          <span className="mc-btn-loading">
            {STATUS_LABEL[instance.status]}
          </span>
        )}

        {/* ── Botón configurar ── */}
        <button
          className="mc-btn mc-btn--ghost mc-btn--sm"
          onClick={onDetail}
          title="Ver configuración y archivos"
        >
          ⚙ Configurar
        </button>

        <button
          className="mc-btn mc-btn--ghost mc-btn--sm mc-btn--icon"
          onClick={onDelete}
          disabled={busy || instance.status !== "offline"}
          title="Eliminar instancia (solo cuando está offline)"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ── Modal: Crear instancia ────────────────────────────────

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (inst: McInstance) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    software: "paper",
    version: "1.21.4",
    edition: "java",
    ramMb: 1024,
  });
  const [versions, setVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingV, setLoadingV] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingV(true);
    api(`/api/minecraft/software/versions?software=${form.software}`)
      .then((r) => r.json())
      .then((d) => {
        setVersions(d.versions ?? []);
        setForm((f) => ({ ...f, version: d.versions?.[0] ?? "" }));
      })
      .catch(() => setVersions([]))
      .finally(() => setLoadingV(false));
  }, [form.software]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...form,
        ramMb: Number.isNaN(form.ramMb) ? 1024 : form.ramMb,
      };
      const res = await api("/api/minecraft", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message ?? data.error ?? "Error al crear");
      if (data.instance) {
        onCreated(data.instance);
      } else {
        throw new Error("El servidor no devolvió la instancia creada");
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mc-modal-overlay" onClick={onClose}>
      <div className="mc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mc-modal-header">
          <h2 className="mc-modal-title">Nueva instancia</h2>
          <button className="mc-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="mc-modal-form" onSubmit={handleSubmit}>
          <div className="mc-form-row">
            <label>Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Mi servidor"
              required
            />
          </div>

          <div className="mc-form-row">
            <label>Descripción</label>
            <input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Descripción opcional"
            />
          </div>

          <div className="mc-form-grid">
            <div className="mc-form-row">
              <label>Software *</label>
              <select
                value={form.software}
                onChange={(e) => set("software", e.target.value)}
              >
                {[
                  "paper",
                  "vanilla",
                  "spigot",
                  "fabric",
                  "forge",
                  "purpur",
                  "neoforge",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="mc-form-row">
              <label>Versión *</label>
              <select
                value={form.version}
                onChange={(e) => set("version", e.target.value)}
                disabled={loadingV}
              >
                {loadingV ? (
                  <option>Cargando...</option>
                ) : (
                  versions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mc-form-row">
              <label>Edición *</label>
              <select
                value={form.edition}
                onChange={(e) => set("edition", e.target.value)}
              >
                <option value="java">Java</option>
                <option value="bedrock">Bedrock</option>
              </select>
            </div>

            <div className="mc-form-row">
              <label>RAM (MB)</label>
              <select
                value={form.ramMb}
                onChange={(e) => set("ramMb", parseInt(e.target.value) || 1024)}
              >
                {[512, 1024, 2048, 4096, 8192].map((mb) => (
                  <option key={mb} value={mb}>
                    {mb} MB
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="mc-modal-error">{error}</div>}

          <div className="mc-modal-footer">
            <button
              type="button"
              className="mc-btn mc-btn--ghost"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="mc-btn mc-btn--primary"
              disabled={loading}
            >
              {loading ? "Creando..." : "Crear servidor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────

export default function MinecraftPage() {
  const navigate = useNavigate(); // ← nuevo

  const [instances, setInstances] = useState<McInstance[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<
    Record<number, string | null>
  >({});
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);
  const [downloadModal, setDownloadModal] = useState<{
    instanceId: number;
    software: string;
    version: string;
  } | null>(null);

  const selectedInstance = Array.isArray(instances)
    ? (instances.find((i) => i.id === selectedId) ?? null)
    : null;

  const notify = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadInstances = async () => {
    try {
      const res = await api("/api/minecraft");
      const data = await res.json();
      setInstances(data.instances ?? []);
      if (data.instances?.length && selectedId === null) {
        setSelectedId(data.instances[0].id);
      }
    } catch {
      notify("Error al cargar instancias", "err");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await api("/api/minecraft");
        const data = await res.json();
        setInstances(data.instances ?? []);
      } catch {
        /* silencioso */
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, []);

  const action = async (id: number, act: "start" | "stop" | "restart") => {
    setActionLoading((prev) => ({ ...prev, [id]: act }));
    try {
      const res = await api(`/api/minecraft/${id}/${act}`, {
        method: "POST",
        body: "{}",
      });
      const data = await res.json();
      if (!res.ok) {
        // ── Detecta JAR faltante → abre modal de descarga
        if (
          data.error === "start_error" &&
          data.message?.includes("JAR_DOWNLOADING")
        ) {
          const inst = instances.find((i) => i.id === id);
          if (inst)
            setDownloadModal({
              instanceId: id,
              software: inst.software,
              version: inst.version,
            });
          return;
        }
        throw new Error(data.message ?? data.error);
      }
      notify(data.message ?? "OK");
      loadInstances();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Error", "err");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta instancia? Esta acción no se puede deshacer."))
      return;
    setActionLoading((prev) => ({ ...prev, [id]: "delete" }));
    try {
      const res = await api(`/api/minecraft/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      notify("Instancia eliminada");
      setInstances((prev) => prev.filter((i) => i.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Error", "err");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  return (
    <DashboardLayout>
      <div className="dashboard-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Minecraft</h1>
            <p className="page-subtitle">
              Gestiona tus servidores de Minecraft
            </p>
          </div>
          <button
            className="mc-btn mc-btn--primary"
            onClick={() => setShowCreate(true)}
          >
            + Nueva instancia
          </button>
        </div>

        {loading && (
          <div className="mc-instances-list">
            {[1, 2].map((i) => (
              <div key={i} className="card mc-instance-card">
                <div
                  className="skeleton skeleton-heading"
                  style={{ width: "40%" }}
                />
                <div className="skeleton skeleton-text" />
                <div
                  className="skeleton skeleton-text"
                  style={{ width: "60%" }}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && instances.length === 0 && (
          <div className="mc-empty-state">
            <div className="mc-empty-icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.29 7 12 12 20.71 7" />
                <line x1="12" y1="22" x2="12" y2="12" />
              </svg>
            </div>
            <h3>No hay servidores todavía</h3>
            <p>Crea tu primera instancia de Minecraft para empezar.</p>
            <button
              className="mc-btn mc-btn--primary"
              onClick={() => setShowCreate(true)}
            >
              + Crear primer servidor
            </button>
          </div>
        )}

        {!loading && instances.length > 0 && (
          <div className="mc-layout">
            <div className="mc-instances-list">
              {instances.map((inst) => (
                <InstanceCard
                  key={inst.id}
                  instance={inst}
                  selected={inst.id === selectedId}
                  onSelect={() => setSelectedId(inst.id)}
                  onStart={() => action(inst.id, "start")}
                  onStop={() => action(inst.id, "stop")}
                  onRestart={() => action(inst.id, "restart")}
                  onDelete={() => handleDelete(inst.id)}
                  onDetail={() => navigate(`/minecraft/${inst.id}`)} // ← nuevo
                  actionLoading={actionLoading[inst.id] ?? null}
                />
              ))}
            </div>

            <div className="mc-console-wrapper">
              {selectedInstance ? (
                <ConsolePanel instance={selectedInstance} />
              ) : (
                <div className="mc-console-placeholder">
                  <p>Selecciona una instancia para ver su consola</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(inst) => {
            setInstances((prev) => [...prev, inst]);
            setSelectedId(inst.id);
            notify(`Servidor "${inst.name}" creado`);
          }}
        />
      )}

      {toast && (
        <div className={`mc-toast mc-toast--${toast.type}`}>{toast.msg}</div>
      )}

      {/* ── Modal de descarga de JAR ── */}
      {downloadModal && (
        <DownloadJarModal
          instanceId={downloadModal.instanceId}
          software={downloadModal.software}
          version={downloadModal.version}
          onDone={() => {
            setDownloadModal(null);
            // Reintenta el start automáticamente
            action(downloadModal.instanceId, "start");
          }}
          onClose={() => setDownloadModal(null)}
        />
      )}
    </DashboardLayout>
  );
}
