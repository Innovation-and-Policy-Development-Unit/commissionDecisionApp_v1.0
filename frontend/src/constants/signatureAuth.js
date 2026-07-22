// Maps a signature's captured auth_method to a display label + Badge variant.
// Blank/unknown values (signatures made before this was tracked) render nothing.
export const AUTH_METHOD_INFO = {
  totp: {
    label: 'Verified via 2FA',
    variant: 'success',
    detail: 'Signed from a session authenticated with a one-time TOTP code.',
  },
  pin: {
    label: 'Trusted Session (PIN)',
    variant: 'info',
    detail: 'Signed after re-authenticating with a session PIN on a previously trusted device.',
  },
  password_only: {
    label: 'Password Only',
    variant: 'warning',
    detail: 'Signed from a session authenticated with password only — no two-factor verification.',
  },
  push_demo: {
    label: 'Demo Push',
    variant: 'warning',
    detail: 'Signed via simulated push approval (demo mode) — not a genuine two-factor verification.',
  },
}

export function authMethodInfo(authMethod) {
  return AUTH_METHOD_INFO[authMethod] || null
}
