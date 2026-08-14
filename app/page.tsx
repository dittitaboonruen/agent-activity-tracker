"use client";

import { useEffect, useState } from "react";

type Theme = "morning" | "night";

type ModuleItem = {
  icon: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  badge?: string;
};

type ModuleSection = {
  number: string;
  title: string;
  description: string;
  items: ModuleItem[];
};

const sections: ModuleSection[] = [
  {
    number: "01",
    title: "ACTIVITY",
    description: "วิเคราะห์กิจกรรมและติดตามการทำงานของตัวแทน",
    items: [
      {
        icon: "📊",
        title: "Activity Dashboard",
        description: "วิเคราะห์กิจกรรมและติดตามการทำงานของตัวแทน",
        href: "/dashboard/activity",
        badge: "Manager",
      },
    ],
  },

  {
    number: "02",
    title: "PERFORMANCE",
    description: "Production และผลงานรายเดือน",
    items: [
      {
        icon: "📥",
        title: "Daily Production",
        description: "บันทึกผลงานนำส่งและอนุมัติประจำวัน",
        href: "/admin/production",
        badge: "พร้อมใช้งาน",
      },
      {
        icon: "📈",
        title: "Monthly Performance",
        description: "สรุปผลงานรายเดือน · YTD",
        href: "/dashboard/performance",
        badge: "พร้อมใช้งาน",
      },
    ],
  },

  {
    number: "03",
    title: "ADMIN",
    description: "ข้อมูลหลักสำหรับการใช้งานระบบ",
    items: [
      {
        icon: "👥",
        title: "Agent Master",
        description: "จัดการ Code / Name / Nick Name ของตัวแทน",
        href: "/admin/agents",
        badge: "Admin",
      },
    ],
  },
];

