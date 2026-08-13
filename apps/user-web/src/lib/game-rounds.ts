type RoundLike = {
  status: string;
  start_time: string;
  end_time: string;
  draw_time?: string;
  last_processed_date: string | null;
};

export type AppLanguage = "ko" | "en" | "zh";

function toSeconds(value: string) {
  const [hours, minutes, seconds] = value.substring(0, 8).split(":").map(Number);
  return (hours * 60 * 60) + (minutes * 60) + seconds;
}

function formatSeconds(totalSeconds: number) {
  const normalized = ((totalSeconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalized / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((normalized % 3600) / 60).toString().padStart(2, "0");
  const seconds = Math.floor(normalized % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function getRoundCloseTime(endTime: string) {
  return formatSeconds(toSeconds(endTime) - 60);
}

export function getRoundAvailability(round: RoundLike, currentTime: string, today: string) {
  const startTime = round.start_time.substring(0, 8);
  const closeTime = (round.draw_time ?? round.end_time).substring(0, 8);

  if (round.last_processed_date === today) {
    return {
      canParticipate: false,
      reason: "DRAW_COMPLETED",
      closeTime,
    };
  }

  if (round.status !== "OPEN") {
    return {
      canParticipate: false,
      reason: "ROUND_CLOSED",
      closeTime,
    };
  }

  if (currentTime < startTime) {
    return {
      canParticipate: false,
      reason: "NOT_STARTED",
      closeTime,
    };
  }

  if (currentTime >= closeTime) {
    return {
      canParticipate: false,
      reason: "BETTING_CLOSED",
      closeTime,
    };
  }

  return {
    canParticipate: true,
    reason: "OPEN",
    closeTime,
  };
}

export function getRoundAvailabilityMessage(reason: string) {
  switch (reason) {
    case "NOT_STARTED":
      return "Betting for this round has not started yet";
    case "BETTING_CLOSED":
      return "Betting closes when the draw time begins";
    case "DRAW_COMPLETED":
      return "This round has already been processed for today";
    case "ROUND_CLOSED":
      return "This round is currently closed";
    default:
      return "Round is not available";
  }
}

export function getParticipationErrorMessage(code: string | undefined, lang: AppLanguage, fallback?: string) {
  switch (code) {
    case "INVALID_PARAMETERS":
      return lang === "ko"
        ? "잘못된 참여 요청입니다."
        : lang === "en"
          ? "Invalid participation request."
          : "参与请求无效。";
    case "ROUND_NOT_FOUND":
      return lang === "ko"
        ? "유효하지 않은 회차입니다."
        : lang === "en"
          ? "Invalid round."
          : "无效的轮次。";
    case "NOT_STARTED":
      return lang === "ko"
        ? "아직 시작 전인 회차입니다."
        : lang === "en"
          ? "This round has not started yet."
          : "本轮尚未开始。";
    case "BETTING_CLOSED":
      return lang === "ko"
        ? "발표 시각부터는 배팅에 참여할 수 없습니다."
        : lang === "en"
          ? "Betting closes when the draw time begins."
          : "按北京时间，截止前1分钟停止投注。";
    case "DRAW_COMPLETED":
      return lang === "ko"
        ? "이 회차는 오늘 추첨이 이미 완료되었습니다."
        : lang === "en"
          ? "This round has already been drawn today."
          : "本轮今天已开奖完成。";
    case "ROUND_CLOSED":
      return lang === "ko"
        ? "현재 참여할 수 없는 회차입니다."
        : lang === "en"
          ? "This round is not available right now."
          : "当前该轮次不可参与。";
    case "SYSTEM_ASSET_CONFIG_MISSING":
      return lang === "ko"
        ? "시스템 자산 설정이 올바르지 않습니다."
        : lang === "en"
          ? "System asset configuration is incomplete."
          : "系统资产配置不完整。";
    case "INSUFFICIENT_USDT":
      return lang === "ko"
        ? "USDT 잔액이 부족합니다."
        : lang === "en"
          ? "Insufficient USDT balance."
          : "USDT 余额不足。";
    case "INSUFFICIENT_JADE":
      return lang === "ko"
        ? "옥구슬이 부족합니다."
        : lang === "en"
          ? "Insufficient Jade Beads."
          : "玉珠不足。";
    case "USER_SESSION_NOT_FOUND":
      return lang === "ko"
        ? "로그인 상태를 확인할 수 없습니다."
        : lang === "en"
          ? "User session not found."
          : "无法确认登录状态。";
    case "NETWORK_ERROR":
      return lang === "ko"
        ? "서버 통신 오류가 발생했습니다."
        : lang === "en"
          ? "Network error."
          : "网络通信出错。";
    default:
      if (fallback) {
        return fallback;
      }

      return lang === "ko"
        ? "참여 처리 중 오류가 발생했습니다."
        : lang === "en"
          ? "An error occurred while processing participation."
          : "参与处理时发生错误。";
  }
}
