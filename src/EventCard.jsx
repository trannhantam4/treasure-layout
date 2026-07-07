import { useNavigate } from 'react-router-dom';

function EventCard({ event: { eventId, imageLink, eventName, eventHostest, eventDateStart, eventDateEnd } }) {
  const navigate = useNavigate();

  const handleAction = (e) => {
    // Allow navigation on mouse click OR keyboard 'Enter'/'Space'
    if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/events/${eventId}`);
    }
  };

  return (
    <article 
      className="touchable-card" 
      onClick={handleAction}
      onKeyDown={handleAction}
      role="button"
      tabIndex={0}
    >
      <img src={imageLink} alt={eventName} className="event-image" />
      <div className="event-info">
        <h3>{eventName}</h3>
        <p>{eventHostest}</p>
        <p className="event-dates">{eventDateStart} - {eventDateEnd}</p>
      </div>
    </article>
  );
}

export default EventCard;