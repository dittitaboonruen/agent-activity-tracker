"use client";

import Link from "next/link";

export default function HomeButton() {
  return (
    <Link
      href="/"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #C9A24B",
        color: "#C9A24B",
        textDecoration: "none",
        fontWeight: 700,
        fontSize: 14,
        marginBottom: 20,
      }}
    >
      ← กลับหน้าหลัก
    </Link>
  );
}
