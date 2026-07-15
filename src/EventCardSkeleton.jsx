import React from 'react';

function EventCardSkeleton() {
  return (
    <div className="touchable-card" style={{ cursor: 'default' }}>
      <div className="skeleton event-image" />
      <div className="event-info">
        <div className="skeleton skeleton-text" style={{ width: '80%' }} />
        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
        <div
          className="skeleton skeleton-text"
          style={{ width: '70%', marginTop: '4px' }}
        />
      </div>
    </div>
  );
}

export default EventCardSkeleton;