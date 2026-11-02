import L from './plugins';
import type { Hazard } from '../hazards/types';
import { SEVERITY_COLOR } from '../detection/draw';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function hazardIcon(h: Pick<Hazard, 'severity' | 'origin'>) {
  return L.divIcon({
    className: '',
    html: `<div class="hz-pin ${h.origin === 'sample' ? 'sample' : ''}" style="color:${SEVERITY_COLOR[h.severity]}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -8],
  });
}

export function popupHtml(h: Hazard) {
  const when = new Date(h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const origin = h.origin === 'sample' ? 'Sample data' : h.origin === 'shared' ? 'Shared report' : 'Saved on this device';
  return `<div style="min-width:180px">
    ${h.thumb ? `<img src="${h.thumb}" alt="" style="width:100%;border-radius:8px;margin-bottom:8px"/>` : ''}
    <div style="display:flex;align-items:center;gap:6px;font-weight:600;color:#fff">
      <span style="width:8px;height:8px;border-radius:9px;background:${SEVERITY_COLOR[h.severity]}"></span>
      ${h.severity[0].toUpperCase() + h.severity.slice(1)} severity pothole
    </div>
    ${h.note ? `<div style="margin-top:4px;color:#d4d4d8">${esc(h.note)}</div>` : ''}
    <div style="margin-top:6px;color:#8b8f98;font-size:12px">${origin} · ${when}<br/>
    ${h.confidence != null ? `Model confidence ${Math.round(h.confidence * 100)}% · ` : ''}${h.source} · ${h.confirmations} report${h.confirmations > 1 ? 's' : ''}</div>
  </div>`;
}

