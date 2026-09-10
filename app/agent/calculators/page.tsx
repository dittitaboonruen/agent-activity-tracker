
import Link from "next/link";

export const metadata = {
  title: "Insurance Calculator | Royal Partners",
};

export default function CalculatorPage() {
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
          style={{
            display: "inline-block",
            marginBottom: 20,
            color: "#0F1B2E",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← กลับ Agent Portal
        </Link>

        <h1 style={{ fontSize: 26, marginBottom: 8 }}>
          Insurance Calculator
        </h1>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 20,
            color: "#6B6455",
          }}
        >
          เครื่องมือคำนวณและจัดทำใบสรุปประกอบการเสนอขาย
          สำหรับตัวแทน Royal Partners
        </p>

        <iframe
          title="Royal Partners Insurance Calculator"
          src="/illustrations/royal_partners_illustration_tool.html"
          sandbox="allow-scripts allow-downloads"
          referrerPolicy="no-referrer"
          style={{
            display: "block",
            width: "100%",
            height: 1100,
            border: "1px solid #D9D2BF",
            background: "#FFFDF8",
          }}
        />
      </div>
    </main>
  );
}
