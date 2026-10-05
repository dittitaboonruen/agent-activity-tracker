import Link from "next/link";
import SkoolCsvImport from "@/components/SkoolCsvImport";

export default function SkoolImportPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "28px 18px 60px", background: "var(--rp-page-gradient), var(--bg)", color: "var(--cream)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <nav style={{ display: "flex", gap: 20, marginBottom: 24 }}>
          <Link href="/" style={{ color: "var(--gold-bright)" }}>← หน้าหลัก</Link>
          <Link href="/admin/skool-courses" style={{ color: "var(--gold-bright)" }}>จัดการคอร์สและบทเรียน</Link>
        </nav>
        <h1>Import Skool Progress</h1>
        <SkoolCsvImport />
      </div>
    </main>
  );
}
