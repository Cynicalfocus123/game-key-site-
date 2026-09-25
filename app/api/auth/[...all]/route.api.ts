import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/server/auth";
import { dbReady } from "@/lib/server/db";

const handler = toNextJsHandler(auth);
export async function GET(req: Request) { await dbReady(); return handler.GET(req); }
export async function POST(req: Request) { await dbReady(); return handler.POST(req); }
