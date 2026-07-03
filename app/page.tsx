"use client";

import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  GraduationCap,
  Loader2,
  RefreshCw,
  School,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type QueryType = "score" | "admission";
type Status = "idle" | "loading" | "success" | "error";

type ScoreResult = {
  admissionTicketNumber?: string;
  candidateName?: string;
  totalScore?: string | number;
  regionalRanking?: string | number;
  chineseLanguageScore?: string | number;
  mathematicsScore?: string | number;
  englishScore?: string | number;
  scienceScore?: string | number;
  socialScore?: string | number;
  physicalEducationScore?: string | number;
  physicalHealthLevel?: string;
  artisticLiteracy?: string;
  innovativePractice?: string;
};

type AdmissionResult = {
  id?: string;
  candidateName?: string;
  graduationSchool?: string;
  admittedSchools?: string;
  admittedMajors?: string;
};

type UpstreamCaptchaResponse = {
  code?: string;
  data?: {
    img?: string;
    codeToken?: string;
  };
};

type UpstreamQueryResponse = {
  code?: string;
  data?: ScoreResult | AdmissionResult | null;
};

const queryTabs: Array<{ type: QueryType; label: string; helper: string }> = [
  {
    type: "score",
    label: "成绩查询",
    helper: "查看总分、区域排名、科目成绩和综合素质。",
  },
  {
    type: "admission",
    label: "录取查询",
    helper: "查看录取学校、专业和毕业学校信息。",
  },
];

const scoreFields = [
  ["语文", "chineseLanguageScore"],
  ["数学", "mathematicsScore"],
  ["英语", "englishScore"],
  ["科学", "scienceScore"],
  ["社会", "socialScore"],
  ["体育", "physicalEducationScore"],
] as const;

const qualityFields = [
  ["运动健康", "physicalHealthLevel"],
  ["艺术素养", "artisticLiteracy"],
  ["创新实践", "innovativePractice"],
] as const;

const upstreamBase = "https://xzzs.zsedus.cn:1443/yixiu";

const queryEndpoints: Record<QueryType, string> = {
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

function normalizeDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function displayValue(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") {
    return "暂无";
  }

  return value;
}

