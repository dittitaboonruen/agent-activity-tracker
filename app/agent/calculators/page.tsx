"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";

export default function CalculatorPage() {
  const iframeRef =
    useRef<HTMLIFrameElement | null>(
      null
    );

  const [
    previewOpen,
    setPreviewOpen,
  ] = useState(false);

  useEffect(() => {
    document.title =
      "Insurance Calculator | Royal Partner";

    function handleMessage(
      event: MessageEvent
    ) {
      if (
        event.source !==
        iframeRef.current
          ?.contentWindow
      ) {
        return;
      }

      const data =
        event.data;

      if (
        !data ||
        data.type !==
          "rp-report-preview"
      ) {
        return;
      }

      setPreviewOpen(
        Boolean(
          data.open
        )
      );
    }

    window.addEventListener(
      "message",
      handleMessage
    );

    return () =>
      window.removeEventListener(
        "message",
        handleMessage
      );
  }, []);

  useEffect(() => {
    if (!previewOpen) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [previewOpen]);

  return (
    <main
      style={{
        minHeight:
          "100vh",
        background:
          "#F7F3EA",
        color:
          "#0F1B2E",
        padding:
          "24px 16px",
      }}
    >
      <div
        style={{
          maxWidth:
            1100,
          margin:
            "0 auto",
        }}
      >
        <Link
          href="/agent"
          style={{
            display:
              "inline-block",
            marginBottom:
              20,
            color:
              "#0F1B2E",
            textDecoration:
              "none",
            fontSize:
              14,
          }}
        >
          ← กลับ Agent Portal
        </Link>

        <h1
          style={{
            fontSize:
              26,
            marginBottom:
              8,
          }}
        >
          Insurance Calculator
        </h1>

        <p
          style={{
            fontSize:
              14,
            lineHeight:
              1.7,
            marginBottom:
              20,
            color:
              "#6B6455",
          }}
        >
          เครื่องมือคำนวณและจัดทำใบสรุปประกอบการเสนอขาย
          สำหรับตัวแทน Royal Partner
        </p>

        <iframe
          ref={
            iframeRef
          }
          title="Royal Partner Insurance Calculator"
          src="/illustrations/royal_partners_illustration_tool.html"
          sandbox="allow-scripts allow-downloads allow-same-origin allow-modals"
          referrerPolicy="no-referrer"
          style={
            previewOpen
              ? {
                  position:
                    "fixed",
                  inset:
                    0,
                  zIndex:
                    99999,
                  display:
                    "block",
                  width:
                    "100vw",
                  height:
                    "100dvh",
                  border:
                    "none",
                  background:
                    "#EEE9DE",
                }
              : {
                  display:
                    "block",
                  width:
                    "100%",
                  height:
                    1100,
                  border:
                    "1px solid #D9D2BF",
                  background:
                    "#FFFDF8",
                }
          }
        />
      </div>
    </main>
  );
}
