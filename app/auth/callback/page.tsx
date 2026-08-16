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

        // 1) กรณี Magic Link ส่ง token มากับ URL hash
        const hash = new URLSearchParams(
          window.location.hash.replace(/^#/, "")
        );

        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            setMessage(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
            return;
          }

          window.history.replaceState(
            {},
            document.title,
            "/auth/callback"
          );

          window.location.replace("/");
          return;
        }

        // 2) กรณี Supabase ส่ง auth code กลับมา
        const params = new URLSearchParams(
          window.location.search
        );

        const code = params.get("code");

        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            setMessage(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`);
            return;
          }

          window.location.replace("/");
          return;
        }

        // 3) ตรวจว่ามี session อยู่แล้วหรือไม่
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
          return;
        }

        if (session) {
          window.location.replace("/");
          return;
        }

        setMessage(
          "ไม่พบข้อมูลสำหรับเข้าสู่ระบบ กรุณากลับไปขอลิงก์เข้าสู่ระบบใหม่"
        );
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
