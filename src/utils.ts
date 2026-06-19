import type { CanFrameDisplay, FilterRule, DbcDatabase, DecodedSignal } from './types';

export function formatTimestamp(us: number): string {
  const seconds = Math.floor(us / 1_000_000);
  const micros = Math.floor(us % 1_000_000);
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(micros).padStart(6, '0')}`;
}

export function formatId(id: number, isExtended: boolean): string {
  const hex = isExtended
    ? id.toString(16).toUpperCase().padStart(8, '0')
    : id.toString(16).toUpperCase().padStart(3, '0');
  return `0x${hex}`;
}

export function formatData(data: number[]): string {
  return data.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

export function parseDataString(str: string): number[] {
  const parts = str.trim().split(/\s+/).filter(Boolean);
  return parts.map((p) => parseInt(p, 16)).filter((n) => !isNaN(n) && n >= 0 && n <= 255).slice(0, 8);
}

export function frameKey(id: number, isExtended: boolean): string {
  return `${id}_${isExtended ? 'ext' : 'std'}`;
}

export function applyFilters(
  frame: CanFrameDisplay,
  filters: FilterRule[],
  dbc: DbcDatabase | null,
  decodedMap: Record<number, DecodedSignal[]>
): boolean {
  const enabledFilters = filters.filter((f) => f.enabled);
  if (enabledFilters.length === 0) return true;

  let pass = true;

  for (const f of enabledFilters) {
    if (f.mode === 'whitelist') {
      if (f.ids && !f.ids.includes(frame.id)) {
        pass = false;
      }
    } else if (f.mode === 'blacklist') {
      if (f.ids && f.ids.includes(frame.id)) {
        pass = false;
      }
    } else if (f.mode === 'conditional') {
      if (f.signal_name && f.message_id !== undefined && frame.id === f.message_id && f.op && f.value !== undefined) {
        const signals = decodedMap[frame.id];
        if (signals) {
          const sig = signals.find((s) => s.name === f.signal_name);
          if (sig) {
            const v = sig.physical_value;
            let condPass = false;
            switch (f.op) {
              case '>': condPass = v > f.value; break;
              case '<': condPass = v < f.value; break;
              case '>=': condPass = v >= f.value; break;
              case '<=': condPass = v <= f.value; break;
              case '==': condPass = v === f.value; break;
              case '!=': condPass = v !== f.value; break;
            }
            if (!condPass) pass = false;
          }
        }
      }
    }
  }

  return pass;
}

export function sortFrames(
  frames: CanFrameDisplay[],
  field: 'id' | 'period' | 'last_timestamp' | 'count',
  order: 'asc' | 'desc'
): CanFrameDisplay[] {
  const sorted = [...frames].sort((a, b) => {
    let va: number, vb: number;
    switch (field) {
      case 'id': va = a.id; vb = b.id; break;
      case 'period': va = a.period; vb = b.period; break;
      case 'last_timestamp': va = a.last_timestamp; vb = b.last_timestamp; break;
      case 'count': va = a.count; vb = b.count; break;
    }
    return order === 'asc' ? va - vb : vb - va;
  });
  return sorted;
}
