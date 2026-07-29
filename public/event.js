import {
  apiJson,
  formatEventDate,
  readSecret,
  rememberSecrets,
  sessionId,
  setStatus,
  track,
  trackVisit,
} from "./common.js";

const app = document.querySelector("#event-app");
const id = app?.dataset.eventId ?? "";
const form = document.querySelector("#response-form");
const status = document.querySelector("#response-status");
const saveButton = document.querySelector("#save-button");
const seatsField = document.querySelector("#seats-field");
const passengersField = document.querySelector("#passengers-field");
let model = null;

const sportLabels = {
  baseball: "野球・ソフトボール",
  basketball: "バスケットボール",
  other: "チームの予定",
  soccer: "サッカー・フットサル",
  volleyball: "バレーボール",
};

const selected = (name) => form?.querySelector(`input[name="${name}"]:checked`)?.value ?? "";

const updateConditionalFields = () => {
  const absent = selected("attendance") === "no";
  const ride = selected("ride");
  if (absent) {
    const self = form?.querySelector('input[name="ride"][value="self"]');
    if (self instanceof HTMLInputElement) self.checked = true;
  }
  form?.querySelectorAll('input[name="ride"]').forEach((input) => {
    input.disabled = absent;
  });
  if (seatsField instanceof HTMLElement) seatsField.hidden = absent || ride !== "offer";
  if (passengersField instanceof HTMLElement) passengersField.hidden = absent || ride !== "need";
};

form?.querySelectorAll('input[name="attendance"], input[name="ride"]').forEach((input) => {
  input.addEventListener("change", updateConditionalFields);
});

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
  const balanceLabel = document.querySelector("#balance-label");
  const balance = summary.seats - summary.needs;
  if (balanceLabel) {
    balanceLabel.textContent =
      summary.seats === 0 && summary.needs === 0
        ? "回答を待っています"
        : balance >= 0
          ? `あと${balance}席あります`
          : `あと${Math.abs(balance)}席必要です`;
    balanceLabel.dataset.state = balance < 0 ? "short" : "ok";
  }
  const visual = document.querySelector("#seat-visual");
  if (visual instanceof HTMLElement) {
    visual.replaceChildren();
    const total = Math.min(12, Math.max(summary.seats, summary.needs));
    for (let index = 0; index < total; index += 1) {
      const seat = document.createElement("i");
      seat.dataset.state = index < summary.needs ? "needed" : "open";
      visual.append(seat);
    }
  }
};

const render = () => {
  if (!model) return;
  const labels = {
    "#event-date-label": formatEventDate(model.date),
    "#event-place": model.place,
    "#event-sport": sportLabels[model.sport] ?? "チームの予定",
    "#event-state": model.status === "open" ? "回答受付中" : "受付終了",
    "#event-time": model.meetTime,
    "#event-title": model.title,
  };
  Object.entries(labels).forEach(([selector, value]) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  });
  updateSummary(model.summary);
  if (form instanceof HTMLFormElement) {
    [...form.elements].forEach((control) => {
      if (
        control instanceof HTMLInputElement ||
        control instanceof HTMLTextAreaElement ||
        control instanceof HTMLButtonElement
      ) {
        control.disabled = model.status !== "open";
      }
    });
  }
  if (model.status !== "open") {
    setStatus(status, "この予定の回答受付は終了しました。");
  }
  updateConditionalFields();
};

const load = async () => {
  model = await apiJson(`/api/events/${id}`);
  render();
};

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    !(form instanceof HTMLFormElement) ||
    !(saveButton instanceof HTMLButtonElement) ||
    !form.reportValidity()
  ) {
    return;
  }
  saveButton.disabled = true;
  setStatus(status, "回答を保存しています…");
  const responseId = readSecret(id, "responseId");
  const editToken = readSecret(id, "editToken");
  try {
    const result = await apiJson(`/api/events/${id}/responses`, {
      body: JSON.stringify({
        attendance: selected("attendance"),
        editToken,
        name: document.querySelector("#name")?.value ?? "",
        note: document.querySelector("#note")?.value ?? "",
        passengers: Number(document.querySelector("#passengers")?.value ?? 0),
        responseId,
        ride: selected("ride"),
        seats: Number(document.querySelector("#seats")?.value ?? 0),
        sessionId,
        website: document.querySelector("#response-website")?.value ?? "",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    rememberSecrets(id, {
      editToken: result.editToken || editToken,
      responseId: result.responseId || responseId,
    });
    setStatus(status, "回答を保存しました。この端末から上書きできます。", "success");
    track("response_saved", id);
    await load();
  } catch (error) {
    const messages = {
      access_denied: "この端末の編集鍵を確認できません。幹事へ変更を伝えてください。",
      already_answered: "この端末からは回答済みです。ページを読み直して上書きしてください。",
      event_closed: "この予定の回答受付は終了しました。",
      event_full: "回答数の上限に達しました。",
      invalid_response: "入力を確認してください。URLや連絡先は入れられません。",
    };
    setStatus(
      status,
      messages[error.message] ?? "保存できませんでした。もう一度お試しください。",
      "error",
    );
  } finally {
    if (model?.status === "open") saveButton.disabled = false;
  }
});

document.querySelector("#report-button")?.addEventListener("click", async () => {
  if (!confirm("迷惑な予定として報告しますか？")) return;
  try {
    await apiJson(`/api/events/${id}/report`, {
      body: JSON.stringify({ reason: "other", sessionId }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    setStatus(status, "報告を受け付けました。", "success");
  } catch {
    setStatus(status, "報告できませんでした。", "error");
  }
});

load().catch(() => setStatus(status, "予定を読み込めませんでした。", "error"));
trackVisit(id);
