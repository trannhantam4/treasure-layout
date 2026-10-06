import { memo } from 'react';
import { useNavigate } from 'react-router-dom';

const EventCard = memo(({ event }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/events/${event.eventId}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const imageLink = event.imageLink || 'https://via.placeholder.com/150';

  return (
    <div
      className="touchable-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View details for event ${event.eventName}`}
    >
      <img src={imageLink} alt={event.eventName} className="event-image" loading="lazy" decoding="async" />
      <div className="event-info">
        <h3>{event.eventName}</h3>
        <p>{event.eventLocation}</p>
        <p className="event-dates">{event.eventDateStart} - {event.eventDateEnd}</p>
      </div>
    </div>
  );
});

export default EventCard;