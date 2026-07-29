import { Hono } from "hono";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

import { securityHeaders } from "./middleware/security";
import { EventPage, GuidePage, HomePage, ManagePage, NotFoundPage, PrivacyPage } from "./ui/pages";

export type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

type AppContext = Context<{ Bindings: Bindings; Variables: { requestId: string } }>;
type EventStatus = "closed" | "hidden" | "open";
type Attendance = "maybe" | "no" | "yes";
type Ride = "need" | "offer" | "self";

type EventRow = {
  created_at: number;
  event_date: string;
  expected_count: number;
  expires_at: number;
  id: string;
  meet_time: string;
  owner_token_hash: string;
  place: string;
  sport: string;
  status: EventStatus;
  title: string;
};

type ResponseRow = {
  attendance: Attendance;
  created_at: number;
  id: string;
  name: string;
  note: string;
  passengers: number;
  ride: Ride;
  seats: number;
  updated_at: number;
};

type AggregateRow = {
  maybe_count: number;
  need_count: number;
  no_count: number;
  response_count: number;
  seat_count: number;
  yes_count: number;
};

class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 429,
  ) {
    super(code);
  }
}

const app = new Hono<{ Bindings: Bindings; Variables: { requestId: string } }>();
const idPattern = /^[0-9a-f]{32}$/i;
const secretPattern = /^[0-9a-f]{64}$/i;
const browserSessionPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const meetTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const sports = new Set(["soccer", "basketball", "baseball", "volleyball", "other"]);
const attendances = new Set<Attendance>(["yes", "maybe", "no"]);
const rides = new Set<Ride>(["self", "offer", "need"]);
const reportReasons = new Set(["spam", "unsafe", "other"]);
const telemetryNames = new Set([
  "visited",
  "event_created",
  "link_copied",
  "response_saved",
  "owner_opened",
  "event_closed",
  "returned",
]);
const blockedLinkPattern =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|net|org|jp|io|app|dev)\b|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i;

const randomHex = (byteLength: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
};

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sameHash = (left: string, right: string) => {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const cleanup = (db: D1Database) =>
  db.batch([
    db.prepare("DELETE FROM events WHERE expires_at <= unixepoch()"),
    db.prepare("DELETE FROM product_events WHERE created_at < unixepoch() - (21 * 86400)"),
  ]);

const enforceSameOrigin = (c: AppContext) => {
  const fetchSite = c.req.header("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ApiError("cross_site_request", 403);
  }
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) {
    throw new ApiError("cross_site_request", 403);
  }
};

const parseJson = async (c: AppContext, maximumBytes: number) => {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError("unsupported_media_type", 415);
  }
  const contentLength = Number(c.req.header("content-length") ?? "0");
  if (contentLength > maximumBytes) {
    throw new ApiError("payload_too_large", 413);
  }
  const rawBody = await c.req.text();
  if (new TextEncoder().encode(rawBody).byteLength > maximumBytes) {
    throw new ApiError("payload_too_large", 413);
  }
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};

const cleanText = (value: unknown, maximumLength: number) => {
  if (typeof value !== "string") {
    return "";
  }
  return Array.from(value.normalize("NFKC"))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
};

