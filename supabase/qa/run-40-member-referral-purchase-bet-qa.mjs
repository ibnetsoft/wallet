import fs from "node:fs";

// QA-only integration harness. It creates an isolated QA root and QA40M01-40.
// Registration runs through the same resolver rules as the API; purchase and
// participation run in database transactions matching the production routes.
const RUN_ID = "QA40-REFERRAL-PURCHASE-BET-20260813";
const TEST_PASSWORD = process.env.QA_TEST_PASSWORD ?? "Qa40!Test2026";
const QA_ROUND_NUMBER = 940401;
const QA_ROOT_NICKNAME = "QA40ROOT";
const LOGIN_VERIFICATION_INDEXES = new Set([1, 2, 3, 18, 19, 20, 21, 22]);

const PRODUCTS = {
  1: { price: 100, jade: 100, urc: 0, hongbao: 0, entries: 10, payoutLimit: 200 },
  2: { price: 500, jade: 550, urc: 1, hongbao: 1, entries: 50, payoutLimit: 1250 },
  3: { price: 1000, jade: 1200, urc: 3, hongbao: 3, entries: 100, payoutLimit: 3000 },
};

function readEnv() {
  const values = { ...process.env };
  for (const file of [".env", "apps/user-web/.env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const separator = line.indexOf("=");
      if (separator < 0) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim().replace(/^['\"]|['\"]$/g, "");
      if (!values[key]) values[key] = value;
    }
  }
  return values;
}

const env = readEnv();
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!baseUrl || !serviceKey || !anonKey) {
  throw new Error("Supabase URL, service role key, and anon key are required.");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function amount(value) {
  return Number(value ?? 0);
}

function sameAmount(actual, expected) {
  return Math.abs(amount(actual) - amount(expected)) < 0.000001;
}

function qaNickname(index) {
  return `QA40M${String(index).padStart(2, "0")}`;
}

function isQaNickname(nickname) {
  return nickname === QA_ROOT_NICKNAME || /^QA40M\d{2}$/i.test(nickname ?? "");
}

function isQaMemberNickname(nickname) {
  return /^QA40M\d{2}$/i.test(nickname ?? "");
}

function getUuidPrefixBounds(prefix) {
  if (!/^[0-9a-f]{8}$/i.test(prefix)) return null;
  const normalized = prefix.toLowerCase();
  const lowerBound = `${normalized}-0000-0000-0000-000000000000`;
  if (normalized === "ffffffff") return { lowerBound, upperBound: null };
  const nextPrefix = (Number.parseInt(normalized, 16) + 1).toString(16).padStart(8, "0");
  return { lowerBound, upperBound: `${nextPrefix}-0000-0000-0000-000000000000` };
}

function chunks(values, size = 20) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

const rest = (path, options) => request(`/rest/v1/${path}`, options);
const rpc = (name, payload) => rest(`rpc/${name}`, { method: "POST", body: payload });

async function deleteByIds(table, column, ids) {
  for (const batch of chunks(ids.filter(Boolean))) {
    if (!batch.length) continue;
    await rest(`${table}?${column}=in.(${batch.join(",")})`, { method: "DELETE" });
  }
}

async function getUsers() {
  return rest("users?select=id,email,nickname,parent_id,recommender_id,sponsor_id,original_recommender_id,status,referral_seq,accumulated_revenue,star_level,created_at&order=created_at.asc&limit=1000");
}

async function getProtectedAccountSnapshot(nickname) {
  const user = (await rest(`users?select=id,nickname,status,parent_id,recommender_id,sponsor_id,original_recommender_id,referral_seq,accumulated_revenue,star_level&nickname=eq.${encodeURIComponent(nickname)}&limit=1`))[0];
  assert(user, `protected account ${nickname} is missing`);

  const balances = await rest(`user_balances?select=asset_id,available_balance,locked_balance&user_id=eq.${user.id}&order=asset_id.asc&limit=100`);
  const machines = await rest(`user_game_machines?select=id,package_level,purchase_price,total_entry_limit,used_entries,payout_limit_usd,accumulated_payout_usd,bonus_settled,cheotan_tickets,created_at&user_id=eq.${user.id}&order=created_at.asc,id.asc&limit=100`);

  return JSON.stringify({ user, balances, machines });
}

async function getAuthUsers() {
  const payload = await request("/auth/v1/admin/users?page=1&per_page=1000");
  return Array.isArray(payload) ? payload : payload.users ?? payload.data?.users ?? [];
}

async function cleanupPriorQa40() {
  const users = await getUsers();
  const qaUsers = users.filter((user) => isQaNickname(user.nickname));
  const qaIds = new Set(qaUsers.map((user) => user.id));
  const externalRefs = users.filter((user) =>
    !qaIds.has(user.id) &&
    [user.parent_id, user.recommender_id, user.sponsor_id, user.original_recommender_id].some((id) => qaIds.has(id))
  );
  assert(externalRefs.length === 0, `non-QA profiles refer to QA40 users: ${externalRefs.map((user) => user.nickname).join(", ")}`);

  const qaMachines = qaIds.size
    ? await rest(`user_game_machines?select=id,user_id,purchase_price,accumulated_payout_usd&user_id=in.(${[...qaIds].join(",")})&limit=1000`)
    : [];
  const machineIds = qaMachines.map((machine) => machine.id);
  const allLedgers = await rest("ledger_entries?select=id,user_id,asset_id,amount,tx_type,details&limit=10000");
  const qaLedgers = allLedgers.filter((entry) => qaIds.has(entry.user_id));
  const qaMachineLedgerRows = allLedgers.filter((entry) => machineIds.includes(entry.details?.machine_id));
  const externalQaBonuses = qaMachineLedgerRows.filter((entry) => !qaIds.has(entry.user_id));
  assert(externalQaBonuses.length === 0, "QA40 bonus rows point to a non-QA account");
  const qaParticipants = qaIds.size
    ? await rest(`game_participants?select=id&user_id=in.(${[...qaIds].join(",")})&limit=1000`)
    : [];
  const qaClaims = machineIds.length
    ? await rest(`game_participant_entry_claims?select=id,participant_id&machine_id=in.(${machineIds.join(",")})&limit=1000`)
    : [];
  const qaAutoSettings = qaIds.size
    ? await rest(`auto_bet_settings?select=user_id&user_id=in.(${[...qaIds].join(",")})&limit=1000`)
    : [];
  const qaAutoExecutions = qaIds.size
    ? await rest(`auto_bet_executions?select=id&user_id=in.(${[...qaIds].join(",")})&limit=1000`)
    : [];
  const qaWallets = qaIds.size
    ? await rest(`user_wallets?select=id&user_id=in.(${[...qaIds].join(",")})&limit=1000`)
    : [];
  const qaBalances = qaIds.size
    ? await rest(`user_balances?select=id&user_id=in.(${[...qaIds].join(",")})&limit=1000`)
    : [];

  const existingRound = (await rest(`game_rounds?select=id,round_number&round_number=eq.${QA_ROUND_NUMBER}&limit=1`))[0];
  if (existingRound) {
    const nonQaParticipants = (await rest(`game_participants?select=id,user_id&round_id=eq.${existingRound.id}&limit=1000`))
      .filter((participant) => !qaIds.has(participant.user_id));
    assert(nonQaParticipants.length === 0, "QA40 game round has non-QA participants");
  }

  await deleteByIds("game_participant_entry_claims", "id", qaClaims.map((entry) => entry.id));
  await deleteByIds("game_participants", "id", qaParticipants.map((entry) => entry.id));
  await deleteByIds("auto_bet_executions", "id", qaAutoExecutions.map((entry) => entry.id));
  await deleteByIds("auto_bet_settings", "user_id", qaAutoSettings.map((entry) => entry.user_id));
  await deleteByIds("ledger_entries", "id", qaMachineLedgerRows.map((entry) => entry.id));
  await deleteByIds("ledger_entries", "id", qaLedgers.map((entry) => entry.id));
  await deleteByIds("user_game_machines", "id", machineIds);
  await deleteByIds("user_wallets", "id", qaWallets.map((entry) => entry.id));
  await deleteByIds("user_balances", "id", qaBalances.map((entry) => entry.id));

  if (existingRound) {
    await rest(`game_rounds?id=eq.${existingRound.id}`, { method: "DELETE" });
  }

  for (const batch of chunks([...qaIds])) {
    await rest(`users?id=in.(${batch.join(",")})`, {
      method: "PATCH",
      body: { parent_id: null, recommender_id: null, sponsor_id: null, original_recommender_id: null },
    });
  }
  await deleteByIds("users", "id", [...qaIds]);

  const authUsers = await getAuthUsers();
  const qaAuthUsers = authUsers.filter((user) =>
    isQaNickname(user.user_metadata?.nickname) || /^qa40(?:root|m\d{2})@sys\.hongbou\.com$/i.test(user.email ?? "")
  );
  for (const user of qaAuthUsers) {
    await request(`/auth/v1/admin/users/${user.id}`, { method: "DELETE" });
  }

  return { profiles: qaUsers.length, authUsers: qaAuthUsers.length, machines: qaMachines.length, ledgers: qaLedgers.length };
}

async function resolveReferrer(referralCode) {
  const masterCodes = ["URC883920", "BAO369", "MASTER"];
  if (!referralCode || masterCodes.includes(referralCode.toUpperCase())) return null;

  let rows = [];
  if (referralCode.toUpperCase().startsWith("BAO-")) {
    const bounds = getUuidPrefixBounds(referralCode.slice(4));
    if (bounds) {
      const upperFilter = bounds.upperBound ? `&id=lt.${bounds.upperBound}` : "";
      rows = await rest(`users?select=id,nickname,email&id=gte.${bounds.lowerBound}${upperFilter}&order=id.asc&limit=2`);
      assert(rows.length <= 1, `ambiguous BAO referral prefix: ${referralCode}`);
      if (rows.length === 1) return rows[0];
    }
  }
  rows = await rest(`users?select=id,nickname,email&nickname=eq.${encodeURIComponent(referralCode)}&limit=1`);
  if (rows.length) return rows[0];
  rows = await rest(`users?select=id,nickname,email&email=eq.${encodeURIComponent(referralCode)}&limit=1`);
  return rows[0] ?? null;
}

async function createRegisteredUser(nickname, referralCode, expectedParentId) {
  const resolved = await resolveReferrer(referralCode);
  assert((resolved?.id ?? null) === expectedParentId, `${nickname} referral resolver mismatch for ${referralCode ?? "no code"}`);

  const auth = await request("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email: `${nickname.toLowerCase()}@sys.hongbou.com`,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { nickname, real_email: `${nickname.toLowerCase()}@qa.hongbou.test`, qa_run: RUN_ID },
    },
  });
  const id = auth.id ?? auth.user?.id;
  assert(id, `${nickname} auth create did not return an id`);

  try {
    const rows = await rest("users", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        id,
        email: `${nickname.toLowerCase()}@qa.hongbou.test`,
        nickname,
        status: "PENDING",
        ...(resolved ? { parent_id: resolved.id, recommender_id: resolved.id } : {}),
      },
    });
    assert(rows.length === 1, `${nickname} public profile was not created`);
    return rows[0];
  } catch (error) {
    await request(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
    throw error;
  }
}

