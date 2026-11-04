import { NextRequest } from "next/server";
import { readAiaMonthly } from "@/lib/aia-monthly-server";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export function GET(request: NextRequest) { return readAiaMonthly(request, "monthly-performance"); }
