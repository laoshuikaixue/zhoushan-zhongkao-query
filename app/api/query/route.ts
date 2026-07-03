import { NextResponse } from "next/server";

export const runtime = "nodejs";

type QueryType = "score" | "admission";

type QueryRequest = {
  type?: QueryType;
  admissionTicketNumber?: string;
  bornDateStr?: string;
  verifyCode?: string;
  codeToken?: string;
};

const REQUEST_TIMEOUT_MS = 12000;
const UPSTREAM_BASE = "https://xzzs.zsedus.cn:1443/yixiu/midSchoolEntranceExamScore";

const endpoints: Record<QueryType, string> = {
  score: "queryScore",
  admission: "admissionQuery",
};

const errorMessages: Record<string, string> = {
  "1001": "验证码错误，请重新输入",
  "9400": "验证码已过期，请重新输入",
  ERROR_CODE: "网络错误，请稍后重试",
  ECONNABORTED: "请求超时，请稍后重试",
  ERR_NETWORK: "网络错误，请稍后重试",
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function validateBody(body: QueryRequest) {
  if (body.type !== "score" && body.type !== "admission") {
    return "查询类型无效";
  }

  if (!/^\d{13,14}$/.test(body.admissionTicketNumber ?? "")) {
    return "请输入 13-14 位准考证号";
  }

  if (!/^\d{8}$/.test(body.bornDateStr ?? "")) {
    return "请输入 8 位出生年月日";
  }

  if (!body.verifyCode?.trim()) {
    return "请输入验证码";
  }

  if (!body.codeToken?.trim()) {
    return "验证码已失效，请刷新验证码";
  }

  return null;
}

export async function POST(request: Request) {
  let body: QueryRequest;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      {
        ok: false,
        message: "请求格式无效",
      },
      400,
    );
  }

  const validationError = validateBody(body);
  if (validationError) {
    return jsonResponse(
      {
        ok: false,
        type: body.type,
        message: validationError,
      },
      400,
    );
  }

  const type = body.type as QueryType;
  const params = new URLSearchParams({
    admissionTicketNumber: body.admissionTicketNumber!,
    bornDateStr: body.bornDateStr!,
    verifyCode: body.verifyCode!.trim(),
    codeToken: body.codeToken!,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${UPSTREAM_BASE}/${endpoints[type]}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Origin: "https://xzzs.zsedus.cn:1443",
        Referer: "https://xzzs.zsedus.cn:1443/",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return jsonResponse(
        {
          ok: false,
          type,
          message: "上游服务暂时不可用，请稍后重试",
        },
        502,
      );
    }

    const payload = await response.json();

    if (payload?.code === "0000" && payload?.data) {
      return jsonResponse({
        ok: true,
        type,
        data: payload.data,
        message: "查询成功",
      });
    }

    const errorCode = typeof payload?.code === "string" ? payload.code : "UNKNOWN";

    return jsonResponse(
      {
        ok: false,
        type,
        errorCode,
        message: errorMessages[errorCode] ?? "未查询到相关数据",
      },
      200,
    );
  } catch {
    return jsonResponse(
      {
        ok: false,
        type,
        errorCode: "ERR_NETWORK",
        message: "网络错误，请稍后重试",
      },
      504,
    );
  } finally {
    clearTimeout(timeout);
  }
}
