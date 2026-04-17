# 🥩 Burma Meatpoint — Vendor Rating System

## 📌 Overview

Burma Meatpoint is a multi-platform vendor rating system designed to help consumers identify reliable and high-quality meat vendors. The system addresses the challenge of misleading pricing and poor meat quality by providing a transparent platform for vendor discovery, ratings, and reviews.

---

## 🚀 Features

### 👤 Consumers

* Register and login
* Browse and search for vendors
* View vendor profiles and ratings
* Submit ratings (hygiene, freshness, service)
* Write reviews
* Save favorite vendors

### 🏪 Vendors

* Apply for vendor approval
* Manage public profile
* View analytics and performance metrics
* Respond to customer reviews
* Generate QR codes for shop sharing

### 🛠 Admin

* Approve or reject vendor applications
* Moderate flagged reviews
* Suspend or reinstate vendors
* Manage rating system configuration
* Monitor system activity logs

---

## 🧱 System Architecture

The system follows a **client–server architecture**:

* **Backend:** Django + Django REST Framework
* **Web Frontend:** React + Vite
* **Mobile App:** React Native (Expo)
* **Database:** SQLite (dev), PostgreSQL (production)

---

## 🛠 Technologies Used

* Python (Django, DRF)
* JavaScript (React, React Native)
* Zustand (state management)
* TanStack Query (data fetching)
* JWT Authentication
* SQLite / PostgreSQL
* Git & GitHub

---

## 📂 Project Structure

```
backend/        # Django backend API
frontend_web/   # React web application
mobile/         # React Native mobile app
```

---

## ⚙️ Setup Instructions

### 1. Clone Repository

```bash
git clone https://github.com/Nick187122/Burma-Meatpoint---Vendor-Rating-System.git
cd Burma-Meatpoint---Vendor-Rating-System
```

---

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

---

### 3. Web Frontend Setup

```bash
cd frontend_web
npm install
npm run dev
```

---

### 4. Mobile App Setup

```bash
cd mobile
npm install
npx expo start
```

---

## 🔐 Environment Variables

Configure environment variables using:

* `.env.example` files in each directory

---

## 📊 Key Functionalities

* Vendor rating aggregation system
* Role-based access control (Consumer, Vendor, Admin)
* Review moderation system
* Notification system
* QR code integration
* Location-based vendor discovery

---

## 🧠 Problem Solved

Many consumers face challenges in identifying trustworthy meat vendors due to:

* Lack of verified information
* Misleading advertising
* Poor quality control

This system introduces **transparency, accountability, and informed decision-making**.

---

## 🔮 Future Improvements

* Online ordering and delivery system
* AI-based review validation
* Recommendation engine
* Scalable cloud deployment

---

## 👨‍💻 Author

**Nicholas Oyiolo Abwana**
Bachelor of Science in Computer Science
St Paul’s University

---

## 📜 License

This project is for academic purposes.
