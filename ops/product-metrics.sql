WITH
telemetry AS (
  SELECT
    COUNT(DISTINCT CASE WHEN name = 'visited' THEN session_id END) AS users,
    COUNT(DISTINCT CASE WHEN name = 'link_copied' THEN context END) AS links_copied,
    COUNT(DISTINCT CASE WHEN name = 'owner_opened' THEN context END) AS owner_opened,
    COUNT(DISTINCT CASE WHEN name = 'returned' THEN session_id END) AS returned,
    COUNT(DISTINCT CASE
      WHEN name = 'visited' AND occurred_on >= date('now', '-6 days') THEN session_id
    END) AS users_7d
  FROM product_events
),
event_counts AS (
  SELECT
    COUNT(*) AS events_created,
    COUNT(DISTINCT creator_session_id) AS organizers,
    COUNT(CASE WHEN status = 'closed' THEN 1 END) AS events_closed,
    COUNT(CASE WHEN created_at >= unixepoch() - (7 * 86400) THEN 1 END) AS events_7d
  FROM events
  WHERE status <> 'hidden'
),
response_counts AS (
  SELECT
    COUNT(*) AS responses_saved,
    COUNT(DISTINCT responses.respondent_session_id) AS respondents,
    COUNT(DISTINCT responses.event_id) AS events_with_responses,
    COUNT(DISTINCT CASE
      WHEN responses.attendance = 'yes' AND responses.ride <> 'self' THEN responses.event_id
    END) AS events_with_carpool,
    COALESCE(SUM(CASE
      WHEN responses.attendance = 'yes' AND responses.ride = 'offer' THEN responses.seats ELSE 0
    END), 0) AS seats_offered,
    COALESCE(SUM(CASE
      WHEN responses.attendance = 'yes' AND responses.ride = 'need'
        THEN responses.passengers ELSE 0
    END), 0) AS rides_needed
  FROM responses
  JOIN events ON events.id = responses.event_id
  WHERE events.status <> 'hidden'
),
deep_events AS (
  SELECT COUNT(*) AS events_with_five_responses
  FROM (
    SELECT responses.event_id
    FROM responses
    JOIN events ON events.id = responses.event_id
    WHERE events.status <> 'hidden'
    GROUP BY responses.event_id
    HAVING COUNT(*) >= 5
  )
),
repeat_organizers AS (
  SELECT COUNT(*) AS repeat_organizers
  FROM (
    SELECT creator_session_id
    FROM events
    WHERE status <> 'hidden'
    GROUP BY creator_session_id
    HAVING COUNT(*) >= 2
  )
)
SELECT
  telemetry.*,
  event_counts.*,
  response_counts.*,
  deep_events.events_with_five_responses,
  repeat_organizers.repeat_organizers
FROM telemetry, event_counts, response_counts, deep_events, repeat_organizers;
