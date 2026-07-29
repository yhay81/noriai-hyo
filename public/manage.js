import {
  apiJson,
  authorization,
  copyText,
  forgetEvent,
  formatEventDate,
  isAutomatedQa,
  linkFor,
  readSecret,
  setStatus,
  track,
  trackVisit,
} from "./common.js";

const app = document.querySelector("#manage-app");
const id = app?.dataset.eventId ?? "";
const owner = readSecret(id, "owner");
const message = document.querySelector("#manage-message");
const roster = document.querySelector("#roster-list");
const offerList = document.querySelector("#offer-list");
const needList = document.querySelector("#need-list");
const toggle = document.querySelector("#toggle-button");
let model = null;

const text = (tag, value, className = "") => {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
};

const updateSummary = (summary) => {
  const values = {
    "#maybe-count": summary.maybe,
    "#need-count": summary.needs,
    "#no-count": summary.no,
    "#seat-count": summary.seats,
    "#yes-count": summary.yes,
  };
  Object.entries(values).forEach(([selector, value]) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = String(value);
  });
};

const renderRideList = (target, responses, kind) => {
  if (!(target instanceof HTMLElement)) return;
  target.replaceChildren();
  if (responses.length === 0) {
    target.append(text("p", kind === "offer" ? "空席の登録なし" : "希望の登録なし", "mini-empty"));
    return;
  }
  responses.forEach((response) => {
    const row = document.createElement("div");
    row.className = "ride-person";
    row.append(
      text("strong", response.name),
      text(
        "span",
        `${kind === "offer" ? response.seats : response.passengers}${kind === "offer" ? "席" : "人"}`,
      ),
    );
    target.append(row);
  });
};

const renderRoster = () => {
  if (!(roster instanceof HTMLElement) || !model) return;
  roster.replaceChildren();
  if (model.responses.length === 0) {
    roster.append(text("p", "まだ回答はありません。", "empty-state"));
    return;
  }
  const attendanceLabels = { maybe: "未定", no: "欠席", yes: "参加" };
  const rideLabels = {
    need: (response) => `乗車希望 ${response.passengers}人`,
    offer: (response) => `空席 ${response.seats}席`,
    self: () => "自分で移動",
  };
  model.responses.forEach((response) => {
    const card = document.createElement("article");
    card.className = "roster-person";
    card.dataset.attendance = response.attendance;
    const heading = document.createElement("div");
    heading.append(
      text("strong", response.name),
      text("span", attendanceLabels[response.attendance], "attendance-badge"),
    );
    const detail = document.createElement("p");
    detail.textContent =
      response.attendance === "no" ? "移動なし" : rideLabels[response.ride](response);
    card.append(heading, detail);
    if (response.note) card.append(text("small", response.note));
    roster.append(card);
  });
};

const render = () => {
  if (!model) return;
  const meta = document.querySelector("#manage-meta");
  const state = document.querySelector("#manage-state");
  const total = document.querySelector("#response-total");
  const rideResult = document.querySelector("#ride-result");
  if (meta) {
    meta.textContent = `${formatEventDate(model.date)}・${model.meetTime}集合・${model.place}`;
  }
  if (state) state.textContent = model.status === "open" ? "回答受付中" : "受付終了";
  if (total) total.textContent = `${model.responses.length}件`;
  if (toggle) toggle.textContent = model.status === "open" ? "回答を締め切る" : "回答を再開";
  const balance = model.summary.seats - model.summary.needs;
  if (rideResult) {
    rideResult.textContent =
      model.summary.seats === 0 && model.summary.needs === 0
        ? "回答待ち"
        : balance >= 0
          ? `${balance}席の余裕`
          : `${Math.abs(balance)}席不足`;
    rideResult.dataset.state = balance < 0 ? "short" : "ok";
  }
  updateSummary(model.summary);
  renderRoster();
  const active = model.responses.filter((response) => response.attendance === "yes");
  renderRideList(
    offerList,
    active.filter((response) => response.ride === "offer"),
    "offer",
  );
  renderRideList(
    needList,
    active.filter((response) => response.ride === "need"),
    "need",
  );
};

const load = async () => {
  if (!owner) throw new Error("missing_owner");
  model = await apiJson(`/api/events/${id}/manage`, { headers: authorization(owner) });
  render();
};

document.querySelector("#copy-event")?.addEventListener("click", async () => {
  try {
    await copyText(linkFor(`/e/${id}`));
    setStatus(message, "回答URLをコピーしました。", "success");
    track("link_copied", id);
  } catch {
    setStatus(message, "コピーできませんでした。", "error");
  }
});

document.querySelector("#copy-owner")?.addEventListener("click", async () => {
  try {
    await copyText(linkFor(`/manage/${id}`, owner));
    setStatus(message, "管理URLをコピーしました。安全な場所に保管してください。", "success");
  } catch {
    setStatus(message, "コピーできませんでした。", "error");
  }
});

document.querySelector("#refresh-button")?.addEventListener("click", () => {
  load().catch(() => setStatus(message, "更新できませんでした。", "error"));
});

toggle?.addEventListener("click", async () => {
  if (!model) return;
  const status = model.status === "open" ? "closed" : "open";
  try {
    await apiJson(`/api/events/${id}/status`, {
      body: JSON.stringify({ status }),
      headers: { ...authorization(owner), "content-type": "application/json" },
      method: "PATCH",
    });
    if (status === "closed") track("event_closed", id);
    await load();
  } catch {
    setStatus(message, "受付状態を変更できませんでした。", "error");
  }
});

const csvCell = (value) => {
  const safe = String(value ?? "").replaceAll('"', '""');
  const protectedValue = /^[=+\-@]/.test(safe) ? `'${safe}` : safe;
  return `"${protectedValue}"`;
};

document.querySelector("#csv-button")?.addEventListener("click", () => {
  if (!model) return;
  const labels = { maybe: "未定", no: "欠席", yes: "参加" };
  const rides = { need: "乗せてほしい", offer: "車を出せる", self: "自分で行く" };
  const rows = [
    ["呼び名", "出欠", "移動", "空席", "希望人数", "メモ"],
    ...model.responses.map((response) => [
      response.name,
      labels[response.attendance],
      rides[response.ride],
      response.seats,
      response.passengers,
      response.note,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${model.date}-${model.title}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#delete-button")?.addEventListener("click", async () => {
  if (!confirm("予定とすべての回答を削除します。元に戻せません。")) return;
  try {
    await apiJson(`/api/events/${id}`, {
      headers: authorization(owner),
      method: "DELETE",
    });
    forgetEvent(id);
    location.assign(isAutomatedQa ? "/?qa=1" : "/");
  } catch {
    setStatus(message, "削除できませんでした。", "error");
  }
});

load()
  .then(() => track("owner_opened", id))
  .catch(() =>
    setStatus(message, "管理鍵を確認できません。作成時に開いた管理URLを使ってください。", "error"),
  );
const refreshTimer = window.setInterval(() => {
  if (!document.hidden) void load().catch(() => {});
}, 10000);
window.addEventListener("pagehide", () => clearInterval(refreshTimer));
trackVisit(id);
