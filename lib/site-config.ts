export const SITE_CONTACT_EMAIL = 'jecrc@jecrcfoundation.live';
export const LEGACY_RESULTS_PORTAL_PATH = '/portal/full';
export const PUBLIC_PORTAL_PATH = '/portal';
export const MAIN_CHAT_PATH = '/';

export const SITE_FEATURES = {
  publicResultsHidden: true,
  detailedProfileHidden: true,
} as const;

export const CHAT_DISCLAIMER_ITEMS = [
  'This chat is community-run and is not an official JECRC service.',
  'Admins may hide or delete messages to keep the room safe and usable.',
  `Marks and detailed student info are temporarily hidden. Mail ${SITE_CONTACT_EMAIL} or request access in chat.`,
] as const;

export const TICKER_MESSAGES = [
  'Main website now opens the live chat room.',
  `Marks and detailed info are temporarily hidden. Contact ${SITE_CONTACT_EMAIL} or drop a chat request.`,
  'Student photos in chat use the same record-mapped image logic as the main portal.',
  'Portal access is still available separately so the old setup can be restored later.',
] as const;
