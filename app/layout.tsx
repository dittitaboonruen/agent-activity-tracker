import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Activity Tracker | แดชบอร์ดผลงานตัวแทน",
  description: "แดชบอร์ดผลงานตัวแทนประกันภัย เชื่อมต่อข้อมูลจาก Jotform แบบเรียลไทม์ สำหรับผู้บริหาร",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" style={{ backgroundColor: "#0A0908" }}>
      <body style={{ margin: 0, backgroundColor: "#0A0908" }}>{children}</body>
    </html>
  );
}
