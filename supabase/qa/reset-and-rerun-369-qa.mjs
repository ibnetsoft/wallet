import fs from "node:fs";

// This script intentionally scopes destructive cleanup to the QA hierarchy
// rooted at antz15, then reproduces the 369 referral/sponsor scenario.
const APPLY = process.argv.includes("--apply");
const RUN_ID = "QA369-FRESH-20260813";
const TEST_PASSWORD = process.env.QA_TEST_PASSWORD ?? "Qa369!Test2026";

const PRODUCTS = {
  1: { price: 100, jade: 100, urc: 0, hongbao: 0, entries: 10, payoutLimit: 200 },
  2: { price: 500, jade: 550, urc: 1, hongbao: 1, entries: 50, payoutLimit: 1250 },
  3: { price: 1000, jade: 1200, urc: 3, hongbao: 3, entries: 100, payoutLimit: 3000 },
};

function readEnv() {
  const parsed = { ...process.env };
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['\"]|['\"]$/g, "");
    if (!parsed[key]) parsed[key] = value;
  }
  return parsed;
}

const env = readEnv();
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!baseUrl || !serviceKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function asNumber(value) {
  return Number(value ?? 0);
}

function sameAmount(actual, expected) {
  return Math.abs(asNumber(actual) - asNumber(expected)) < 0.000001;
}

function isTestNickname(nickname) {
  if (nickname === "antz15") return true;
  return /^QAANTZ\d+$/i.test(nickname ?? "") || /^QAT3A\d+$/i.test(nickname ?? "") || /^QAT3B\d+(?:C\d+)?$/i.test(nickname ?? "");
}

function isTestAuthUser(user) {
  const nickname = user.user_metadata?.nickname;
  const email = String(user.email ?? "").toLowerCase();
  return isTestNickname(nickname) || /^(?:antz15|qaantz\d+|qat3a\d+|qat3b\d+(?:c\d+)?)@sys\.hongbou\.com$/.test(email);
}

