import { getFounderEmails, isFounderEmail } from '@/lib/founders'

const DEFAULT_TEST_ACCOUNT_EMAILS = [
  'nathansharer@gmail.com',
  'drsharer@sharerpsych.com',
  'drsharer@baltimorepsychologist.net',
]

function parseEmails(value?: string | null) {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function getTestAccountEmails() {
  return [...new Set([...getFounderEmails(), ...DEFAULT_TEST_ACCOUNT_EMAILS, ...parseEmails(process.env.TEST_ACCOUNT_EMAILS)])]
}

export function isTestAccountEmail(email?: string | null) {
  if (!email) return false

  return getTestAccountEmails().includes(email.trim().toLowerCase())
}

export function canUseTestSwitcher(email?: string | null) {
  return isFounderEmail(email) || isTestAccountEmail(email)
}
