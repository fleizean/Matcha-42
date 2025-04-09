# Matcha

A modern dating web application inspired by Tinder, built as part of 42 School's curriculum.

## Tech Stack

- Frontend: Next.js
- Backend: FastApi
- Database: PostgreSQL
- Real-time: Websocket
- Authentication: JWT

## Prerequisites

- Node.js (v14 or higher)
- Python (v3.8 or higher)
- pip (Python package manager)
- npm (Node package manager)

### Development

- Backend runs on: http://localhost:8000
- Frontend runs on: http://localhost:3000
- API documentation: http://localhost:8000/docs

## ✅ Project Checklist - Matcha Dating Website

### 📌 General Requirements

<div class="checklist-container">

- [x] No errors, warnings, or notices (server-side & client-side) 🤔
- [x] Use any programming language and micro-framework of choice 🤔
- [x] Use a relational or graph-oriented database (MySQL, PostgreSQL, Neo4j, etc.)
- [x] Ensure database contains at least 500 distinct profiles
- [x] Use a secure and well-structured UI (React, Vue, Bootstrap, etc.)
- [x] Ensure website is mobile-friendly
- [x] Implement proper form validation
- [x] Prevent security vulnerabilities (SQL injection, XSS, plain-text passwords)
- [x] Store credentials, API keys, and environment variables in .env file (excluded from Git)

</div>

### 📝 Mandatory Features

<details>
<summary><b>🛂 Registration and Signing-in</b></summary>
<div class="checklist-container">

- [x] Allow users to register with:
  - [x] Email
  - [x] Username
  - [x] Last Name
  - [x] First Name
  - [x] Secure password (no common words)
- [x] Send email verification upon registration
- [x] Allow users to log in with username & password
- [x] Implement password reset via email
- [x] Ensure users can log out from any page easily

</div>
</details>

<details>
<summary><b>🏠 User Profile</b></summary>
<div class="checklist-container">

- [x] Require users to complete profile with: 🤔
  - [x] Gender
  - [x] Sexual Preferences
  - [x] Biography
  - [x] Interest tags (e.g., #geek, #vegan)
  - [x] Upload up to 5 pictures (one as profile picture)
- [x] Allow users to update their profile information anytime
- [x] Show who viewed their profile
- [x] Show who liked their profile
- [x] Implement public "fame rating" for each user
- [x] Determine user location via GPS (with manual override option)
- [x] If GPS tracking is disabled, use an alternative location method 🤔

</div>
</details>

<details>
<summary><b>🔍 Browsing</b></summary>
<div class="checklist-container">

- [x] Display suggested profiles based on:
  - [x] Sexual orientation
  - [x] Geographical proximity
  - [x] Shared interest tags
  - [x] "Fame rating"
- [x] Allow sorting of profiles by:
  - [x] Age
  - [x] Location
  - [x] "Fame rating"
  - [x] Common tags
- [x] Allow filtering by:
  - [x] Age
  - [x] Location
  - [x] "Fame rating"
  - [x] Common tags

</div>
</details>

<details>
<summary><b>🔬 Research (Advanced Search)</b></summary>
<div class="checklist-container">

- [x] Allow users to search with criteria: 🤔
  - [x] Age range 🤔
  - [x] "Fame rating" range 🤔
  - [x] Location 🤔
  - [x] Interest tags 🤔
- [x] Allow sorting and filtering in search results 🤔

</div>
</details>

<details>
<summary><b>👀 Profile View</b></summary>
<div class="checklist-container">

- [x] Display all public profile information (except email/password)
- [x] Track profile visit history
- [x] Allow users to:
  - [x] "Like" a profile (mutual likes enable chat)
  - [x] Remove a "like" (disables chat & notifications)
  - [x] Check another user's fame rating
  - [x] See online status & last active time
  - [x] Report fake accounts
  - [x] Block users (removes from search & disables chat)

</div>
</details>

<details>
<summary><b>💬 Chat</b></summary>
<div class="checklist-container">

- [x] Enable real-time chat (only for mutually "liked" users)
- [x] Display new messages notification on any page
- [x] Ensure chat messages update within 10 seconds

</div>
</details>

<details>
<summary><b>🔔 Notifications</b></summary>
<div class="checklist-container">

- [x] Notify users when:
  - [x] They receive a new like 🤔
  - [x] Their profile is viewed
  - [x] They receive a new message
  - [X] A "liked" user likes them back
  - [X] A connected user "unlikes" them 🤔
- [x] Display unread notifications on all pages
- [x] Ensure notifications update within 10 seconds

</div>
</details>