async function verifyCredentials(nickname) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${nickname.toLowerCase()}@sys.hongbou.com`, password: TEST_PASSWORD }),
    });
    if (response.ok) {
      const data = await response.json();
      assert(data.access_token && data.user?.id, `${nickname} auth login response was incomplete`);
      return;
    }
    if (response.status !== 429 || attempt === 2) {
      throw new Error(`${nickname} auth login failed (${response.status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2500 * (attempt + 1)));
  }
}

async function getAssets() {
  const assets = await rest("assets?select=id,symbol&symbol=in.(USDT,JADE,URC,HONGBAO)&limit=10");
  const bySymbol = Object.fromEntries(assets.map((asset) => [asset.symbol, Number(asset.id)]));
  for (const symbol of ["USDT", "JADE", "URC", "HONGBAO"]) assert(bySymbol[symbol], `${symbol} asset is missing`);
  return bySymbol;
}

async function getBalance(userId, assetId) {
  const rows = await rest(`user_balances?select=id,available_balance&user_id=eq.${userId}&asset_id=eq.${assetId}&limit=1`);
  return rows[0] ?? null;
}

async function adjustBalance(userId, assetId, delta) {
  const current = await getBalance(userId, assetId);
  const next = amount(current?.available_balance) + delta;
  assert(next >= 0, `insufficient asset ${assetId} balance for ${userId}`);
  if (current) {
    await rest(`user_balances?id=eq.${current.id}`, { method: "PATCH", body: { available_balance: next } });
  } else {
    await rest("user_balances", { method: "POST", body: { user_id: userId, asset_id: assetId, available_balance: next, locked_balance: 0 } });
  }
}

