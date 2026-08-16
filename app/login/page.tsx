"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setIsError(true);
        setMessage(
          data.error || "ไม่สามารถส่งลิงก์เข้าสู่ระบบได้"
        );
        return;
      }

      setIsError(false);
      setMessage(
        "ส่งลิงก์เข้าสู่ระบบแล้ว กรุณาเปิดอีเมลและกดลิงก์เพื่อเข้าสู่ Performance Hub"
      );
    } catch (error) {
      setIsError(true);

      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      }
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
          <div style={{ marginBottom: 18 }}>
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
              placeholder="name@royalpartner.org"
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

          {message && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 13px",
                borderRadius: 10,
                border: isError
                  ? "1px solid var(--rp-danger-border)"
                  : "1px solid var(--hairline)",
                background: isError
                  ? "transparent"
                  : "var(--rp-soft-gold)",
                color: isError
                  ? "var(--rp-danger)"
                  : "var(--gold-bright)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {message}
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
            {loading
              ? "กำลังส่งลิงก์..."
              : "ส่งลิงก์เข้าสู่ระบบ"}
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
            ระบบจะส่ง Magic Link ไปยังอีเมลที่ได้รับอนุญาต
          </div>
        </form>
      </div>
    </main>
  );
}
