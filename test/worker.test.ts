import { describe, expect, it, vi } from "vitest";

import { app, type Bindings } from "../src/worker";

const eventId = "a".repeat(32);
const responseId = "b".repeat(32);
const ownerToken = "1".repeat(64);
const editToken = "2".repeat(64);
const browserSessionId = "21d6f5db-2a77-4dd2-8319-e45fe918e687";
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const ownerHash = "3138bb9bc78df27c473ecfd1410f7bd45ebac1f59cf3ff9cfe4db77aab7aedd3";
const editHash = "4f2e8d65483c641648cdb374ae9d8abd368d269e4ddffe092a8237b8162cddd6";
const hash = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

type StoredResponse = {
  attendance: "maybe" | "no" | "yes";
  created_at: number;
  edit_token_hash: string;
  event_id: string;
  id: string;
  name: string;
  note: string;
  passengers: number;
  respondent_session_id: string;
  ride: "need" | "offer" | "self";
  seats: number;
  updated_at: number;
};

type TestState = {
  event: {
    created_at: number;
    event_date: string;
    expected_count: number;
    expires_at: number;
    id: string;
    meet_time: string;
    owner_token_hash: string;
    place: string;
    sport: string;
    status: "closed" | "hidden" | "open";
    title: string;
  } | null;
  recentEvents: number;
  reportCount: number;
  responses: StoredResponse[];
};

type Call = {
  arguments: unknown[];
  sql: string;
};

const defaultState = (): TestState => ({
  event: {
    created_at: 1_721_000_000,
    event_date: tomorrow,
    expected_count: 9,
    expires_at: 4_102_444_800,
    id: eventId,
    meet_time: "08:30",
    owner_token_hash: ownerHash,
    place: "河川敷グラウンド",
    sport: "soccer",
    status: "open",
    title: "日曜の練習試合",
  },
  recentEvents: 0,
  reportCount: 0,
  responses: [
    {
      attendance: "yes",
      created_at: 1_721_000_100,
      edit_token_hash: editHash,
      event_id: eventId,
      id: responseId,
      name: "ゆう家",
      note: "帰りだけお願いします",
      passengers: 2,
      respondent_session_id: browserSessionId,
      ride: "need",
      seats: 0,
      updated_at: 1_721_000_100,
    },
  ],
});

