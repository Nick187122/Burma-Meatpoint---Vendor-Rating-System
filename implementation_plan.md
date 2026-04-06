# Project Status & Remaining Implementation Plan

Based on the review of the current codebase (`Burma-Meatpoint---Vendor-Rating-System`), the core vendor rating system is functional with essential roles (Consumer, Vendor, Admin), rating composites, vendor requests, and basic dashboards.

However, several critical features have been left out of the initial build, and there is significant work remaining to make this a production-ready Web and Mobile solution.

## 1. Left Out & Remaining Tasks (Backend + Web)

### 1.1 Authentication & Security Enhancements
- **Password Reset Flow:** Currently missing. Need to implement email-based password reset endpoints and frontend UI.
- **Email Verification:** Users (especially Vendors) should verify their emails upon registration.
- **Social Login (Optional):** Google/Facebook login for faster consumer onboarding.

### 1.2 Consumer Features & Experience
- **Consumer Profile Dashboard:** A page for consumers to view all the ratings they have given, edit their profile details, and manage favorites.
- **Favorites / Bookmarking:** Allow consumers to "save" or "favorite" vendors for quick access later.
- **Advanced Search & Geolocation:** The current search is a basic text match. It needs to be upgraded to use **Geospatial Queries** (e.g., PostGIS or simple HAversine formula) to show vendors within a specific radius of the user's location.

### 1.3 Vendor Enhancements
- **Real-time Notifications:** WebSockets (Django Channels) or Email notifications when a vendor receives a new rating, or when an Admin approves their shop name change/vendor request.
- **Analytics Dashboard:** Graphical representation (charts/graphs) of their rating trends over time (Hygiene, Freshness, Service) to help them improve.
- **QR Code Generation:** A feature in the vendor dashboard to generate a unique QR code that links directly to their rating page, which they can print and place in their shop.

### 1.4 Admin Portal Upgrades
- **System Analytics:** A comprehensive metrics dashboard showing total daily ratings, active users, and platform growth.
- **Audit Logs:** Tracking admin actions (e.g., who suspended a vendor, who changed the rating algorithm weights).

---

## 2. Mobile Application Implementation Plan

Given that consumers will mostly be rating vendors on-the-go (at the butchery or meat point), a Mobile Application is essential. 

**Technology Stack:** React Native (with Expo) for cross-platform (iOS and Android) support, utilizing the existing Django REST API.

### 2.1 Core Mobile Features
- **Geolocation & Interactive Maps:** The app will prompt for location permissions and show nearby vendors on a map (Google Maps or Apple Maps integration).
- **QR Code Scanner:** Consumers can instantly open their camera in the app, scan a vendor's printed QR code, and land directly on the rating submission screen.
- **Push Notifications:** Firebase Cloud Messaging (FCM) to alert vendors of new ratings and consumers of nearby top-rated vendors or promotions.
- **Offline Caching:** Caching the vendor list so consumers can browse even with poor network connectivity.

### 2.2 Consumer App Screens
1. **Onboarding & Auth:** Login, Register, Forgot Password.
2. **Home/Map Tab:** Interactive map showing nearby vendors as pins with their overall score.
3. **Search Tab:** Filter vendors by meat type (Beef, Goat, etc.), price range, and minimum rating.
4. **Vendor Profile & Rating:** View vendor details, read reviews, and submit a rating (with photo upload if needed in the future).
5. **My Profile Tab:** View favorite vendors and history of given ratings.

### 2.3 Vendor App Screens (Can be a distinct mode in the same app)
1. **Vendor Dashboard:** Quick glance at their current composite scores (Hygiene, Freshness, Service) and total ratings.
2. **Review Management:** A feed of recent ratings with the ability to "Reply" or "Flag" directly from the phone.
3. **Profile Settings:** Update shop status (Open/Closed), edit meat types, and manage profile photos.
4. **QR Code Display:** A screen that displays their shop's QR code so a consumer can scan it directly from the vendor's phone if a printed copy isn't available.

## Verification Plan

### Automated Tests
- **Backend:** Write unit tests for the new endpoints (e.g., password reset, favorites, geolocation search) using `pytest` and Django's `TestCase`. 
- **Command:** `pytest backend/` or `python manage.py test core`
- **Mobile:** Use `Jest` and `React Native Testing Library` for component and integration testing of the mobile screens.

### Manual Verification
- **Web App:** Manually verify the new UI components (Consumer Dashboard, Password Reset flow). Ensure the map renders correctly and filters work.
- **Mobile App:** Run the app on iOS Simulator and Android Emulator. 
  - Verify location permissions prompt correctly.
  - Test the QR scanner using a sample generated QR code on a screen.
  - Test Push Notifications by triggering an event from the Django admin panel and verifying the notification arrives on the device.
