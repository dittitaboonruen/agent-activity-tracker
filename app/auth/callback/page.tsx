"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState(
    "กำลังตรวจสอบการเข้าสู่ระบบ..."
  );

  useEffect(() => {
    async function finishLogin() {
      try {
        const supabase = createClient();

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          setMessage(error.message);
          return;
        }

        if (!session) {
          setMessage(
            "ไม่พบ Session กรุณากลับไปขอลิงก์เข้าสู่ระบบใหม่"
          );
          return;
        }

        window.location.replace("/");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "ไม่สามารถเข้าสู่ระบบได้"
        );
      }
    }

    finishLogin();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--rp-page-gradient), var(--bg)",
        color: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          textAlign: "center",
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: 20,
          padding: 32,
        }}
      >
        <div
          style={{
            color: "var(--gold)",
            fontWeight: 800,
            letterSpacing: 2,
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          ROYAL PARTNER
        </div>

        <h1
          style={{
            margin: "0 0 14px",
            fontSize: 28,
          }}
        >
          Performance Hub
        </h1>

        <p
          style={{
            margin: 0,
            color: "var(--cream-muted)",
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>
      </div>
    </main>
  );
}
