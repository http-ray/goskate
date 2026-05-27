# GoSkate Authentication System (V1)

## Purpose

This document explains how authentication was added to GoSkate using Supabase Auth, how sessions are managed in the current app, and how this foundation supports future profile and social features.

This is a V1 implementation focused on:

- account creation
- login
- logout
- persistent sessions across refreshes
- simple profile metadata (username + avatar URL)

It intentionally does not include full social systems yet.

---

## 1. Auth Feature Overview

GoSkate now has a basic but production-style authentication foundation:

- Supabase Auth handles user identity
- The app tracks auth session state globally through a provider
- The profile screen doubles as the auth hub:
  - signed out users see Sign up / Log in
  - signed in users see editable profile metadata + Log out
- Session state persists across refreshes
- Existing map UI and responsive controls remain unchanged

---

## 2. Why Supabase Auth Was Chosen

Supabase Auth was chosen because it fits the current GoSkate architecture:

- Already using Supabase for spot data
- Easy frontend integration with the same Supabase client
- Built-in session management and token refresh
- Good path to future Row Level Security policies
- Supports gradual growth:
  - metadata now
  - dedicated profiles/social tables later

In short, it gives a fast V1 path without building custom auth infrastructure.

---

## 3. Current Auth Architecture

### Main auth pieces

- Supabase browser client:
  - created once and reused
  - session persistence enabled

- Auth Provider:
  - fetches current session on app load
  - listens to auth state changes (login, logout, refresh token, etc.)
  - exposes user/session/loading via React context

- App Providers wrapper:
  - injects auth provider at root layout level

- Profile page:
  - signed out mode: sign up and log in forms
  - signed in mode: profile view, metadata editing, logout

### Important file roles

- lib/supabase.ts
  - Supabase client configuration
  - auth persistence enabled

- components/auth/AuthProvider.tsx
  - central auth session state

- app/providers.tsx
  - provider composition layer

- app/layout.tsx
  - mounts providers globally

- app/profile/page.tsx
  - auth UI and profile metadata editing

- components/ui/BottomLeftWidget.tsx
  - profile button routes user to /profile, which now drives auth flow

- app/profile/settings/page.tsx
  - log out action is wired to real Supabase sign out

---

## 4. Sign Up, Log In, Log Out Flow

### Sign up

When a user signs up:

1. User enters email, password, optional username, optional avatar URL
2. App calls Supabase sign up
3. Metadata is stored in auth user metadata:
   - username
   - avatar_url
4. UI shows confirmation message
5. If email confirmation is enabled in Supabase, user must verify email before login

### Log in

When a user logs in:

1. User enters email and password
2. App calls Supabase password sign in
3. Supabase returns session + user
4. Auth provider receives session update and app becomes signed in
5. Profile screen switches to signed-in profile state

### Log out

When a user logs out:

1. App calls Supabase sign out
2. Session is cleared
3. Auth provider updates state to signed out
4. UI returns to signed-out auth view

---

## 5. Email Confirmation Behavior

Email confirmation behavior is controlled in Supabase dashboard settings.

- If enabled:
  - sign up succeeds
  - user must click confirmation email link before login works
- If disabled:
  - user can login immediately after sign up

Current UI already handles both by showing a post-signup guidance message.

---

## 6. Session Persistence After Refresh

Session persistence works because of two layers:

- Supabase client auth options:
  - persistSession true
  - autoRefreshToken true
  - detectSessionInUrl true

- Auth provider bootstrap:
  - on first load, app asks Supabase for current session
  - provider stores session/user in React state
  - provider subscribes to auth changes and keeps UI synced

What happens on refresh:

1. Browser reloads app
2. Auth provider runs
3. getSession restores existing session if valid
4. UI returns to signed-in state without user re-login

---

## 7. How the Profile Button Connects to Auth

The existing profile button still navigates to /profile.

Difference now:

- Before: mostly mock profile content
- Now: real auth gate and profile hub

Behavior:

- signed out user taps profile button -> sees login/signup
- signed in user taps profile button -> sees account profile and logout

This keeps map controls unchanged while making profile navigation meaningful.

---

## 8. Supabase Dashboard Settings Required

To make this work in a project, configure:

1. Authentication provider
- Enable Email provider in Auth settings

2. URL configuration
- Set Site URL
- Set Redirect URLs for local and production environments

3. Email confirmation policy
- Decide whether Confirm email is required for V1

Optional next settings:

- custom email templates
- SMTP provider for branded email deliverability
- rate limits and bot protection for abuse prevention

---

## 9. Environment Variables Used

Current frontend requires:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

These must match the same Supabase project where auth is configured.

---

## 10. Beginner-Friendly Concepts

### Authentication vs Session

- Authentication:
  - proving who the user is (login/signup)
- Session:
  - proof that user is currently signed in, reused between pages/refreshes

### Why context provider is used

Without a provider, each page would separately ask Supabase for user state.

With provider:

- auth state is fetched once
- all components share same source of truth
- UI updates automatically on login/logout

### Why metadata is used in V1

Using auth metadata for username/avatar:

- avoids early schema complexity
- good for fast iteration
- enough for early profile display

---

## 11. Current Limitations

This is intentionally lightweight and has known limits:

- No dedicated profiles table yet
- Avatar is URL-only (no storage upload flow)
- No password reset UI yet
- No protected social actions yet
- No friends/messages/notifications yet
- No full RLS auth-to-content ownership model yet
- Existing profile subpages still include placeholder/mock behavior in areas

---

## 12. Future Improvements

Planned likely upgrades:

### Data model upgrades

- Add public profiles table linked to auth user id
- Move profile fields from auth metadata to profiles table
- Add avatar upload via Supabase Storage

### Social and content systems

- Friends/follows table
- Clips table linked to users and spots
- Check-in ownership per authenticated user
- Notifications and activity feed

### Security and authorization

- Add Row Level Security policies for user-owned rows
- Add role-aware policies for moderation actions
- Restrict write paths to authenticated users only

### UX improvements

- Password reset flow
- Better auth error messages
- Loading skeletons and reduced auth flicker
- Optional OAuth providers (Google, Apple, etc.)

---

## 13. What Happens in Production Later

Likely production changes compared to V1:

- Dedicated profile data tables instead of auth metadata
- Strong RLS policies for every user-generated table
- Better account recovery and email infrastructure
- abuse protection (captcha/rate limiting)
- auditability and admin tooling
- more robust route protection and server-side auth checks where needed

V1 is intentionally client-forward for speed; production shifts more critical checks into stricter data policy and backend patterns.

---

## 14. Interview-Relevant Skills Demonstrated

This phase demonstrates practical engineering skills:

- integrating third-party auth into existing app shell
- managing global session state with React context
- handling async auth lifecycle events
- building auth UX that works on mobile and desktop
- preserving existing product UI while adding auth capability
- storing and updating user metadata
- planning incremental architecture from V1 to production
- understanding relationship between auth and future RLS-based authorization

Good interview talking point:
You implemented auth as a minimal, extensible layer that enables real user identity now without overbuilding social features before core map-product validation.

---

## 15. Why This Auth Architecture Was Chosen

This architecture balances speed and future readiness:

- Fast to ship:
  - no custom backend auth service
  - no immediate extra table complexity
- Easy to understand:
  - one shared client
  - one provider
  - one auth hub page
- Scalable path:
  - can evolve toward profiles table + social graph + strict RLS later

It is intentionally pragmatic for the current GoSkate phase.