export default function PerformanceHubHome() {
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

    document.documentElement.setAttribute(
      "data-rp-theme",
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
      ? "rgba(201,162,75,0.10)"
      : "rgba(201,162,75,0.07)",

    sectionBackground: isMorning
      ? "rgba(255,255,255,0.35)"
      : "rgba(255,255,255,0.015)",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: colors.background,
        color: colors.text,

        transition:
          "background 0.25s ease, color 0.25s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "34px 22px 70px",
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

            marginBottom: 42,
          }}
        >
          <div>
            <div
              style={{
                color: colors.gold,

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
                  "clamp(34px, 5vw, 54px)",

                lineHeight: 1.05,

                letterSpacing:
                  "-1px",
              }}
            >
              Performance Hub
            </h1>

            <p
              style={{
                marginTop: 12,

                marginBottom: 0,

                color:
                  colors.muted,

                fontSize: 16,
              }}
            >
              Agent Activity · Production · Performance · Development
            </p>

            <div
              style={{
                marginTop: 9,

                color:
                  colors.gold,

                fontSize: 12,

                fontWeight: 700,

                letterSpacing: 0.5,
              }}
            >
              Royal Partner Agent Performance
            </div>
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

            marginBottom: 34,
          }}
        >
          <div
            style={{
              color:
                colors.gold,

              fontSize: 12,

              fontWeight: 800,

              letterSpacing: 1.2,

              marginBottom: 7,
            }}
          >
            ROYAL PARTNER AGENT PERFORMANCE
          </div>

          <div
            style={{
              fontSize: 20,

              fontWeight: 750,

              marginBottom: 6,
            }}
          >
            ศูนย์กลางสำหรับติดตามกิจกรรมและผลงานของตัวแทน
          </div>

          <div
            style={{
              color:
                colors.muted,

              fontSize: 14,

              lineHeight: 1.6,
            }}
          >
            ติดตามกิจกรรม · Production · วิเคราะห์ผลงาน · จัดการข้อมูลตัวแทน
          </div>
        </section>

        {/* SECTIONS */}
        <div
          style={{
            display: "flex",

            flexDirection:
              "column",

            gap: 34,
          }}
        >
          {sections.map(
            (section) => (
              <section
                key={
                  section.title
                }

                style={{
                  padding: "22px",

                  borderRadius:
                    20,

                  border:
                    `1px solid ${colors.border}`,

                  background:
                    colors.sectionBackground,
                }}
              >
                {/* SECTION HEADER */}
                <div
                  style={{
                    display:
                      "flex",

                    alignItems:
                      "flex-start",

                    gap: 14,

                    marginBottom:
                      18,
                  }}
                >
                  <div
                    style={{
                      width: 44,

                      height: 44,

                      borderRadius:
                        12,

                      background:
                        colors.softGold,

                      border:
                        `1px solid ${colors.border}`,

                      display:
                        "flex",

                      alignItems:
                        "center",

                      justifyContent:
                        "center",

                      color:
                        colors.gold,

                      fontWeight:
                        800,

                      fontSize: 14,

                      flexShrink:
                        0,
                    }}
                  >
                    {
                      section.number
                    }
                  </div>

                  <div>
                    <div
                      style={{
                        color:
                          colors.gold,

                        fontSize:
                          14,

                        fontWeight:
                          800,

                        letterSpacing:
                          1.3,
                      }}
                    >
                      {
                        section.title
                      }
                    </div>

                    <div
                      style={{
                        marginTop:
                          5,

                        color:
                          colors.muted,

                        fontSize:
                          13,
                      }}
                    >
                      {
                        section.description
                      }
                    </div>
                  </div>
                </div>

                {/* CARDS */}
                <div
                  style={{
                    display:
                      "grid",

                    gridTemplateColumns:
                      section.items.length ===
                      1
                        ? "minmax(250px, 340px)"
                        : "repeat(auto-fit, minmax(250px, 1fr))",

                    gap: 15,
                  }}
                >
                  {section.items.map(
                    (item) => (
                      <a
                        key={
                          item.title
                        }

                        href={
                          item.href
                        }

                        target={
                          item.external
                            ? "_blank"
                            : undefined
                        }

                        rel={
                          item.external
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

                          borderRadius:
                            17,

                          padding:
                            20,

                          minHeight:
                            170,

                          display:
                            "flex",

                          flexDirection:
                            "column",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",

                            justifyContent:
                              "space-between",

                            gap: 12,

                            marginBottom:
                              18,
                          }}
                        >
                          <div
                            style={{
                              width:
                                48,

                              height:
                                48,

                              borderRadius:
                                13,

                              background:
                                colors.softGold,

                              display:
                                "flex",

                              alignItems:
                                "center",

                              justifyContent:
                                "center",

                              fontSize:
                                24,
                            }}
                          >
                            {
                              item.icon
                            }
                          </div>

                          {item.badge && (
                            <div
                              style={{
                                height:
                                  "fit-content",

                                borderRadius:
                                  999,

                                border:
                                  `1px solid ${colors.border}`,

                                padding:
                                  "5px 9px",

                                fontSize:
                                  10,

                                fontWeight:
                                  700,

                                color:
                                  item.badge ===
                                  "Admin"
                                    ? colors.muted
                                    : colors.gold,
                              }}
                            >
                              {
                                item.badge
                              }
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            fontSize:
                              19,

                            fontWeight:
                              800,

                            marginBottom:
                              8,
                          }}
                        >
                          {
                            item.title
                          }
                        </div>

                        <div
                          style={{
                            color:
                              colors.muted,

                            fontSize:
                              13,

                            lineHeight:
                              1.55,
                          }}
                        >
                          {
                            item.description
                          }
                        </div>

                        <div
                          style={{
                            marginTop:
                              "auto",

                            paddingTop:
                              17,

                            color:
                              colors.gold,

                            fontSize:
                              12,

                            fontWeight:
                              800,
                          }}
                        >
                          เปิดระบบ →
                        </div>
                      </a>
                    )
                  )}
                </div>
              </section>
            )
          )}
        </div>

        <footer
          style={{
            marginTop: 46,

            textAlign:
              "center",

            color:
              colors.muted,

            fontSize: 12,
          }}
        >
          Royal Partner · Agent Performance System
        </footer>
      </div>
    </main>
  );
}
