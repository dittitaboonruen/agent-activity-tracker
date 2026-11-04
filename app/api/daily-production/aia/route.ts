import { NextRequest } from "next/server";
import { readAiaMonthly, writeAiaMonthly } from "@/lib/aia-monthly-server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export function GET(request: NextRequest) { return readAiaMonthly(request, "daily-production"); }
export const POST = writeAiaMonthly;
