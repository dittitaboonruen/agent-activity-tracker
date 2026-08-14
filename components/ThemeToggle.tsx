"use client";

import { useEffect, useState } from "react";

export type RPTheme = "morning" | "night";

const STORAGE_KEY = "agent-dev-theme";

function applyTheme(theme: RPTheme) {
  document.documentElement.setAttribute(
    "data-rp-theme",
    theme
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] =
    useState<RPTheme>("night");

  useEffect(() => {
    const saved =
      localStorage.getItem(
        STORAGE_KEY
      ) as RPTheme | null;

    const initialTheme =
      saved === "morning" ||
      saved === "night"
        ? saved
        : "night";

    setTheme(initialTheme);
    applyTheme(initialTheme);

    function handleThemeChange(
      event: Event
    ) {
      const customEvent =
        event as CustomEvent<RPTheme>;

      if (
        customEvent.detail ===
          "morning" ||
        customEvent.detail ===
          "night"
      ) {
        setTheme(
          customEvent.detail
        );
      }
    }

    function handleStorage(
      event: StorageEvent
    ) {
      if (
        event.key ===
          STORAGE_KEY &&
        (event.newValue ===
          "morning" ||
          event.newValue ===
            "night")
      ) {
        setTheme(
          event.newValue
        );

        applyTheme(
          event.newValue
        );
      }
    }

    window.addEventListener(
      "rp-theme-change",
      handleThemeChange
    );

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      window.removeEventListener(
        "rp-theme-change",
        handleThemeChange
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, []);

  function changeTheme(
    nextTheme: RPTheme
  ) {
    setTheme(nextTheme);

    localStorage.setItem(
      STORAGE_KEY,
      nextTheme
    );

    applyTheme(nextTheme);

    window.dispatchEvent(
      new CustomEvent(
        "rp-theme-change",
        {
          detail: nextTheme,
        }
      )
    );
  }

  const isMorning =
    theme === "morning";

  return (
    <div
      style={{
        display: "flex",
        padding: 4,
        gap: 3,
        borderRadius: 999,
        border:
          "1px solid var(--hairline)",
        background:
          "var(--surface)",
      }}
    >
      <button
        type="button"
        onClick={() =>
          changeTheme("morning")
        }
        style={{
          border: 0,
          borderRadius: 999,
          padding: "8px 12px",
          cursor: "pointer",
          fontWeight: 700,

          background:
            isMorning
              ? "var(--gold)"
              : "transparent",

          color:
            isMorning
              ? "#18120A"
              : "var(--cream-muted)",
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
          borderRadius: 999,
          padding: "8px 12px",
          cursor: "pointer",
          fontWeight: 700,

          background:
            !isMorning
              ? "var(--gold)"
              : "transparent",

          color:
            !isMorning
              ? "#18120A"
              : "var(--cream-muted)",
        }}
      >
        🌙 กลางคืน
      </button>
    </div>
  );
}
