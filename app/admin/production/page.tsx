"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import HomeButton from "@/components/HomeButton";

type AgentMaster = {
  id?: number;

  agent_code:
    | string
    | null;

  agent_name: string;

  agent_nickname:
    | string
    | null;
};

type SavedProduction = {
  production_date: string;

  agent_code:
    | string
    | null;

  agent_name: string;

  agent_nickname:
    | string
    | null;

  aia_case_submitted:
    number;

  aia_case_approved:
    number;

  aia_fyp_submitted:
    number;

  aia_fyp_approved:
    number;

  aia_fyc_approved:
    number;

  pa_case: number;

  pa_fyp: number;

  pa_fyc: number;

  note:
    | string
    | null;
};

type ProductionRow = {
  agentCode: string;

  agentName: string;

  agentNickname: string;

  aiaCaseSubmitted:
    string;

  aiaCaseApproved:
    string;

  aiaFypSubmitted:
    string;

  aiaFypApproved:
    string;

  aiaFycApproved:
    string;

  paCase: string;

  paFyp: string;

  paFyc: string;

  note: string;
};

function todayBangkok() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Bangkok",

      year: "numeric",

      month: "2-digit",

      day: "2-digit",
    }
  ).format(
    new Date()
  );
}

function valueOrBlank(
  value: unknown
) {
  const number =
    Number(value ?? 0);

  if (!number) {
    return "";
  }

  return String(number);
}

function moneyOrBlank(
  value: unknown
) {
  const number =
    Number(value ?? 0);

  if (!number) {
    return "";
  }

  return number.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 2,
    }
  );
}

function parseNumber(
  value: string
) {
  const cleaned =
    value
      .replace(
        /,/g,
        ""
      )
      .trim();

  if (!cleaned) {
    return 0;
  }

  return Number(
    cleaned
  );
}

function formatMoneyInput(
  value: string
) {
  const cleaned =
    value.replace(
      /,/g,
      ""
    );

  if (!cleaned) {
    return "";
  }

  const [
    integerPart,
    decimalPart,
  ] = cleaned.split(".");

  const formattedInteger =
    integerPart
      .replace(
        /\D/g,
        ""
      )
      .replace(
        /\B(?=(\d{3})+(?!\d))/g,
        ","
      );

  if (
    decimalPart !==
    undefined
  ) {
    return `${formattedInteger}.${decimalPart.replace(
      /\D/g,
      ""
    )}`;
  }

  return formattedInteger;
}

function createRowFromAgent(
  agent: AgentMaster,
  saved?: SavedProduction
): ProductionRow {
  return {
    agentCode:
      saved?.agent_code ??
      agent.agent_code ??
      "",

    agentName:
      saved?.agent_name ??
      agent.agent_name ??
      "",

    agentNickname:
      saved?.agent_nickname ??
      agent.agent_nickname ??
      "",

    aiaCaseSubmitted:
      valueOrBlank(
        saved?.aia_case_submitted
      ),

    aiaCaseApproved:
      valueOrBlank(
        saved?.aia_case_approved
      ),

    aiaFypSubmitted:
      moneyOrBlank(
        saved?.aia_fyp_submitted
      ),

    aiaFypApproved:
      moneyOrBlank(
        saved?.aia_fyp_approved
      ),

    aiaFycApproved:
      moneyOrBlank(
        saved?.aia_fyc_approved
      ),

    paCase:
      valueOrBlank(
        saved?.pa_case
      ),

    paFyp:
      moneyOrBlank(
        saved?.pa_fyp
      ),

    paFyc:
      moneyOrBlank(
        saved?.pa_fyc
      ),

    note:
      saved?.note ?? "",
  };
}

