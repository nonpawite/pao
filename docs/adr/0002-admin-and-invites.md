# Sign-up by invite, from one admin

A household's instance has one admin: its oldest account, normally the self-hoster who signed up first. When sign-up is closed (`ALLOW_SIGNUP: "false"`, now the default), nobody can create an account on their own; the admin makes a one-time invite (a code, and a link that carries it) for each new member. The first sign-up on an empty instance always works, so a fresh install can make its admin.

This reverses v1's rule of "no invite links or admin roles". Under v1, adding a member to a closed instance meant editing `docker-compose.yml`, restarting, waiting for the sign-up, then closing it again, all on the server; and an open instance let anyone who could reach it make an account.

## Considered Options

- **Keep the env switch only** (v1): no roles to explain, but every new member needs server access and two restarts, and closing sign-up is easy to forget.
- **Any member can invite**: no admin needed, but anyone in the household could add people.
- **The admin creates accounts with a temporary password**: the admin would see and hand over a password.
- **Invites bound to an email address**: safer if a code leaks, but a typo blocks the person, and Pao sends no email to check it.

## Consequences

- The admin is worked out from account age rather than stored as a role, so there is nothing to migrate and an upgraded instance's self-hoster becomes admin without action. Handing the role over, or a second admin, would need a stored role.
- Invites work for 7 days and once only. The admin sees members and pending invites in Settings and can revoke an invite; there is no removing accounts.
