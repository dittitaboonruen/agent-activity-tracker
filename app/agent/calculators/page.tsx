import Link from "next/link";

export const metadata = {
  title: "เครื่องมือคำนวณและจัดทำใบสรุปประกอบการเสนอขาย | Royal Partner",
};

export default function CalculatorPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F7F3EA",
        color: "#0F1B2E",
        padding: "clamp(12px, 2vw, 28px)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1600, margin: "0 auto", minWidth: 0 }}>
        <Link
          href="/agent"
          style={{
            display: "inline-block",
            marginBottom: 20,
            color: "#0F1B2E",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← กลับหน้าตัวแทน
        </Link>

        <h1 style={{ fontSize: 26, marginBottom: 8 }}>
          เครื่องมือคำนวณและจัดทำใบสรุปประกอบการเสนอขาย
        </h1>


        <iframe
          title="เครื่องมือคำนวณและจัดทำใบสรุปประกอบการเสนอขาย"
          src="/illustrations/royal_partners_illustration_tool.html"
          sandbox="allow-scripts allow-downloads allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          style={{
            display: "block",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            height: "max(1100px, 90dvh)",
            border: "1px solid #D9D2BF",
            background: "#FFFDF8",
          }}
        />
      </div>
    </main>
  );
}
