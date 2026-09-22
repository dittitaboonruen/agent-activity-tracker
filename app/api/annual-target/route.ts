import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

const LOCKED_MESSAGE =
  "Annual Target ยังไม่เปิดใช้งานในขณะนี้";

function lockedResponse() {
  return NextResponse.json(
    {
      success: false,
      locked: true,
      error: LOCKED_MESSAGE,
    },
    {
      status: 423,
      headers: NO_STORE_HEADERS,
    }
  );
}

/* =========================
   ANNUAL TARGET — TEMP LOCK
========================= */

/*
 * ปิดการอ่านข้อมูล Annual Target
 */
export async function GET() {
  return lockedResponse();
}

/*
 * ปิดการสร้าง / บันทึก / แก้ไข Target
 */
export async function POST() {
  return lockedResponse();
}

/*
 * ปิดการลบ Target
 */
export async function DELETE() {
  return lockedResponse();
}

/*
 * ปิดการแก้ไขผ่าน PUT
 */
export async function PUT() {
  return lockedResponse();
}

/*
 * ปิดการแก้ไขผ่าน PATCH
 */
export async function PATCH() {
  return lockedResponse();
}
