# LifeLink 🏥🔗

> **Bridging the gap between available medical resources and the patients who can't find them.**

[![Live Demo](https://img.shields.io/badge/Live-Demo-brightgreen)](https://lifelink-a61c1.web.app/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Gemini API](https://img.shields.io/badge/AI-Gemini_API-8E75B2)](https://deepmind.google/technologies/gemini/)

* **Live MVP:** [https://lifelink-a61c1.web.app/](https://lifelink-a61c1.web.app/)

## 📖 Overview

**LifeLink** is a web-based, hyperlocal healthcare platform designed to centralize access to essential medical resources and community healthcare initiatives. In emergencies, fragmented information can lead to critical delays. LifeLink solves this by connecting patients, donors, hospitals, pharmacies, and healthcare organizers through a single, unified interface.

Developed by Team **INNODYSSEY**.

## 💡 Problem Statement

Healthcare accessibility often faces major challenges due to:
* **Fragmented Information:** Unreliable data regarding hospitals, pharmacies, and free medical camps.
* **Lack of Coordination:** Poor communication between donors, patients, and healthcare organizers during emergencies.
* **Inefficiency:** People struggle to locate timely and accurate healthcare resources, leading to underutilization of available services.

## 🚀 The Solution

LifeLink offers a **Unified Healthcare Platform** that enables:
* **Real-time Discovery:** Find nearby hospitals, medical shops, and free medical camps instantly.
* **Donation Coordination:** Verified facilitation of blood, plasma, and bone marrow donations.
* **Community Participation:** A two-way model where users can not only consume information but also organize and publish healthcare initiatives.

## ✨ Key Features

### 🩸 Medical Donation Coordination
* Facilitates blood, plasma, and bone marrow donations.
* Connects donors with verified requests efficiently.

### 🏥 Hyperlocal Resource Locator
* **Hospitals:** Locate hospitals with detailed facility information and contact details.
* **Pharmacies:** Find medical shops with real-time location access.
* **Navigation:** Integrated with **OpenStreetMap** for precise geolocation.

### ⛺ Event Discovery & Management
* Discover nearby free medical camps and health drives.
* Organizers can publish events and manage registrations seamlessly.

### 📊 Shop Owner Analytics
* Medical shop owners get a dedicated dashboard.
* View performance metrics (views, direction clicks) to track customer engagement.

### 🤖 AI-Powered Search
* Integrated **Gemini API** for intelligent, personalized filtering (e.g., finding hospitals specifically for "Heart surgery").

## 🛠️ Tech Stack

**Client Layer:**
* HTML5, CSS3, JavaScript

**Backend & Hosting (Serverless):**
* **Firebase Authentication:** Secure login and user role management.
* **Firebase Cloud Firestore:** NoSQL database for user profiles, events, and medical records.
* **Firebase Hosting:** Scalable and secure web application deployment.

**External APIs & Services:**
* **Google Gemini API:** AI-powered search and filtering.
* **OpenStreetMap API:** Geolocation and mapping services.

## 🏗️ System Architecture

1.  **User Layer:** Users interact via the Web Application.
2.  **Auth Layer:** Firebase Auth handles Identity Access Management (IAM).
3.  **Logic Layer:** Application logic handles events, donation matching, and AI filtering.
4.  **Data Layer:** Firestore stores all persistent data (Users, Events, Resources).

## 🔮 Future Enhancements

* 🚑 **Real-time Ambulance Tracking:** Live tracking of emergency services.
* 🛏️ **Bed Availability:** Integration with hospitals for live bed status.
* 💊 **Pharmacy Inventory API:** Live stock status for essential medicines.
* 📱 **Mobile Application:** Dedicated Android/iOS app.
* 🗺️ **Admin "God-View":** Geospatial heatmaps to pinpoint service gaps and analyze user engagement.

---
*Created for the Innodyssey Project.*
