# ⚓ Visakhapatnam Port Authority — Administrative Resolution Portal

[![System Status](https://img.shields.io/badge/System_Status-Active-059669?style=flat-square)](#)
[![Deployment Framework](https://img.shields.io/badge/Framework-React_18-2563EB?style=flat-square)](#)
[![Database Infrastructure](https://img.shields.io/badge/Database-Firebase_Firestore-D97706?style=flat-square)](#)
[![Notification Service](https://img.shields.io/badge/Notifications-EmailJS-6366F1?style=flat-square)](#)

A secure, enterprise-grade data amendment and digital ticketing workspace custom-engineered for the **IT & Administrative Division of the Visakhapatnam Port Authority (VPA)**. This portal automates internal employee data corrections, tracks technical modifications, and dispatches real-time, status-aware electronic transmissions across cascading clearance phases.

---

## 🎨 System Visual States & Framing

The administrative dashboard and automated messaging nodes leverage an adaptive, per-status perimeter color hierarchy. This ensures instant technical context classification across internal teams and employee notifications:

| Operational Phase | Status Label (EN) | Status Label (HI) | Hex Code Theme | Color Identity |
| :--- | :--- | :--- | :--- | :--- |
| **🟢 Resolved** | `Resolved` | अनुरोध का समाधान किया गया | `#059669` | Emerald Green |
| **🔵 Processing** | `In Progress` | अनुरोध प्रगति पर है | `#2563EB` | Royal Blue |
| **🔴 Rejected** | `Rejected` | अनुरोध अस्वीकार कर दिया गया | `#DC2626` | Crimson Red |
| **🟡 Pending** | `Pending` | अनुरोध लंबित है | `#D97706` | Amber Orange |

---

## 🚀 Key Functional Modules

### ⚡ Secure Status Management Engine
Administrators evaluate filed amendments and adjust clearance thresholds using a real-time tracking panel. Updating a ticket automatically triggers:
* Cryptographically logged document edits within Cloud Firestore.
* Multi-lingual header translation mappings (`status_hindi`).
* Comprehensive text generation parsing custom administrative executive notes (`resolve_notes`).

### ✉️ Dynamic Notification Pipeline
Integrates a hardened transactional mail framework powered by EmailJS. The pipeline dynamically injects structural parameters directly into transactional HTML layout wrappers:
* **Themed Borders:** Alters outer wrapper frame strokes matching the current structural phase.
* **Metadata Aggregation:** Safely transmits system keys including `{{ticket_no}}`, `{{category}}`, and personnel metadata hooks.
* **Compliance Sandboxing:** Wraps user text structures within standard safety tags to prevent character stripping across strict desktop email clients (e.g., Microsoft Outlook).

---

## 🛠️ Technology Stack Architecture

* **Frontend Matrix:** React.js (Hooks, Async State Managers, Context Architecture)
* **Cloud Infrastructure:** Firebase Web SDK v10+ (Firestore Distributed Storage, Auth Layers)
* **Communications Router:** EmailJS Engine (Custom Transactional Templates)
* **Styling Framework:** Tailwind CSS & Strict Inline CSS-3 Typography Tables (Email Compatible)

---

## ⚙️ Local Development Installation

### 1. Clone the Directory
```bash
git clone [https://github.com/vpa-it-division/administrative-portal.git](https://github.com/vpa-it-division/administrative-portal.git)
cd administrative-portal

