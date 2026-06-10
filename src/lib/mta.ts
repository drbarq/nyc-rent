// Official MTA line colors. Yellow (N/Q/R/W) bullets take black text; all others white.

export const LINE_COLORS: Record<string, string> = {
  '1': '#ee352e',
  '2': '#ee352e',
  '3': '#ee352e',
  '4': '#00933c',
  '5': '#00933c',
  '6': '#00933c',
  '7': '#b933ad',
  A: '#0039a6',
  C: '#0039a6',
  E: '#0039a6',
  B: '#ff6319',
  D: '#ff6319',
  F: '#ff6319',
  M: '#ff6319',
  G: '#6cbe45',
  J: '#996633',
  Z: '#996633',
  L: '#a7a9ac',
  N: '#fccc0a',
  Q: '#fccc0a',
  R: '#fccc0a',
  W: '#fccc0a',
  S: '#808183',
}

export function lineColor(line: string): string {
  return LINE_COLORS[line] ?? '#808183'
}

export function lineTextColor(line: string): string {
  return lineColor(line) === '#fccc0a' ? '#0f0f0f' : '#ffffff'
}
