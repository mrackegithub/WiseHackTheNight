# How does `Me.onboardingComplete` become true?
Status: OPEN
From: A   To: B
Blocking: no (the frontend uses the rule below in its MSW mocks meanwhile)

## Need
`Me.onboardingComplete` is required in the contract, but nothing in `UpdateMeRequest` (or any other request) sets it.
The frontend sends users with `onboardingComplete: false` to the onboarding wizard (`/onboarding`) and lets them into
the app once `GET /me` returns `true`. So the backend has to derive it, and both sides must agree on the rule.

## Proposed solution / interface
No contract change. The backend recomputes `onboardingComplete` whenever one of these endpoints succeeds:
`PUT /me/subjects`, `PUT /me/preferences`, `PUT /me/location`, `PATCH /me`.

```
onboardingComplete = hasAtLeastOneSubject
                  && preferencesSaved            // a Preferences row exists (PUT /me/preferences was called)
                  && (homeLocationSet || preferences.mode === 'ONLINE')
```

Once true it stays true (removing all subjects later shouldn't throw a user back into the wizard).

The wizard order is: PATCH /me (profile) → PUT /me/subjects → PATCH /me (`interestIds`) → PUT /me/preferences → PUT /me/location.
After the last step the frontend refetches `GET /me`.

## Acceptance
- A freshly registered user gets `onboardingComplete: false` from `GET /me`.
- After the five calls above, `GET /me` returns `true`; an ONLINE-only user doesn't need `PUT /me/location`.
- Seed users (`isSeed`) and `demo@sgm.local` are created with `true`.
