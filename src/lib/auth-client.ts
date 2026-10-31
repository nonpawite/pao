import { passkeyClient } from '@better-auth/passkey/client'
import { inferAdditionalFields, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields({ user: { locale: { type: 'string', required: false } } }), twoFactorClient(), passkeyClient()],
})

/** Browsers refuse passkeys on plain http except localhost; only the browser knows, so call this after hydration. */
export const passkeysWork = () => window.isSecureContext && 'PublicKeyCredential' in window

/** The passkey client's error types don't all declare a code, though the answers carry one. */
export const errorCode = (error: object) => ('code' in error ? error.code : undefined)
