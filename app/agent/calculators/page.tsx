import Link from "next/link";
import CalculatorPdfDelivery from "./CalculatorPdfDelivery";

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


        <CalculatorPdfDelivery />
      </div>
    </main>
  );
}
