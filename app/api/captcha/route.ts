import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CAPTCHA_URL = "https://xzzs.zsedus.cn:1443/yixiu/getVCode?width=123&height=45";
const REQUEST_TIMEOUT_MS = 10000;

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CAPTCHA_URL, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Origin: "https://xzzs.zsedus.cn:1443",
        Referer: "https://xzzs.zsedus.cn:1443/",
      },
      body: "{}",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return jsonResponse(
        { ok: false, message: "验证码获取失败，请稍后重试" },
        502,
      );
    }

    const payload = await response.json();
    const img = payload?.data?.img;
    const codeToken = payload?.data?.codeToken;

    if (payload?.code !== "0000" || typeof img !== "string" || typeof codeToken !== "string") {
      return jsonResponse(
        { ok: false, message: "验证码数据异常，请刷新重试" },
        502,
      );
    }

    return jsonResponse({
      ok: true,
      imageDataUrl: `data:image/jpeg;base64,${img}`,
      codeToken,
    });
  } catch {
    return jsonResponse(
      { ok: false, message: "网络错误，验证码获取失败" },
      504,
    );
  } finally {
    clearTimeout(timeout);
  }
}
