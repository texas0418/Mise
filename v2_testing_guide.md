# Mise v2 — Performance & Testing Guide

## Performance Optimizations (Task 5.6)

### Batch Sync Operations
The sync engine already batches upserts in groups of 100 records (`syncEngine.ts → initialUpload`). For ongoing sync, the queue processes items one at a time to preserve order — but could be batched by table for better throughput if needed.

### Pagination
`pullTableChanges()` limits to 1000 records per table per sync cycle. For tables with more data, add cursor-based pagination:
```typescript
// In pullTableChanges, after the first fetch:
while (rows.length === 1000) {
  // Fetch next page using last row's updated_at as cursor
  const nextQuery = query.gt('updated_at', rows[rows.length - 1].updated_at).limit(1000);
  const { data: nextRows } = await nextQuery;
  if (!nextRows || nextRows.length === 0) break;
  rows.push(...nextRows);
}
```

### Database Indexes
The migration already creates indexes on:
- `user_id` (every table)
- `project_id` (every project-scoped table)
- `updated_at` (every table — critical for incremental sync)
- `deleted_at` (every table — for soft delete filtering)

Additional indexes to consider:
```sql
CREATE INDEX idx_shots_scene ON shots(project_id, scene_number);
CREATE INDEX idx_schedule_day ON schedule_days(project_id, day_number);
CREATE INDEX idx_devices_user_uuid ON devices(user_id, device_uuid);
```

### React Query Caching
All entity stores use React Query with `useQuery`. The default cache time is 5 minutes. For sync-heavy usage, consider:
- Setting `staleTime: 30000` (30s) to reduce refetches
- Using `queryClient.setQueryData()` for optimistic updates from realtime events
- The realtime subscription handler already calls `invalidateQueries` on incoming changes

### Lazy-Load Project Data
Currently all tables load on app start. To lazy-load:
1. Only sync the `projects` table on login
2. Sync other tables when `activeProjectId` changes
3. Add `projectId` filter to `pullTableChanges` for project-scoped tables

---

## Testing Checklist (Task 5.7)

### Multi-Device Sync
- [ ] Create a shot on Device A → appears on Device B within 5s
- [ ] Edit a shot title on Device A → change syncs to Device B
- [ ] Delete a shot on Device A → removed from Device B
- [ ] Create a project on Device A → appears on Device B
- [ ] Add crew members on Device B → appear on Device A

### Offline / Reconnect
- [ ] Put Device A in airplane mode → app works normally (AsyncStorage)
- [ ] Make edits offline → pending count shows in sync indicator
- [ ] Turn airplane mode off → changes push automatically
- [ ] Make edits on Device A (offline) AND Device B (online) → both merge on reconnect
- [ ] Leave device offline for 24+ hours → reconnect → verify sync completes

### Conflict Resolution
- [ ] Edit same shot on both devices while one is offline → reconnect → last-write-wins applies
- [ ] Verify the newer `updatedAt` timestamp always wins
- [ ] Delete on Device A + edit on Device B → delete takes precedence (soft delete synced)

### Authentication
- [ ] Sign up with email → verify email → sign in
- [ ] Magic link sign-in → check email → taps link → signed in
- [ ] Apple Sign In (iOS) → account created → signed in
- [ ] Sign out → local data persists → sync stops
- [ ] Password reset → receives email → resets → can sign in

### Device Licensing
- [ ] New user → signs up → no device licensed → paywall shown for Pro features
- [ ] Purchase Pro → device is licensed → Pro features unlocked
- [ ] Check second device → shows as unlicensed → requires additional device purchase
- [ ] Deactivate device from settings → loses Pro access
- [ ] Existing RevenueCat subscriber → upgrade to v2 → auto-licensed (grandfathered)
- [ ] Verify pricing: $4.99 for 1st device, $2.99 for each additional

### Role-Based Access
- [ ] Owner creates project → has full access to all tools
- [ ] Owner invites user as "Crew" → crew member sees limited tools
- [ ] Owner invites user as "DP" → DP sees shots, references, color tools
- [ ] Owner changes member role from "Crew" to "Editor" → UI updates on member's device
- [ ] Owner removes member → member loses project access
- [ ] Viewer role → can see everything but edit nothing (no add/edit/delete buttons)

### Data Migration (v1 → v2)
- [ ] Existing v1 user opens v2 → sees migration flow
- [ ] User skips migration → app works as before (local only)
- [ ] User signs in during migration → local data uploads
- [ ] Fresh install user → sample data is NOT uploaded to server
- [ ] User with real data + sample data → only real data uploads

### Edge Cases
- [ ] Sign in on Device A → sign out → sign in with different account → data is separate
- [ ] Very large project (500+ shots) → sync completes in reasonable time (<30s)
- [ ] Rapid successive edits → queue consolidates (update+update = single update)
- [ ] App force-quit during sync → queue persisted → resumes on next launch
- [ ] Network timeout during push → item retries with exponential backoff
- [ ] 3 failed retries → item pruned from queue → logged for debug
