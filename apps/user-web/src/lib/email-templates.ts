export const emailLocales = ["zh", "en", "ko"] as const;

export type EmailLocale = (typeof emailLocales)[number];

type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type EmailMessageKey =
  | "missingEmail"
  | "emailServiceUnavailable"
  | "verificationSendFailed"
  | "verificationSent"
  | "missingNickname"
  | "userNotFound"
  | "passwordResetSendFailed"
  | "passwordResetSent"
  | "invalidVerificationRequest"
  | "invalidVerificationToken"
  | "serverError";

type EmailCopy = {
  htmlLang: string;
  verification: {
    subject: string;
    heading: string;
    greeting: string;
    body: string;
    button: string;
    notice: string;
  };
  passwordReset: {
    subject: string;
    heading: string;
    greeting: (nickname: string) => string;
    body: string;
    button: string;
    notice: string;
  };
  messages: Record<EmailMessageKey, string>;
};

const emailCopy: Record<EmailLocale, EmailCopy> = {
  ko: {
    htmlLang: "ko",
    verification: {
      subject: "[BAO369] 이메일 인증 안내",
      heading: "BAO369 이메일 인증",
      greeting: "안녕하세요.",
      body: "BAO369 회원가입을 계속하려면 아래 버튼을 눌러 이메일 주소를 인증해 주세요.",
      button: "이메일 인증 완료하기",
      notice: "이 링크는 15분 동안만 유효합니다. 본인이 요청하지 않았다면 이 이메일을 무시해 주세요.",
    },
    passwordReset: {
      subject: "[BAO369] 비밀번호 재설정 안내",
      heading: "BAO369 비밀번호 재설정",
      greeting: (nickname) => `안녕하세요, ${nickname}님.`,
      body: "비밀번호를 재설정하려면 아래 버튼을 눌러 주세요. 본인이 요청하지 않았다면 이 이메일을 무시해 주세요.",
      button: "비밀번호 재설정하기",
      notice: "이 링크는 15분 동안만 유효합니다.",
    },
    messages: {
      missingEmail: "올바른 이메일 주소를 입력해 주세요.",
      emailServiceUnavailable: "이메일 발송 설정이 완료되지 않았습니다.",
      verificationSendFailed: "인증 이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      verificationSent: "인증 이메일을 발송했습니다.",
      missingNickname: "닉네임을 입력해 주세요.",
      userNotFound: "등록된 닉네임을 찾을 수 없습니다.",
      passwordResetSendFailed: "비밀번호 재설정 이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      passwordResetSent: "비밀번호 재설정 링크를 이메일로 보냈습니다.",
      invalidVerificationRequest: "유효하지 않은 인증 요청입니다.",
      invalidVerificationToken: "유효하지 않거나 만료된 인증 링크입니다.",
      serverError: "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    },
  },
  en: {
    htmlLang: "en",
    verification: {
      subject: "[BAO369] Verify your email address",
      heading: "Verify your BAO369 email",
      greeting: "Hello,",
      body: "To continue creating your BAO369 account, please verify your email address using the button below.",
      button: "Verify email address",
      notice: "This link expires in 15 minutes. If you did not request this, you can safely ignore this email.",
    },
    passwordReset: {
      subject: "[BAO369] Reset your password",
      heading: "Reset your BAO369 password",
      greeting: (nickname) => `Hello, ${nickname}.`,
      body: "Use the button below to reset your password. If you did not request this, you can safely ignore this email.",
      button: "Reset password",
      notice: "This link expires in 15 minutes.",
    },
    messages: {
      missingEmail: "Please enter a valid email address.",
      emailServiceUnavailable: "Email delivery is not configured yet.",
      verificationSendFailed: "We could not send the verification email. Please try again shortly.",
      verificationSent: "Verification email sent.",
      missingNickname: "Please enter your nickname.",
      userNotFound: "We could not find that nickname.",
      passwordResetSendFailed: "We could not send the password reset email. Please try again shortly.",
      passwordResetSent: "Password reset link sent by email.",
      invalidVerificationRequest: "This verification request is invalid.",
      invalidVerificationToken: "This verification link is invalid or has expired.",
      serverError: "A server error occurred. Please try again shortly.",
    },
  },
  zh: {
    htmlLang: "zh-CN",
    verification: {
      subject: "[BAO369] 邮箱验证",
      heading: "BAO369 邮箱验证",
      greeting: "您好，",
      body: "如需继续注册 BAO369，请点击下方按钮验证您的邮箱地址。",
      button: "完成邮箱验证",
      notice: "此链接将在 15 分钟后失效。如果不是您本人发起的请求，请忽略此邮件。",
    },
    passwordReset: {
      subject: "[BAO369] 重置密码",
      heading: "重置 BAO369 密码",
      greeting: (nickname) => `您好，${nickname}。`,
      body: "如需重置密码，请点击下方按钮。如果不是您本人发起的请求，请忽略此邮件。",
      button: "重置密码",
      notice: "此链接将在 15 分钟后失效。",
    },
    messages: {
      missingEmail: "请输入有效的邮箱地址。",
      emailServiceUnavailable: "邮件发送服务尚未配置完成。",
      verificationSendFailed: "验证邮件发送失败，请稍后重试。",
      verificationSent: "验证邮件已发送。",
      missingNickname: "请输入昵称。",
      userNotFound: "未找到该昵称。",
      passwordResetSendFailed: "密码重置邮件发送失败，请稍后重试。",
      passwordResetSent: "密码重置链接已发送至邮箱。",
      invalidVerificationRequest: "无效的验证请求。",
      invalidVerificationToken: "验证链接无效或已过期。",
      serverError: "服务器发生错误，请稍后重试。",
    },
  },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };

    return entities[character];
  });
}

