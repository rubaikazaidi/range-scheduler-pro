
# Rifle Range Scheduling App — Plan

A multi-branch rifle shooting range app where coaches manage daily shooting slots and students see their assigned timings and request changes.

## Roles & Access

- **Coach** (admin): global access — can switch between any branch in the app, manage students, build daily schedules, approve requests.
- **Student**: belongs to one branch, sees their own daily timetable, can request a timing change.
- **Self-signup with approval**: students sign up, pick a branch, and stay in a "pending" state until a coach approves them.

## Core Features

1. **Authentication** — email/password signup & login (Lovable Cloud).
2. **Branch switcher** (coach only) — dropdown in the top bar to view/manage any branch.
3. **Daily timetable**
   - Coach view: calendar/day view, create time slots (start/end, capacity, notes), assign approved students to slots.
   - Student view: today + upcoming days showing their assigned slots only.
4. **Student management** (coach) — list students per branch, approve/reject pending signups, remove students.
5. **Reschedule requests**
   - Student picks an existing slot they'd prefer and submits a request (with optional note).
   - Coach sees a request inbox, approves (auto-moves student) or rejects (with optional reason).
   - Student sees status update in-app.

## Pages / Routes

```
/                              Landing (intro + login/signup CTAs)
/login                         Login
/signup                        Student self-signup (with branch selector)
/_authenticated/
  dashboard                    Role-based: redirects to coach or student home
  schedule                     Student: my upcoming slots + request change button
  requests                     Student: my submitted requests + status
  coach/
    schedule                   Day view, create slots, assign students
    students                   Manage students (approve, list, remove)
    requests                   Inbox of reschedule requests to approve/reject
    branches                   List branches, create/edit branches
```

## Data Model (Lovable Cloud)

- `branches` — id, name, location, created_at
- `profiles` — id (= auth.users.id), full_name, primary_branch_id, status (pending/approved/rejected)
- `user_roles` — user_id, role (`coach` | `student`) — separate table for security
- `slots` — id, branch_id, date, start_time, end_time, capacity, notes, created_by
- `slot_assignments` — id, slot_id, student_id, created_at (unique pair)
- `reschedule_requests` — id, student_id, current_assignment_id, requested_slot_id, note, status (pending/approved/rejected), reviewed_by, reviewed_at

RLS:
- Students can read only their own profile, assignments, requests; can read slots for their branch.
- Coaches (checked via `has_role()` security-definer function) can read/write everything.
- Approving a request moves the assignment in a single transaction (server function).

## Design

Clean, focused interface with a sport/precision feel — dark navy + white with a single accent color, sans-serif typography, card-based slot layout, day-stepper for the schedule. Mobile-friendly since students will mostly use it on phones.

## Out of Scope (for v1)

Equipment tracking, payments, attendance marking, performance scores, push notifications (in-app status only), per-branch coach permissions (all coaches are global as you specified).

## Technical Notes

- TanStack Start + Lovable Cloud (Supabase under the hood) with email/password auth.
- Roles in dedicated `user_roles` table with `has_role()` security-definer function (avoids RLS recursion and privilege escalation).
- Server functions (`createServerFn` + `requireSupabaseAuth`) for all mutations; RLS enforces row-level access.
- Branch context for coaches stored in URL search params so it survives reloads and is shareable.
