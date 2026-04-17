// =========================================================
// LOGIN PAGE — Pantalla de inicio de sesión
// Diseño centrado con card flotante sobre fondo oscuro
// =========================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";
import axios from 'axios'
import { login } from '../services/auth'

export default function LoginPage() {
  // ── Estado del formulario ─────────────────────────────
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // ── Manejo del submit — ahora llama al backend real ──────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Llama al servicio de auth que conecta con el backend
      await login(username, password);
      navigate("/");
    } catch (err: unknown) {
      // Axios envuelve el error del backend en err.response.data
      if (axios.isAxiosError(err)) {
        const msg = err.response?.data?.message;
        setError(msg || "Usuario o contraseña incorrectos");
      } else {
        setError("Error al conectar con el servidor");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* Fondo con efecto de profundidad — círculos de luz difusa */}
      <div className="login-bg">
        <div className="login-bg-glow login-bg-glow--blue" />
        <div className="login-bg-glow login-bg-glow--purple" />
      </div>

      {/* Card principal de login */}
      <div className="login-card">
        {/* Logo / Header */}
        <div className="login-header">
          <div className="login-logo">
            {/* Ícono SVG del servidor */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="2" y="3" width="20" height="5" rx="2" />
              <rect x="2" y="10" width="20" height="5" rx="2" />
              <rect x="2" y="17" width="20" height="5" rx="2" />
              <circle
                cx="18"
                cy="5.5"
                r="0.8"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="18"
                cy="12.5"
                r="0.8"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="18"
                cy="19.5"
                r="0.8"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </div>
          <h1 className="login-title">Completos Hosting</h1>
          <p className="login-subtitle">Panel de administración del servidor</p>
        </div>

        {/* Formulario */}
        <form className="login-form" onSubmit={handleSubmit}>
          {/* Campo usuario */}
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              className="input"
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          {/* Campo contraseña */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Ingresa tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {/* Mensaje de error — solo se muestra si hay un error */}
          {error && (
            <div className="login-error">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Botón de submit */}
          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Iniciando sesión...
              </>
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>

        {/* Footer de la card */}
        <p className="login-footer">completohosting.lat — v0.2</p>
      </div>
    </div>
  );
}
