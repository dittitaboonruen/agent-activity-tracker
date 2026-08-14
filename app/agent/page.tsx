"use client";

import { useEffect, useState } from "react";

type Theme = "morning" | "night";

const ACTIVITY_FORM_URL =
  "https://form.jotform.com/262221782679061";

export default function AgentPortalPage() {
  const [theme, setTheme] =
    useState<Theme>("night");

  useEffect(() => {
    const saved = localStorage.getItem(
      "agent-dev-theme"
    ) as Theme | null;

    if (
      saved === "morning" ||
      saved === "night"
    ) {
      setTheme(saved);
    }
  }, []);

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);

    localStorage.setItem(
      "agent-dev-theme",
      nextTheme
    );

    document.documentElement.setAttribute(
      "data-rp-theme",
      nextTheme
    );
  }

  const isMorning =
    theme === "morning";

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
      ? "rgba(201,162,75,0.10)"
      : "rgba(201,162,75,0.07)",
  };

  const cards = [
    {
      icon: "🎯",
      title: "Annual Target 2569",
      description:
        "ตั้งเป้าหมาย FYP / FYC / CASE ประจำปี",
      href: "/annual-target",
      external: false,
    },

    {
      icon: "📝",
      title: "Activity Form",
      description:
        "บันทึกกิจกรรมตัวแทนประจำวัน",
      href: ACTIVITY_FORM_URL,
      external: true,
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",

        background:
          colors.background,

        color:
          colors.text,

        transition:
          "background .25s ease, color .25s ease",
      }}
    >
      <div
        style={{
          width: "100%",

          maxWidth: 900,

          margin: "0 auto",

          padding:
            "34px 22px 70px",
        }}
      >
        {/* HEADER */}
        <header
          style={{
            display: "flex",

            justifyContent:
              "space-between",

            alignItems:
              "flex-start",

            gap: 24,

            flexWrap: "wrap",

            marginBottom: 44,
          }}
        >
          <div>
            <div
              style={{
                color:
                  colors.gold,

                fontSize: 12,

                fontWeight: 800,

                letterSpacing: 2.5,

                marginBottom: 10,
              }}
            >
              ROYAL PARTNER
            </div>

            <h1
              style={{
                margin: 0,

                fontSize:
                  "clamp(36px, 6vw, 56px)",

                lineHeight: 1.05,

                letterSpacing:
                  "-1px",
              }}
            >
              Agent Portal
            </h1>

            <p
              style={{
                marginTop: 12,

                marginBottom: 0,

                color:
                  colors.muted,

                fontSize: 16,

                lineHeight: 1.6,
              }}
            >
              เครื่องมือสำหรับตัวแทน
              Royal Partner
            </p>
          </div>

          {/* THEME */}
          <div
            style={{
              display: "flex",

              gap: 4,

              padding: 5,

              borderRadius: 999,

              background:
                colors.card,

              border:
                `1px solid ${colors.border}`,
            }}
          >
            <button
              type="button"

              onClick={() =>
                changeTheme(
                  "morning"
                )
              }

              style={{
                border: 0,

                borderRadius:
                  999,

                padding:
                  "9px 14px",

                cursor:
                  "pointer",

                fontWeight:
                  700,

                background:
                  isMorning
                    ? colors.gold
                    : "transparent",

                color:
                  isMorning
                    ? "#18120A"
                    : colors.muted,
              }}
            >
              ☀️ เช้า
            </button>

            <button
              type="button"

              onClick={() =>
                changeTheme(
                  "night"
                )
              }

              style={{
                border: 0,

                borderRadius:
                  999,

                padding:
                  "9px 14px",

                cursor:
                  "pointer",

                fontWeight:
                  700,

                background:
                  !isMorning
                    ? colors.gold
                    : "transparent",

                color:
                  !isMorning
                    ? "#18120A"
                    : colors.muted,
              }}
            >
              🌙 กลางคืน
            </button>
          </div>
        </header>

        {/* INTRO */}
        <section
          style={{
            padding:
              "22px 24px",

            borderRadius: 18,

            border:
              `1px solid ${colors.border}`,

            background:
              colors.softGold,

            marginBottom: 26,
          }}
        >
          <div
            style={{
              color:
                colors.gold,

              fontSize: 11,

              fontWeight: 800,

              letterSpacing: 1.6,

              marginBottom: 7,
            }}
          >
            AGENT TOOLS
          </div>

          <div
            style={{
              fontSize: 20,

              fontWeight: 800,

              marginBottom: 7,
            }}
          >
            เริ่มต้นใช้งานได้จาก 2 เมนูด้านล่าง
          </div>

          <div
            style={{
              color:
                colors.muted,

              fontSize: 14,

              lineHeight: 1.6,
            }}
          >
            ตั้งเป้าหมายประจำปี
            และบันทึกกิจกรรมประจำวัน
          </div>
        </section>

        {/* CARDS */}
        <div
          style={{
            display: "grid",

            gridTemplateColumns:
              "repeat(auto-fit, minmax(260px, 1fr))",

            gap: 18,
          }}
        >
          {cards.map(
            (card) => (
              <a
                key={card.title}

                href={card.href}

                target={
                  card.external
                    ? "_blank"
                    : undefined
                }

                rel={
                  card.external
                    ? "noopener noreferrer"
                    : undefined
                }

                style={{
                  textDecoration:
                    "none",

                  color:
                    colors.text,

                  background:
                    colors.card,

                  border:
                    `1px solid ${colors.border}`,

                  borderRadius: 20,

                  padding: 24,

                  minHeight: 220,

                  display: "flex",

                  flexDirection:
                    "column",

                  boxShadow:
                    isMorning
                      ? "0 12px 30px rgba(74,55,30,.06)"
                      : "0 14px 30px rgba(0,0,0,.12)",
                }}
              >
                <div
                  style={{
                    width: 56,

                    height: 56,

                    borderRadius: 16,

                    background:
                      colors.softGold,

                    display:
                      "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "center",

                    fontSize: 28,

                    marginBottom: 22,
                  }}
                >
                  {card.icon}
                </div>

                <div
                  style={{
                    fontSize: 22,

                    fontWeight: 800,

                    marginBottom: 9,
                  }}
                >
                  {card.title}
                </div>

                <div
                  style={{
                    color:
                      colors.muted,

                    fontSize: 14,

                    lineHeight: 1.6,
                  }}
                >
                  {
                    card.description
                  }
                </div>

                <div
                  style={{
                    marginTop:
                      "auto",

                    paddingTop: 24,

                    color:
                      colors.gold,

                    fontSize: 13,

                    fontWeight: 800,
                  }}
                >
                  เปิดใช้งาน →
                </div>
              </a>
            )
          )}
        </div>

        {/* FOOTER */}
        <footer
          style={{
            marginTop: 46,

            textAlign:
              "center",

            color:
              colors.muted,

            fontSize: 12,

            lineHeight: 1.6,
          }}
        >
          Royal Partner ·
          Agent Portal
        </footer>
      </div>
    </main>
  );
}
