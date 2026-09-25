"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme =
  | "morning"
  | "night";

type FormCategory =
  | "ปีแรก"
  | "ปีต่อ"
  | "เคลม";

type FormItem = {
  id: string;
  name: string;
  description?: string;
  file: string;
  active: boolean;
  order: number;
  version?: string;
  categories: FormCategory[];
};

type CategoryItem = {
  id: FormCategory;
  icon: string;
  title: string;
  description: string;
};

const CATEGORIES: CategoryItem[] = [
  {
    id: "ปีแรก",
    icon: "🌱",
    title: "ปีแรก",
    description:
      "แบบฟอร์มและเอกสารสำหรับการสมัคร การพิจารณารับประกัน และการดำเนินงานในปีแรก",
  },
  {
    id: "ปีต่อ",
    icon: "🔄",
    title: "ปีต่อ",
    description:
      "แบบฟอร์มและเอกสารสำหรับการดูแลกรมธรรม์และการดำเนินงานในปีต่อ",
  },
  {
    id: "เคลม",
    icon: "🩺",
    title: "เคลม",
    description:
      "แบบฟอร์มและเอกสารสำหรับการเรียกร้องสินไหมและการเคลม",
  },
];

const FORMS: FormItem[] = [
  {
    id: "form-001",
    name: "W8BEN",
    description:
      "แบบฟอร์ม W-8BEN",
    file: "/forms/w8ben.pdf",
    active: true,
    order: 1,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-002",
    name: "W9",
    description:
      "แบบฟอร์ม W-9",
    file: "/forms/w9.pdf",
    active: true,
    order: 2,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-003",
    name: "ขอประวัติ",
    description:
      "แบบฟอร์มสำหรับขอประวัติ",
    file: "/forms/ขอประวัติ.pdf",
    active: true,
    order: 3,
    version: "2026-09",
    categories: [
      "ปีแรก",
      "เคลม",
    ],
  },

  {
    id: "form-004",
    name: "ขอเอกสารคืน",
    description:
      "แบบฟอร์มสำหรับขอเอกสารคืน",
    file: "/forms/ขอเอกสารคืน.pdf",
    active: true,
    order: 1,
    version: "2026-09",
    categories: ["เคลม"],
  },

  {
    id: "form-005",
    name: "ทำฟัน",
    description:
      "แบบฟอร์มสำหรับการเคลมค่ารักษาทางทันตกรรม",
    file: "/forms/ทำฟัน.pdf",
    active: true,
    order: 2,
    version: "2026-09",
    categories: ["เคลม"],
  },

  {
    id: "form-006",
    name: "ผู้ป่วยใน",
    description:
      "แบบฟอร์มสำหรับการเคลมผู้ป่วยใน",
    file: "/forms/ผู้ป่วยใน.pdf",
    active: true,
    order: 3,
    version: "2026-09",
    categories: ["เคลม"],
  },

  {
    id: "form-007",
    name: "หนังสือรับรองสุขภาพ",
    description:
      "หนังสือรับรองสุขภาพสำหรับประกอบเอกสาร",
    file: "/forms/หนังสือรับรองสุขภาพ.pdf",
    active: true,
    order: 1,
    version: "2026-09",
    categories: ["ปีต่อ"],
  },

  {
    id: "form-008",
    name: "เคลมผู้ป่วยนอก",
    description:
      "แบบฟอร์มสำหรับการเคลมผู้ป่วยนอก",
    file: "/forms/เคลมผู้ป่วยนอก.pdf",
    active: true,
    order: 4,
    version: "2026-09",
    categories: ["เคลม"],
  },

  {
    id: "form-009",
    name: "เรียกร้องเสียชีวิต (ตัวแทน)",
    description:
      "แบบฟอร์มสำหรับตัวแทน กรณีเรียกร้องสินไหมเสียชีวิต",
    file:
      "/forms/เรียกร้องเสียชีวิต (ตัวแทน).pdf",
    active: true,
    order: 5,
    version: "2026-09",
    categories: ["เคลม"],
  },

  {
    id: "form-010",
    name: "เรียกร้องเสียชีวิต (ลูกค้า)",
    description:
      "แบบฟอร์มสำหรับลูกค้า กรณีเรียกร้องสินไหมเสียชีวิต",
    file:
      "/forms/เรียกร้องเสียชีวิต (ลูกค้า).pdf",
    active: true,
    order: 6,
    version: "2026-09",
    categories: ["เคลม"],
  },

  {
    id: "form-011",
    name:
      "แบบตอบคำถามและวัดความดันโลหิตและชีพจร 3 ครั้ง",
    description:
      "แบบฟอร์มสำหรับบันทึกคำตอบ ความดันโลหิต และชีพจร 3 ครั้ง",
    file:
      "/forms/แบบตอบคำถามและวัดความดันโลหิตและชีพจร 3 ครั้ง.pdf",
    active: true,
    order: 4,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-012",
    name:
      "แบบสอบถามการดื่มเครื่องดื่มแอลกอฮอล์",
    description:
      "แบบสอบถามเกี่ยวกับการดื่มเครื่องดื่มแอลกอฮอล์",
    file:
      "/forms/แบบสอบถามการดื่มเครื่องดื่มแอลกอฮอล์.pdf",
    active: true,
    order: 5,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-013",
    name:
      "แบบสอบถามการผ่าตัดเกี่ยวกับเนื้องอก",
    description:
      "แบบสอบถามเกี่ยวกับประวัติการผ่าตัดเนื้องอก",
    file:
      "/forms/แบบสอบถามการผ่าตัดเกี่ยวกับเนื้องอก.pdf",
    active: true,
    order: 6,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-014",
    name:
      "แบบสอบถามการสูบบุหรี่",
    description:
      "แบบสอบถามเกี่ยวกับประวัติการสูบบุหรี่",
    file:
      "/forms/แบบสอบถามการสูบบุหรี่.pdf",
    active: true,
    order: 7,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-015",
    name:
      "แบบสอบถามการเจ็บหน้าอก",
    description:
      "แบบสอบถามเกี่ยวกับอาการเจ็บหน้าอก",
    file:
      "/forms/แบบสอบถามการเจ็บหน้าอก.pdf",
    active: true,
    order: 8,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-016",
    name:
      "แบบสอบถามการเลิกดื่มเครื่องดื่มแอลกอฮอล์",
    description:
      "แบบสอบถามเกี่ยวกับประวัติการเลิกดื่มเครื่องดื่มแอลกอฮอล์",
    file:
      "/forms/แบบสอบถามการเลิกดื่มเครื่องดื่มแอลกอฮอล์.pdf",
    active: true,
    order: 9,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-017",
    name:
      "แบบสอบถามความดันโลหิตสูง",
    description:
      "แบบสอบถามเกี่ยวกับภาวะความดันโลหิตสูง",
    file:
      "/forms/แบบสอบถามความดันโลหิตสูง.pdf",
    active: true,
    order: 10,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-018",
    name:
      "แบบสอบถามวงเงินสูง สำหรับ ประกันชีวิตบุคคลตำแหน่งสำคัญ (Keyman)",
    description:
      "แบบสอบถามวงเงินสูงสำหรับการประกันชีวิตบุคคลตำแหน่งสำคัญ",
    file:
      "/forms/แบบสอบถามวงเงินสูง สำหรับ ประกันชีวิตบุคคลตำแหน่งสำคัญ (Keyman).pdf",
    active: true,
    order: 11,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-019",
    name:
      "แบบสอบถามวงเงินสูง สำหรับ ผู้ขอเอาประกันทั่วไป",
    description:
      "แบบสอบถามวงเงินสูงสำหรับผู้ขอเอาประกันทั่วไป",
    file:
      "/forms/แบบสอบถามวงเงินสูง สำหรับ ผู้ขอเอาประกันทั่วไป.pdf",
    active: true,
    order: 12,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-020",
    name:
      "แบบสอบถามอุบัติเหตุ",
    description:
      "แบบสอบถามเกี่ยวกับประวัติหรือรายละเอียดอุบัติเหตุ",
    file:
      "/forms/แบบสอบถามอุบัติเหตุ.pdf",
    active: true,
    order: 13,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-021",
    name:
      "แบบสอบถามเกี่ยวกับกรมธรรม์เดิม",
    description:
      "แบบสอบถามข้อมูลเกี่ยวกับกรมธรรม์เดิม",
    file:
      "/forms/แบบสอบถามเกี่ยวกับกรมธรรม์เดิม.pdf",
    active: true,
    order: 14,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-022",
    name:
      "แบบสอบถามเกี่ยวกับการตรวจร่างกาย",
    description:
      "แบบสอบถามเกี่ยวกับประวัติการตรวจร่างกาย",
    file:
      "/forms/แบบสอบถามเกี่ยวกับการตรวจร่างกาย.pdf",
    active: true,
    order: 15,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-023",
    name:
      "แบบสอบถามโรคกระเพาะอาหาร",
    description:
      "แบบสอบถามเกี่ยวกับโรคกระเพาะอาหาร",
    file:
      "/forms/แบบสอบถามโรคกระเพาะอาหาร.pdf",
    active: true,
    order: 16,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-024",
    name:
      "แบบสอบถามโรคภูมิแพ้",
    description:
      "แบบสอบถามเกี่ยวกับโรคภูมิแพ้",
    file:
      "/forms/แบบสอบถามโรคภูมิแพ้.pdf",
    active: true,
    order: 17,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-025",
    name:
      "แบบสอบถามโรคลมชัก",
    description:
      "แบบสอบถามเกี่ยวกับโรคลมชัก",
    file:
      "/forms/แบบสอบถามโรคลมชัก.pdf",
    active: true,
    order: 18,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-026",
    name:
      "แบบสอบถามโรคหอบหืด",
    description:
      "แบบสอบถามเกี่ยวกับโรคหอบหืด",
    file:
      "/forms/แบบสอบถามโรคหอบหืด.pdf",
    active: true,
    order: 19,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-027",
    name:
      "แบบสอบถามโรคเบาหวาน",
    description:
      "แบบสอบถามเกี่ยวกับโรคเบาหวาน",
    file:
      "/forms/แบบสอบถามโรคเบาหวาน.pdf",
    active: true,
    order: 20,
    version: "2026-09",
    categories: ["ปีแรก"],
  },

  {
    id: "form-028",
    name: "ใบปะหน้าเคลม",
    description:
      "ใบปะหน้าสำหรับเอกสารเคลม",
    file:
      "/forms/ใบปะหน้าเคลม.pdf",
    active: true,
    order: 7,
    version: "2026-09",
    categories: ["เคลม"],
  },
];

