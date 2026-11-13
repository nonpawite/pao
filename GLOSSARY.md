# Pao

A self-hosted limit tracker: members log spending by hand and see what is left today and this cycle in each category.

## Language

**Household**:
The group of people who share one self-hosted instance. Could be a family, a couple, roommates, or one person.
_Avoid_: Family, team, organisation

**Member**:
A person with an account on a household's instance.
_Avoid_: User (in product copy), customer

**Pocket**:
A budget with its own categories, limits, cycle start day and currency. Personal pockets belong to one member; shared pockets are logged into by several.
_Avoid_: Wallet, budget, account

**Bill**:
A charge in a pocket that comes back every N weeks, months or years, such as rent, a phone plan or a streaming service. Until it is paid, each due date in the cycle sets its amount aside from what is left. A bill can start with a free trial, be paused, and end after a number of charges or on a date. Paying one logs an entry linked to that due date.
_Avoid_: Subscription, recurring payment

**Setup**:
The first-run steps where a new member builds their personal pocket: its currency, cycle start day, categories and limits, plus their bank accounts. A member has no pocket until they finish it.
_Avoid_: Onboarding, landing page, wizard

**Admin**:
The member who runs the household's instance: the first person to sign up. The admin invites new members.
_Avoid_: Owner (a pocket role), superuser, self-hoster (the person with server access, usually the same person)

**Invite**:
A one-time code (and a link that carries it) an admin creates so one person can sign up, including while sign-up is closed. It works for 7 days.
_Avoid_: Invitation, referral

**Passkey**:
A complete way to sign in, with no password or code, that a member unlocks on their own device by fingerprint, face or device PIN. A member can have several, one per device, each with a name they can change. Passkeys need an HTTPS address.
_Avoid_: Fingerprint, biometrics

**2FA**:
An extra check after the password: a 6-digit code from an authenticator app. Each member turns it on for themselves.
_Avoid_: MFA, two-step sign-in, two-factor

**Backup code**:
A one-time code a member saves when they turn on 2FA, typed in place of the 6-digit code when they don't have their phone.
_Avoid_: Recovery code
