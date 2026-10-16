# Contract: add a way to read the saved weekly availability windows
Status: OPEN
From: A   To: human
Blocking: no (frontend uses a stopgap, see below)
Affected zones: int (implements, owner of `/me/availability`), fe (consumes)

## Need
`PUT /me/availability` (`replaceMyAvailabilityWindows`) saves the user's recurring weekly windows (`WeeklyWindow[]`),
but there is no operation that **returns** them: `GET /me/availability` returns computed free *slots* (`TimeSlot[]`)
for a date range, which is a different thing.

So the "Your study hours" editor on `/calendar` cannot show what the user saved last time. After a reload or on
another device it can only show the default (Mon–Fri 08:00–20:00), and saving from there would silently overwrite
the user's real windows.

## Proposed solution / interface
Additive change, no rename. New GET on a sub-path of the same resource:

```yaml
  /me/availability/windows:
    get:
      tags: [calendar]
      operationId: getMyAvailabilityWindows
      x-owner: integrations
      description: The user's recurring weekly windows (as last saved with PUT /me/availability). Defaults to Mon–Fri 08:00–20:00.
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: array
                items: { $ref: "#/components/schemas/WeeklyWindow" }
```

(Alternatively move both GET and PUT of windows to `/me/availability/windows`, but that renames an operation, which
needs all three humans per AGENTS.md §5. The additive version above is enough.)

## Stopgap in the frontend until this lands
The editor initialises from, in order: the windows returned by the last successful PUT in this browser
(kept in `localStorage` per user, key `sgm.windows.<userId>`), else the documented default.
Once `getMyAvailabilityWindows` exists, the frontend replaces that with a normal query (one small PR).

## Acceptance
- `pnpm contract:gen` produces `paths['/me/availability/windows']['get']`.
- After `PUT /me/availability` with `[{ weekday: 6, startTime: "10:00", endTime: "14:00" }]`, the new GET returns exactly that.
- A user who never saved windows gets the Mon–Fri 08:00–20:00 default.