export default function AgentFormsPage() {
  const [theme, setTheme] =
    useState<Theme>("night");

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "agent-dev-theme"
      ) as Theme | null;

    if (
      saved === "morning" ||
      saved === "night"
    ) {
      setTheme(saved);
    }
  }, []);

  function changeTheme(
    nextTheme: Theme
  ) {
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

  const activeForms =
    useMemo(() => {
      return FORMS.filter(
        (form) => form.active
      );
    }, []);

  function getFormsByCategory(
    category: FormCategory
  ) {
    return activeForms
      .filter((form) =>
        form.categories.includes(
          category
        )
      )
      .sort(
        (a, b) =>
          a.order - b.order
      );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          colors.background,
        color: colors.text,
        transition:
          "background .25s ease, color .25s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1100,
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
            marginBottom: 34,
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
                  "clamp(34px, 6vw, 54px)",
                lineHeight: 1.05,
                letterSpacing:
                  "-1px",
              }}
            >
              แบบฟอร์มเอกสาร
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
              รวมแบบฟอร์ม PDF
              สำหรับใช้งานของตัวแทน
              Royal Partner
            </p>
          </div>

          {/* THEME SWITCH */}

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
                borderRadius: 999,
                padding:
                  "9px 14px",
                cursor: "pointer",
                fontWeight: 700,

                background:
                  isMorning
                    ? colors.gold
                    : "transparent",

                color: isMorning
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
                borderRadius: 999,
                padding:
                  "9px 14px",
                cursor: "pointer",
                fontWeight: 700,

                background:
                  !isMorning
                    ? colors.gold
                    : "transparent",

                color: !isMorning
                  ? "#18120A"
                  : colors.muted,
              }}
            >
              🌙 กลางคืน
            </button>
          </div>
        </header>

        {/* BACK */}

        <a
          href="/agent"
          style={{
            display:
              "inline-flex",
            alignItems:
              "center",
            gap: 8,
            marginBottom: 24,
            textDecoration:
              "none",
            color: colors.gold,
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          ← กลับ Agent Portal
        </a>

        {/* INTRO */}

        <section
          style={{
            padding:
              "20px 22px",
            borderRadius: 18,
            border:
              `1px solid ${colors.border}`,
            background:
              colors.softGold,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              color:
                colors.gold,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.5,
              marginBottom: 7,
            }}
          >
            DOCUMENT FORMS
          </div>

          <div
            style={{
              fontSize: 19,
              fontWeight: 800,
              marginBottom: 6,
            }}
          >
            เลือกหมวดหมู่และแบบฟอร์มที่ต้องการใช้งาน
          </div>

          <div
            style={{
              color:
                colors.muted,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            แบบฟอร์มแบ่งเป็น
            ปีแรก ปีต่อ และเคลม
            สามารถเปิดดู PDF
            หรือดาวน์โหลดเก็บไว้ใช้งานได้ทันที
          </div>
        </section>

        {/* CATEGORY SECTIONS */}

        {CATEGORIES.map(
          (category) => {
            const categoryForms =
              getFormsByCategory(
                category.id
              );

            if (
              categoryForms.length ===
              0
            ) {
              return null;
            }

            return (
              <section
                key={category.id}
                style={{
                  marginBottom: 48,
                }}
              >
                {/* CATEGORY HEADER */}

                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                    gap: 16,
                    flexWrap:
                      "wrap",
                    marginBottom: 20,
                    paddingBottom: 14,
                    borderBottom:
                      `1px solid ${colors.border}`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 10,
                        marginBottom: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 25,
                        }}
                      >
                        {
                          category.icon
                        }
                      </span>

                      <h2
                        style={{
                          margin: 0,
                          fontSize: 27,
                          lineHeight: 1.2,
                        }}
                      >
                        {
                          category.title
                        }
                      </h2>
                    </div>

                    <div
                      style={{
                        color:
                          colors.muted,
                        fontSize: 13,
                        lineHeight: 1.6,
                      }}
                    >
                      {
                        category.description
                      }
                    </div>
                  </div>

                  <div
                    style={{
                      padding:
                        "7px 12px",
                      borderRadius:
                        999,
                      background:
                        colors.softGold,
                      color:
                        colors.gold,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {
                      categoryForms.length
                    }{" "}
                    แบบฟอร์ม
                  </div>
                </div>

                {/* CARDS */}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 18,
                  }}
                >
                  {categoryForms.map(
                    (form) => (
                      <div
                        key={`${category.id}-${form.id}`}
                        style={{
                          background:
                            colors.card,

                          border:
                            `1px solid ${colors.border}`,

                          borderRadius:
                            20,

                          padding: 24,

                          minHeight:
                            220,

                          display:
                            "flex",

                          flexDirection:
                            "column",

                          boxShadow:
                            isMorning
                              ? "0 12px 30px rgba(74,55,30,.06)"
                              : "0 14px 30px rgba(0,0,0,.12)",
                        }}
                      >
                        {/* ICON */}

                        <div
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius:
                              16,

                            background:
                              colors.softGold,

                            display:
                              "flex",

                            alignItems:
                              "center",

                            justifyContent:
                              "center",

                            fontSize: 28,
                            marginBottom:
                              20,
                          }}
                        >
                          📄
                        </div>

                        {/* TITLE */}

                        <div
                          style={{
                            fontSize: 20,
                            fontWeight:
                              800,
                            lineHeight:
                              1.4,
                            marginBottom:
                              9,
                          }}
                        >
                          {
                            form.name
                          }
                        </div>

                        {/* DESCRIPTION */}

                        {form.description && (
                          <div
                            style={{
                              color:
                                colors.muted,

                              fontSize:
                                14,
                              lineHeight:
                                1.6,
                              marginBottom:
                                12,
                            }}
                          >
                            {
                              form.description
                            }
                          </div>
                        )}

                        {/* VERSION */}

                        {form.version && (
                          <div
                            style={{
                              color:
                                colors.muted,

                              fontSize:
                                11,
                              marginBottom:
                                20,
                            }}
                          >
                            Version:{" "}
                            {
                              form.version
                            }
                          </div>
                        )}

                        {/* ACTIONS */}

                        <div
                          style={{
                            display:
                              "flex",
                            gap: 10,
                            flexWrap:
                              "wrap",
                            marginTop:
                              "auto",
                          }}
                        >
                          <a
                            href={
                              form.file
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              flex: 1,
                              minWidth:
                                110,

                              textAlign:
                                "center",

                              textDecoration:
                                "none",

                              background:
                                colors.gold,

                              color:
                                "#18120A",

                              padding:
                                "11px 14px",

                              borderRadius:
                                12,

                              fontSize:
                                13,

                              fontWeight:
                                800,
                            }}
                          >
                            เปิดดู PDF
                          </a>

                          <a
                            href={
                              form.file
                            }
                            download
                            style={{
                              flex: 1,
                              minWidth:
                                110,

                              textAlign:
                                "center",

                              textDecoration:
                                "none",

                              background:
                                "transparent",

                              color:
                                colors.gold,

                              border:
                                `1px solid ${colors.gold}`,

                              padding:
                                "10px 14px",

                              borderRadius:
                                12,

                              fontSize:
                                13,

                              fontWeight:
                                800,
                            }}
                          >
                            ดาวน์โหลด
                          </a>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </section>
            );
          }
        )}

        {/* EMPTY */}

        {activeForms.length ===
          0 && (
          <div
            style={{
              marginTop: 20,
              padding: 30,
              textAlign:
                "center",
              border:
                `1px solid ${colors.border}`,
              borderRadius: 18,
              color:
                colors.muted,
              background:
                colors.card,
            }}
          >
            ยังไม่มีแบบฟอร์มที่เปิดใช้งาน
          </div>
        )}

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
          Document Forms
        </footer>
      </div>
    </main>
  );
}
