"use client";

import Link from "next/link";

export default function HomeButton() {
  return (
    <Link
      href="/"
      style={{
        display:
          "inline-flex",

        alignItems:
          "center",

        gap: 8,

        padding:
          "10px 14px",

        borderRadius: 10,

        border:
          "1px solid var(--gold)",

        color:
          "var(--gold)",

        background:
          "var(--surface)",

        textDecoration:
          "none",

        fontWeight: 700,

        fontSize: 14,
      }}
    >
      ← กลับหน้าหลัก
    </Link>
  );
}
