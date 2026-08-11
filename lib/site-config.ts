export const SITE_CONTACT_EMAIL = 'jecrc@jecrcfoundation.live';
export const LEGACY_RESULTS_PORTAL_PATH = '/portal/full';
export const PUBLIC_PORTAL_PATH = '/portal';
export const MAIN_CHAT_PATH = '/';

/**
 * Flip either flag back to `true` to re-hide that surface. The notices below and
 * the hold dialog on /portal follow these, so the site never tells students
 * something is hidden while it is actually visible.
 */
export const SITE_FEATURES = {
  publicResultsHidden: false,
  detailedProfileHidden: false,
} as const;

export const CHAT_DISCLAIMER_ITEMS: readonly string[] = [
  'This chat is community-run and is not an official JECRC service.',
  'Admins may hide or delete messages to keep the room safe and usable.',
  ...(SITE_FEATURES.publicResultsHidden
    ? [`Marks and detailed student info are temporarily hidden. Mail ${SITE_CONTACT_EMAIL} or request access in chat.`]
    : []),
];

export const TICKER_MESSAGES: readonly string[] = [
  'Main website now opens the live chat room.',
  ...(SITE_FEATURES.publicResultsHidden
    ? [`Marks and detailed info are temporarily hidden. Contact ${SITE_CONTACT_EMAIL} or drop a chat request.`]
    : ['Marks and student records are open again in the portal.']),
];
