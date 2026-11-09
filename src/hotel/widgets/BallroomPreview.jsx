// Ballroom preview: the booking's table count drawn on the Grand Ballroom floor plan.
// Click a couple in the pipeline grid (cross-filter) to see their room.
import React from 'react';
import { useWidgetRows } from './useWidgetRows.js';
import { tableGrid, ROOM } from '../../explorer/agent/applyStudioPatch.js';
export default function BallroomPreview(params) {
  const rows = useWidgetRows(params, ['couple', 'tables']);
  // one couple selected (cross-filter) → that room; otherwise the newest real enquiry
  const one =
      rows.length === 1
        ? rows[0]
        : rows.find(r => !String(r.couple).includes('(example)')) || rows[0] || null,
    tables = one ? Math.round(one.tables || 0) : 0;
  const W = ROOM.maxX - ROOM.minX + 6,
    H = ROOM.maxZ - ROOM.minZ + 4,
    x0 = ROOM.minX - 5,
    z0 = ROOM.minZ - 2;
  const grid = tables ? tableGrid(Math.min(tables, 60)) : [];
  return (
    <div className="w-room">
      <svg
        viewBox={`${x0} ${z0} ${W} ${H}`}
        role="img"
        aria-label={one ? `${tables} tables for ${one.couple}` : 'Grand Ballroom floor plan'}
      >
        <rect x={x0} y={z0} width={W} height={H} rx="1" className="w-room-floor" />
        <rect x={x0 + 0.6} y={-3} width="2.6" height="6" className="w-room-stage" />
        {grid.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.z} r="1.2" className="w-room-table" />
        ))}
      </svg>
      <p>
        {one ? (
          <>
            <b>{String(one.couple)}</b> · {tables} tables · {tables * 10} guests
            {rows.length > 1 && <small> · click a couple in the pipeline to see theirs</small>}
          </>
        ) : (
          'No bookings in this view.'
        )}
      </p>
    </div>
  );
}
