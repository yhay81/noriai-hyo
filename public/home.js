import { apiJson, isAutomatedQa, sessionId, setStatus, track, trackVisit } from "./common.js";

const form = document.querySelector("#create-form");
const button = document.querySelector("#create-button");
const status = document.querySelector("#create-status");
const dateInput = document.querySelector("#event-date");

if (dateInput instanceof HTMLInputElement) {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  dateInput.min = now.toISOString().slice(0, 10);
  dateInput.max = new Date(now.getTime() + 180 * 86400000).toISOString().slice(0, 10);
  dateInput.value = tomorrow.toISOString().slice(0, 10);
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    !(form instanceof HTMLFormElement) ||
    !(button instanceof HTMLButtonElement) ||
    !form.reportValidity()
  ) {
    return;
  }
  button.disabled = true;
  setStatus(status, "予定表をつくっています…");
  try {
    const result = await apiJson("/api/events", {
      body: JSON.stringify({
        date: document.querySelector("#event-date")?.value ?? "",
        expectedCount: Number(document.querySelector("#expected-count")?.value ?? 0),
        meetTime: document.querySelector("#meet-time")?.value ?? "",
        place: document.querySelector("#place")?.value ?? "",
        sessionId,
        sport: document.querySelector("#sport")?.value ?? "",
        title: document.querySelector("#title")?.value ?? "",
        website: document.querySelector("#website")?.value ?? "",
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    track("event_created", result.eventId);
    const query = isAutomatedQa ? "?qa=1" : "";
    location.assign(
      `/manage/${result.eventId}${query}#${new URLSearchParams({ owner: result.ownerToken })}`,
    );
  } catch (error) {
    const messages = {
      invalid_event: "日付、集合時刻、場所を確認してください。URLや連絡先は入れられません。",
      rate_limited: "今日はすでに10件作成しています。明日もう一度お試しください。",
    };
    setStatus(
      status,
      messages[error.message] ?? "予定を作れませんでした。少し待ってからお試しください。",
      "error",
    );
    button.disabled = false;
  }
});

trackVisit("home");
