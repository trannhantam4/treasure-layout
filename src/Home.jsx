import EventCard from './EventCard'
import { useRef, useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

function Home() {
  const slider1Ref = useRef(null)
  const slider2Ref = useRef(null)
  const [upcomingEvents, setUpcomingEvents] = useState([])

  const scroll = (ref, dir) => {
    if (ref.current) {
      ref.current.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' })
    }
  }

  // Mock data for image sliders
  const sliderImages1 = [
    'https://picsum.photos/seed/slide1/400/300',
    'https://picsum.photos/seed/slide2/400/300',
    'https://picsum.photos/seed/slide3/400/300',
  ]

  const sliderImages2 = [
    'https://picsum.photos/seed/slide4/400/300',
    'https://picsum.photos/seed/slide5/400/300',
    'https://picsum.photos/seed/slide6/400/300',
  ]

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'event'))
        const fetchedEvents = querySnapshot.docs.map(doc => doc.data())
        const closestEvents = fetchedEvents
          .sort((a, b) => Math.abs(new Date(a.eventDateStart) - new Date()) - Math.abs(new Date(b.eventDateStart) - new Date()))
          .slice(0, 3)
        setUpcomingEvents(closestEvents)
      } catch (error) {
        console.error("Failed to fetch events from Firestore:", error)
      }
    }
    fetchEvents()
  }, [])

  return (
    <div className="mobile-container" style={{ maxWidth: '100%', overflowX: 'hidden' }}>
      {/* Main Screen ScrollView */}
      <div className="scroll-view">
        
        <div className="slider-container">
          <h2 className="slider-title">Featured Galleries</h2>
          <div className="slider-wrapper">
            <button className="slider-btn left" onClick={() => scroll(slider1Ref, 'left')}>&lt;</button>
            <div className="image-slider" ref={slider1Ref}>
              {sliderImages1.map((src, idx) => (
                <img key={idx} src={src} alt={`Featured ${idx}`} className="slider-image" />
              ))}
            </div>
            <button className="slider-btn right" onClick={() => scroll(slider1Ref, 'right')}>&gt;</button>
          </div>
        </div>

        <div className="slider-container">
          <h2 className="slider-title">New Arrivals</h2>
          <div className="slider-wrapper">
            <button className="slider-btn left" onClick={() => scroll(slider2Ref, 'left')}>&lt;</button>
            <div className="image-slider" ref={slider2Ref}>
              {sliderImages2.map((src, idx) => (
                <img key={idx} src={src} alt={`Arrival ${idx}`} className="slider-image" />
              ))}
            </div>
            <button className="slider-btn right" onClick={() => scroll(slider2Ref, 'right')}>&gt;</button>
          </div>
        </div>

        <div className="slider-container">
          <h2 className="slider-title">Upcoming Events</h2>
          {/* Event Cards ScrollView */}
          <div className="events-scroll-view">
            {upcomingEvents.map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

export default Home
