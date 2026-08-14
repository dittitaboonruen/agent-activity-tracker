"use client";

import { useEffect, useState } from "react";

type Theme = "morning" | "night";

const modules = [
  {
    icon: "📝",
    title: "Activity Form",
    description: "บันทึกกิจกรรมตัวแทนประจำวัน",
    href: "https://form.jotform.com/262221782679061",
    external: true,
    status: "พร้อมใช้งาน",
  },
  {
    icon: "🎯",
    title: "Annual Target",
    description: "กำหนด Target FYP / FYC / CASE ประจำปี",
    href: "/annual-target",
    external: false,
    status: "พร้อมใช้งาน",
  },
  {
    icon: "📥",
    title: "Daily Production",
    description: "Admin บันทึกผลงานนำส่งและอนุมัติประจำวัน",
    href: "/admin/production",
    external: false,
    status: "พร้อมใช้งาน",
  },
  {
    icon: "📊",
    title: "Activity Dashboard",
    description: "ติดตามกิจกรรม ผลงานตัวแทน และ PEP",
    href: "/dashboard/activity",
    external: false,
    status: "พร้อมใช้งาน",
  },
  {
    icon: "📈",
    title: "Monthly Performance",
    description: "สรุป Production รายเดือน YTD และเทียบ Annual Target",
    href: "/dashboard/performance",
    external: false,
    status: "พร้อมใช้งาน",
  },
  {
    icon: "👥",
    title: "Agent Master",
    description: "จัดการ Code / Name / Nick Name ของตัวแทน",
    href: "/admin/agents",
    external: false,
    status: "Admin",
  },
];

export default function AgentDevHome() {
  const [theme, setTheme] = useState<Theme>("night");

  useEffect(() => {
    const saved = localStorage.getItem(
      "agent-dev-theme"
    ) as Theme | null;

    if (saved === "morning" || saved === "night") {
      setTheme(saved);
    }
  }, []);

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    localStorage.setItem(
      "agent-dev-theme",
      nextTheme
    );
  }

  const isMorning = theme === "morning";

  const colors = {
    background: isMorning
      ? "#F5EFE4"
      : "#0D0B08",

    card: isMorning
      ? "#FFFDF8"
      : "#17130E",

    text: isMorning
      ? "#2C241A"
      : "#F4E8D0",

    muted: isMorning
      ? "#756A5A"
      : "#A89B86",

    gold: "#C9A24B",

    border: isMorning
      ? "#E3D3B2"
      : "#4A3B1E",

    softGold: isMorning
      ? "rgba(201,162,75,0.12)"
      : "rgba(201,162,75,0.08)",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: colors.background,
        color: colors.text,
        transition: "all 0.25s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "36px 22px 60px",
        }}
      >
        {/* HEADER */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            flexWrap: "wrap",
            marginBottom: 46,
          }}
        >
          <div>
            <div
              style={{
                color: colors.gold,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 2.4,
                marginBottom: 10,
              }}
            >
              ROYAL PARTNER
            </div>

            <h1
              style={{
                margin: 0,
                fontSize:
                  "clamp(32px, 5vw, 52px)",
                lineHeight: 1.05,
              }}
            >
              Agent Dev
            </h1>

            <p
              style={{
                marginTop: 12,
                marginBottom: 0,
                color: colors.muted,
                fontSize: 16,
              }}
            >
              Agent Development & Performance
              System
            </p>
          </div>

          {/* THEME */}
          <div
            style={{
              display: "flex",
              padding: 5,
              gap: 4,
              borderRadius: 999,
              border: `1px solid ${colors.border}`,
              background: colors.card,
            }}
          >
            <button
              type="button"
              onClick={() =>
                changeTheme("morning")
              }
              style={{
                border: 0,
                cursor: "pointer",
                borderRadius: 999,
                padding: "9px 14px",
                background: isMorning
                  ? colors.gold
                  : "transparent",
                color: isMorning
                  ? "#18120A"
                  : colors.muted,
                fontWeight: 700,
              }}
            >
              ☀️ เช้า
            </button>

            <button
              type="button"
              onClick={() =>
                changeTheme("night")
              }
              style={{
                border: 0,
                cursor: "pointer",
                borderRadius: 999,
                padding: "9px 14px",
                background: !isMorning
                  ? colors.gold
                  : "transparent",
                color: !isMorning
                  ? "#18120A"
                  : colors.muted,
                fontWeight: 700,
              }}
            >
              🌙 กลางคืน
            </button>
          </div>
        </header>

        {/* WELCOME */}
        <section
          style={{
            padding: "24px 26px",
            border: `1px solid ${colors.border}`,
            borderRadius: 20,
            background: colors.softGold,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: colors.gold,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            AGENT DEVELOPMENT HUB
          </div>

          <div
            style={{
              fontSize: 21,
              fontWeight: 700,
            }}
          >
            ทุกเครื่องมือสำหรับติดตามการเติบโตของตัวแทน
          </div>

          <div
            style={{
              marginTop: 7,
              color: colors.muted,
              lineHeight: 1.6,
            }}
          >
            ตั้งเป้าหมาย · บันทึกกิจกรรม ·
            ติดตาม Production · วิเคราะห์ผลงาน ·
            PEP
          </div>
        </section>

        {/* MODULES */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 16,
          }}
        >
          {modules.map((module) => {
            const isAdmin =
              module.status === "Admin";

            return (
              <a
                key={module.title}
                href={module.href}
                target={
                  module.external
                    ? "_blank"
                    : undefined
                }
                rel={
                  module.external
                    ? "noopener noreferrer"
                    : undefined
                }
                style={{
                  textDecoration: "none",
                  color: colors.text,
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 20,
                  padding: 22,
                  minHeight: 195,
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    gap: 12,
                    marginBottom: 22,
                  }}
                >
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 14,
                      background:
                        colors.softGold,
                      display: "flex",
                      alignItems: "center",
                      justifyContent:
                        "center",
                      fontSize: 25,
                    }}
                  >
                    {module.icon}
                  </div>

                  <div
                    style={{
                      height: "fit-content",
                      padding: "5px 9px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      color: isAdmin
                        ? colors.muted
                        : colors.gold,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    {module.status}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 750,
                    marginBottom: 8,
                  }}
                >
                  {module.title}
                </div>

                <div
                  style={{
                    color: colors.muted,
                    fontSize: 14,
                    lineHeight: 1.55,
                  }}
                >
                  {module.description}
                </div>

                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 18,
                    color: colors.gold,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  เปิดระบบ →
                </div>
              </a>
            );
          })}
        </div>

        <footer
          style={{
            textAlign: "center",
            color: colors.muted,
            fontSize: 12,
            marginTop: 50,
          }}
        >
          Royal Partner · Agent Development
          System
        </footer>
      </div>
    </main>
  );
}