const integerInRange = (value: unknown, minimum: number, maximum: number) => {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

const validEventDate = (value: string) => {
  if (!eventDatePattern.test(value)) {
    return false;
  }
  const eventDay = Date.parse(`${value}T00:00:00Z`);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayDay = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(eventDay) && eventDay >= todayDay && eventDay <= todayDay + 180 * 86400000;
};

const getEvent = (db: D1Database, eventId: string) =>
  db
    .prepare(
      `SELECT id, owner_token_hash, title, event_date, meet_time, place, sport,
        expected_count, status, created_at, expires_at
       FROM events
       WHERE id = ? AND expires_at > unixepoch()`,
    )
    .bind(eventId)
    .first<EventRow>();

const bearerToken = (c: AppContext) => {
  const authorization = c.req.header("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secretPattern.test(token)) {
    throw new ApiError("access_denied", 403);
  }
  return token;
};

const requireOwner = async (c: AppContext, eventId: string) => {
  const token = bearerToken(c);
  const event = await getEvent(c.env.DB, eventId);
  if (!event || !sameHash(await sha256(token), event.owner_token_hash)) {
    throw new ApiError("access_denied", 403);
  }
  return event;
};

const getAggregates = async (db: D1Database, eventId: string) => {
  const result = await db
    .prepare(
      `SELECT
        COUNT(*) AS response_count,
        COUNT(CASE WHEN attendance = 'yes' THEN 1 END) AS yes_count,
        COUNT(CASE WHEN attendance = 'maybe' THEN 1 END) AS maybe_count,
        COUNT(CASE WHEN attendance = 'no' THEN 1 END) AS no_count,
        COALESCE(SUM(CASE WHEN attendance = 'yes' AND ride = 'offer' THEN seats ELSE 0 END), 0)
          AS seat_count,
        COALESCE(SUM(CASE WHEN attendance = 'yes' AND ride = 'need' THEN passengers ELSE 0 END), 0)
          AS need_count
       FROM responses WHERE event_id = ?`,
    )
    .bind(eventId)
    .first<AggregateRow>();
  return {
    maybe: Number(result?.maybe_count ?? 0),
    needs: Number(result?.need_count ?? 0),
    no: Number(result?.no_count ?? 0),
    responses: Number(result?.response_count ?? 0),
    seats: Number(result?.seat_count ?? 0),
    yes: Number(result?.yes_count ?? 0),
  };
};

const publicEvent = async (db: D1Database, event: EventRow) => ({
  date: event.event_date,
  expiresAt: new Date(event.expires_at * 1000).toISOString(),
  expectedCount: event.expected_count,
  id: event.id,
  meetTime: event.meet_time,
  place: event.place,
  sport: event.sport,
  status: event.status,
  summary: await getAggregates(db, event.id),
  title: event.title,
});

const isAutomatedQa = (c: AppContext) => {
  if (c.req.header("x-automated-qa") === "1") {
    return true;
  }
  const referer = c.req.header("referer");
  if (!referer) {
    return false;
  }
  try {
    return new URL(referer).searchParams.get("qa") === "1";
  } catch {
    return false;
  }
};

const noStore = (c: AppContext) => {
  c.header("Cache-Control", "private, no-store");
  c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
};

app.use("*", requestId());
app.use("*", securityHeaders);
app.use("/api/*", async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  await next();
});

app.get("/", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<HomePage />);
});

app.get("/guide", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<GuidePage />);
});

app.get("/privacy", (c) => {
  c.header("Cache-Control", "public, max-age=300, s-maxage=86400");
  return c.html(<PrivacyPage />);
});

app.get("/e/:eventId", async (c) => {
  noStore(c);
  const eventId = c.req.param("eventId");
  if (!idPattern.test(eventId)) {
    return c.html(<NotFoundPage />, 404);
  }
  const event = await getEvent(c.env.DB, eventId);
  if (!event || event.status === "hidden") {
    return c.html(<NotFoundPage />, 404);
  }
  return c.html(<EventPage eventId={eventId} title={event.title} />);
});

app.get("/manage/:eventId", async (c) => {
  noStore(c);
  const eventId = c.req.param("eventId");
  if (!idPattern.test(eventId)) {
    return c.html(<NotFoundPage />, 404);
  }
  const event = await getEvent(c.env.DB, eventId);
  if (!event || event.status === "hidden") {
    return c.html(<NotFoundPage />, 404);
  }
  return c.html(<ManagePage eventId={eventId} title={event.title} />);
});

app.get("/api/events/:eventId", async (c) => {
  const eventId = c.req.param("eventId");
  if (!idPattern.test(eventId)) {
    throw new ApiError("not_found", 404);
  }
  const event = await getEvent(c.env.DB, eventId);
  if (!event || event.status === "hidden") {
    throw new ApiError("not_found", 404);
  }
  return c.json(await publicEvent(c.env.DB, event));
});

