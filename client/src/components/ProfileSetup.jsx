import React, { useState } from 'react';

const DEFAULT_AVATARS = ['😀','😎','🤠','🧐','😏','🤩','😂','🥸','👻','🤖','👾','🎭','🦊','🐯','🦁','🐻','🐼','🐸','🦄','🐲','👑','🎩','🧢','🪄'];
const DEFAULT_COLORS = ['#2196F3','#4CAF50','#FF5722','#9C27B0','#F44336','#FF9800','#009688','#795548','#607D8B','#E91E63','#3F51B5','#00BCD4'];

export default function ProfileSetup({ player, avatarOptions, onSave, isFirstTime }) {
  const avatars = avatarOptions?.avatars?.length ? avatarOptions.avatars : DEFAULT_AVATARS;
  const bgColors = avatarOptions?.bgColors?.length ? avatarOptions.bgColors : DEFAULT_COLORS;

  const [name, setName] = useState(player?.name || '');
  const [avatar, setAvatar] = useState(player?.avatar || '😀');
  const [avatarBg, setAvatarBg] = useState(player?.avatarBg || '#2196F3');

  const canSave = name.trim().length >= 2;

  return (
    <div className="profile-setup-screen">
      <div className="profile-setup-card">
        <h1>🃏 Card Games</h1>
        <p className="setup-sub">Mendicot & Court Piece</p>

        <h3>{isFirstTime ? 'Create Your Player' : 'Edit Profile'}</h3>

        {/* Avatar Preview */}
        <div className="avatar-preview" style={{ background: avatarBg }}>
          <span className="avatar-emoji">{avatar}</span>
        </div>

        {/* Avatar Picker */}
        <div className="avatar-section">
          <label>Choose Face</label>
          <div className="avatar-grid">
            {avatars.map(a => (
              <button
                key={a}
                className={`avatar-opt ${avatar === a ? 'selected' : ''}`}
                onClick={() => setAvatar(a)}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div className="color-section">
          <label>Background Color</label>
          <div className="color-grid">
            {bgColors.map(c => (
              <button
                key={c}
                className={`color-opt ${avatarBg === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setAvatarBg(c)}
              />
            ))}
          </div>
        </div>

        {/* Name Input */}
        <div className="name-section">
          <label>Your Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canSave && onSave({ name: name.trim(), avatar, avatarBg })}
            placeholder="Enter name (2–16 chars)"
            maxLength={16}
            autoFocus
          />
        </div>

        <button
          className="save-profile-btn"
          disabled={!canSave}
          onClick={() => onSave({ name: name.trim(), avatar, avatarBg })}
        >
          {isFirstTime ? 'Start Playing →' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
