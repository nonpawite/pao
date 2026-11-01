# Passkeys as a complete sign-in, and recovery from the server

Each member can turn on 2FA, add passkeys, both or neither. A passkey is a complete sign-in: it skips the password and the 6-digit code, so it only counts when the device verified the person (fingerprint, face or device PIN). Pao refuses a passkey sign-in where the device did not. A member locked out of their account asks the self-hoster, who runs one command on the server: it clears the member's 2FA, deletes their passkeys, signs them out everywhere and prints a temporary password.

Pao sends no email, so there is no reset link to fall back on, and until now a forgotten password had no way back at all.

## Considered Options

- **A passkey as the second step after the password**: feels stricter, but Better Auth has no support for it, so it would mean custom sign-in code, the riskiest code to own. A verified passkey already proves two things: the member holds the device and can unlock it.
- **A passkey replacing the password**: plain-HTTP households can't use passkeys, and losing the device would leave no way in.
- **An admin button that clears a member's 2FA**: friendlier, but a hijacked admin session could strip a member's protection, and an admin locked out of their own account would still need a server command.
- **Backup codes as the only recovery**: least code, but losing them would lock a member out for good, along with their spending history.
- **A command that leaves the password alone**: nobody sees a password, but a member who also forgot theirs stays locked out, and passkeys make forgetting more likely.

## Consequences

- Adding a passkey asks for the current password, like turning 2FA on or off, because a passkey skips both. A stolen session alone can't add one. Someone who also has the password can, and a password change or turning on 2FA doesn't remove passkeys, so a member who suspects an intruder also checks their list in Settings.
- The password route stays as strong as the member chose: someone with a passkey but no 2FA can still sign in with only a password.
- A security key with no PIN is refused. Better Auth's passkey package accepts such keys by default, so Pao checks the result itself before the session is created.
- The self-hoster sees a temporary password once. ADR 0002 rejected the admin handing over passwords for new accounts, but this is a rare recovery by someone who already controls the server, so it gives nobody new power. The member changes it in Settings.
- Passkeys belong to the address they were made on. They need HTTPS or `localhost`, and moving the instance to a new domain breaks them, so members sign in with their password and add new ones.
- Losing the app-data volume loses the auth secret, which makes 2FA unreadable. The recovery command gets those members back in.