app.post("/api/events", async (c) => {
  enforceSameOrigin(c);
  const payload = await parseJson(c, 4096);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_event", 400);
  }
  const source = payload as Record<string, unknown>;
  const title = cleanText(source.title, 50);
  const eventDate = cleanText(source.date, 10);
  const meetTime = cleanText(source.meetTime, 5);
  const place = cleanText(source.place, 60);
  const sport = typeof source.sport === "string" ? source.sport : "";
  const expectedCount = integerInRange(source.expectedCount, 1, 50);
  const creatorSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const website = cleanText(source.website, 100);
  if (
    !title ||
    !validEventDate(eventDate) ||
    !meetTimePattern.test(meetTime) ||
    !place ||
    !sports.has(sport) ||
    expectedCount === null ||
    !browserSessionPattern.test(creatorSessionId) ||
    website ||
    blockedLinkPattern.test(title) ||
    blockedLinkPattern.test(place)
  ) {
    throw new ApiError("invalid_event", 400);
  }
  const recent = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM events
     WHERE creator_session_id = ? AND created_at > unixepoch() - 86400`,
  )
    .bind(creatorSessionId)
    .first<{ count: number }>();
  if (Number(recent?.count ?? 0) >= 10) {
    throw new ApiError("rate_limited", 429);
  }
  const eventId = randomHex(16);
  const ownerToken = randomHex(32);
  await c.env.DB.prepare(
    `INSERT INTO events (
      id, owner_token_hash, creator_session_id, title, event_date,
      meet_time, place, sport, expected_count, created_at, updated_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch(), unixepoch() + (21 * 86400))`,
  )
    .bind(
      eventId,
      await sha256(ownerToken),
      creatorSessionId,
      title,
      eventDate,
      meetTime,
      place,
      sport,
      expectedCount,
    )
    .run();
  return c.json({ eventId, expiresInDays: 21, ownerToken }, 201);
});

app.post("/api/events/:eventId/responses", async (c) => {
  enforceSameOrigin(c);
  const eventId = c.req.param("eventId");
  if (!idPattern.test(eventId)) {
    throw new ApiError("not_found", 404);
  }
  const event = await getEvent(c.env.DB, eventId);
  if (!event || event.status === "hidden") {
    throw new ApiError("not_found", 404);
  }
  if (event.status !== "open") {
    throw new ApiError("event_closed", 409);
  }
  const payload = await parseJson(c, 4096);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_response", 400);
  }
  const source = payload as Record<string, unknown>;
  const name = cleanText(source.name, 20);
  const attendanceValue = typeof source.attendance === "string" ? source.attendance : "";
  const rideValue = typeof source.ride === "string" ? source.ride : "";
  const note = cleanText(source.note, 100);
  const respondentSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const website = cleanText(source.website, 100);
  if (
    !name ||
    !attendances.has(attendanceValue as Attendance) ||
    !rides.has(rideValue as Ride) ||
    !browserSessionPattern.test(respondentSessionId) ||
    website ||
    blockedLinkPattern.test(name) ||
    blockedLinkPattern.test(note)
  ) {
    throw new ApiError("invalid_response", 400);
  }

  const attendance = attendanceValue as Attendance;
  let ride = rideValue as Ride;
  let seats = 0;
  let passengers = 0;
  if (attendance === "no") {
    ride = "self";
  } else if (ride === "offer") {
    seats = integerInRange(source.seats, 1, 8) ?? 0;
    if (seats === 0) {
      throw new ApiError("invalid_response", 400);
    }
  } else if (ride === "need") {
    passengers = integerInRange(source.passengers, 1, 4) ?? 0;
    if (passengers === 0) {
      throw new ApiError("invalid_response", 400);
    }
  }

  const responseId = typeof source.responseId === "string" ? source.responseId : "";
  const editToken = typeof source.editToken === "string" ? source.editToken : "";
  if (responseId || editToken) {
    if (!idPattern.test(responseId) || !secretPattern.test(editToken)) {
      throw new ApiError("access_denied", 403);
    }
    const stored = await c.env.DB.prepare(
      `SELECT edit_token_hash FROM responses
       WHERE id = ? AND event_id = ? AND respondent_session_id = ?`,
    )
      .bind(responseId, eventId, respondentSessionId)
      .first<{ edit_token_hash: string }>();
    if (!stored || !sameHash(await sha256(editToken), stored.edit_token_hash)) {
      throw new ApiError("access_denied", 403);
    }
    await c.env.DB.prepare(
      `UPDATE responses
       SET name = ?, attendance = ?, ride = ?, seats = ?, passengers = ?, note = ?,
           updated_at = unixepoch()
       WHERE id = ? AND event_id = ?`,
    )
      .bind(name, attendance, ride, seats, passengers, note, responseId, eventId)
      .run();
    return c.json({ responseId, saved: true, updated: true });
  }

  const counts = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       COUNT(CASE WHEN respondent_session_id = ? THEN 1 END) AS own
     FROM responses WHERE event_id = ?`,
  )
    .bind(respondentSessionId, eventId)
    .first<{ own: number; total: number }>();
  if (Number(counts?.total ?? 0) >= 100) {
    throw new ApiError("event_full", 409);
  }
  if (Number(counts?.own ?? 0) >= 1) {
    throw new ApiError("already_answered", 409);
  }
  const newResponseId = randomHex(16);
  const newEditToken = randomHex(32);
  await c.env.DB.prepare(
    `INSERT INTO responses (
      id, event_id, edit_token_hash, respondent_session_id, name,
      attendance, ride, seats, passengers, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
  )
    .bind(
      newResponseId,
      eventId,
      await sha256(newEditToken),
      respondentSessionId,
      name,
      attendance,
      ride,
      seats,
      passengers,
      note,
    )
    .run();
  return c.json({ editToken: newEditToken, responseId: newResponseId, saved: true }, 201);
});

app.get("/api/events/:eventId/manage", async (c) => {
  const eventId = c.req.param("eventId");
  if (!idPattern.test(eventId)) {
    throw new ApiError("not_found", 404);
  }
  const event = await requireOwner(c, eventId);
  const responses = await c.env.DB.prepare(
    `SELECT id, name, attendance, ride, seats, passengers, note, created_at, updated_at
     FROM responses WHERE event_id = ? ORDER BY updated_at DESC`,
  )
    .bind(eventId)
    .all<ResponseRow>();
  return c.json({
    ...(await publicEvent(c.env.DB, event)),
    responses: responses.results.map((response) => ({
      attendance: response.attendance,
      createdAt: new Date(response.created_at * 1000).toISOString(),
      id: response.id,
      name: response.name,
      note: response.note,
      passengers: response.passengers,
      ride: response.ride,
      seats: response.seats,
      updatedAt: new Date(response.updated_at * 1000).toISOString(),
    })),
  });
});

app.patch("/api/events/:eventId/status", async (c) => {
  enforceSameOrigin(c);
  const eventId = c.req.param("eventId");
  if (!idPattern.test(eventId)) {
    throw new ApiError("not_found", 404);
  }
  await requireOwner(c, eventId);
  const payload = await parseJson(c, 1024);
  const status =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>).status : "";
  if (status !== "open" && status !== "closed") {
    throw new ApiError("invalid_status", 400);
  }
  await c.env.DB.prepare("UPDATE events SET status = ?, updated_at = unixepoch() WHERE id = ?")
    .bind(status, eventId)
    .run();
  return c.json({ status });
});

app.delete("/api/events/:eventId", async (c) => {
  enforceSameOrigin(c);
  const eventId = c.req.param("eventId");
  if (!idPattern.test(eventId)) {
    throw new ApiError("not_found", 404);
  }
  await requireOwner(c, eventId);
  await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(eventId).run();
  return c.body(null, 204);
});

app.post("/api/events/:eventId/report", async (c) => {
  enforceSameOrigin(c);
  const eventId = c.req.param("eventId");
  if (!idPattern.test(eventId)) {
    throw new ApiError("not_found", 404);
  }
  const event = await getEvent(c.env.DB, eventId);
  if (!event || event.status === "hidden") {
    throw new ApiError("not_found", 404);
  }
  const payload = await parseJson(c, 1024);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_report", 400);
  }
  const source = payload as Record<string, unknown>;
  const reporterSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const reason = typeof source.reason === "string" ? source.reason : "";
  if (!browserSessionPattern.test(reporterSessionId) || !reportReasons.has(reason)) {
    throw new ApiError("invalid_report", 400);
  }
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO reports
      (event_id, reporter_session_id, reason, created_at)
     VALUES (?, ?, ?, unixepoch())`,
  )
    .bind(eventId, reporterSessionId, reason)
    .run();
  const result = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM reports WHERE event_id = ?")
    .bind(eventId)
    .first<{ count: number }>();
  if (Number(result?.count ?? 0) >= 3) {
    await c.env.DB.prepare(
      "UPDATE events SET status = 'hidden', updated_at = unixepoch() WHERE id = ?",
    )
      .bind(eventId)
      .run();
  }
  return c.json({ reported: true });
});