export default function Home() {
  const [queryType, setQueryType] = useState<QueryType>("score");
  const [admissionTicketNumber, setAdmissionTicketNumber] = useState("");
  const [bornDateStr, setBornDateStr] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [codeToken, setCodeToken] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [captchaError, setCaptchaError] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ScoreResult | AdmissionResult | null>(null);

  const activeTab = useMemo(
    () => queryTabs.find((tab) => tab.type === queryType) ?? queryTabs[0],
    [queryType],
  );

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaError("");

    try {
      const response = await fetch(`${upstreamBase}/getVCode?width=123&height=45`, {
        method: "POST",
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      });
      const data = (await response.json()) as UpstreamCaptchaResponse;

      if (
        !response.ok ||
        data.code !== "0000" ||
        !data.data?.img ||
        !data.data?.codeToken
      ) {
        throw new Error("验证码获取失败");
      }

      setCaptchaImage(`data:image/jpeg;base64,${data.data.img}`);
      setCodeToken(data.data.codeToken);
      setVerifyCode("");
    } catch (error) {
      setCaptchaImage("");
      setCodeToken("");
      setCaptchaError(error instanceof Error ? error.message : "验证码获取失败");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCaptcha();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCaptcha]);

  function validateForm() {
    if (!/^\d{13,14}$/.test(admissionTicketNumber)) {
      return "请输入 13-14 位准考证号";
    }

    if (!/^\d{8}$/.test(bornDateStr)) {
      return "请输入 8 位出生年月日";
    }

    if (!verifyCode.trim()) {
      return "请输入验证码";
    }

    if (!codeToken) {
      return "验证码已失效，请刷新验证码";
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setStatus("error");
      setMessage(validationError);
      setResult(null);
      return;
    }

    setStatus("loading");
    setMessage(queryType === "score" ? "正在查询成绩..." : "正在查询录取结果...");
    setResult(null);

    try {
      const params = new URLSearchParams({
        admissionTicketNumber,
        bornDateStr,
        verifyCode: verifyCode.trim(),
        codeToken,
      });
      const response = await fetch(
        `${upstreamBase}/midSchoolEntranceExamScore/${queryEndpoints[queryType]}?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
          },
          cache: "no-store",
        },
      );

      if (!response.ok) {
        setStatus("error");
        setMessage("网络错误，请稍后重试");
        setResult(null);
        void loadCaptcha();
        return;
      }

      const data = (await response.json()) as UpstreamQueryResponse;

      if (data.code === "0000" && data.data) {
        setStatus("success");
        setMessage("查询成功");
        setResult(data.data);
        return;
      }

      const errorCode = typeof data.code === "string" ? data.code : "UNKNOWN";
      setStatus("error");
      setMessage(errorMessages[errorCode] ?? "未查询到相关数据");
      setResult(null);

      if (errorCode === "1001" || errorCode === "9400") {
        void loadCaptcha();
      }
    } catch {
      setStatus("error");
      setMessage("网络错误，请稍后重试");
      setResult(null);
      void loadCaptcha();
    }
  }

  function selectType(type: QueryType) {
    setQueryType(type);
    setStatus("idle");
    setMessage("");
    setResult(null);
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col justify-center gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-700">舟山市中考查询</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              成绩与录取结果统一查询
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
            不保存查询信息
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur sm:p-5"
          >
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              {queryTabs.map((tab) => {
                const selected = tab.type === queryType;
                return (
                  <button
                    key={tab.type}
                    type="button"
                    onClick={() => selectType(tab.type)}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      selected
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white hover:text-slate-950"
                    }`}
                    aria-pressed={selected}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">{activeTab.helper}</p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Ticket className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  准考证号
                </span>
                <input
                  value={admissionTicketNumber}
                  onChange={(event) =>
                    setAdmissionTicketNumber(normalizeDigits(event.target.value, 14))
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="如 2409029113001"
                  aria-label="准考证号，13 到 14 位数字"
                  className="h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
                />
              </label>

              <label className="block">
                <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                  <CalendarDays className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  出生年月日
                </span>
                <input
                  value={bornDateStr}
                  onChange={(event) => setBornDateStr(normalizeDigits(event.target.value, 8))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="如 20080101"
                  className="h-12 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
                />
              </label>

              <div>
                <label
                  htmlFor="verifyCode"
                  className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800"
                >
                  <BadgeCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  验证码
                </label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input
                    id="verifyCode"
                    value={verifyCode}
                    onChange={(event) => setVerifyCode(event.target.value.trim().toUpperCase())}
                    autoComplete="off"
                    placeholder="输入右侧验证码"
                    className="h-12 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10"
                  />
                  <button
                    type="button"
                    onClick={() => void loadCaptcha()}
                    disabled={captchaLoading}
                    className="flex h-12 w-[132px] items-center justify-center overflow-hidden rounded-md border border-slate-300 bg-white text-sm text-slate-600 transition hover:border-teal-700 disabled:cursor-wait disabled:opacity-70"
                    title="刷新验证码"
                  >
                    {captchaLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-teal-700" aria-hidden="true" />
                    ) : captchaImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={captchaImage} alt="验证码，点击刷新" className="h-full w-full object-cover" />
                    ) : (
                      <RefreshCw className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {captchaError ? (
                  <p className="mt-2 text-sm text-red-700">{captchaError}</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">看不清可点击图片刷新。</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={status === "loading" || captchaLoading}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-base font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {status === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-5 w-5" aria-hidden="true" />
              )}
              {queryType === "score" ? "查询成绩" : "查询录取结果"}
            </button>
          </form>

          <ResultPanel
            queryType={queryType}
            status={status}
            message={message}
            result={result}
          />
        </section>

        <footer className="rounded-lg border border-slate-200/80 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-600 backdrop-blur">
          查询结果仅供参考，最终结果以官方成绩单和录取通知书为准。数据来源为舟山市教育局公开查询接口。
        </footer>
      </div>
    </main>
  );
}

function ResultPanel({
  queryType,
  status,
  message,
  result,
}: {
  queryType: QueryType;
  status: Status;
  message: string;
  result: ScoreResult | AdmissionResult | null;
}) {
  return (
    <section className="rounded-lg border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">查询结果</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            {queryType === "score" ? "成绩信息" : "录取信息"}
          </h2>
        </div>
        <div className="rounded-md bg-slate-100 p-2 text-slate-700">
          {queryType === "score" ? (
            <Trophy className="h-5 w-5" aria-hidden="true" />
          ) : (
            <School className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
      </div>

      <div className="mt-5">
        {status === "idle" && <EmptyState queryType={queryType} />}
        {status === "loading" && <MessageState tone="loading" message={message} />}
        {status === "error" && <MessageState tone="error" message={message} />}
        {status === "success" && queryType === "score" && result && (
          <ScoreView data={result as ScoreResult} />
        )}
        {status === "success" && queryType === "admission" && result && (
          <AdmissionView data={result as AdmissionResult} />
        )}
      </div>
    </section>
  );
}

function EmptyState({ queryType }: { queryType: QueryType }) {
  return (
    <div className="flex min-h-[360px] flex-col justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-5 text-center">
      <GraduationCap className="mx-auto h-10 w-10 text-teal-700" aria-hidden="true" />
      <h3 className="mt-4 text-lg font-semibold text-slate-950">
        {queryType === "score" ? "输入信息后查询成绩" : "输入信息后查询录取结果"}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
        准考证号、出生年月日和验证码只用于本次查询，不会在本地持久化保存。
      </p>
    </div>
  );
}

function MessageState({ tone, message }: { tone: "loading" | "error"; message: string }) {
  const isLoading = tone === "loading";

  return (
    <div
      className={`flex min-h-[360px] flex-col justify-center rounded-lg border p-5 text-center ${
        isLoading
          ? "border-teal-200 bg-teal-50 text-teal-900"
          : "border-red-200 bg-red-50 text-red-900"
      }`}
      role={isLoading ? "status" : "alert"}
    >
      {isLoading ? (
        <Loader2 className="mx-auto h-9 w-9 animate-spin" aria-hidden="true" />
      ) : (
        <AlertCircle className="mx-auto h-9 w-9" aria-hidden="true" />
      )}
      <h3 className="mt-4 text-lg font-semibold">{isLoading ? "请稍候" : "查询未完成"}</h3>
      <p className="mt-2 text-sm leading-6">{message}</p>
    </div>
  );
}

function ScoreView({ data }: { data: ScoreResult }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="考生姓名" value={displayValue(data.candidateName)} />
        <Metric label="准考证号" value={displayValue(data.admissionTicketNumber)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="总分" value={displayValue(data.totalScore)} highlight />
        <Metric label="区域排名" value={displayValue(data.regionalRanking)} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">考试成绩</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {scoreFields.map(([label, key]) => (
            <Metric key={key} label={label} value={displayValue(data[key])} compact />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">综合素质</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {qualityFields.map(([label, key]) => (
            <Metric key={key} label={label} value={displayValue(data[key])} compact />
          ))}
        </div>
      </div>
    </div>
  );
}

function AdmissionView({ data }: { data: AdmissionResult }) {
  const isLiuheng = data.admittedSchools?.includes("舟山市六横中学") ?? false;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Metric label="考生姓名" value={displayValue(data.candidateName)} />
        <Metric label="准考证号" value={displayValue(data.id)} />
      </div>

      <Metric label="毕业学校" value={displayValue(data.graduationSchool)} />
      <Metric label="录取学校" value={displayValue(data.admittedSchools)} highlight />
      <Metric label="录取专业" value={displayValue(data.admittedMajors)} />

      {isLiuheng ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-950">
          <p className="font-semibold">已录取到舟山市六横中学</p>
          <p className="mt-1">
            添加微信 <span className="font-semibold">laoshuikaixue</span>，通过后发送本页面截图加入新生交流群。
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  highlight = false,
  compact = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-white"
      } ${compact ? "min-h-20" : ""}`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1 break-words font-semibold ${
          highlight ? "text-2xl text-teal-900" : "text-base text-slate-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
