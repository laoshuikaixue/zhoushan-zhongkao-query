"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { encryptAdmissionData, isTestEnvironment } from "./actions";

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

const upstreamBase = "https://xzzs.zsedus.cn:1443/yixiu";

const queryEndpoints: Record<QueryType, string> = {
  score: "queryScore",
  admission: "admissionQuery",
};

const queryLabels: Record<QueryType, string> = {
  score: "成绩查询",
  admission: "录取查询",
};

const mockAdmissionResult: Required<AdmissionResult> = {
  id: "2409029113001",
  candidateName: "张三",
  graduationSchool: "本地测试初中",
  admittedSchools: "舟山市六横中学",
  admittedMajors: "普通班",
};

const errorMessages: Record<string, string> = {
  "1001": "验证码错误，请重新输入",
  "9400": "验证码已过期，请重新输入",
  ERROR_CODE: "网络错误，请稍后重试",
  ECONNABORTED: "请求超时，请稍后重试",
  ERR_NETWORK: "网络错误，请稍后重试",
};

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

function onlyDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function show(value: string | number | undefined) {
  return value === undefined || value === null || value === "" ? "暂无" : value;
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
  const [showMockAdmission, setShowMockAdmission] = useState(false);

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

      if (!response.ok || data.code !== "0000" || !data.data?.img || !data.data?.codeToken) {
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

  useEffect(() => {
    let mounted = true;

    isTestEnvironment()
      .then((enabled) => {
        if (mounted) {
          setShowMockAdmission(enabled);
        }
      })
      .catch(() => {
        if (mounted) {
          setShowMockAdmission(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  function switchType(type: QueryType) {
    setQueryType(type);
    setStatus("idle");
    setMessage("");
    setResult(null);
  }

  function validateForm() {
    if (!/^\d{13,14}$/.test(admissionTicketNumber)) return "请输入 13-14 位准考证号";
    if (!/^\d{8}$/.test(bornDateStr)) return "请输入 8 位出生年月日";
    if (!verifyCode.trim()) return "请输入验证码";
    if (!codeToken) return "验证码已失效，请刷新验证码";
    return "";
  }

  function handleMockAdmissionResult() {
    setQueryType("admission");
    setAdmissionTicketNumber(mockAdmissionResult.id);
    setBornDateStr("20080101");
    setVerifyCode("");
    setStatus("success");
    setMessage("");
    setResult(mockAdmissionResult);
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
        setMessage("");
        setResult(data.data);
      } else {
        const errorCode = typeof data.code === "string" ? data.code : "UNKNOWN";
        setStatus("error");
        setMessage(errorMessages[errorCode] ?? "未查询到相关数据");
        setResult(null);
      }
      void loadCaptcha();
    } catch {
      setStatus("error");
      setMessage("网络错误，请稍后重试");
      setResult(null);
      void loadCaptcha();
    }
  }

  return (
    <main className="site-shell">
      <section className="query-card">
        <div className="title-block">
          <p className="brand">LaoShui · 舟山中考</p>
          <h1>{queryLabels[queryType]}</h1>
        </div>

        <div className="tabs" aria-label="选择查询类型">
          {(["score", "admission"] as QueryType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={queryType === type ? "active" : ""}
              onClick={() => switchType(type)}
            >
              {queryLabels[type]}
            </button>
          ))}
        </div>

        <form className="query-form" onSubmit={handleSubmit}>
          <FieldIcon icon="ticket">
            <input
              value={admissionTicketNumber}
              onChange={(event) => setAdmissionTicketNumber(onlyDigits(event.target.value, 14))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="准考证号（如 2409029113001）"
              aria-label="准考证号"
            />
          </FieldIcon>

          <FieldIcon icon="date">
            <input
              value={bornDateStr}
              onChange={(event) => setBornDateStr(onlyDigits(event.target.value, 8))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="出生年月日（如 20080101）"
              aria-label="出生年月日"
            />
          </FieldIcon>

          <div className="captcha-row">
            <FieldIcon icon="check">
              <input
                value={verifyCode}
                onChange={(event) => setVerifyCode(event.target.value.trim().toUpperCase())}
                autoComplete="off"
                placeholder="验证码"
                aria-label="验证码"
              />
            </FieldIcon>
            <button
              type="button"
              className="captcha"
              onClick={() => void loadCaptcha()}
              disabled={captchaLoading}
              title="刷新验证码"
            >
              {captchaLoading ? (
                <Icon name="loading" />
              ) : captchaImage ? (
                <img src={captchaImage} alt="验证码，点击刷新" />
              ) : (
                <Icon name="refresh" />
              )}
            </button>
          </div>

          {captchaError ? <p className="hint error">{captchaError}</p> : <p className="hint">看不清验证码可以点击图片刷新</p>}

          <button className="submit" type="submit" disabled={status === "loading" || captchaLoading}>
            {status === "loading" ? <Icon name="loading" /> : <Icon name="search" />}
            {queryType === "score" ? "查询成绩" : "查询录取结果"}
          </button>

          {showMockAdmission ? (
            <button className="mock-submit" type="button" onClick={handleMockAdmissionResult}>
              <Icon name="search" />
              <span className="mock-badge">TEST</span>
              生成模拟录取结果
            </button>
          ) : null}
        </form>

        <ResultArea
          status={status}
          message={message}
          queryType={queryType}
          result={result}
          birthDateStr={bornDateStr}
        />

        <p className="notice">查询结果仅供参考，最终以官方成绩单和录取通知书为准。</p>
      </section>
    </main>
  );
}

function FieldIcon({
  icon,
  children,
}: {
  icon: IconName;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>
        <Icon name={icon} />
      </span>
      {children}
    </label>
  );
}

function ResultArea({
  status,
  message,
  queryType,
  result,
  birthDateStr,
}: {
  status: Status;
  message: string;
  queryType: QueryType;
  result: ScoreResult | AdmissionResult | null;
  birthDateStr: string;
}) {
  if (status === "idle") return null;

  if (status === "loading" || status === "error") {
    return (
      <div className={`message ${status}`}>
        {status === "error" ? <Icon name="alert" /> : <Icon name="loading" />}
        <span>{message}</span>
      </div>
    );
  }

  if (!result) return null;

  return queryType === "score" ? (
    <ScoreResultView data={result as ScoreResult} />
  ) : (
    <AdmissionResultView data={result as AdmissionResult} birthDateStr={birthDateStr} />
  );
}

type IconName = "ticket" | "date" | "check" | "search" | "refresh" | "loading" | "alert";

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "ticket") {
    return (
      <svg {...common}>
        <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4Z" />
        <path d="M13 6v2" />
        <path d="M13 16v2" />
        <path d="M13 11v2" />
      </svg>
    );
  }

  if (name === "date") {
    return (
      <svg {...common}>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="3" />
        <path d="M3 10h18" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="M9 12l2 2 4-5" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }

  if (name === "refresh") {
    return (
      <svg {...common}>
        <path d="M20 12a8 8 0 0 1-13.66 5.66" />
        <path d="M4 12A8 8 0 0 1 17.66 6.34" />
        <path d="M17 2v5h-5" />
        <path d="M7 22v-5h5" />
      </svg>
    );
  }

  if (name === "alert") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    );
  }

  return (
    <svg {...common} className="spin">
      <path d="M21 12a9 9 0 0 1-9 9" />
      <path d="M3 12a9 9 0 0 1 9-9" />
    </svg>
  );
}

function ScoreResultView({ data }: { data: ScoreResult }) {
  return (
    <section className="result">
      <div className="result-head">
        <div>
          <span>考生</span>
          <strong>{show(data.candidateName)}</strong>
        </div>
        <div>
          <span>准考证号</span>
          <strong>{show(data.admissionTicketNumber)}</strong>
        </div>
      </div>

      <div className="score-main">
        <div>
          <span>总分</span>
          <strong>{show(data.totalScore)}</strong>
        </div>
        <div>
          <span>区域排名</span>
          <strong>{show(data.regionalRanking)}</strong>
        </div>
      </div>

      <ResultGrid title="考试成绩" items={scoreFields.map(([label, key]) => [label, show(data[key])])} />
      <ResultGrid title="综合素质" items={qualityFields.map(([label, key]) => [label, show(data[key])])} />
    </section>
  );
}

function AdmissionResultView({ data, birthDateStr }: { data: AdmissionResult; birthDateStr: string }) {
  const isLiuheng = data.admittedSchools?.includes("舟山市六横中学") ?? false;
  const [verificationCode, setVerificationCode] = useState<string>("");
  const [verificationError, setVerificationError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isLiuheng && data.id && /^\d{8}$/.test(birthDateStr)) {
      encryptAdmissionData({
        ticket: data.id,
        birthDate: birthDateStr,
        candidateName: data.candidateName,
      })
        .then((code) => {
          setVerificationCode(code);
          setVerificationError("");
        })
        .catch((err) => {
          console.error("Encryption failed", err);
          setVerificationCode("");
          setVerificationError("校验码生成失败，请截图本页面，并添加微信 laoshuikaixue 进行人工验证。");
        });
    }
  }, [isLiuheng, data.id, data.candidateName, birthDateStr]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verificationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <section className="result">
      <div className="result-list">
        <ResultLine label="考生姓名" value={show(data.candidateName)} />
        <ResultLine label="准考证号" value={show(data.id)} />
        <ResultLine label="毕业学校" value={show(data.graduationSchool)} />
        <ResultLine label="录取学校" value={show(data.admittedSchools)} strong />
        <ResultLine label="录取专业" value={show(data.admittedMajors)} />
      </div>

      {isLiuheng ? (
        <div className="school-tip">
          <strong>已录取到舟山市六横中学 🎉</strong>
          <span className="tip-desc">请扫描下方二维码加入微信新生交流群，并在申请信息中填写校验码进行录取身份核验。</span>
          
          {!verificationError ? (
          <div className="qr-container">
            <img src="/新生群二维码.png" alt="新生群二维码" className="qr-image" />
          </div>
          ) : null}
          
          <div className="code-container">
            <span className="code-label">入群申请校验码</span>
            <div className="code-row">
              <code className="code-value">{verificationCode || "正在生成校验码..."}</code>
              <button 
                type="button" 
                className="copy-btn" 
                onClick={handleCopy} 
                disabled={!verificationCode}
              >
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            {verificationError ? (
              <p className="manual-verify">
                <Icon name="alert" />
                <span>{verificationError}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ResultGrid({ title, items }: { title: string; items: Array<[string, string | number]> }) {
  return (
    <div className="result-section">
      <h2>{title}</h2>
      <div className="mini-grid">
        {items.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string | number;
  strong?: boolean;
}) {
  return (
    <p>
      <span>{label}</span>
      <strong className={strong ? "accent" : ""}>{value}</strong>
    </p>
  );
}
