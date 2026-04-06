-- Burma Meat Point PostgreSQL Schema setup script

-- Drop existing tables to allow clean recreation
DROP TABLE IF EXISTS core_favorite CASCADE;
DROP TABLE IF EXISTS core_flaggedreview CASCADE;
DROP TABLE IF EXISTS core_vendorreply CASCADE;
DROP TABLE IF EXISTS core_rating CASCADE;
DROP TABLE IF EXISTS core_shopnamechangerequest CASCADE;
DROP TABLE IF EXISTS core_ratingalgorithmconfig CASCADE;
DROP TABLE IF EXISTS core_vendorrequest CASCADE;
DROP TABLE IF EXISTS core_vendordetails CASCADE;
DROP TABLE IF EXISTS core_user_groups CASCADE;
DROP TABLE IF EXISTS core_user_user_permissions CASCADE;
DROP TABLE IF EXISTS core_user CASCADE;

-- Type ENUMs (Though in Django we just use VARCHAR, enum helps constraint natively if wanted)
-- For compatibility with Django, we'll use VARCHAR with CHECK constraints or just VARCHAR.

CREATE TABLE core_user (
    id BIGSERIAL PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    email VARCHAR(254) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL CHECK (role IN ('Consumer', 'Vendor', 'Admin')),
    status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended')),
    is_vendor_approved BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT True,
    is_staff BOOLEAN NOT NULL DEFAULT False,
    date_joined TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE core_vendordetails (
    id BIGSERIAL PRIMARY KEY,
    vendor_id BIGINT UNIQUE NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    shop_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    kebs_license VARCHAR(100),
    meat_types TEXT NOT NULL,
    price_range VARCHAR(100) NOT NULL,
    description TEXT,
    profile_image VARCHAR(100),
    meat_photo VARCHAR(100),
    hygiene_score NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    freshness_score NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    service_score NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    overall_score NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    total_ratings INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE core_vendorrequest (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    shop_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    kebs_license VARCHAR(100),
    meat_types TEXT NOT NULL,
    price_range VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    submitted_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_date TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT
);

CREATE TABLE core_ratingalgorithmconfig (
    id BIGSERIAL PRIMARY KEY,
    hygiene_weight NUMERIC(3, 2) NOT NULL DEFAULT 0.35,
    freshness_weight NUMERIC(3, 2) NOT NULL DEFAULT 0.40,
    service_weight NUMERIC(3, 2) NOT NULL DEFAULT 0.25,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE core_shopnamechangerequest (
    id BIGSERIAL PRIMARY KEY,
    vendor_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    old_name VARCHAR(255) NOT NULL,
    new_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    request_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_date TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT
);

CREATE TABLE core_rating (
    id BIGSERIAL PRIMARY KEY,
    vendor_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    consumer_id BIGINT REFERENCES core_user(id) ON DELETE SET NULL,
    anonymous_mode BOOLEAN NOT NULL DEFAULT FALSE,
    hygiene_score INTEGER NOT NULL CHECK (hygiene_score BETWEEN 1 AND 5),
    freshness_score INTEGER NOT NULL CHECK (freshness_score BETWEEN 1 AND 5),
    service_score INTEGER NOT NULL CHECK (service_score BETWEEN 1 AND 5),
    comment TEXT,
    is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE core_vendorreply (
    id BIGSERIAL PRIMARY KEY,
    rating_id BIGINT UNIQUE NOT NULL REFERENCES core_rating(id) ON DELETE CASCADE,
    reply_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE core_flaggedreview (
    id BIGSERIAL PRIMARY KEY,
    rating_id BIGINT NOT NULL REFERENCES core_rating(id) ON DELETE CASCADE,
    flagged_by_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resolved', 'Dismissed')),
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT
);

CREATE TABLE core_favorite (
    id BIGSERIAL PRIMARY KEY,
    consumer_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    vendor_id BIGINT NOT NULL REFERENCES core_user(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(consumer_id, vendor_id)
);

-- Insert default Algorithm config
INSERT INTO core_ratingalgorithmconfig (hygiene_weight, freshness_weight, service_weight) VALUES (0.35, 0.40, 0.25);
