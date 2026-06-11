# Style — Caveman Full

Default communication mode: **caveman full**. Drop articles (a/an/the), filler, pleasantries, hedging. Fragments OK. Short synonyms. Pattern: `[thing] [action] [reason]. [next step].` Technical terms exact. Code blocks unchanged. Pre-send gate: scan for articles, filler, hedging, tool-tone leakage. Rewrite before sending.

User says "stop caveman" or "normal mode" to disable.

---

# Tag Search History — Known Fixes

## History Write Sources

History writes happen ONLY from `handleSubmit()` in `TagSearch.tsx:59-63`. `addTag()` no longer writes history.

## `disableHistory` Prop

`TagSearch` accepts `disableHistory` boolean prop (default `false`). When `true`, `handleSubmit()` skips `addToSearchHistory()`. Used by `SmashOrPass.tsx` to prevent tag filter changes from polluting global search history.

## History Storage

- Key: `hydrus-search-history` in `localStorage`
- Format: `string[][]` (array of tag arrays, max 20)
- Dedup: `JSON.stringify` comparison before prepend
- Load: `loadJson` at store creation in `settings-store.ts:112`

## Breakage Patterns (Fixed)

1. **Double-write on auto-submit**: `addTag()` called `addToSearchHistory(newTags)` then `onSubmit()` → `handleSubmit()` called it again. Both writes often in same tick. Fix: removed history write from `addTag()`, only `handleSubmit()` writes.

2. **Intermediate partial tag sets saved**: Building query incrementally (e.g. "cat" Enter, "dog" Enter) saved `["cat"]`, `["cat", "dog"]` as separate history entries. Fix: same as #1 — history only written on explicit submit, not per-tag-add.

3. **Smash/Pass leakage**: Every `TagSearch` in Smash/Pass called `handleSubmit()` → `addToSearchHistory()` when pressing Enter (even without `onSubmit` prop). Clogged search history with tag filter changes. Fix: `disableHistory` prop, set `true` on all Smash/Pass TagSearch instances.

## Future-Check

If history breaks again, check:
- `handleSubmit()` is only write path → verify no other code calls `addToSearchHistory`
- `disableHistory` on any new `TagSearch` instance in non-search context
- `localStorage` key `hydrus-search-history` format: must be `string[][]`
- SW cache busting does NOT affect localStorage (separate storage)

---

# Hydrus Network Client API Spec

Source: https://hydrusnetwork.github.io/hydrus/developer_api.html

## General

- API deals with standard UTF-8 JSON.
- POST requests send JSON body with `Content-Type: application/json`.
- GET complex params (lists, objects) must be JSON-encoded then URL-encoded: `urllib.parse.quote(json.dumps(val), safe='')`.
- Errors: 400 (bad param), 401 (no access key), 403 (insufficient permissions), 419 (session expired), 500 (server error).
- Every JSON response includes `version` (API version) and `hydrus_version` (client build number).

## Access

- Header: `Hydrus-Client-API-Access-Key: <64-char-hex>`
- Or as GET param or POST body param.
- Session key via `/session_key`. Use header `Hydrus-Client-API-Session-Key`. Expires after 24h idle or client restart.

## Permissions (Basic)

0 = Import & Edit URLs
1 = Import & Delete Files
2 = Edit File Tags
3 = Search for & Fetch Files
4 = Manage Pages
5 = Manage Cookies & Headers
6 = Manage Database
7 = Edit File Notes
8 = Edit File Relationships
9 = Edit File Ratings
10 = Manage Popups
11 = Edit File Times
12 = Commit Pending
13 = See Local Paths

## Common Complex Parameters

### files
One of: `file_id` (number), `file_ids` (number[]), `hash` (hex SHA256), `hashes` (hex SHA256[]). In GET, lists must be percent-encoded JSON.

### file domain
`file_service_key` (hex, single domain), `file_service_keys` (hex[], union of domains), `deleted_file_service_key` (hex, deleted-from domain), `deleted_file_service_keys` (hex[], union of deleted-from). Default: "combined local file domains".

### legacy service_name params
Still supported: `file_service_name`, `tag_service_name`, `service_names_to_tags`, `service_names_to_actions_to_tags`, `service_names_to_additional_tags`. Migrate to `service_key`.

## Services Object

List returned from `/get_services`. Each entry:
- `name` - mutable human name
- `service_key` - immutable hex id
- `type` - integer enum
- `type_pretty` - display label

### Service type enum
0 = tag repository
1 = file repository
2 = local file domain ("my files")
5 = local tag domain ("my tags")
6 = numerical rating service
7 = like/dislike rating service
10 = all known tags
11 = all known files
12 = local booru (ignore)
13 = IPFS
14 = trash
15 = hydrus local file storage
17 = file notes
18 = Client API
19 = deleted from anywhere (ignore)
20 = local updates
21 = combined local file domains
22 = inc/dec rating service
99 = server administration

### Rating service extras
- `colours`: `{ like, dislike, null, mixed }` each with `{ brush, pen }`
- `show_in_thumbnail`, `show_in_thumbnail_even_when_null`
- `star_shape`: `circle|square|fat star|pentagram star|...|svg`
- Numerical: `min_stars` (0|1), `max_stars` (1-20)

## Current/Deleted/Pending/Petitioned (CDPP)

Content exists in 4 states:
- **Current** - exists on service
- **Deleted** - removed from service
- **Pending** - queued to be added
- **Petitioned** - queued to be removed

States cannot be both Current and Deleted simultaneously, but other combos possible. Local services have no pending/petitioned. Remote (PTR) use full suite.

