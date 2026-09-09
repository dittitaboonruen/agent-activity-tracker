
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calculator Preview | Royal Partners",
};

export default async function CalculatorPreviewPage() {
  if (process.env.RP_CALCULATOR_PREVIEW_ENABLED !== "true") {
    return (
      <main style={{ padding: 32 }}>
        <h1>Calculator อยู่ระหว่างเตรียมเปิดใช้งาน</h1>
        <p>ยังไม่เปิดให้ใช้งานสาธารณะ</p>
        <Link href="/agent">กลับ Agent Portal</Link>
      </main>
    );
  }

  const supabase = createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !profile ||
    profile.active !== true ||
    !["manager", "admin"].includes(profile.role)
  ) {
    return (
      <main style={{ padding: 32 }}>
        <h1>ไม่มีสิทธิ์เข้าถึง</h1>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F7F3EA",
        color: "#0F1B2E",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link
          href="/agent"
          style={{ color: "#0F1B2E" }}
        >
          ← Agent Portal
        </Link>

        <h1 style={{ fontSize: 26, marginBottom: 8 }}>
          Insurance Calculator
        </h1>

        <p
          style={{
            lineHeight: 1.7,
            padding: 14,
            background: "#FFF3CD",
            border: "1px solid #D6B55C",
          }}
        >
          ทดสอบภายในเท่านั้น: สูตรและอัตราเบี้ยยังไม่ผ่านการอนุมัติ
          ห้ามใช้เสนอขายหรือกรอกข้อมูลลูกค้าจริง
          ยังไม่มีระบบบันทึกฐานข้อมูล
        </p>

        <iframe
          title="Royal Partners calculator prototype"
          src="/illustrations/royal_partners_illustration_tool.html"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{
            width: "100%",
            height: 1050,
            border: "1px solid #D9D2BF",
            background: "#FFFDF8",
          }}
        />
      </div>
    </main>
  );
}