const makeBindings = (partial: Partial<TestState> = {}) => {
  const state = { ...defaultState(), ...partial };
  const calls: Call[] = [];

  const prepare = vi.fn((sql: string) => {
    let arguments_: unknown[] = [];
    const call = { arguments: arguments_, sql };
    calls.push(call);
    const statement = {
      bind: (...values: unknown[]) => {
        arguments_ = values;
        call.arguments = values;
        return statement;
      },
      first: async () => {
        if (sql.includes("COUNT(*) AS count FROM events")) {
          return { count: state.recentEvents };
        }
        if (sql.includes("COUNT(*) AS response_count")) {
          const relevant = state.responses.filter(
            (response) => response.event_id === arguments_[0],
          );
          return {
            maybe_count: relevant.filter((response) => response.attendance === "maybe").length,
            need_count: relevant
              .filter((response) => response.attendance === "yes" && response.ride === "need")
              .reduce((sum, response) => sum + response.passengers, 0),
            no_count: relevant.filter((response) => response.attendance === "no").length,
            response_count: relevant.length,
            seat_count: relevant
              .filter((response) => response.attendance === "yes" && response.ride === "offer")
              .reduce((sum, response) => sum + response.seats, 0),
            yes_count: relevant.filter((response) => response.attendance === "yes").length,
          };
        }
        if (sql.includes("COUNT(*) AS total")) {
          return {
            own: state.responses.filter(
              (response) =>
                response.respondent_session_id === arguments_[0] &&
                response.event_id === arguments_[1],
            ).length,
            total: state.responses.filter((response) => response.event_id === arguments_[1]).length,
          };
        }
        if (sql.includes("SELECT edit_token_hash FROM responses")) {
          return (
            state.responses.find(
              (response) =>
                response.id === arguments_[0] &&
                response.event_id === arguments_[1] &&
                response.respondent_session_id === arguments_[2],
            ) ?? null
          );
        }
        if (sql.includes("COUNT(*) AS count FROM reports")) {
          return { count: state.reportCount };
        }
        if (sql.includes("FROM events") && sql.includes("expires_at > unixepoch()")) {
          return state.event?.id === arguments_[0] ? state.event : null;
        }
        return null;
      },
      all: async () => ({ results: state.responses }),
      run: async () => {
        if (sql.includes("INSERT INTO responses")) {
          state.responses.push({
            attendance: arguments_[5] as StoredResponse["attendance"],
            created_at: 1_721_000_200,
            edit_token_hash: arguments_[2] as string,
            event_id: arguments_[1] as string,
            id: arguments_[0] as string,
            name: arguments_[4] as string,
            note: arguments_[9] as string,
            passengers: arguments_[8] as number,
            respondent_session_id: arguments_[3] as string,
            ride: arguments_[6] as StoredResponse["ride"],
            seats: arguments_[7] as number,
            updated_at: 1_721_000_200,
          });
        }
        if (sql.includes("UPDATE events SET status") && state.event) {
          state.event.status = arguments_[0] as "closed" | "hidden" | "open";
        }
        return { meta: { changes: 1 } };
      },
      raw: async () => [],
    };
    return statement as unknown as D1PreparedStatement;
  });

  const db = {
    batch: vi.fn(async () => []),
    dump: vi.fn(async () => new ArrayBuffer(0)),
    exec: vi.fn(async () => ({ count: 0, duration: 0 })),
    prepare,
    withSession: vi.fn(),
  } as unknown as D1Database;
  const bindings = {
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    DB: db,
  } satisfies Bindings;
  return { bindings, calls, state };
};

const jsonHeaders = {
  "content-type": "application/json",
  origin: "http://localhost",
  "sec-fetch-site": "same-origin",
};

const validEvent = () => ({
  date: tomorrow,
  expectedCount: 9,
  meetTime: "08:30",
  place: "河川敷グラウンド入口",
  sessionId: browserSessionId,
  sport: "soccer",
  title: "日曜の練習試合",
  website: "",
});

const validResponse = (sessionId = "38b80262-aaf5-4cf4-91f7-4dc052f9f08e") => ({
  attendance: "yes",
  name: "あお家",
  note: "",
  passengers: 0,
  ride: "offer",
  seats: 3,
  sessionId,
  website: "",
});