app.post("/api/telemetry", async (c) => {
  enforceSameOrigin(c);
  if (isAutomatedQa(c)) {
    return c.body(null, 204);
  }
  const payload = await parseJson(c, 1024);
  if (!payload || typeof payload !== "object") {
    throw new ApiError("invalid_telemetry", 400);
  }
  const source = payload as Record<string, unknown>;
  const browserSessionId = typeof source.sessionId === "string" ? source.sessionId : "";
  const name = typeof source.name === "string" ? source.name : "";
  const context = cleanText(source.context, 32);
  if (
    !browserSessionPattern.test(browserSessionId) ||
    !telemetryNames.has(name) ||
    (context !== "home" && context !== "" && !idPattern.test(context))
  ) {
    throw new ApiError("invalid_telemetry", 400);
  }
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO product_events
       (session_id, name, context, occurred_on, created_at)
       VALUES (?, ?, ?, ?, unixepoch())`,
    ).bind(browserSessionId, name, context, new Date().toISOString().slice(0, 10)),
    c.env.DB.prepare("DELETE FROM product_events WHERE created_at < unixepoch() - (21 * 86400)"),
    c.env.DB.prepare("DELETE FROM events WHERE expires_at <= unixepoch()"),
  ]);
  return c.body(null, 204);
});

app.get("/healthz", (c) =>
  c.json({
    healthy: true,
    service: "noriai-hyo",
    time: new Date().toISOString(),
  }),
);

app.notFound((c) => {
  if (c.req.method === "GET" && !c.req.path.startsWith("/api/")) {
    return c.html(<NotFoundPage />, 404);
  }
  return c.json({ error: "not_found", requestId: c.get("requestId") }, 404);
});

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json({ error: error.code, requestId: c.get("requestId") }, error.status);
  }
  console.error(
    JSON.stringify({
      event: "request_failed",
      message: error.message,
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

export { app };
export default {
  fetch: app.fetch,
  scheduled(_controller: ScheduledController, env: Bindings, context: ExecutionContext) {
    context.waitUntil(cleanup(env.DB));
  },
};
