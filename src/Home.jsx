import EventCard from './EventCard';
import { useRef, useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, setDoc, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import BackToTopButton from './BackToTopButton';
import { getCachedEventsList, cacheEventsList } from './storage';
import { canManage } from './utils/auth';
import SliderEditModal from './components/SliderEditModal';

const DEFAULT_SLIDERS = {
  slider1: [
    'https://picsum.photos/seed/slide1/600/400',
    'https://picsum.photos/seed/slide2/600/400',
    'https://picsum.photos/seed/slide3/600/400',
  ],
  slider2: [
    'https://picsum.photos/seed/slide4/600/400',
    'https://picsum.photos/seed/slide5/600/400',
    'https://picsum.photos/seed/slide6/400/400',
  ],
};

function Home({ user }) {
  const canEdit = canManage(user);
  const slider1Ref = useRef(null);
  const slider2Ref = useRef(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const scrollViewRef = useRef(null);

  const [sliderImages1, setSliderImages1] = useState(DEFAULT_SLIDERS.slider1);
  const [sliderImages2, setSliderImages2] = useState(DEFAULT_SLIDERS.slider2);
  const [editingSlider, setEditingSlider] = useState(null); // 'slider1' | 'slider2' | null
  const [savingSlider, setSavingSlider] = useState(false);

  const scroll = (ref, dir) => {
    if (ref.current) {
      ref.current.scrollBy({ left: dir === 'left' ? -220 : 220, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      // 1. Try to load from device IndexedDB first (0ms delay, 0 server reads)
      try {
        const cached = await getCachedEventsList();
        if (cached && cached.length > 0) {
          setUpcomingEvents(cached.slice(0, 3));
          return;
        }
      } catch {
        /* ignore cache read error */
      }

      // 2. Fetch from Firestore only if device cache is missing/expired
      try {
        const q = query(collection(db, 'event'), orderBy('eventDateStart', 'desc'), limit(10));
        const querySnapshot = await getDocs(q);
        const fetchedEvents = querySnapshot.docs.map(doc => doc.data());

        const today = new Date();
        const closestEvents = fetchedEvents
          .sort((a, b) => Math.abs(new Date(a.eventDateStart) - today) - Math.abs(new Date(b.eventDateStart) - today))
          .slice(0, 3);

        setUpcomingEvents(closestEvents);
        cacheEventsList(closestEvents);
      } catch (error) {
        console.error("Failed to fetch events from Firestore:", error);
      }
    };
    fetchEvents();
  }, []);

  // Sync slider images from Firestore /settings/sliders in real time
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'sliders'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.sliderImages1) && data.sliderImages1.length > 0) {
          setSliderImages1(data.sliderImages1);
        }
        if (Array.isArray(data.sliderImages2) && data.sliderImages2.length > 0) {
          setSliderImages2(data.sliderImages2);
        }
      }
    }, (err) => {
      console.warn("Could not listen to sliders settings, using default fallbacks:", err);
    });
    return () => unsub();
  }, []);

  const handleSaveSlider = async (newImages) => {
    if (!canEdit || !user) return;
    setSavingSlider(true);
    try {
      const isSlider1 = editingSlider === 'slider1';
      const fieldKey = isSlider1 ? 'sliderImages1' : 'sliderImages2';
      const sliderTitle = isSlider1 ? 'Featured Galleries' : 'New Floor Layouts';
      const oldImages = isSlider1 ? sliderImages1 : sliderImages2;

      // 1. Update sliders in Firestore /settings/sliders
      const sliderRef = doc(db, 'settings', 'sliders');
      await setDoc(sliderRef, {
        [fieldKey]: newImages,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid,
      }, { merge: true });

      // 2. Save audit log in /logs collection
      await addDoc(collection(db, 'logs'), {
        changerUid: user.uid,
        changerName: user.fullName || user.userName || user.name || 'Admin/Manager',
        changerRole: user.role || 'manager',
        action: 'change_slider_images',
        sliderId: editingSlider,
        sliderTitle,
        oldImages,
        newImages,
        timestamp: new Date().toISOString(),
      });

      if (isSlider1) {
        setSliderImages1(newImages);
      } else {
        setSliderImages2(newImages);
      }

      alert(`Successfully updated ${sliderTitle} images! Audit log recorded.`);
      setEditingSlider(null);
    } catch (err) {
      console.error("Error saving slider images:", err);
      alert("Failed to update slider images: " + err.message);
    } finally {
      setSavingSlider(false);
    }
  };

  return (
    <div className="mobile-container page-enter">
      <div className="scroll-view" ref={scrollViewRef}>
        {/* Hero Section */}
        <section style={{
          textAlign: 'center',
          padding: 'var(--space-8) var(--space-6)',
          background: 'var(--gradient-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-gold)',
          boxShadow: 'var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 50% 0%, rgba(223, 183, 108, 0.18), transparent 70%)',
            pointerEvents: 'none'
          }} />
          <span className="badge badge-accent" style={{ marginBottom: 'var(--space-3)' }}>Event Layout &amp; Treasure Hunt Platform</span>
          <h1 style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontFamily: 'var(--font-serif)',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            background: 'var(--gradient-accent)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 'var(--space-3) 0',
            filter: 'drop-shadow(0 2px 10px rgba(223, 183, 108, 0.2))'
          }}>
            Discover &amp; Connect at Top Events
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto var(--space-2)', fontSize: 'var(--font-base)', lineHeight: 'var(--leading-loose)' }}>
            Explore floor plans, connect with premier brands, and collect digital stamps to win prizes.
          </p>
        </section>

        {/* Featured Galleries Slider */}
        <div className="slider-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h2 className="slider-title" style={{ margin: 0 }}>Featured Galleries</h2>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditingSlider('slider1')}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                aria-label="Edit Featured Galleries Images"
              >
                ✏️ Edit Slider
              </button>
            )}
          </div>
          <div className="slider-wrapper">
            <button className="slider-btn left" onClick={() => scroll(slider1Ref, 'left')} aria-label="Scroll left">&lt;</button>
            <div className="image-slider" ref={slider1Ref}>
              {sliderImages1.map((src, idx) => (
                <img key={idx} src={src} alt={`Featured gallery ${idx + 1}`} className="slider-image" loading="lazy" decoding="async" />
              ))}
            </div>
            <button className="slider-btn right" onClick={() => scroll(slider1Ref, 'right')} aria-label="Scroll right">&gt;</button>
          </div>
        </div>

        {/* New Arrivals Slider */}
        <div className="slider-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h2 className="slider-title" style={{ margin: 0 }}>New Floor Layouts</h2>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditingSlider('slider2')}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                aria-label="Edit New Floor Layouts Images"
              >
                ✏️ Edit Slider
              </button>
            )}
          </div>
          <div className="slider-wrapper">
            <button className="slider-btn left" onClick={() => scroll(slider2Ref, 'left')} aria-label="Scroll left">&lt;</button>
            <div className="image-slider" ref={slider2Ref}>
              {sliderImages2.map((src, idx) => (
                <img key={idx} src={src} alt={`New layout ${idx + 1}`} className="slider-image" loading="lazy" decoding="async" />
              ))}
            </div>
            <button className="slider-btn right" onClick={() => scroll(slider2Ref, 'right')} aria-label="Scroll right">&gt;</button>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="slider-container">
          <h2 className="slider-title">Upcoming Events</h2>
          <div className="events-scroll-view">
            {upcomingEvents.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)' }}>Loading upcoming events...</p>
            ) : (
              upcomingEvents.map((event) => (
                <EventCard key={event.eventId} event={event} />
              ))
            )}
          </div>
        </div>

      </div>
      <BackToTopButton scrollableRef={scrollViewRef} />

      {/* Slider Edit Modal for Admin/Manager */}
      {canEdit && editingSlider && (
        <SliderEditModal
          isOpen={Boolean(editingSlider)}
          onClose={() => setEditingSlider(null)}
          sliderTitle={editingSlider === 'slider1' ? 'Featured Galleries' : 'New Floor Layouts'}
          currentImages={editingSlider === 'slider1' ? sliderImages1 : sliderImages2}
          onSave={handleSaveSlider}
          saving={savingSlider}
        />
      )}
    </div>
  );
}

export default Home
