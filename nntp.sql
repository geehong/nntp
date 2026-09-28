-- ============================================================
-- NNTP Database Schema Configuration (PostgreSQL / MySQL Compatible)
-- ============================================================

-- 1. NNTP Server Settings Table
CREATE TABLE IF NOT EXISTS nntp_servers (
    id VARCHAR(100) PRIMARY KEY,                -- Unique server identifier (e.g., 'server-easynews')
    name VARCHAR(255) NOT NULL,                 -- Display name of the Usenet server
    host VARCHAR(255) NOT NULL,                 -- NNTP server hostname or IP address (e.g., 'news.easynews.com')
    port INT NOT NULL DEFAULT 563,              -- Connection port (563 for SSL/TLS, 119 for plain)
    use_ssl INT DEFAULT 1,                      -- SSL/TLS flag (1: enabled, 0: disabled)
    username VARCHAR(255),                      -- Authentication username
    password VARCHAR(255),                      -- Authentication password
    max_connections INT DEFAULT 10,             -- Maximum parallel socket connection limit
    status VARCHAR(50) DEFAULT 'Connected',     -- Current server status ('Connected', 'Disconnected', etc.)
    retention VARCHAR(50) DEFAULT '3000+ Days', -- Retention capability info (e.g., '5800+ Days')
    synced_groups INT DEFAULT 0,                -- Count of synced newsgroups for this server
    is_primary INT DEFAULT 0,                   -- Primary default server flag (1: primary, 0: secondary)
    default_article_count INT DEFAULT 30000,    -- Default XOVER article header fetch chunk size
    show_in_sidebar INT DEFAULT 1,              -- Flag to display server in sidebar (1: show, 0: hide)
    sort_order INT DEFAULT 0,                   -- Priority sorting order in server list UI
    expire_date VARCHAR(50)                     -- Subscription or account expiration date
);

-- 2. Newsgroups Directory Table
CREATE TABLE IF NOT EXISTS newsgroups (
    server_id VARCHAR(100) NOT NULL DEFAULT 'server-easynews', -- Associated NNTP server ID
    name VARCHAR(255) NOT NULL,                                -- Newsgroup name (e.g., 'alt.binaries.pictures.erotica')
    high VARCHAR(50),                                          -- Highest article ID returned by NNTP GROUP command
    low VARCHAR(50),                                           -- Lowest article ID returned by NNTP GROUP command
    status VARCHAR(20),                                        -- Group posting status ('y': posting allowed, 'n': no posting, 'm': moderated)
    count VARCHAR(50),                                         -- Raw string estimated article count
    article_count VARCHAR(50),                                 -- Raw string total article range count (high - low + 1)
    raw_nntp_line TEXT,                                        -- Raw LIST overview response line from NNTP server
    is_favorite INT DEFAULT 0,                                 -- User favorite flag (1: favorite, 0: normal)
    num_high BIGINT DEFAULT 0,                                 -- Numeric highest article ID for indexing & fast sorting
    num_low BIGINT DEFAULT 0,                                  -- Numeric lowest article ID for indexing & fast sorting
    num_count BIGINT DEFAULT 0,                                -- Numeric estimated article count
    num_article_count BIGINT DEFAULT 0,                        -- Numeric calculated article range count
    PRIMARY KEY (server_id, name)
);

-- Performance Optimization Indexes for Newsgroup Lookups & Sorting
CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_fav ON newsgroups(server_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_name ON newsgroups(server_id, name);
CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_artcnt ON newsgroups(server_id, num_article_count DESC);
CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_high ON newsgroups(server_id, num_high DESC);
CREATE INDEX IF NOT EXISTS idx_newsgroups_srv_count ON newsgroups(server_id, num_count DESC);

-- 3. Article XOVER Headers Cache Table
CREATE TABLE IF NOT EXISTS article_cache (
    server_id VARCHAR(100) NOT NULL,            -- NNTP server ID
    group_name VARCHAR(255) NOT NULL,           -- Target newsgroup name
    range_key VARCHAR(100) NOT NULL,            -- Fetched article range key (e.g., '213916872-213946871')
    lines TEXT,                                 -- Tab-separated raw XOVER header lines payload
    updated_at BIGINT,                          -- Cache creation timestamp (epoch milliseconds)
    PRIMARY KEY (server_id, group_name, range_key)
);

CREATE INDEX IF NOT EXISTS idx_artcache_lookup ON article_cache(server_id, group_name, range_key);

-- 4. NNTP Server Traffic & Usage Analytics Table
CREATE TABLE IF NOT EXISTS server_usage (
    server_id VARCHAR(100) NOT NULL,            -- NNTP server ID
    date VARCHAR(20) NOT NULL,                  -- Usage tracking date (YYYY-MM-DD)
    bytes_downloaded BIGINT DEFAULT 0,          -- Total bytes downloaded on this date
    PRIMARY KEY (server_id, date)
);

-- 5. Application Metadata & Key-Value Storage Table
CREATE TABLE IF NOT EXISTS metadata (
    key VARCHAR(100) PRIMARY KEY,               -- Metadata setting key (e.g., 'last_group_sync_time')
    value TEXT                                  -- Metadata setting value
);
