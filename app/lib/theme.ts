import type { Theme } from './engine/types'

/** 'plain' renders with no body class (the default :root palette). */
export function themeClass(theme: Theme | undefined): string {
  return !theme || theme === 'plain' ? '' : `theme-${theme}`
}

export const themeLabels: Record<Theme, string> = {
  plain: 'Plain',
  fantasy: 'Epic Quest',
  cyberpunk: 'Neon Nights',
  western: 'Frontier Feast',
  noir: 'Case Files',
  pirate: 'High Seas',
  medieval: 'Royal Banquet',
  space: 'Cosmic Voyage',
  horror: 'Midnight Manor'
}

export const themeSubtitles: Record<Theme, string> = {
  plain: 'A meal planning roguelike',
  fantasy: 'A culinary adventure',
  cyberpunk: 'A meal planning simulation',
  western: 'A meal wrangling game',
  noir: 'A culinary mystery',
  pirate: 'A meal treasure hunt',
  medieval: 'A royal banquet quest',
  space: 'A deep space meal protocol',
  horror: 'A haunted meal quest'
}

export const themeButtonText: Record<Theme, { inProgress: string; complete: string }> = {
  plain: { inProgress: 'Lock In Picks', complete: 'Finish Up' },
  fantasy: { inProgress: 'Seal & Dispatch', complete: 'Return Triumphant' },
  cyberpunk: { inProgress: 'Upload & Transmit', complete: 'Mission Complete' },
  western: { inProgress: 'Saddle Up & Ride', complete: 'Ride Into Sunset' },
  noir: { inProgress: 'File the Case', complete: 'Case Closed' },
  pirate: { inProgress: 'Chart the Course', complete: 'Claim the Treasure' },
  medieval: { inProgress: 'Send the Herald', complete: 'Feast Declared' },
  space: { inProgress: 'Transmit Coordinates', complete: 'Mission Accomplished' },
  horror: { inProgress: 'Seal the Pact', complete: 'Survive the Week' }
}
