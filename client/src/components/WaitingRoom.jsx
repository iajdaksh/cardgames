import React from 'react';

export default function WaitingRoom({ player, room, onLeave }) {
  const copyCode = () => navigator.clipboard?.writeText(room.code);

  return (
    <div className="waiting-room">
      <div className="wr-header">
        <h2>{room.gameType === 'mendicot' ? '🎴 Mendicot' : '♠️ Court Piece'}</h2>
        <button className="btn-leave-sm" onClick={onLeave}>Leave</button>
      </div>

      <div className="room-code-box">
        <span className="rcode-label">Room Code</span>
        <span className="rcode-value">{room.code}</span>
        <button className="btn-copy" onClick={copyCode}>📋</button>
      </div>

      <div className="wr-table">
        {[
          { pos: 0, label: 'South', team: 0, css: 'south' },
          { pos: 1, label: 'West',  team: 1, css: 'west'  },
          { pos: 2, label: 'North', team: 0, css: 'north' },
          { pos: 3, label: 'East',  team: 1, css: 'east'  }
        ].map(({ pos, label, team, css }) => {
          const p = room.players?.find(pl => pl.position === pos);
          const teamColor = team === 0 ? '#4CAF50' : '#2196F3';
          return (
            <div key={pos} className={`wr-seat wr-${css}`} style={{ borderColor: teamColor }}>
              <div className="wr-avatar" style={{ background: p ? (p.avatarBg || teamColor) : '#2a3d52' }}>
                {p ? (p.avatar || p.name[0].toUpperCase()) : '?'}
              </div>
              <div className="wr-name">
                {p ? <>{p.name}{p.id === player.id && <span className="you-tag"> (You)</span>}</> : <span className="waiting-tag">Waiting...</span>}
              </div>
              <div className="wr-team" style={{ color: teamColor }}>Team {team === 0 ? 'A' : 'B'}</div>
            </div>
          );
        })}
        <div className="wr-center">
          <span className="wr-count">{room.players?.length || 0}/4</span>
        </div>
      </div>

      <div className="wr-teams-legend">
        <span style={{ color: '#4CAF50' }}>🟢 Team A: South & North</span>
        <span style={{ color: '#2196F3' }}>🔵 Team B: West & East</span>
      </div>

      <div className="wr-status">
        {(room.players?.length || 0) < 4
          ? `⏳ Waiting for ${4 - (room.players?.length || 0)} more player(s)...`
          : '✅ Starting game...'}
      </div>
    </div>
  );
}