function createEmailHtml({
  htmlLang,
  heading,
  greeting,
  body,
  button,
  link,
  notice,
}: {
  htmlLang: string;
  heading: string;
  greeting: string;
  body: string;
  button: string;
  link: string;
  notice: string;
}) {
  const safeLink = escapeHtml(link);

  return `<!doctype html>
<html lang="${htmlLang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:24px;background:#f4f4f5;color:#1f2937;font-family:Arial,'Noto Sans KR','Noto Sans SC',sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="padding:22px;background:#0b0e11;color:#fcd535;text-align:center;font-size:22px;font-weight:700;">${heading}</div>
      <div style="padding:28px 30px;line-height:1.65;font-size:16px;">
        <p style="margin:0 0 16px;">${greeting}</p>
        <p style="margin:0 0 24px;">${body}</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${safeLink}" style="display:inline-block;padding:13px 24px;border-radius:7px;background:#fcd535;color:#0b0e11;font-weight:700;text-decoration:none;">${button}</a>
        </div>
        <p style="margin:0;color:#6b7280;font-size:13px;">${notice}</p>
      </div>
    </div>
  </body>
</html>`;
}

export function resolveEmailLocale(value: unknown, acceptLanguage?: string | null): EmailLocale {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase().split("-")[0];
    if (normalized === "ko" || normalized === "en" || normalized === "zh") {
      return normalized;
    }
  }

  const browserLanguage = acceptLanguage?.toLowerCase() ?? "";
  if (browserLanguage.includes("ko")) return "ko";
  if (browserLanguage.includes("en")) return "en";
  return "zh";
}

export function emailMessage(locale: EmailLocale, key: EmailMessageKey) {
  return emailCopy[locale].messages[key];
}

export function createVerificationEmail(locale: EmailLocale, confirmLink: string): EmailTemplate {
  const copy = emailCopy[locale];
  const { verification } = copy;

  return {
    subject: verification.subject,
    html: createEmailHtml({ ...verification, htmlLang: copy.htmlLang, link: confirmLink }),
    text: `${verification.heading}\n\n${verification.greeting}\n\n${verification.body}\n\n${verification.button}: ${confirmLink}\n\n${verification.notice}`,
  };
}

export function createPasswordResetEmail(
  locale: EmailLocale,
  resetLink: string,
  nickname: string
): EmailTemplate {
  const copy = emailCopy[locale];
  const { passwordReset } = copy;
  const greeting = passwordReset.greeting(nickname);

  return {
    subject: passwordReset.subject,
    html: createEmailHtml({
      htmlLang: copy.htmlLang,
      heading: passwordReset.heading,
      greeting: escapeHtml(greeting),
      body: passwordReset.body,
      button: passwordReset.button,
      link: resetLink,
      notice: passwordReset.notice,
    }),
    text: `${passwordReset.heading}\n\n${greeting}\n\n${passwordReset.body}\n\n${passwordReset.button}: ${resetLink}\n\n${passwordReset.notice}`,
  };
}
