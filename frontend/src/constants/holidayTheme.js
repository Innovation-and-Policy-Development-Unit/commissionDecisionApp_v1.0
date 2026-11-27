/**
 * Holiday palette and icon, keyed by the slug the API sends.
 *
 * Keys come from the backend's tracker/holidays.py::key_for(), which derives
 * them from the holiday name. An unrecognised name — a one-off the government
 * gazettes, or a row an admin renamed — arrives as 'other' and renders in the
 * neutral tone rather than borrowing the wrong one.
 *
 * `tone` is the CSS class that sets --hol-surface and --hol-ink; the palette
 * itself, light and dark, lives in index.css under "Holiday palette".
 */
import {
  Baby,
  Church,
  CloudSun,
  Cross,
  Egg,
  Flag,
  Hammer,
  Handshake,
  HeartHandshake,
  Landmark,
  ScrollText,
  Sparkles,
  CalendarDays,
} from 'lucide-react'

import Beanie from '../components/shared/icons/Beanie'
import NameleFrond from '../components/shared/icons/NameleFrond'

export const HOLIDAY_THEME = {
  'new-year':      { tone: 'hol-new-year',      Icon: Sparkles },
  'lini':          { tone: 'hol-lini',          Icon: Landmark },
  'chiefs':        { tone: 'hol-chiefs',        Icon: NameleFrond },
  'good-friday':   { tone: 'hol-good-friday',   Icon: Cross },
  'easter-monday': { tone: 'hol-easter-monday', Icon: Egg },
  'labour':        { tone: 'hol-labour',        Icon: Hammer },
  'ascension':     { tone: 'hol-ascension',     Icon: CloudSun },
  'childrens':     { tone: 'hol-childrens',     Icon: Baby },
  'independence':  { tone: 'hol-independence',  Icon: Flag },
  'assumption':    { tone: 'hol-assumption',    Icon: Church },
  'constitution':  { tone: 'hol-constitution',  Icon: ScrollText },
  'unity':         { tone: 'hol-unity',         Icon: Handshake },
  'christmas':     { tone: 'hol-christmas',     Icon: Beanie },
  'family':        { tone: 'hol-family',        Icon: HeartHandshake },
  'other':         { tone: 'hol-other',         Icon: CalendarDays },
}

export const FALLBACK_HOLIDAY_KEY = 'other'

export function holidayTheme(key) {
  return HOLIDAY_THEME[key] || HOLIDAY_THEME[FALLBACK_HOLIDAY_KEY]
}
