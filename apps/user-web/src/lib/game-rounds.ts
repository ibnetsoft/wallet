type RoundLike = {
  status: string;
  start_time: string;
  end_time: string;
  last_processed_date: string | null;
};

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
  const endTime = round.end_time.substring(0, 8);
  const closeTime = getRoundCloseTime(endTime);

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
      return "Betting closes 1 minute before the round deadline";
    case "DRAW_COMPLETED":
      return "This round has already been processed for today";
    case "ROUND_CLOSED":
      return "This round is currently closed";
    default:
      return "Round is not available";
  }
}
