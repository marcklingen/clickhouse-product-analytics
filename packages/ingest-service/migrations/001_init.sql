CREATE DATABASE IF NOT EXISTS {{DATABASE}};

CREATE TABLE IF NOT EXISTS {{DATABASE}}.person_distinct_ids
(
    distinct_id String,
    person_id UUID,
    created_at DateTime64(6, 'UTC'),
    is_deleted Int8,
    version Int64
)
ENGINE = ReplacingMergeTree(version)
ORDER BY distinct_id
SETTINGS index_granularity = 512;

CREATE TABLE IF NOT EXISTS {{DATABASE}}.persons
(
    distinct_id String,
    id UUID,
    properties String CODEC(ZSTD(3)),
    created_at DateTime64(6, 'UTC'),
    updated_at DateTime64(6, 'UTC'),
    last_seen_at DateTime64(6, 'UTC'),
    is_identified Int8,
    is_deleted Int8,
    version Int64
)
ENGINE = ReplacingMergeTree(version)
ORDER BY id;

CREATE TABLE IF NOT EXISTS {{DATABASE}}.events
(
    uuid UUID,
    api_key LowCardinality(String),
    event LowCardinality(String),
    distinct_id String,
    person_id UUID,
    session_id String,
    session_id_uuid Nullable(UUID) MATERIALIZED accurateCastOrNull(session_id, 'UUID'),
    window_id String,
    window_id_uuid Nullable(UUID) MATERIALIZED accurateCastOrNull(window_id, 'UUID'),
    elements_chain String,
    timestamp DateTime64(6, 'UTC'),
    inserted_at DateTime64(6, 'UTC') DEFAULT now64(),
    ip String,
    user_agent String,
    current_url String,
    host String,
    properties String CODEC(ZSTD(3)),
    is_deleted Int8 DEFAULT 0,
    INDEX idx_distinct_id distinct_id TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX idx_session_id session_id TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX idx_window_id window_id TYPE bloom_filter(0.01) GRANULARITY 4,
    INDEX idx_inserted_at inserted_at TYPE minmax GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
ORDER BY (toDate(timestamp), event, cityHash64(distinct_id), cityHash64(uuid))
SAMPLE BY cityHash64(distinct_id);

CREATE VIEW IF NOT EXISTS {{DATABASE}}.sessions AS
SELECT
    api_key,
    session_id,
    argMax(distinct_id, (timestamp, inserted_at, uuid)) AS distinct_id,
    argMax(person_id, (timestamp, inserted_at, uuid)) AS person_id,
    min(timestamp) AS started_at,
    max(timestamp) AS ended_at,
    dateDiff('second', min(timestamp), max(timestamp)) AS duration_seconds,
    groupUniqArray(2000)(current_url) AS urls,
    argMin(current_url, timestamp) AS entry_url,
    argMax(current_url, timestamp) AS exit_url,
    argMax(host, (timestamp, inserted_at, uuid)) AS host,
    count() AS event_count,
    countIf(event = '$pageview') AS pageview_count,
    countIf(event = '$autocapture') AS autocapture_count,
    groupUniqArray(2000)(event) AS event_names
FROM {{DATABASE}}.events
WHERE session_id != ''
  AND is_deleted = 0
GROUP BY api_key, session_id;