async function addLedger({ userId, assetId, amount: entryAmount, txType, txHash, details }) {
  await rest("ledger_entries", {
    method: "POST",
    body: {
      user_id: userId,
      asset_id: assetId,
      amount: entryAmount,
      tx_type: txType,
      status: "COMPLETED",
      tx_hash: txHash,
      details,
    },
  });
}

async function activateUser(user) {
  const rows = await rest(`users?id=eq.${user.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: { status: "ACTIVE" },
  });
  assert(rows.length === 1 && rows[0].status === "ACTIVE", `${user.nickname} did not activate`);
  return rows[0];
}

async function createQaRoot() {
  const user = await createRegisteredUser(QA_ROOT_NICKNAME, null, null);
  return activateUser(user);
}

async function deposit(user, assets, depositAmount) {
  await adjustBalance(user.id, assets.USDT, depositAmount);
  await addLedger({
    userId: user.id,
    assetId: assets.USDT,
    amount: depositAmount,
    txType: "DEPOSIT",
    txHash: `${RUN_ID}-DEPOSIT-${user.nickname}`,
    details: { qa_run: RUN_ID, nickname: user.nickname },
  });
}

async function purchase(user, assets, level, ordinal) {
  const product = PRODUCTS[level];
  assert(product, `invalid level ${level}`);
  const suffix = `${user.nickname}-L${level}-${ordinal}`;
  const details = { qa_run: RUN_ID, nickname: user.nickname, package_level: level };
  await adjustBalance(user.id, assets.USDT, -product.price);
  await adjustBalance(user.id, assets.JADE, product.jade);
  if (product.urc) await adjustBalance(user.id, assets.URC, product.urc);
  if (product.hongbao) await adjustBalance(user.id, assets.HONGBAO, product.hongbao);
  await addLedger({ userId: user.id, assetId: assets.USDT, amount: -product.price, txType: "PACKAGE_BUY", txHash: `${RUN_ID}-BUY-${suffix}`, details });
  await addLedger({ userId: user.id, assetId: assets.JADE, amount: product.jade, txType: "PACKAGE_BONUS", txHash: `${RUN_ID}-JADE-${suffix}`, details });
  if (product.urc) await addLedger({ userId: user.id, assetId: assets.URC, amount: product.urc, txType: "PACKAGE_BONUS", txHash: `${RUN_ID}-URC-${suffix}`, details });
  if (product.hongbao) await addLedger({ userId: user.id, assetId: assets.HONGBAO, amount: product.hongbao, txType: "PACKAGE_BONUS", txHash: `${RUN_ID}-HONGBAO-${suffix}`, details });
  const machines = await rest("user_game_machines", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      user_id: user.id,
      package_level: level,
      purchase_price: product.price,
      total_entry_limit: product.entries,
      payout_limit_usd: product.payoutLimit,
    },
  });
  const machine = machines[0];
  assert(machine?.id, `machine insertion failed for ${suffix}`);
  const response = await rpc("settle_machine_purchase", { p_machine_id: machine.id });
  const settlement = Array.isArray(response) ? response[0]?.settle_machine_purchase ?? response[0] : response?.settle_machine_purchase ?? response;
  assert(settlement?.settled === true, `bonus settlement failed for ${suffix}`);
  return { machine, settlement };
}

function shanghaiNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}:${values.second}` };
}

