export const GearIcon = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
    <path
      fill="currentColor"
      transform="translate(-1 0)"
      d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.7a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5L19.4 13zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
    />
  </svg>
);

const Chevron = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
    <path fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
export const UpIcon = () => <Chevron d="M5 15l7-7 7 7" />;
export const DownIcon = () => <Chevron d="M5 9l7 7 7-7" />;

export const TrashIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
    <path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z" />
  </svg>
);