describe("のりあい表 worker", () => {
  it("serves compact public product pages with security metadata", async () => {
    const { bindings } = makeBindings();
    for (const path of ["/", "/guide", "/privacy"]) {
      const response = await app.request(path, undefined, bindings);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
      expect(await response.text()).toContain("のりあい表");
    }
  });

  it("marks event and owner pages private and noindex", async () => {
    const { bindings } = makeBindings();
    for (const path of [`/e/${eventId}`, `/manage/${eventId}`]) {
      const response = await app.request(path, undefined, bindings);
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-robots-tag")).toContain("noindex");
      expect(html).toContain(`data-event-id="${eventId}"`);
    }
  });

  it("does not expose hidden events", async () => {
    const state = defaultState();
    if (state.event) state.event.status = "hidden";
    const { bindings } = makeBindings(state);
    const response = await app.request(`/e/${eventId}`, undefined, bindings);
    expect(response.status).toBe(404);
  });

  it("returns only aggregate data from the public event API", async () => {
    const { bindings } = makeBindings();
    const response = await app.request(`/api/events/${eventId}`, undefined, bindings);
    const body = await response.json<Record<string, unknown>>();
    expect(response.status).toBe(200);
    expect(body.summary).toEqual({
      maybe: 0,
      needs: 2,
      no: 0,
      responses: 1,
      seats: 0,
      yes: 1,
    });
    expect(body).not.toHaveProperty("responses");
    expect(JSON.stringify(body)).not.toContain("ゆう家");
    expect(JSON.stringify(body)).not.toContain("帰りだけ");
  });

  it("creates an event with a hashed owner key", async () => {
    const { bindings, calls } = makeBindings({ event: null, responses: [] });
    const response = await app.request(
      "/api/events",
      { body: JSON.stringify(validEvent()), headers: jsonHeaders, method: "POST" },
      bindings,
    );
    const body = await response.json<{ eventId: string; ownerToken: string }>();
    const insert = calls.find((call) => call.sql.includes("INSERT INTO events"));
    expect(response.status).toBe(201);
    expect(body.eventId).toMatch(/^[0-9a-f]{32}$/);
    expect(body.ownerToken).toMatch(/^[0-9a-f]{64}$/);
    expect(insert?.arguments).not.toContain(body.ownerToken);
    expect(insert?.arguments[1]).toBe(await hash(body.ownerToken));
  });

  it("rejects invalid, linked, cross-site, and rate-limited event creation", async () => {
    const cases = [
      {
        bindings: makeBindings().bindings,
        body: { ...validEvent(), place: "https://example.com" },
        headers: jsonHeaders,
        status: 400,
      },
      {
        bindings: makeBindings().bindings,
        body: { ...validEvent(), date: "2020-01-01" },
        headers: jsonHeaders,
        status: 400,
      },
      {
        bindings: makeBindings().bindings,
        body: validEvent(),
        headers: { ...jsonHeaders, origin: "https://evil.example" },
        status: 403,
      },
      {
        bindings: makeBindings({ recentEvents: 10 }).bindings,
        body: validEvent(),
        headers: jsonHeaders,
        status: 429,
      },
    ];
    for (const value of cases) {
      const response = await app.request(
        "/api/events",
        { body: JSON.stringify(value.body), headers: value.headers, method: "POST" },
        value.bindings,
      );
      expect(response.status).toBe(value.status);
    }
  });

  it("creates a response with a separate hashed edit key", async () => {
    const { bindings, calls } = makeBindings({ responses: [] });
    const response = await app.request(
      `/api/events/${eventId}/responses`,
      { body: JSON.stringify(validResponse()), headers: jsonHeaders, method: "POST" },
      bindings,
    );
    const body = await response.json<{ editToken: string; responseId: string }>();
    const insert = calls.find((call) => call.sql.includes("INSERT INTO responses"));
    expect(response.status).toBe(201);
    expect(body.responseId).toMatch(/^[0-9a-f]{32}$/);
    expect(body.editToken).toMatch(/^[0-9a-f]{64}$/);
    expect(insert?.arguments).not.toContain(body.editToken);
    expect(insert?.arguments[2]).toBe(await hash(body.editToken));
  });

  it("normalizes absent responses to no ride and zero seats", async () => {
    const { bindings, calls } = makeBindings({ responses: [] });
    const response = await app.request(
      `/api/events/${eventId}/responses`,
      {
        body: JSON.stringify({
          ...validResponse(),
          attendance: "no",
          passengers: 4,
          ride: "need",
          seats: 8,
        }),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    const insert = calls.find((call) => call.sql.includes("INSERT INTO responses"));
    expect(response.status).toBe(201);
    expect(insert?.arguments.slice(5, 9)).toEqual(["no", "self", 0, 0]);
  });

  it("requires positive capacity for ride offers and requests", async () => {
    for (const ride of ["offer", "need"]) {
      const { bindings } = makeBindings({ responses: [] });
      const response = await app.request(
        `/api/events/${eventId}/responses`,
        {
          body: JSON.stringify({ ...validResponse(), passengers: 0, ride, seats: 0 }),
          headers: jsonHeaders,
          method: "POST",
        },
        bindings,
      );
      expect(response.status).toBe(400);
    }
  });

  it("updates a response only with its edit key and same browser session", async () => {
    const { bindings, calls } = makeBindings();
    const response = await app.request(
      `/api/events/${eventId}/responses`,
      {
        body: JSON.stringify({
          ...validResponse(browserSessionId),
          editToken,
          responseId,
        }),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(calls.some((call) => call.sql.includes("UPDATE responses"))).toBe(true);

    const denied = await app.request(
      `/api/events/${eventId}/responses`,
      {
        body: JSON.stringify({
          ...validResponse(browserSessionId),
          editToken: "3".repeat(64),
          responseId,
        }),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(denied.status).toBe(403);
  });

  it("prevents a second response from the same anonymous browser", async () => {
    const { bindings } = makeBindings();
    const response = await app.request(
      `/api/events/${eventId}/responses`,
      {
        body: JSON.stringify(validResponse(browserSessionId)),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "already_answered" });
  });

  it("returns names and notes only to the owner key", async () => {
    const { bindings } = makeBindings();
    const owner = await app.request(
      `/api/events/${eventId}/manage`,
      { headers: { authorization: `Bearer ${ownerToken}` } },
      bindings,
    );
    const denied = await app.request(
      `/api/events/${eventId}/manage`,
      { headers: { authorization: `Bearer ${"9".repeat(64)}` } },
      bindings,
    );
    const body = await owner.json<{ responses: Array<{ name: string; note: string }> }>();
    expect(owner.status).toBe(200);
    expect(body.responses[0]).toMatchObject({ name: "ゆう家", note: "帰りだけお願いします" });
    expect(denied.status).toBe(403);
  });

  it("allows the owner to close and delete an event", async () => {
    const { bindings, calls } = makeBindings();
    const closed = await app.request(
      `/api/events/${eventId}/status`,
      {
        body: JSON.stringify({ status: "closed" }),
        headers: { ...jsonHeaders, authorization: `Bearer ${ownerToken}` },
        method: "PATCH",
      },
      bindings,
    );
    const deleted = await app.request(
      `/api/events/${eventId}`,
      {
        headers: { ...jsonHeaders, authorization: `Bearer ${ownerToken}` },
        method: "DELETE",
      },
      bindings,
    );
    expect(closed.status).toBe(200);
    expect(deleted.status).toBe(204);
    expect(calls.some((call) => call.sql.includes("DELETE FROM events"))).toBe(true);
  });

  it("hides an event after three independent reports", async () => {
    const { bindings, calls } = makeBindings({ reportCount: 3 });
    const response = await app.request(
      `/api/events/${eventId}/report`,
      {
        body: JSON.stringify({ reason: "spam", sessionId: browserSessionId }),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(200);
    expect(
      calls.some(
        (call) =>
          call.sql.includes("UPDATE events SET status = 'hidden'") && call.arguments[0] === eventId,
      ),
    ).toBe(true);
  });

  it("does not record automated QA telemetry", async () => {
    const { bindings, calls } = makeBindings();
    const response = await app.request(
      "/api/telemetry",
      {
        body: JSON.stringify({
          context: eventId,
          name: "response_saved",
          sessionId: browserSessionId,
        }),
        headers: { ...jsonHeaders, "x-automated-qa": "1" },
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(204);
    expect(calls.some((call) => call.sql.includes("INSERT OR IGNORE INTO product_events"))).toBe(
      false,
    );
  });

  it("records valid telemetry with 21-day cleanup", async () => {
    const { bindings, calls } = makeBindings();
    const response = await app.request(
      "/api/telemetry",
      {
        body: JSON.stringify({
          context: eventId,
          name: "response_saved",
          sessionId: browserSessionId,
        }),
        headers: jsonHeaders,
        method: "POST",
      },
      bindings,
    );
    expect(response.status).toBe(204);
    expect(
      calls.some(
        (call) =>
          call.sql.includes("DELETE FROM product_events") && call.sql.includes("21 * 86400"),
      ),
    ).toBe(true);
  });

  it("provides health and JSON request ids for missing APIs", async () => {
    const { bindings } = makeBindings();
    const health = await app.request("/healthz", undefined, bindings);
    expect(await health.json()).toMatchObject({ healthy: true, service: "noriai-hyo" });
    const missing = await app.request("/api/missing", undefined, bindings);
    const body = await missing.json<{ error: string; requestId: string }>();
    expect(missing.status).toBe(404);
    expect(body.error).toBe("not_found");
    expect(body.requestId).toBeTruthy();
  });
});
