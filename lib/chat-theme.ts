export const participantThemes = [
  {
    avatarClass: 'bg-teal-700 text-white',
    bubbleClass: 'border-2 border-teal-600 bg-teal-50 text-teal-950',
    cardClass: 'border-2 border-teal-300 bg-teal-50',
    chipClass: 'border-2 border-teal-300 bg-teal-50 text-teal-900',
    dotClass: 'bg-teal-600',
    labelClass: 'text-teal-700',
  },
  {
    avatarClass: 'bg-orange-600 text-white',
    bubbleClass: 'border-2 border-orange-400 bg-orange-50 text-orange-950',
    cardClass: 'border-2 border-orange-300 bg-orange-50',
    chipClass: 'border-2 border-orange-300 bg-orange-50 text-orange-900',
    dotClass: 'bg-orange-500',
    labelClass: 'text-orange-700',
  },
  {
    avatarClass: 'bg-indigo-700 text-white',
    bubbleClass: 'border-2 border-indigo-400 bg-indigo-50 text-indigo-950',
    cardClass: 'border-2 border-indigo-300 bg-indigo-50',
    chipClass: 'border-2 border-indigo-300 bg-indigo-50 text-indigo-900',
    dotClass: 'bg-indigo-500',
    labelClass: 'text-indigo-700',
  },
  {
    avatarClass: 'bg-fuchsia-700 text-white',
    bubbleClass: 'border-2 border-fuchsia-400 bg-fuchsia-50 text-fuchsia-950',
    cardClass: 'border-2 border-fuchsia-300 bg-fuchsia-50',
    chipClass: 'border-2 border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900',
    dotClass: 'bg-fuchsia-500',
    labelClass: 'text-fuchsia-700',
  },
  {
    avatarClass: 'bg-emerald-700 text-white',
    bubbleClass: 'border-2 border-emerald-400 bg-emerald-50 text-emerald-950',
    cardClass: 'border-2 border-emerald-300 bg-emerald-50',
    chipClass: 'border-2 border-emerald-300 bg-emerald-50 text-emerald-900',
    dotClass: 'bg-emerald-500',
    labelClass: 'text-emerald-700',
  },
] as const

export function getParticipantTheme(index: number) {
  return participantThemes[index % participantThemes.length]
}

export function getHandleInitial(handle: string) {
  return handle.trim().charAt(0).toUpperCase() || '?'
}