export default function DailyProductionPage() {
  const [
    productionDate,
    setProductionDate,
  ] = useState(
    todayBangkok()
  );

  const [
    savedRows,
    setSavedRows,
  ] = useState<
    SavedProduction[]
  >([]);

  const [
    rows,
    setRows,
  ] = useState<
    ProductionRow[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingData,
    setLoadingData,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    status,
    setStatus,
  ] = useState("");

  async function loadPageData(
    date: string
  ) {
    setLoadingData(true);
    setStatus("");

    try {
      const [
        agentResponse,
        productionResponse,
      ] =
        await Promise.all([
          fetch(
            "/api/agent-master",
            {
              cache:
                "no-store",
            }
          ),

          fetch(
            `/api/daily-production?date=${encodeURIComponent(
              date
            )}`,
            {
              cache:
                "no-store",
            }
          ),
        ]);

      const agentData =
        await agentResponse.json();

      const productionData =
        await productionResponse.json();

      if (
        !agentResponse.ok
      ) {
        setStatus(
          agentData.error ||
            "ไม่สามารถโหลดรายชื่อตัวแทนได้"
        );

        return;
      }

      if (
        !productionResponse.ok
      ) {
        setStatus(
          productionData.error ||
            "ไม่สามารถโหลด Production ได้"
        );

        return;
      }

      const loadedAgents:
        AgentMaster[] =
        agentData.agents ??
        [];

      const loadedProduction:
        SavedProduction[] =
        productionData.rows ??
        [];

      setSavedRows(
        loadedProduction
      );

      const productionMap =
        new Map<
          string,
          SavedProduction
        >();

      loadedProduction.forEach(
        (item) => {
          productionMap.set(
            item.agent_name,
            item
          );
        }
      );

      const builtRows =
        loadedAgents.map(
          (agent) =>
            createRowFromAgent(
              agent,
              productionMap.get(
                agent.agent_name
              )
            )
        );

      setRows(
        builtRows
      );
    } catch {
      setStatus(
        "เกิดข้อผิดพลาดในการโหลดข้อมูล"
      );
    } finally {
      setLoadingData(
        false
      );
    }
  }

  useEffect(() => {
    loadPageData(
      productionDate
    );
  }, [
    productionDate,
  ]);

  function updateRow(
    index: number,
    field:
      keyof ProductionRow,
    value: string
  ) {
    setRows(
      (current) =>
        current.map(
          (
            row,
            rowIndex
          ) =>
            rowIndex ===
            index
              ? {
                  ...row,
                  [field]:
                    value,
                }
              : row
        )
    );
  }

  function updateMoney(
    index: number,
    field:
      keyof ProductionRow,
    value: string
  ) {
    updateRow(
      index,
      field,
      formatMoneyInput(
        value
      )
    );
  }

  function rowHasProduction(
    row: ProductionRow
  ) {
    return (
      parseNumber(
        row.aiaCaseSubmitted
      ) > 0 ||
      parseNumber(
        row.aiaCaseApproved
      ) > 0 ||
      parseNumber(
        row.aiaFypSubmitted
      ) > 0 ||
      parseNumber(
        row.aiaFypApproved
      ) > 0 ||
      parseNumber(
        row.aiaFycApproved
      ) > 0 ||
      parseNumber(
        row.paCase
      ) > 0 ||
      parseNumber(
        row.paFyp
      ) > 0 ||
      parseNumber(
        row.paFyc
      ) > 0 ||
      row.note.trim() !==
        ""
    );
  }

  function rowWasSaved(
    agentName: string
  ) {
    return savedRows.some(
      (saved) =>
        saved.agent_name ===
        agentName
    );
  }

  const activeRows =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            rowHasProduction(
              row
            )
        ),
      [rows]
    );

  async function saveAll() {
    setStatus("");

    if (!rows.length) {
      setStatus(
        "ยังไม่มีรายชื่อตัวแทนใน Agent Master"
      );

      return;
    }

    const rowsToSave =
      rows.filter(
        (row) => {
          const existed =
            savedRows.some(
              (saved) =>
                saved.agent_name ===
                row.agentName
            );

          return (
            rowHasProduction(
              row
            ) || existed
          );
        }
      );

    if (
      !rowsToSave.length
    ) {
      setStatus(
        "ยังไม่มี Production ที่ต้องบันทึก"
      );

      return;
    }

    setLoading(true);

    try {
      const results =
        await Promise.all(
          rowsToSave.map(
            async (row) => {
              const response =
                await fetch(
                  "/api/daily-production",
                  {
                    method:
                      "POST",

                    headers:
                      {
                        "Content-Type":
                          "application/json",
                      },

                    body:
                      JSON.stringify(
                        {
                          productionDate,

                          agentCode:
                            row.agentCode,

                          agentName:
                            row.agentName,

                          agentNickname:
                            row.agentNickname,

                          aiaCaseSubmitted:
                            parseNumber(
                              row.aiaCaseSubmitted
                            ),

                          aiaCaseApproved:
                            parseNumber(
                              row.aiaCaseApproved
                            ),

                          aiaFypSubmitted:
                            parseNumber(
                              row.aiaFypSubmitted
                            ),

                          aiaFypApproved:
                            parseNumber(
                              row.aiaFypApproved
                            ),

                          aiaFycApproved:
                            parseNumber(
                              row.aiaFycApproved
                            ),

                          paCase:
                            parseNumber(
                              row.paCase
                            ),

                          paFyp:
                            parseNumber(
                              row.paFyp
                            ),

                          paFyc:
                            parseNumber(
                              row.paFyc
                            ),

                          note:
                            row.note.trim(),
                        }
                      ),
                  }
                );

              return {
                ok:
                  response.ok,

                agentName:
                  row.agentName,

                data:
                  await response.json(),
              };
            }
          )
        );

      const failed =
        results.filter(
          (result) =>
            !result.ok
        );

      if (
        failed.length >
        0
      ) {
        setStatus(
          `บันทึกไม่สำเร็จ ${failed.length} รายการ`
        );

        return;
      }

      await loadPageData(
        productionDate
      );

      setStatus(
        `✅ บันทึก Production วันที่ ${productionDate} สำเร็จ ${rowsToSave.length} คน`
      );
    } catch {
      setStatus(
        "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteAgentProduction(
    row: ProductionRow
  ) {
    if (
      !rowWasSaved(
        row.agentName
      )
    ) {
      setStatus(
        `${row.agentName} ยังไม่มี Production ที่บันทึกในวันนี้`
      );

      return;
    }

    const confirmed =
      window.confirm(
        `ต้องการลบ Production วันที่ ${productionDate}\nของ ${row.agentName} ใช่หรือไม่?\n\nข้อมูลของคนนี้ในวันนี้จะถูกลบทั้งหมด`
      );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setStatus("");

    try {
      const response =
        await fetch(
          `/api/daily-production?date=${encodeURIComponent(
            productionDate
          )}&agent=${encodeURIComponent(
            row.agentName
          )}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setStatus(
          data.error ||
            "ไม่สามารถลบ Production ได้"
        );

        return;
      }

      await loadPageData(
        productionDate
      );

      setStatus(
        `🗑️ ลบ Production ของ ${row.agentName} วันที่ ${productionDate} เรียบร้อยแล้ว`
      );
    } catch {
      setStatus(
        "เกิดข้อผิดพลาดในการลบข้อมูล"
      );
    } finally {
      setDeleting(
        false
      );
    }
  }

  async function deleteWholeDay() {
    if (
      savedRows.length ===
      0
    ) {
      setStatus(
        "วันนี้ยังไม่มี Production ที่บันทึกไว้"
      );

      return;
    }

    const confirmed =
      window.confirm(
        `ต้องการลบ Production ทั้งหมดของวันที่ ${productionDate} ใช่หรือไม่?\n\nจะลบข้อมูล ${savedRows.length} รายการ และไม่สามารถย้อนกลับได้`
      );

    if (!confirmed) {
      return;
    }

    const doubleConfirm =
      window.confirm(
        "ยืนยันอีกครั้ง: ต้องการลบ Production ทั้งวันจริงหรือไม่?"
      );

    if (
      !doubleConfirm
    ) {
      return;
    }

    setDeleting(true);
    setStatus("");

    try {
      const response =
        await fetch(
          `/api/daily-production?date=${encodeURIComponent(
            productionDate
          )}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setStatus(
          data.error ||
            "ไม่สามารถลบ Production ทั้งวันได้"
        );

        return;
      }

      await loadPageData(
        productionDate
      );

      setStatus(
        `🗑️ ลบ Production วันที่ ${productionDate} ทั้งหมด ${data.deletedCount ?? 0} รายการเรียบร้อยแล้ว`
      );
    } catch {
      setStatus(
        "เกิดข้อผิดพลาดในการลบข้อมูล"
      );
    } finally {
      setDeleting(
        false
      );
    }
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",

        background:
          "#0D0B08",

        color:
          "#F4E8D0",

        padding:
          "26px 18px 60px",
      }}
    >
      <div
        style={{
          maxWidth: 1800,
          margin:
            "0 auto",
        }}
      >
        <div
          style={{
            marginBottom: 20,
          }}
        >
          <HomeButton />
        </div>

        <div
          style={{
            marginBottom: 24,
          }}
        >
          <div
            style={{
              color:
                "#C9A24B",

              fontSize: 12,

              fontWeight: 700,

              letterSpacing: 2,

              marginBottom: 8,
            }}
          >
            ROYAL PARTNER ·
            AGENT DEV
          </div>

          <h1
            style={{
              margin: 0,

              fontSize: 34,
            }}
          >
            Daily Production
          </h1>

          <p
            style={{
              marginTop: 8,

              color:
                "#A89B86",
            }}
          >
            บันทึกผลงานนำส่ง /
            อนุมัติประจำวัน
          </p>
        </div>

        <div
          style={{
            background:
              "#17130E",

            border:
              "1px solid #4A3B1E",

            borderRadius: 16,

            padding: 18,

            marginBottom: 18,

            display: "flex",

            justifyContent:
              "space-between",

            alignItems:
              "flex-end",

            flexWrap:
              "wrap",

            gap: 16,
          }}
        >
          <div>
            <label
              style={{
                display:
                  "block",

                color:
                  "#C9A24B",

                fontWeight:
                  700,

                fontSize:
                  13,

                marginBottom:
                  8,
              }}
            >
              วันที่ Production
            </label>

            <input
              type="date"

              value={
                productionDate
              }

              onChange={(e) =>
                setProductionDate(
                  e.target.value
                )
              }

              style={
                dateInputStyle
              }
            />
          </div>

          <div
            style={{
              display:
                "flex",

              gap: 22,

              alignItems:
                "center",

              flexWrap:
                "wrap",
            }}
          >
            <MiniStat
              label="ตัวแทนทั้งหมด"

              value={
                rows.length
              }
            />

            <MiniStat
              label="มี Production"

              value={
                activeRows.length
              }
            />

            <MiniStat
              label="บันทึกแล้ว"

              value={
                savedRows.length
              }
            />

            {savedRows.length >
              0 && (
              <button
                type="button"

                onClick={
                  deleteWholeDay
                }

                disabled={
                  deleting ||
                  loading
                }

                style={
                  deleteDayButtonStyle
                }
              >
                🗑️ ลบ Production
                ทั้งวัน
              </button>
            )}
          </div>
        </div>

        {loadingData && (
          <div
            style={{
              marginBottom:
                16,

              color:
                "#A89B86",
            }}
          >
            กำลังโหลดรายชื่อและ
            Production...
          </div>
        )}

        <div
          style={{
            background:
              "#17130E",

            border:
              "1px solid #4A3B1E",

            borderRadius: 16,

            overflow:
              "hidden",
          }}
        >
          <div
            style={{
              overflowX:
                "auto",
            }}
          >
            <table
              style={{
                width:
                  "100%",

                minWidth:
                  1700,

                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      "rgba(201,162,75,.10)",
                  }}
                >
                  <HeaderCell>
                    No.
                  </HeaderCell>

                  <HeaderCell>
                    Code
                  </HeaderCell>

                  <HeaderCell>
                    Name
                  </HeaderCell>

                  <HeaderCell>
                    Nick Name
                  </HeaderCell>

                  <HeaderCell>
                    Case นำส่ง
                  </HeaderCell>

                  <HeaderCell>
                    Case อนุมัติ
                  </HeaderCell>

                  <HeaderCell>
                    FYP นำส่ง
                  </HeaderCell>

                  <HeaderCell>
                    FYP อนุมัติ
                  </HeaderCell>

                  <HeaderCell>
                    FYC อนุมัติ
                  </HeaderCell>

                  <HeaderCell>
                    PA Case
                  </HeaderCell>

                  <HeaderCell>
                    PA FYP
                  </HeaderCell>

                  <HeaderCell>
                    PA FYC
                  </HeaderCell>

                  <HeaderCell>
                    หมายเหตุ
                  </HeaderCell>

                  <HeaderCell>
                    จัดการ
                  </HeaderCell>
                </tr>
              </thead>

              <tbody>
                {!loadingData &&
                rows.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        14
                      }

                      style={{
                        padding:
                          30,

                        textAlign:
                          "center",

                        color:
                          "#8F8370",
                      }}
                    >
                      ยังไม่มีรายชื่อใน
                      Agent Master
                    </td>
                  </tr>
                ) : (
                  rows.map(
                    (
                      row,
                      index
                    ) => {
                      const saved =
                        rowWasSaved(
                          row.agentName
                        );

                      return (
                        <tr
                          key={`${row.agentName}-${index}`}

                          style={{
                            borderTop:
                              "1px solid #332A1C",

                            background:
                              rowHasProduction(
                                row
                              )
                                ? "rgba(201,162,75,.035)"
                                : "transparent",
                          }}
                        >
                          <Cell>
                            {index +
                              1}
                          </Cell>

                          <Cell>
                            <FixedText>
                              {
                                row.agentCode
                              }
                            </FixedText>
                          </Cell>

                          <Cell>
                            <FixedText>
                              {
                                row.agentName
                              }
                            </FixedText>
                          </Cell>

                          <Cell>
                            <FixedText>
                              {
                                row.agentNickname
                              }
                            </FixedText>
                          </Cell>

                          <Cell>
                            <NumberInput
                              value={
                                row.aiaCaseSubmitted
                              }

                              onChange={(
                                value
                              ) =>
                                updateRow(
                                  index,
                                  "aiaCaseSubmitted",
                                  value
                                )
                              }
                            />
                          </Cell>

                          <Cell>
                            <NumberInput
                              value={
                                row.aiaCaseApproved
                              }

                              onChange={(
                                value
                              ) =>
                                updateRow(
                                  index,
                                  "aiaCaseApproved",
                                  value
                                )
                              }
                            />
                          </Cell>

                          <Cell>
                            <NumberInput
                              value={
                                row.aiaFypSubmitted
                              }

                              onChange={(
                                value
                              ) =>
                                updateMoney(
                                  index,
                                  "aiaFypSubmitted",
                                  value
                                )
                              }
                            />
                          </Cell>

                          <Cell>
                            <NumberInput
                              value={
                                row.aiaFypApproved
                              }

                              onChange={(
                                value
                              ) =>
                                updateMoney(
                                  index,
                                  "aiaFypApproved",
                                  value
                                )
                              }
                            />
                          </Cell>

                          <Cell>
                            <NumberInput
                              value={
                                row.aiaFycApproved
                              }

                              onChange={(
                                value
                              ) =>
                                updateMoney(
                                  index,
                                  "aiaFycApproved",
                                  value
                                )
                              }
                            />
                          </Cell>

                          <Cell>
                            <NumberInput
                              value={
                                row.paCase
                              }

                              onChange={(
                                value
                              ) =>
                                updateRow(
                                  index,
                                  "paCase",
                                  value
                                )
                              }
                            />
                          </Cell>

                          <Cell>
                            <NumberInput
                              value={
                                row.paFyp
                              }

                              onChange={(
                                value
                              ) =>
                                updateMoney(
                                  index,
                                  "paFyp",
                                  value
                                )
                              }
                            />
                          </Cell>

                          <Cell>
                            <NumberInput
                              value={
                                row.paFyc
                              }

                              onChange={(
                                value
                              ) =>
                                updateMoney(
                                  index,
                                  "paFyc",
                                  value
                                )
                              }
                            />
                          </Cell>

                          <Cell>
                            <TextInput
                              value={
                                row.note
                              }

                              onChange={(
                                value
                              ) =>
                                updateRow(
                                  index,
                                  "note",
                                  value
                                )
                              }
                            />
                          </Cell>

                          <Cell>
                            {saved ? (
                              <button
                                type="button"

                                onClick={() =>
                                  deleteAgentProduction(
                                    row
                                  )
                                }

                                disabled={
                                  deleting
                                }

                                style={
                                  deleteRowButtonStyle
                                }
                              >
                                🗑️ ลบ
                              </button>
                            ) : (
                              <span
                                style={{
                                  color:
                                    "#655A49",

                                  fontSize:
                                    12,
                                }}
                              >
                                ยังไม่บันทึก
                              </span>
                            )}
                          </Cell>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: 18,

              borderTop:
                "1px solid #332A1C",

              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap: 12,

              flexWrap:
                "wrap",
            }}
          >
            <div
              style={{
                color:
                  "#807460",

                fontSize: 12,
              }}
            >
              รายชื่อดึงจาก Agent
              Master อัตโนมัติ
            </div>

            <button
              type="button"

              onClick={
                saveAll
              }

              disabled={
                loading ||
                loadingData ||
                deleting
              }

              style={{
                border:
                  "1px solid #C9A24B",

                background:
                  "#C9A24B",

                color:
                  "#17110A",

                borderRadius:
                  10,

                padding:
                  "12px 22px",

                fontWeight:
                  800,

                cursor:
                  loading
                    ? "default"
                    : "pointer",

                opacity:
                  loading ||
                  loadingData ||
                  deleting
                    ? 0.6
                    : 1,
              }}
            >
              {loading
                ? "กำลังบันทึก..."
                : "บันทึก Production สิ้นวัน"}
            </button>
          </div>
        </div>

        {status && (
          <div
            style={{
              marginTop: 18,

              padding:
                "13px 16px",

              border:
                "1px solid #4A3B1E",

              borderRadius: 10,

              color:
                "#D8B66A",

              background:
                "rgba(201,162,75,.06)",

              lineHeight: 1.5,
            }}
          >
            {status}
          </div>
        )}
      </div>
    </main>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;

  value: number;
}) {
  return (
    <div>
      <div
        style={{
          color:
            "#807460",

          fontSize: 11,

          marginBottom:
            3,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color:
            "#D8B66A",

          fontSize: 22,

          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function HeaderCell({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <th
      style={{
        padding:
          "13px 10px",

        color:
          "#D8B66A",

        fontSize: 12,

        textAlign:
          "left",

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Cell({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: 8,

        fontSize: 13,

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function FixedText({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        minWidth: 95,

        color:
          "#E6D8C1",

        fontSize: 13,
      }}
    >
      {children || "-"}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: string;

  onChange:
    (
      value: string
    ) => void;
}) {
  return (
    <input
      value={value}

      inputMode="decimal"

      placeholder="0"

      onChange={(e) =>
        onChange(
          e.target.value
        )
      }

      style={{
        ...tableInputStyle,

        textAlign:
          "right",
      }}
    />
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string;

  onChange:
    (
      value: string
    ) => void;
}) {
  return (
    <input
      value={value}

      placeholder="-"

      onChange={(e) =>
        onChange(
          e.target.value
        )
      }

      style={
        tableInputStyle
      }
    />
  );
}

const tableInputStyle = {
  width: "100%",

  minWidth: 100,

  boxSizing:
    "border-box" as const,

  background:
    "#0F0C09",

  color:
    "#F4E8D0",

  border:
    "1px solid #3D3325",

  borderRadius: 8,

  padding: "9px",

  fontSize: 13,
};

const dateInputStyle = {
  background:
    "#0F0C09",

  color:
    "#F4E8D0",

  border:
    "1px solid #4A3B1E",

  borderRadius: 8,

  padding:
    "10px 12px",

  fontSize: 14,
};

const deleteRowButtonStyle = {
  border:
    "1px solid #8E4B40",

  background:
    "rgba(142,75,64,0.08)",

  color:
    "#E09A8E",

  borderRadius: 8,

  padding:
    "8px 11px",

  cursor:
    "pointer",

  fontWeight: 700,
};

const deleteDayButtonStyle = {
  border:
    "1px solid #8E4B40",

  background:
    "rgba(142,75,64,0.08)",

  color:
    "#E09A8E",

  borderRadius: 9,

  padding:
    "10px 13px",

  cursor:
    "pointer",

  fontWeight: 700,

  fontSize: 12,
};