function chunks(values, size = 20) {
  const result = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function inFilter(column, values) {
  return `${column}=in.(${values.join(",")})`;
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

function rest(path, options) {
  return request(`/rest/v1/${path}`, options);
}

function rpc(name, payload) {
  return rest(`rpc/${name}`, { method: "POST", body: payload });
}

async function getUsers() {
  return rest("users?select=id,email,nickname,parent_id,recommender_id,sponsor_id,original_recommender_id,status,referral_seq,accumulated_revenue,star_level,created_at&order=created_at.asc&limit=1000");
}

async function getAuthUsers() {
  const response = await request("/auth/v1/admin/users?page=1&per_page=1000");
  if (Array.isArray(response)) return response;
  return response?.users ?? response?.data?.users ?? [];
}

async function getMachines(userIds) {
  if (!userIds.length) return [];
  const rows = [];
  for (const ids of chunks(userIds)) {
    rows.push(...await rest(`user_game_machines?select=id,user_id,package_level,purchase_price,total_entry_limit,payout_limit_usd,accumulated_payout_usd,bonus_settled,created_at&${inFilter("user_id", ids)}&limit=1000`));
  }
  return rows;
}

async function getLedgers() {
  return rest("ledger_entries?select=id,user_id,asset_id,amount,tx_type,status,tx_hash,details,created_at&order=created_at.asc&limit=10000");
}

async function deleteByIds(table, column, ids) {
  for (const batch of chunks(ids)) {
    await rest(`${table}?${inFilter(column, batch)}`, { method: "DELETE" });
  }
}

async function clearExistingQaData() {
  const users = await getUsers();
  const testUsers = users.filter((user) => isTestNickname(user.nickname));
  const testIds = new Set(testUsers.map((user) => user.id));
  const externalReferences = users.filter((user) =>
    !testIds.has(user.id) && [user.parent_id, user.recommender_id, user.sponsor_id, user.original_recommender_id].some((id) => testIds.has(id))
  );
  assert(externalReferences.length === 0, `test members are referenced by non-test users: ${externalReferences.map((user) => user.nickname).join(", ")}`);

  const machines = await getMachines([...testIds]);
  const machineIds = new Set(machines.map((machine) => machine.id));
  const ledgers = await getLedgers();
  const externalMachineLedgers = ledgers.filter((entry) => !testIds.has(entry.user_id) && machineIds.has(entry.details?.machine_id));
  assert(externalMachineLedgers.length === 0, "test purchases have bonus entries owned by non-test users");

  const authUsers = (await getAuthUsers()).filter(isTestAuthUser);
  const summary = {
    users: testUsers.length,
    authUsers: authUsers.length,
    machines: machines.length,
    ledgers: ledgers.filter((entry) => testIds.has(entry.user_id)).length,
  };

  if (!APPLY) {
    console.log(JSON.stringify({ mode: "dry-run", cleanup: summary, message: "Run with --apply to delete only this isolated QA hierarchy." }, null, 2));
    return null;
  }

  const ids = [...testIds];
  const machineIdList = [...machineIds];
  if (ids.length) {
    await deleteByIds("game_participants", "user_id", ids);
    await deleteByIds("auto_bet_executions", "user_id", ids);
    await deleteByIds("auto_bet_settings", "user_id", ids);
    await deleteByIds("game_participant_entry_claims", "machine_id", machineIdList);
    await deleteByIds("ledger_entries", "user_id", ids);
    await deleteByIds("user_game_machines", "user_id", ids);
    await deleteByIds("user_wallets", "user_id", ids);
    await deleteByIds("user_balances", "user_id", ids);
    for (const batch of chunks(ids)) {
      await rest(`users?${inFilter("id", batch)}`, {
        method: "PATCH",
        body: { parent_id: null, recommender_id: null, sponsor_id: null, original_recommender_id: null },
      });
    }
    await deleteByIds("users", "id", ids);
  }

  for (const authUser of authUsers) {
    await request(`/auth/v1/admin/users/${authUser.id}`, { method: "DELETE" });
  }

  const remainingProfiles = (await getUsers()).filter((user) => isTestNickname(user.nickname));
  const remainingAuth = (await getAuthUsers()).filter(isTestAuthUser);
  assert(remainingProfiles.length === 0, "QA public profiles remain after cleanup");
  assert(remainingAuth.length === 0, "QA auth users remain after cleanup");
  console.log(`Cleaned isolated QA data: ${JSON.stringify(summary)}.`);
  return summary;
}

async function createActiveUser(nickname, parentId = null) {
  const auth = await request("/auth/v1/admin/users", {
    method: "POST",
    body: {
      email: `${nickname.toLowerCase()}@sys.hongbou.com`,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { nickname, real_email: `${nickname.toLowerCase()}@qa.hongbou.test` },
    },
  });
  const id = auth.id ?? auth.user?.id;
  assert(id, `auth creation did not return an id for ${nickname}`);

  try {
    const inserted = await rest("users", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        id,
        email: `${nickname.toLowerCase()}@qa.hongbou.test`,
        nickname,
        status: "PENDING",
        ...(parentId ? { parent_id: parentId, recommender_id: parentId } : {}),
      },
    });
    assert(Array.isArray(inserted) && inserted.length === 1, `profile creation failed for ${nickname}`);
    const activated = await rest(`users?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: { status: "ACTIVE" },
    });
    assert(Array.isArray(activated) && activated.length === 1, `activation failed for ${nickname}`);
    return activated[0];
  } catch (error) {
    await request(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
    throw error;
  }
}

async function getAssets() {
  const assets = await rest("assets?select=id,symbol&symbol=in.(USDT,JADE,URC,HONGBAO)&limit=10");
  const bySymbol = Object.fromEntries(assets.map((asset) => [asset.symbol, Number(asset.id)]));
  for (const symbol of ["USDT", "JADE", "URC", "HONGBAO"]) assert(bySymbol[symbol], `${symbol} asset is missing`);
  return bySymbol;
}

async function readBalance(userId, assetId) {
  const rows = await rest(`user_balances?select=id,available_balance&user_id=eq.${userId}&asset_id=eq.${assetId}&limit=1`);
  return rows[0] ?? null;
}

async function changeBalance(userId, assetId, delta) {
  const current = await readBalance(userId, assetId);
  const next = asNumber(current?.available_balance) + delta;
  assert(next >= 0, `insufficient asset ${assetId} balance for user ${userId}`);
  if (current) {
    await rest(`user_balances?id=eq.${current.id}`, { method: "PATCH", body: { available_balance: next } });
  } else {
    await rest("user_balances", { method: "POST", body: { user_id: userId, asset_id: assetId, available_balance: next, locked_balance: 0 } });
  }
}

async function addLedger({ userId, assetId, amount, txType, txHash, details }) {
  await rest("ledger_entries", {
    method: "POST",
    body: { user_id: userId, asset_id: assetId, amount, tx_type: txType, status: "COMPLETED", tx_hash: txHash, details },
  });
}

async function deposit(user, assets, amount) {
  await changeBalance(user.id, assets.USDT, amount);
  await addLedger({
    userId: user.id,
    assetId: assets.USDT,
    amount,
    txType: "DEPOSIT",
    txHash: `${RUN_ID}-DEPOSIT-${user.nickname}`,
    details: { qa_run: RUN_ID, nickname: user.nickname },
  });
}

async function purchase(user, assets, level, suffix = "") {
  const product = PRODUCTS[level];
  assert(product, `unknown package level ${level}`);
  const label = `L${level}${suffix}`;
  await changeBalance(user.id, assets.USDT, -product.price);
  await changeBalance(user.id, assets.JADE, product.jade);
  if (product.urc) await changeBalance(user.id, assets.URC, product.urc);
  if (product.hongbao) await changeBalance(user.id, assets.HONGBAO, product.hongbao);

  const details = { qa_run: RUN_ID, nickname: user.nickname, package_level: level };
  await addLedger({ userId: user.id, assetId: assets.USDT, amount: -product.price, txType: "PACKAGE_BUY", txHash: `${RUN_ID}-BUY-${user.nickname}-${label}`, details });
  await addLedger({ userId: user.id, assetId: assets.JADE, amount: product.jade, txType: "PACKAGE_BONUS", txHash: `${RUN_ID}-JADE-${user.nickname}-${label}`, details });
  if (product.urc) await addLedger({ userId: user.id, assetId: assets.URC, amount: product.urc, txType: "PACKAGE_BONUS", txHash: `${RUN_ID}-URC-${user.nickname}-${label}`, details });
  if (product.hongbao) await addLedger({ userId: user.id, assetId: assets.HONGBAO, amount: product.hongbao, txType: "PACKAGE_BONUS", txHash: `${RUN_ID}-HONGBAO-${user.nickname}-${label}`, details });

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
  assert(machine?.id, `machine creation failed for ${user.nickname} ${label}`);
  const rawSettlement = await rpc("settle_machine_purchase", { p_machine_id: machine.id });
  const settlement = Array.isArray(rawSettlement) ? rawSettlement[0]?.settle_machine_purchase ?? rawSettlement[0] : rawSettlement?.settle_machine_purchase ?? rawSettlement;
  assert(settlement?.settled === true || settlement?.reason === "already_settled", `bonus settlement failed for ${user.nickname} ${label}`);
  return machine;
}

function expectedSponsorForA(index, ids) {
  if (index === 3) return ids.QAANTZ01.id;
  if (index === 6 || index === 9) return ids.antz15.id;
  return ids.QAT3A01.id;
}

function expectedSponsorForB(index, ids) {
  if (index === 3) return ids.QAT3A01.id;
  if (index === 6) return ids.QAANTZ01.id;
  if (index === 9) return ids.antz15.id;
  return ids.QAT3A04.id;
}

function assertHierarchy(usersByNickname) {
  const ids = usersByNickname;
  const assertMember = (nickname, recommenderId, sponsorId, seq) => {
    const member = ids[nickname];
    assert(member?.status === "ACTIVE", `${nickname} is not active`);
    assert(member.recommender_id === recommenderId, `${nickname} recommender mismatch`);
    assert(member.sponsor_id === sponsorId, `${nickname} sponsor mismatch`);
    assert(Number(member.referral_seq) === seq, `${nickname} referral sequence mismatch`);
  };

  assertMember("antz15", null, null, 0);
  assertMember("QAANTZ01", ids.antz15.id, ids.antz15.id, 1);
  assertMember("QAT3A01", ids.QAANTZ01.id, ids.QAANTZ01.id, 1);
  for (let index = 1; index <= 10; index += 1) {
    const nickname = `QAT3A${String(index + 1).padStart(2, "0")}`;
    assertMember(nickname, ids.QAT3A01.id, expectedSponsorForA(index, ids), index);
  }
  for (let index = 1; index <= 9; index += 1) {
    const nickname = `QAT3B${String(index).padStart(2, "0")}`;
    assertMember(nickname, ids.QAT3A04.id, expectedSponsorForB(index, ids), index);
  }
}

async function verify(usersByNickname, assets) {
  const testUsers = Object.values(usersByNickname);
  const ids = testUsers.map((user) => user.id);
  const freshUsers = (await getUsers()).filter((user) => ids.includes(user.id));
  const freshByNickname = Object.fromEntries(freshUsers.map((user) => [user.nickname, user]));
  assertHierarchy(freshByNickname);

  const machines = await getMachines(ids);
  const expectedMachineCounts = Object.fromEntries(testUsers.map((user) => [user.nickname, 3]));
  assert(machines.length === 66, `expected 66 machines, found ${machines.length}`);
  assert(machines.every((machine) => machine.bonus_settled), "some QA machines were not bonus-settled");
  for (const user of testUsers) {
    const count = machines.filter((machine) => machine.user_id === user.id).length;
    assert(count === expectedMachineCounts[user.nickname], `${user.nickname} machine count is ${count}`);
  }

  const machineIds = new Set(machines.map((machine) => machine.id));
  const ledgers = await getLedgers();
  const bonusTypes = ["REFERRAL_BONUS", "FOSTER_BONUS", "MAMA_BONUS"];
  const actualBonuses = ledgers.filter((entry) => bonusTypes.includes(entry.tx_type) && machineIds.has(entry.details?.machine_id));
  const byId = Object.fromEntries(freshUsers.map((user) => [user.id, user]));
  const expectedBonuses = [];
  for (const machine of machines) {
    const owner = byId[machine.user_id];
    const price = asNumber(machine.purchase_price);
    if (owner.recommender_id) expectedBonuses.push({ machineId: machine.id, userId: owner.recommender_id, type: "REFERRAL_BONUS", amount: price * 0.2 });
    if (owner.sponsor_id) {
      expectedBonuses.push({ machineId: machine.id, userId: owner.sponsor_id, type: "FOSTER_BONUS", amount: price * 0.1 });
      const mamaId = byId[owner.sponsor_id]?.recommender_id;
      if (mamaId && mamaId !== owner.sponsor_id) expectedBonuses.push({ machineId: machine.id, userId: mamaId, type: "MAMA_BONUS", amount: price * 0.1 });
    }
  }
  assert(actualBonuses.length === expectedBonuses.length, `expected ${expectedBonuses.length} bonus ledgers, found ${actualBonuses.length}`);
  for (const expected of expectedBonuses) {
    const matches = actualBonuses.filter((entry) => entry.user_id === expected.userId && entry.tx_type === expected.type && entry.details?.machine_id === expected.machineId);
    assert(matches.length === 1 && sameAmount(matches[0].amount, expected.amount), `bonus mismatch for ${expected.type} on machine ${expected.machineId}`);
  }

  const totalsByType = Object.fromEntries(bonusTypes.map((type) => [type, actualBonuses.filter((entry) => entry.tx_type === type).reduce((sum, entry) => sum + asNumber(entry.amount), 0)]));
  const totalsByNickname = Object.fromEntries(testUsers.map((user) => [user.nickname, actualBonuses.filter((entry) => entry.user_id === user.id).reduce((sum, entry) => sum + asNumber(entry.amount), 0)]));
  assert(sameAmount(totalsByType.REFERRAL_BONUS, 7000), "referral total must be 7,000 USDT");
  assert(sameAmount(totalsByType.FOSTER_BONUS, 3500), "foster total must be 3,500 USDT");
  assert(sameAmount(totalsByType.MAMA_BONUS, 2860), "mama total must be 2,860 USDT");
  for (const [nickname, expected] of Object.entries({ antz15: 1580, QAANTZ01: 2500, QAT3A01: 5440, QAT3A04: 3840 })) {
    assert(sameAmount(totalsByNickname[nickname], expected), `${nickname} bonus total mismatch`);
  }

  const expectedRevenue = { antz15: 1600, QAANTZ01: 3000, QAT3A01: 16000, QAT3A04: 14400 };
  for (const [nickname, expected] of Object.entries(expectedRevenue)) {
    assert(sameAmount(freshByNickname[nickname].accumulated_revenue, expected), `${nickname} accumulated revenue mismatch`);
  }

  const expectedUsdt = { antz15: 1980, QAANTZ01: 2900, QAT3A01: 5440, QAT3A04: 4240 };
  for (const user of testUsers) {
    const balance = await readBalance(user.id, assets.USDT);
    const expected = expectedUsdt[user.nickname] ?? 400;
    assert(balance && sameAmount(balance.available_balance, expected), `${user.nickname} USDT balance mismatch`);
  }

  const payoutByNickname = Object.fromEntries(testUsers.map((user) => [
    user.nickname,
    machines.filter((machine) => machine.user_id === user.id).reduce((sum, machine) => sum + asNumber(machine.accumulated_payout_usd), 0),
  ]));
  for (const [nickname, expected] of Object.entries({ antz15: 1580, QAANTZ01: 2500, QAT3A01: 5440, QAT3A04: 3840 })) {
    assert(sameAmount(payoutByNickname[nickname], expected), `${nickname} payout-cap accounting mismatch`);
  }

  return {
    users: freshUsers.length,
    machines: machines.length,
    purchaseTotal: machines.reduce((sum, machine) => sum + asNumber(machine.purchase_price), 0),
    bonusCount: actualBonuses.length,
    bonusTotals: totalsByType,
    recipientTotals: Object.fromEntries(Object.entries(totalsByNickname).filter(([, amount]) => amount > 0)),
    usdtBalances: Object.fromEntries(Object.entries(expectedUsdt)),
    sponsorChecks: {
      qat3a04: freshByNickname.QAT3A04.sponsor_id === freshByNickname.QAANTZ01.id,
      qat3a07: freshByNickname.QAT3A07.sponsor_id === freshByNickname.antz15.id,
      qat3a10: freshByNickname.QAT3A10.sponsor_id === freshByNickname.antz15.id,
      qat3b03: freshByNickname.QAT3B03.sponsor_id === freshByNickname.QAT3A01.id,
      qat3b06: freshByNickname.QAT3B06.sponsor_id === freshByNickname.QAANTZ01.id,
      qat3b09: freshByNickname.QAT3B09.sponsor_id === freshByNickname.antz15.id,
    },
  };
}

async function run() {
  const cleanup = await clearExistingQaData();
  if (!APPLY) return;

  const usersByNickname = {};
  usersByNickname.antz15 = await createActiveUser("antz15");
  usersByNickname.QAANTZ01 = await createActiveUser("QAANTZ01", usersByNickname.antz15.id);
  usersByNickname.QAT3A01 = await createActiveUser("QAT3A01", usersByNickname.QAANTZ01.id);
  for (let index = 2; index <= 11; index += 1) {
    const nickname = `QAT3A${String(index).padStart(2, "0")}`;
    usersByNickname[nickname] = await createActiveUser(nickname, usersByNickname.QAT3A01.id);
  }
  for (let index = 1; index <= 9; index += 1) {
    const nickname = `QAT3B${String(index).padStart(2, "0")}`;
    usersByNickname[nickname] = await createActiveUser(nickname, usersByNickname.QAT3A04.id);
  }
  assertHierarchy(usersByNickname);

  const assets = await getAssets();
  const orderedUsers = [
    usersByNickname.antz15,
    usersByNickname.QAANTZ01,
    usersByNickname.QAT3A01,
    ...Array.from({ length: 10 }, (_, index) => usersByNickname[`QAT3A${String(index + 2).padStart(2, "0")}`]),
    ...Array.from({ length: 9 }, (_, index) => usersByNickname[`QAT3B${String(index + 1).padStart(2, "0")}`]),
  ];
  for (const user of orderedUsers) await deposit(user, assets, user.nickname === "QAT3A01" ? 3000 : 2000);
  for (const user of orderedUsers) {
    // Every test member buys exactly three products. QAT3A01 uses three L3
    // products so its payout cap can accommodate its high direct-referral flow.
    const levels = user.nickname === "QAT3A01" ? [3, 3, 3] : [1, 2, 3];
    for (const [index, level] of levels.entries()) await purchase(user, assets, level, `-${index + 1}`);
  }

  const report = await verify(usersByNickname, assets);
  console.log(JSON.stringify({ cleanup, run: RUN_ID, verification: "passed", report }, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
