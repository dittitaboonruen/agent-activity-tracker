"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        return;
      }

      window.location.href = "/";
    } catch {
      setErrorMessage("ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="dash-root"
      style={{
        minHeight: "100vh",
        background: "var(--rp-page-gradient), var(--bg)",
        color: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              color: "var(--gold)",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2.5,
              marginBottom: 10,
            }}
          >
            ROYAL PARTNER
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 38,
              lineHeight: 1.1,
            }}
          >
            Performance Hub
          </h1>

          <p
            style={{
              margin: "10px 0 0",
              color: "var(--cream-muted)",
              fontSize: 14,
            }}
          >
            เข้าสู่ระบบสำหรับ Manager และ Admin
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: 22,
            padding: 26,
          }}
        >
          <div
            style={{
              marginBottom: 18,
            }}
          >
            <label
              htmlFor="email"
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="name@company.com"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 14px",
                borderRadius: 12,
                border: "1px solid var(--hairline)",
                background: "var(--surface-alt)",
                color: "var(--cream)",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>

          <div
            style={{
              marginBottom: 18,
            }}
          >
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 14px",
                borderRadius: 12,
                border: "1px solid var(--hairline)",
                background: "var(--surface-alt)",
                color: "var(--cream)",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>

          {errorMessage && (
            <div
              style={{
                marginBottom: 16,
                padding: "11px 13px",
                borderRadius: 10,
                border: "1px solid var(--rp-danger-border)",
                color: "var(--rp-danger)",
                fontSize: 13,
              }}
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              border: 0,
              borderRadius: 12,
              padding: "13px 16px",
              background: "var(--gold)",
              color: "#171109",
              fontWeight: 800,
              fontSize: 15,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

          <div
            style={{
              marginTop: 18,
              textAlign: "center",
              color: "var(--cream-faint)",
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            Royal Partner · Back Office
          </div>
        </form>
      </div>
    </main>
  );
}
