# System Summary

## Overview

This project is a multi-platform vendor rating system for meat shops. It allows consumers to discover vendors, submit ratings, save favorites, and interact with vendor profiles. Vendors can manage their public profile, view analytics, reply to reviews, and generate QR codes for their shop pages. Admins can approve vendor applications, moderate flagged reviews, suspend vendors, manage name-change requests, and adjust the rating algorithm.

## Main Components

### Backend

- Location: `backend/`
- Framework: Django + Django REST Framework
- Auth: JWT with refresh cookies
- Data layer:
  - SQLite by default
  - PostgreSQL supported through environment configuration
- Key responsibilities:
  - authentication and registration
  - vendor and consumer APIs
  - admin moderation and management APIs
  - rating aggregation
  - notifications and Expo push token handling

### Web Frontend

- Location: `frontend_web/`
- Framework: React 19 + Vite
- State/query tools:
  - Zustand for auth state
  - TanStack Query for server state
- Key responsibilities:
  - public vendor browsing
  - consumer dashboards and rating flows
  - vendor dashboard
  - admin dashboard

### Mobile App

- Location: `mobile/`
- Framework: Expo + React Native + Expo Router
- Key responsibilities:
  - mobile access to the same API-backed flows
  - QR scanning
  - location-based vendor discovery
  - push notification registration

## Core Domain Model

Main backend models in `backend/core/models.py`:

- `User`: supports `Consumer`, `Vendor`, and `Admin` roles
- `VendorDetails`: public vendor profile and aggregate scores
- `VendorRequest`: application flow for becoming a vendor
- `Rating`: consumer review with hygiene, freshness, and service scores
- `VendorReply`: vendor response to a rating
- `FlaggedReview`: admin moderation queue for problematic reviews
- `RatingAlgorithmConfig`: adjustable score weighting
- `ShopNameChangeRequest`: vendor rename approval workflow
- `Favorite`: consumer-saved vendors
- `Notification` and `DevicePushToken`: in-app and push notifications
- `AdminAuditLog`: records admin actions

## Main User Flows

### Consumer

- register and log in
- browse vendors
- search vendors by filters and location
- view vendor profile and ratings
- submit ratings
- save favorite vendors
- view personal rating history

### Vendor

- apply for vendor approval
- view dashboard analytics
- manage public profile content
- upload a showcase meat photo
- reply to consumer reviews
- request a shop-name change
- share public profile through QR code

### Admin

- review vendor applications
- suspend or reinstate vendors
- moderate flagged reviews
- approve or reject shop-name changes
- adjust rating weights
- review audit logs and system statistics

## API and Configuration

- Backend API base path: `/api/v1`
- Web API URL is now environment-driven through `VITE_API_URL`
- Mobile API URL is now environment-driven through `EXPO_PUBLIC_API_BASE_URL`
- Backend production origins are controlled with:
  - `FRONTEND_URL`
  - `CORS_ALLOWED_ORIGINS`
  - `CSRF_TRUSTED_ORIGINS`

Environment examples were added in:

- `backend/.env.example`
- `frontend_web/.env.example`
- `mobile/.env.example`

## Current Technical State

### Strengths

- clear separation between backend, web, and mobile
- role-based flows for consumer, vendor, and admin
- environment-aware client API configuration
- backend checks and tests currently pass
- web lint and production build currently pass

### Risks / Notes

- backend settings currently contain very high throttle limits; these should be reviewed before production
- SQLite is acceptable only for very low traffic on a small VPS
- some earlier bug-report items were already partially fixed before this round of work
- there are existing user changes in some backend files, so future edits should continue to be made carefully

## Verification Completed

The following were verified during debugging:

- frontend lint passed
- frontend production build passed
- `manage.py check` passed
- Django test suite passed with `--keepdb --noinput`

## Recommended Cheapest Hosting

Lowest practical cost:

- Web frontend: Cloudflare Pages
- Backend API: one small VPS
- TLS: Let's Encrypt
- Reverse proxy: Nginx
- App process management: `systemd`
- Database:
  - start with SQLite only if traffic is very low
  - move to PostgreSQL on the same VPS when growth starts

This approach minimizes recurring cost while fitting the current Django architecture.