### Content update actions (for tag/rating edits)
- 0 = Add (local) / Pend (remote)
- 1 = Delete (local) / Petition (remote)
- 2 = Rescind Pend
- 3 = Rescind Petition
- 4 = Petition with reason (tag repos)
- 5 = Rescind petition

## Endpoints Used By This Project

### GET `/api_version`
No auth required. No params. Returns `{ version: int, hydrus_version: int }`.

### GET `/get_service`
Auth: Add Files/Tags/Manage Pages/Search Files. Params: `service_name` OR `service_key`. Returns single service object. 404 if not found. Used to look up service keys by name.

### GET `/get_services`
Auth: Add Files/Tags/Manage Pages/Search Files. No params. Returns `{ services: ServicesObject, services_v2: ServicesObject }`. Used at startup to discover available tag/rating/file services.

### GET `/add_tags/search_tags`
Auth: Search Files + Add Tags. Params (GET): `search` (string, tag text), `tag_service_key` (hex, optional, default "all known tags"), `file_domain` (optional), `tag_display_type` (`storage`|`display`, default `storage`).
Returns `{ tags: [{ value: string, count: number }], autocomplete_text: { search_text, inclusive } }`. Sorted by descending count. Used for tag autocomplete.

### GET `/add_tags/clean_tags`
Auth: Add Tags. Params (GET): `tags` (JSON array of strings, URL-encoded). Returns `{ tags: string[] }`. Cleans whitespace, fixes namespacing, sorts. Used before tag operations.

### POST `/add_tags/add_tags`
Auth: Add Tags. Content-Type: application/json. Body: `{ files, service_keys_to_tags | service_keys_to_actions_to_tags, override_previously_deleted_mappings? (default true), create_new_deleted_mappings? (default true) }`. Actions: 0=add, 1=delete, 2=pend, 3=rescind pend, 4=petition, 5=rescind petition. Petition reason: send `[[tag, reason], ...]`. Returns 200 no content. Idempotent.

### GET `/get_files/search_files`
Auth: Search Files. Params (GET, percent-encoded JSON): `tags` (string[]), `file_service_key` (optional), `file_sort_type` (int, optional, default 2=import time), `file_sort_asc` (bool, optional, default desc), `return_file_ids`, `return_hashes`, `include_current_tags`, `include_pending_tags`, `tag_service_key`.
Returns `{ file_ids: number[], hashes: string[] }`. No implicit 10k limit.

### File sort types
0=file size, 1=duration, 2=import time, 3=filetype, 4=random, 5=width, 6=height, 7=ratio, 8=pixels, 9=tag count, 10=media views, 11=viewtime, 12=bitrate, 13=has audio, 14=modified time, 15=framerate, 16=frames, 18=last viewed, 19=archive timestamp, 20=hash hex, 21=pixel hash, 22=blurhash, 23-27=average colour axes

### System predicates
`system:inbox`, `system:archive`, `system:everything`, `system:has duration`, `system:has audio`, `system:has exif`, `system:has tags`, `system:untagged`, `system:height > 900`, `system:width < 200`, `system:filesize ~= 50 kilobytes`, `system:limit = 100`, `system:filetype = image/jpg, image/png`, `system:hash = <sha256>`, `system:import time > 2011-06-04`, `system:duration < 5 seconds`, `system:num pixels > 50 px`, `system:ratio is wider than 16:9`, `system:rating for service_name is like`, `system:rating for service_name = 13`.
OR predicates: nest arrays, e.g. `["skirt", ["space bounty hunter", "jane raider"]]`.

### GET `/get_files/file_metadata`
Auth: Search Files. Params (percent-encoded JSON): `file_ids` or `hashes`, `create_new_file_ids`, `only_return_identifiers`, `only_return_basic_information`, `include_blurhash`, `include_notes`, `include_services_object`.
Returns `{ metadata: FileMetadata[], services: ServicesObject }`.
Response fields: `file_id`, `hash`, `size` (bytes), `mime`, `width`, `height`, `duration` (ms), `has_audio`, `is_inbox`, `is_local`, `is_trashed`, `is_deleted`, `has_exif`, `known_urls`, `blurhash`, `pixel_hash`, `num_frames`, `num_words`, `file_services: { current: {}, deleted: {} }`, `ratings: { [service_key]: null|bool|int }`, `tags: { [service_key]: { storage_tags: { "0": string[] }, display_tags: { "0": string[] } } }`, `file_viewing_statistics: [{ canvas_type, views, viewtime }]`.
Tag status keys: "0"=current, "1"=pending, "2"=deleted, "3"=petitioned.
Rating types: like/dislike = null/true/false, numerical = null/int, inc/dec = int (default 0).

### GET `/get_files/file`
Auth: Search Files. Params: `file_id` OR `hash`, `download` (bool, default false, attachment vs inline). Returns raw file bytes with correct Content-Type. Supports Range requests.

### GET `/get_files/thumbnail`
Auth: Search Files. Params: `file_id` OR `hash`. Returns thumbnail image bytes. Supports Range requests.

### POST `/edit_ratings/set_rating`
Auth: Edit Ratings. Content-Type: application/json. Body: `{ files, rating_service_key, rating }`.
- Like/Dislike: `true`=like, `false`=dislike, `null`=unset
- Numerical: int for star count, `null`=unset
- Inc/Dec: int (0 minimum)
Returns 200 no content.

### POST `/add_files/archive_files`
Auth: Import Files. Content-Type: application/json. Body: `{ files }`. Moves files from inbox to archive. Idempotent. Returns 200 no content.

### POST `/add_files/unarchive_files`
Auth: Import Files. Content-Type: application/json. Body: `{ files }`. Moves files from archive to inbox. Returns 200 no content.
