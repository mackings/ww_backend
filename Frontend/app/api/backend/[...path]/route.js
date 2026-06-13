import { NextResponse } from "next/server";

const BACKEND_URL = (
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_API_URL ||
  "https://ww-backend.vercel.app"
).replace(/\/$/, "");

const proxy = async (request, context) => {
  const { path } = await context.params;
  const incomingUrl = new URL(request.url);
  const targetUrl = `${BACKEND_URL}/${path.join("/")}${incomingUrl.search}`;
  const headers = new Headers();
  const authorization = request.headers.get("authorization");
  const contentType = request.headers.get("content-type");

  if (authorization) headers.set("authorization", authorization);
  if (contentType) headers.set("content-type", contentType);

  const method = request.method;
  const body = ["GET", "HEAD"].includes(method) ? undefined : await request.arrayBuffer();

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual"
    });
    const responseHeaders = new Headers();
    const responseType = response.headers.get("content-type");
    const disposition = response.headers.get("content-disposition");

    if (responseType) responseHeaders.set("content-type", responseType);
    if (disposition) responseHeaders.set("content-disposition", disposition);

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Backend service is unavailable" },
      { status: 502 }
    );
  }
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
