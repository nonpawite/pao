# Password reset by email, when the self-hoster sets up SMTP

A member who forgot their password can ask for a reset link from the sign-in page, if the self-hoster gave Pao an SMTP server (`SMTP_URL`) and a public address (`BETTER_AUTH_URL`). Without both, the sign-in page's "Forgot your password?" says to ask the self-hoster, and the recovery command from ADR 0003 is the only way back. This replaces ADR 0003's "Pao sends no email" for instances that set it up.

## Considered Options

- **Keep no email** (ADR 0003): nothing new to secure, but every forgotten password needs the self-hoster at the server.
- **Email on by default through a hosted service**: works out of the box, but would send members' addresses to a third party the self-hoster never chose.
- **One provider's HTTP API** (Resend, Postmark): no new dependency, but ties every self-hoster to that provider. SMTP works with all of them, and with Gmail or a home mail server.
- **A 6-digit code by email instead of a link**: no link to forward, but a short code needs its own tries limit, and Better Auth's link flow already has one.

## Consequences

- Whoever can read a member's inbox can set a new password. For a member without 2FA, the inbox becomes the weakest way in. A reset leaves 2FA and passkeys in place, so a member with 2FA still needs their code.
- A reset signs the member out everywhere, including whoever was using the old password.
- Email needs `BETTER_AUTH_URL`: without a fixed address Better Auth builds the link from the request's Host header, so anyone could ask for a reset that links to their own site.
- The page answers the same whether or not an account uses the email, and the email is sent without waiting, so the response time doesn't tell either.
- Better Auth allows 3 requests a minute per address; a link works once, for 1 hour.
- A failed send shows only in the server log, never to the person asking, for the same reason.
