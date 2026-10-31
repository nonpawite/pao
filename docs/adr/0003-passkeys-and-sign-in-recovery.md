# Passkeys as a complete sign-in, and recovery from the server

Each member can turn on two-step sign-in, add passkeys, both or neither. A passkey is a complete sign-in: it skips the password and the 6-digit code, so it only counts when the device verified the person (fingerprint, face or device PIN). Pao refuses a passkey sign-in where the device did not. A member locked out of their account asks the self-hoster, who runs one command on the server: it clears the member's two-step sign-in, deletes their passkeys, signs them out everywhere and prints a temporary password.

Pao sends no email, so there is no reset link to fall back on, and until now a forgotten password had no way back at all.

## Considered Options

- **A passkey as the second step after the password**: feels stricter, but Better Auth has no support for it, so it would mean custom sign-in code, the riskiest code to own. A verified passkey already proves two things: the member holds the device and can unlock it.
- **A passkey replacing the password**: plain-HTTP households can't use passkeys, and losing the device would leave no way in.
- **An admin button that clears a member's two-step sign-in**: friendlier, but a hijacked admin session could strip a member's protection, and an admin locked out of their own account would still need a server command.
- **Backup codes as the only recovery**: least code, but losing them would lock a member out for good, along with their spending history.
- **A command that leaves the password alone**: nobody sees a password, but a member who also forgot theirs stays locked out, and passkeys make forgetting more likely.

## Consequences

- The password route stays as strong as the member chose: someone with a passkey but no two-step sign-in can still sign in with only a password.
- A security key with no PIN is refused. Better Auth's passkey package accepts such keys by default, so Pao checks the result itself before the session is created.
- The self-hoster sees a temporary password once. ADR 0002 rejected the admin handing over passwords for new accounts, but this is a rare recovery by someone who already controls the server, so it gives nobody new power. The member changes it in Settings.
- Passkeys belong to the address they were made on. They need HTTPS or `localhost`, and moving the instance to a new domain breaks them, so members sign in with their password and add new ones.
- Losing the app-data volume loses the auth secret, which makes two-step sign-in unreadable. The recovery command gets those members back in.
