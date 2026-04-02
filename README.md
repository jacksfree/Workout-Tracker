# TrackForge Prototype

This folder contains the first working prototype for the workout tracker you described.

What is already here:

- A desktop-first program builder for creating and editing multiple workout templates
- Spreadsheet-style strength blocks that track weight, reps, sets, RPE, top set, estimated 1RM, and total volume
- Cardio blocks that track time, distance, and difficulty
- A calendar view that lets you click a date and inspect saved workout data
- A simplified iPhone logging flow that keeps the phone side focused on choosing a workout and recording it smoothly
- Demo multi-user separation so your data and your friend's data stay independent
- Selectable `lb/kg` and `mi/km` units per user
- First-pass progression logic that suggests whether to increase weight, increase reps, or hold steady without relying on a single fixed global jump for every lift

Important note:

- The prototype saves in browser `localStorage` for now so the interaction can be tested immediately.
- The included SQL file shows how we would move the same data model into `Supabase` for real long-term storage across phones and computers.
- The SQL also includes the shape for passwordless-friendly profiles, invite-based shared viewing, and recommendation records that can later be produced by an LLM.

## Files

- `index.html`: main app shell
- `styles.css`: responsive UI styling for desktop and phone-like layouts
- `app.js`: demo data, rendering, builder interactions, phone logging flow, and progression logic
- `supabase-schema.sql`: backend schema for real multi-user storage

## How to open it

Option 1:

- Open `index.html` directly in a browser

Option 2:

- Run a tiny local server from this folder
- Example: `python3 -m http.server 8000`
- Then visit `http://127.0.0.1:8000`

## What we should do next

1. Replace demo sign-in with real auth using Supabase Auth
2. Use passwordless email magic links instead of passwords
3. Move workout templates, sessions, and measurements into the hosted database
4. Add invite-based shared viewing between accounts
5. Add real charts and richer analytics on desktop
6. Add a true phone calendar/history screen and session editing
7. Add LLM-generated recommendation passes with human-readable rationale

## Main assumptions in this first pass

- Desktop is the planning and analysis environment
- iPhone is the execution and logging environment
- Some templates need set-by-set logging while others only need block completion
- Progression recommendations should start as heuristic logic, then be upgraded to structured LLM analysis once enough real session data exists
- Each athlete has their own account and only sees their own data by default
