import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return NextResponse.json(
        {
          ok: false,
          error: "กรุณากรอกอีเมล",
        },
        { status: 400 }
      );
    }

    // อนุญาตเฉพาะอีเมล Royal Partner
    if (!email.endsWith("@royalpartner.org")) {
      return NextResponse.json(
        {
          ok: false,
          error: "อีเมลนี้ไม่ได้รับอนุญาตให้เข้าสู่ระบบ",
        },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !publishableKey) {
      console.error("Missing Supabase environment variables");

      return NextResponse.json(
        {
          ok: false,
          error: "ระบบ Login ยังตั้งค่าไม่ครบ",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://agent-activity-tracker.vercel.app";

    const { error } =
      await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${origin}/`,
        },
      });

    if (error) {
      console.error(
        "Supabase Magic Link Error:",
        error.message
      );

      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "ส่งลิงก์เข้าสู่ระบบแล้ว กรุณาตรวจสอบอีเมล",
    });
  } catch (error) {
    console.error("Magic Link API Error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "ไม่สามารถส่งลิงก์เข้าสู่ระบบได้",
      },
      { status: 500 }
    );
  }
}