async function createQaRound() {
  const now = shanghaiNow();
  assert(now.time >= "00:00:00" && now.time < "23:59:00", "QA round can only run before 23:59 Shanghai time");
  const rounds = await rest("game_rounds", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      round_number: QA_ROUND_NUMBER,
      start_time: "00:00:00",
      end_time: "23:58:00",
      draw_time: "23:59:00",
      status: "OPEN",
      last_processed_date: null,
    },
  });
  const round = rounds[0];
  assert(round?.id, "QA game round was not created");
  return { round, date: now.date };
}

// Mirrors executeParticipation in apps/user-web/src/lib/game-participation.ts.
// REST is used only for this isolated QA harness; normal users call the API.
async function participate({ user, round, roundDate, assets, tickets, callOrdinal }) {
  assert(tickets >= 1 && tickets <= 100, `${user.nickname} invalid tickets`);
  const freshUser = (await rest(`users?select=status& id=eq.${user.id}`.replace("& ", "&")))[0];
  assert(freshUser?.status === "ACTIVE", `${user.nickname} is not active`);

  const machines = await rest(`user_game_machines?select=id,total_entry_limit,used_entries,accumulated_payout_usd,payout_limit_usd,created_at&user_id=eq.${user.id}&order=created_at.asc,id.asc&limit=1000`);
  // PostgREST cannot compare two columns in a filter; retain only eligible rows here.
  const eligible = machines.filter((machine) => amount(machine.used_entries) < amount(machine.total_entry_limit) && amount(machine.accumulated_payout_usd) < amount(machine.payout_limit_usd));
  const availableEntries = eligible.reduce((sum, machine) => sum + amount(machine.total_entry_limit) - amount(machine.used_entries), 0);
  assert(availableEntries >= tickets, `${user.nickname} does not have enough entries`);

  await adjustBalance(user.id, assets.USDT, -(100 * tickets));
  await adjustBalance(user.id, assets.JADE, -tickets);

  const claims = [];
  let pending = tickets;
  for (const machine of eligible) {
    if (!pending) break;
    const available = amount(machine.total_entry_limit) - amount(machine.used_entries);
    const used = Math.min(available, pending);
    await rest(`user_game_machines?id=eq.${machine.id}`, {
      method: "PATCH",
      body: { used_entries: amount(machine.used_entries) + used },
    });
    claims.push({ machineId: machine.id, count: used });
    pending -= used;
  }
  assert(pending === 0, `${user.nickname} entry claim was incomplete`);

  const details = { qa_run: RUN_ID, nickname: user.nickname, round_id: round.id, tickets, call_ordinal: callOrdinal };
  await addLedger({ userId: user.id, assetId: assets.USDT, amount: -(100 * tickets), txType: "GAME_WAGER", txHash: `${RUN_ID}-WAGER-USDT-${user.nickname}-${callOrdinal}`, details });
  await addLedger({ userId: user.id, assetId: assets.JADE, amount: -tickets, txType: "GAME_WAGER", txHash: `${RUN_ID}-WAGER-JADE-${user.nickname}-${callOrdinal}`, details });

  const participants = await rest(`game_participants?select=id,tickets_count&round_id=eq.${round.id}&user_id=eq.${user.id}&round_date=eq.${roundDate}&limit=1`);
  let participant;
  if (participants.length) {
    const current = participants[0];
    const updated = await rest(`game_participants?id=eq.${current.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: { tickets_count: amount(current.tickets_count) + tickets, status: "PENDING" },
    });
    participant = updated[0];
  } else {
    const created = await rest("game_participants", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: { round_id: round.id, user_id: user.id, round_date: roundDate, tickets_count: tickets, status: "PENDING" },
    });
    participant = created[0];
  }
  assert(participant?.id, `${user.nickname} participant record was not created`);

  for (const claim of claims) {
    const existing = await rest(`game_participant_entry_claims?select=id,entries_count&participant_id=eq.${participant.id}&machine_id=eq.${claim.machineId}&limit=1`);
    if (existing.length) {
      await rest(`game_participant_entry_claims?id=eq.${existing[0].id}`, { method: "PATCH", body: { entries_count: amount(existing[0].entries_count) + claim.count } });
    } else {
      await rest("game_participant_entry_claims", { method: "POST", body: { participant_id: participant.id, machine_id: claim.machineId, entries_count: claim.count } });
    }
  }
  return { claims, participantId: participant.id };
}

function referralSpec(index, usersByNickname, root) {
  const named = (parentNickname, mode) => {
    const parent = usersByNickname[parentNickname];
    assert(parent, `parent ${parentNickname} is not registered`);
    if (mode === "bao") return { code: `BAO-${parent.id.slice(0, 8)}`, parentId: parent.id, mode };
    if (mode === "email") return { code: parent.email, parentId: parent.id, mode };
    return { code: parent.nickname, parentId: parent.id, mode: "nickname" };
  };

  if (index === 1) return { code: root.nickname, parentId: root.id, mode: "nickname" };
  if (index === 2) return named(qaNickname(1), "bao");
  if (index === 3) return named(qaNickname(2), "email");
  if (index === 4) return named(qaNickname(3), "nickname");
  if (index >= 5 && index <= 16) return named(qaNickname(4), ["nickname", "bao", "email"][(index - 5) % 3]);
  if (index === 17) return { code: root.nickname, parentId: root.id, mode: "nickname" };
  if (index === 18) return { code: `BAO-${root.id.slice(0, 8)}`, parentId: root.id, mode: "bao" };
  if (index === 19) return { code: null, parentId: null, mode: "none" };
  if (index === 20) return { code: "URC883920", parentId: null, mode: "master" };
  if (index === 21) return { code: "BAO369", parentId: null, mode: "master" };
  if (index === 22) return { code: "MASTER", parentId: null, mode: "master" };
  if (index >= 23 && index <= 30) return named(qaNickname(17), ["nickname", "bao", "email"][(index - 23) % 3]);
  if (index >= 31 && index <= 40) return named(qaNickname(18), ["nickname", "bao", "email"][(index - 31) % 3]);
  throw new Error(`Unhandled QA index ${index}`);
}

function purchaseLevels(index) {
  if ([4, 17, 18].includes(index)) return [1, 2, 3];
  if ([1, 2, 3].includes(index)) return [3];
  return [((index - 1) % 3) + 1];
}

function betPlan(index) {
  if (index === 4) return [1];
  if (index === 17) return [2, 3];
  // QA40M18 receives enough referral capacity to leave its L2 and L3
  // machines eligible. Sixty tickets exercises entry allocation over both.
  if (index === 18) return [60];
  return [1 + (index % 3)];
}

function expectedSponsorForDirectChild(parent, sequence, ids) {
  if (sequence % 3 !== 0) return parent.id;
  let current = parent;
  for (let generation = 0; generation < sequence / 3; generation += 1) {
    const next = ids[current.recommender_id];
    if (!next) return current.id;
    current = next;
  }
  return current.id;
}

async function verify(usersByNickname, assets, round, roundDate, purchaseRecords, betRecords, codeModes) {
  const users = (await getUsers()).filter((user) => isQaMemberNickname(user.nickname));
  assert(users.length === 40, `expected 40 QA profiles, found ${users.length}`);
  const byNickname = Object.fromEntries(users.map((user) => [user.nickname, user]));
  const byId = Object.fromEntries(users.map((user) => [user.id, user]));
  const qaAuthUsers = (await getAuthUsers()).filter((user) => isQaNickname(user.user_metadata?.nickname));
  assert(qaAuthUsers.length === 41, `expected 41 QA auth users including the root, found ${qaAuthUsers.length}`);

  for (let index = 1; index <= 40; index += 1) {
    const nickname = qaNickname(index);
    const expected = referralSpec(index, usersByNickname, usersByNickname[QA_ROOT_NICKNAME]);
    const user = byNickname[nickname];
    assert(user?.status === "ACTIVE", `${nickname} is not active`);
    assert(user.recommender_id === expected.parentId, `${nickname} recommender mismatch`);
  }

  const directGroups = [
    { parent: qaNickname(4), children: Array.from({ length: 12 }, (_, offset) => qaNickname(offset + 5)) },
    { parent: qaNickname(17), children: Array.from({ length: 8 }, (_, offset) => qaNickname(offset + 23)) },
    { parent: qaNickname(18), children: Array.from({ length: 10 }, (_, offset) => qaNickname(offset + 31)) },
  ];
  for (const group of directGroups) {
    const parent = byNickname[group.parent];
    for (const [offset, childNickname] of group.children.entries()) {
      const child = byNickname[childNickname];
      const seq = offset + 1;
      assert(amount(child.referral_seq) === seq, `${childNickname} referral sequence mismatch`);
      assert(child.sponsor_id === expectedSponsorForDirectChild(parent, seq, { ...byId, [usersByNickname[QA_ROOT_NICKNAME].id]: usersByNickname[QA_ROOT_NICKNAME] }), `${childNickname} sponsor mismatch`);
    }
  }

  const qaIds = users.map((user) => user.id);
  const machines = await rest(`user_game_machines?select=id,user_id,package_level,purchase_price,used_entries,total_entry_limit,bonus_settled&user_id=in.(${qaIds.join(",")})&order=created_at.asc&limit=1000`);
  assert(machines.length === 46, `expected 46 purchased machines, found ${machines.length}`);
  assert(machines.every((machine) => machine.bonus_settled), "not all QA purchases were settled");

  const machineIds = new Set(machines.map((machine) => machine.id));
  const ledgers = await rest("ledger_entries?select=id,user_id,asset_id,amount,tx_type,details&limit=10000");
  const qaLedgers = ledgers.filter((entry) => qaIds.includes(entry.user_id));
  assert(qaLedgers.filter((entry) => entry.tx_type === "DEPOSIT").length === 40, "deposit ledger count mismatch");
  assert(qaLedgers.filter((entry) => entry.tx_type === "PACKAGE_BUY").length === 46, "package purchase ledger count mismatch");

  const bonusTypes = ["REFERRAL_BONUS", "FOSTER_BONUS", "MAMA_BONUS"];
  const actualBonuses = ledgers.filter((entry) => bonusTypes.includes(entry.tx_type) && machineIds.has(entry.details?.machine_id));
  const expectedBonuses = [];
  for (const machine of machines) {
    const owner = byId[machine.user_id];
    const price = amount(machine.purchase_price);
    if (owner.recommender_id) expectedBonuses.push({ userId: owner.recommender_id, machineId: machine.id, type: "REFERRAL_BONUS", value: price * 0.2 });
    if (owner.sponsor_id) {
      expectedBonuses.push({ userId: owner.sponsor_id, machineId: machine.id, type: "FOSTER_BONUS", value: price * 0.1 });
      const sponsor = owner.sponsor_id === usersByNickname[QA_ROOT_NICKNAME].id ? usersByNickname[QA_ROOT_NICKNAME] : byId[owner.sponsor_id];
      if (sponsor?.recommender_id) expectedBonuses.push({ userId: sponsor.recommender_id, machineId: machine.id, type: "MAMA_BONUS", value: price * 0.1 });
    }
  }
  assert(actualBonuses.length === expectedBonuses.length, `expected ${expectedBonuses.length} bonus rows, found ${actualBonuses.length}`);
  for (const expected of expectedBonuses) {
    const rows = actualBonuses.filter((entry) => entry.user_id === expected.userId && entry.tx_type === expected.type && entry.details?.machine_id === expected.machineId);
    assert(rows.length === 1 && sameAmount(rows[0].amount, expected.value), `bonus mismatch for ${expected.type} on ${expected.machineId}`);
  }

  const participants = await rest(`game_participants?select=id,user_id,tickets_count,status,round_date&round_id=eq.${round.id}&round_date=eq.${roundDate}&limit=1000`);
  assert(participants.length === 40, `expected 40 game participants, found ${participants.length}`);
  assert(participants.every((participant) => participant.status === "PENDING"), "a QA bet is not pending");
  const participantIds = participants.map((participant) => participant.id);
  const claims = await rest(`game_participant_entry_claims?select=participant_id,machine_id,entries_count&participant_id=in.(${participantIds.join(",")})&limit=1000`);
  const expectedTickets = betRecords.reduce((sum, record) => sum + record.tickets, 0);
  assert(participants.reduce((sum, participant) => sum + amount(participant.tickets_count), 0) === expectedTickets, "participant ticket total mismatch");
  assert(claims.reduce((sum, claim) => sum + amount(claim.entries_count), 0) === expectedTickets, "entry claim total mismatch");
  assert(machines.reduce((sum, machine) => sum + amount(machine.used_entries), 0) === expectedTickets, "machine used-entry total mismatch");

  const m18 = byNickname[qaNickname(18)];
  const m18Participant = participants.find((participant) => participant.user_id === m18.id);
  const m18Claims = claims.filter((claim) => claim.participant_id === m18Participant.id);
  assert(amount(m18Participant.tickets_count) === 60 && m18Claims.length === 2, "QA40M18 did not test cross-machine entry claims");
  const m17Participant = participants.find((participant) => participant.user_id === byNickname[qaNickname(17)].id);
  assert(amount(m17Participant.tickets_count) === 5, "QA40M17 did not aggregate repeated bets");

  const wagerLedgers = qaLedgers.filter((entry) => entry.tx_type === "GAME_WAGER" && entry.details?.qa_run === RUN_ID);
  assert(wagerLedgers.length === betRecords.length * 2, "game wager ledger count mismatch");
  assert(sameAmount(wagerLedgers.filter((entry) => amount(entry.asset_id) === assets.USDT).reduce((sum, entry) => sum + amount(entry.amount), 0), -expectedTickets * 100), "USDT wager total mismatch");
  assert(sameAmount(wagerLedgers.filter((entry) => amount(entry.asset_id) === assets.JADE).reduce((sum, entry) => sum + amount(entry.amount), 0), -expectedTickets), "JADE wager total mismatch");

  return {
    registeredUsers: users.length,
    registeredAuthUsers: qaAuthUsers.length,
    referralCodeModes: codeModes,
    purchasedMachines: machines.length,
    totalPurchaseUsdt: machines.reduce((sum, machine) => sum + amount(machine.purchase_price), 0),
    bonusRows: actualBonuses.length,
    bonusTotals: Object.fromEntries(bonusTypes.map((type) => [type, actualBonuses.filter((entry) => entry.tx_type === type).reduce((sum, entry) => sum + amount(entry.amount), 0)])),
    round: { id: round.id, number: QA_ROUND_NUMBER, date: roundDate },
    participantRows: participants.length,
    wagerCalls: betRecords.length,
    totalTickets: expectedTickets,
    crossMachineBet: { nickname: qaNickname(18), tickets: 60, claims: m18Claims.length },
    repeatedBet: { nickname: qaNickname(17), tickets: 5 },
  };
}

async function run() {
  const protectedBefore = await getProtectedAccountSnapshot("antz15");
  const cleanup = await cleanupPriorQa40();
  const invalid = await resolveReferrer("QA40-NOT-FOUND");
  assert(invalid === null, "invalid referral code unexpectedly resolved");

  const root = await createQaRoot();
  await verifyCredentials(QA_ROOT_NICKNAME);
  const usersByNickname = { [QA_ROOT_NICKNAME]: root };
  const codeModes = { nickname: 0, bao: 0, email: 0, master: 0, none: 0, invalidRejected: 1 };
  const assets = await getAssets();

  // The isolated root owns capacity for every bonus it can receive. It has no
  // recommender, so these bootstrap purchases cannot credit a real account.
  await deposit(root, assets, 1600);
  for (const [offset, level] of [1, 2, 3].entries()) {
    await purchase(root, assets, level, offset + 1);
  }

  for (let index = 1; index <= 40; index += 1) {
    const nickname = qaNickname(index);
    const spec = referralSpec(index, usersByNickname, root);
    const user = await createRegisteredUser(nickname, spec.code, spec.parentId);
    usersByNickname[nickname] = user;
    codeModes[spec.mode] += 1;
    if (LOGIN_VERIFICATION_INDEXES.has(index)) {
      await verifyCredentials(nickname);
    }
  }

  const purchaseRecords = [];
  for (let index = 1; index <= 40; index += 1) {
    const user = await activateUser(usersByNickname[qaNickname(index)]);
    usersByNickname[qaNickname(index)] = user;
    const levels = purchaseLevels(index);
    const tickets = betPlan(index).reduce((sum, value) => sum + value, 0);
    const purchaseTotal = levels.reduce((sum, level) => sum + PRODUCTS[level].price, 0);
    await deposit(user, assets, purchaseTotal + tickets * 100 + 100);
    for (const [offset, level] of levels.entries()) {
      purchaseRecords.push({ user, ...(await purchase(user, assets, level, offset + 1)) });
    }
  }

  const { round, date } = await createQaRound();
  const betRecords = [];
  for (let index = 1; index <= 40; index += 1) {
    const user = usersByNickname[qaNickname(index)];
    for (const [offset, tickets] of betPlan(index).entries()) {
      await participate({ user, round, roundDate: date, assets, tickets, callOrdinal: offset + 1 });
      betRecords.push({ user, tickets, callOrdinal: offset + 1 });
    }
  }

  const report = await verify(usersByNickname, assets, round, date, purchaseRecords, betRecords, codeModes);
  const protectedAfter = await getProtectedAccountSnapshot("antz15");
  assert(protectedAfter === protectedBefore, "antz15 changed during the isolated QA run");
  console.log(JSON.stringify({ run: RUN_ID, cleanup, verification: "passed", protectedAccountUnchanged: true, report }, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
