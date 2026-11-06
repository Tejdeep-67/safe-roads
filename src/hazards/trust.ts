import type { Hazard } from './types';

// one plain sentence about what the community knows about a report
export function trustLine(h: Pick<Hazard, 'status' | 'verified' | 'confirmations' | 'fixedVotes'>) {
  if (h.status === 'resolved') return `Marked as fixed (${h.fixedVotes} ${h.fixedVotes === 1 ? 'person says' : 'people say'} so)`;
  if (h.status === 'stale') return 'Nobody has confirmed this for a long time';
  if (h.verified) return `Confirmed by ${h.confirmations} people`;
  return 'Not confirmed by anyone else yet';
}
