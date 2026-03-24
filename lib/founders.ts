const DEFAULT_FOUNDER_EMAILS = ['nathansharer@gmail.com']

export function getFounderEmails() {
  const envValue = process.env.FOUNDER_EMAILS

  if (!envValue) {
    return DEFAULT_FOUNDER_EMAILS
  }

  const emails = envValue
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)

  return emails.length > 0 ? emails : DEFAULT_FOUNDER_EMAILS
}

export function isFounderEmail(email?: string | null) {
  if (!email) return false

  return getFounderEmails().includes(email.trim().toLowerCase())
}
