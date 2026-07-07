import { useState, useEffect } from 'react';
import { collection, getDocs, query, limit, orderBy, where, startAfter } from 'firebase/firestore';
import { db } from './firebase';
import { saveEventToFirestore, uploadImageToImgBB } from './Event';
import EventCard from './EventCard';

function Events({ user }) {
  const [eventsList, setEventsList] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingKeyview, setIsUploadingKeyview] = useState(false);
  const [isUploadingLayout, setIsUploadingLayout] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [formData, setFormData] = useState({
    eventName: '',
    eventHostest: '',
    setUpDate: '',
    eventDateStart: '',
    eventDateEnd: '',
    CleanUpDate: '',
    eventLocation: '',
    PIC: '',
    note: '',
    attendees: 0,
    imageLink: '',
    layoutImages: []
  });

  const userRole = user?.role?.toLowerCase();
  const canEdit = userRole === 'admin' || userRole === 'manager' || user?.email === 'trannhantam4@gmail.com';

  useEffect(() => {
    const fetchEvents = async () => {
      // Instantly load from cache for a snappy UI
      const cachedEvents = sessionStorage.getItem('events_cache');
      if (cachedEvents) {
        setEventsList(JSON.parse(cachedEvents));
      }

      // Always fetch to establish the 'lastDoc' cursor for pagination and sync fresh data
      try {
        const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
        const q = query(
          collection(db, 'event'),
          orderBy('eventDateStart', 'desc'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        const fetchedEvents = querySnapshot.docs.map(doc => doc.data());
        
        if (querySnapshot.docs.length > 0) {
          setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
          setEventsList(fetchedEvents);
          sessionStorage.setItem('events_cache', JSON.stringify(fetchedEvents));
          if (querySnapshot.docs.length < 10) setHasMore(false);
        } else {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Failed to fetch events from Firestore:", error);
      }
    };
    fetchEvents();
  }, []);

  const loadMoreEvents = async () => {
    if (!lastDoc) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'event'),
        orderBy('eventDateStart', 'desc'),
        startAfter(lastDoc),
        limit(10)
      );
      const querySnapshot = await getDocs(q);
      const fetchedEvents = querySnapshot.docs.map(doc => doc.data());
      
      if (querySnapshot.docs.length > 0) {
        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setEventsList(prev => {
          const newList = [...prev, ...fetchedEvents];
          sessionStorage.setItem('events_cache', JSON.stringify(newList));
          return newList;
        });
        if (querySnapshot.docs.length < 10) setHasMore(false);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to load more events:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      eventName: '', eventHostest: '', setUpDate: '', eventDateStart: '',
      eventDateEnd: '', CleanUpDate: '', eventLocation: '', PIC: '', note: '', attendees: 0,
      imageLink: '', layoutImages: []
    });
  };

  const handleKeyviewUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingKeyview(true);
    try {
      const url = await uploadImageToImgBB(file);
      setFormData(prev => ({ ...prev, imageLink: url }));
    } catch (err) {
      alert("Keyview image upload failed.");
    } finally {
      setIsUploadingKeyview(false);
      e.target.value = ''; // reset input
    }
  };

  const handleLayoutUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingLayout(true);
    try {
      const url = await uploadImageToImgBB(file);
      setFormData(prev => ({ ...prev, layoutImages: [...prev.layoutImages, url] }));
    } catch (err) {
      alert("Layout image upload failed.");
    } finally {
      setIsUploadingLayout(false);
      e.target.value = ''; // reset input
    }
  };

  const removeLayoutImage = (indexToRemove) => {
    setFormData(prev => ({ ...prev, layoutImages: prev.layoutImages.filter((_, index) => index !== indexToRemove) }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    
    // Manual validation to ensure the form doesn't fail silently
    if (!formData.eventName || !formData.eventHostest || !formData.eventDateStart || !formData.eventLocation) {
      alert("Please fill out the Event Name, Host, Start Date, and Location.");
      return;
    }

    setIsSaving(true);
    try {
      const newEventData = {
        ...formData,
        attendees: Number(formData.attendees), // Ensure attendees is a number
        imageLink: formData.imageLink || '', 
      };
      const newId = await saveEventToFirestore(newEventData);
      const addedEvent = { ...newEventData, eventId: newId };
      setEventsList(prev => {
        const updatedList = [...prev, addedEvent];
        sessionStorage.setItem('events_cache', JSON.stringify(updatedList));
        return updatedList;
      });
      alert('Event successfully added to Firestore! Check console for details.');
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      if (error.code === 'unavailable' || error.message.includes('offline')) {
        alert('Failed to connect to Firebase. You appear to be offline or a browser extension is blocking the connection.');
      } else {
        alert('Failed to add event: ' + error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setShowAddModal(false);
    resetForm();
  };

  const inputStyle = {
    padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', 
    backgroundColor: 'transparent', color: 'inherit', fontSize: '1rem', marginBottom: '12px', width: '100%', boxSizing: 'border-box'
  };

  return (
    <div className="mobile-container">
      <div className="scroll-view">
        <div className="slider-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="slider-title">All Events</h2>
            {canEdit && (
              <button onClick={() => setShowAddModal(true)} style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#4caf50', color: 'white', border: 'none', cursor: 'pointer', marginRight: '16px' }}>
                Add Event
              </button>
            )}
          </div>
          
          <div className="events-scroll-view" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {eventsList.map((event) => (
              <EventCard key={event.eventId} event={event} />
            ))}
          </div>

          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', marginBottom: '16px' }}>
              <button onClick={loadMoreEvents} style={{ padding: '10px 20px', borderRadius: '8px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                Load Next 10 Events
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'var(--bg)', zIndex: 1000, overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
          <h2 style={{ marginTop: '20px', marginBottom: '20px' }}>Add New Event</h2>
          <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            <input name="eventName" placeholder="Event Name" value={formData.eventName} onChange={handleChange} style={inputStyle} />
            <input name="eventHostest" placeholder="Host" value={formData.eventHostest} onChange={handleChange} style={inputStyle} />
            <label style={{ marginBottom: '4px', fontSize: '0.9rem' }}>Setup Date</label>
            <input name="setUpDate" type="date" value={formData.setUpDate} onChange={handleChange} style={inputStyle} />
            <label style={{ marginBottom: '4px', fontSize: '0.9rem' }}>Start Date</label>
            <input name="eventDateStart" type="date" value={formData.eventDateStart} onChange={handleChange} style={inputStyle} />
            <label style={{ marginBottom: '4px', fontSize: '0.9rem' }}>End Date</label>
            <input name="eventDateEnd" type="date" value={formData.eventDateEnd} onChange={handleChange} style={inputStyle} />
            <label style={{ marginBottom: '4px', fontSize: '0.9rem' }}>Cleanup Date</label>
            <input name="CleanUpDate" type="date" value={formData.CleanUpDate} onChange={handleChange} style={inputStyle} />
            <input name="eventLocation" placeholder="Location" value={formData.eventLocation} onChange={handleChange} style={inputStyle} />
            <input name="PIC" placeholder="PIC (Person in Charge)" value={formData.PIC} onChange={handleChange} style={inputStyle} />
            <input name="attendees" type="number" placeholder="Attendees" value={formData.attendees} onChange={handleChange} style={inputStyle} />
            <textarea name="note" placeholder="Notes" value={formData.note} onChange={handleChange} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />
            
            <label style={{ marginBottom: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>Keyview Image</label>
            {formData.imageLink && <img src={formData.imageLink} alt="Keyview Preview" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />}
            <input type="file" accept="image/*" onChange={handleKeyviewUpload} style={inputStyle} disabled={isUploadingKeyview} />
            {isUploadingKeyview && <span style={{fontSize: '0.8rem', color: 'var(--accent)', marginTop: '-8px', marginBottom: '12px', display: 'block'}}>Uploading Keyview...</span>}

            <label style={{ marginBottom: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>Layout Images</label>
            {formData.layoutImages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {formData.layoutImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 'calc(50% - 4px)', height: '100px' }}>
                    <img src={img} alt={`Layout Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                    <button type="button" onClick={() => removeLayoutImage(idx)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleLayoutUpload} style={inputStyle} disabled={isUploadingLayout} />
            {isUploadingLayout && <span style={{fontSize: '0.8rem', color: 'var(--accent)', marginTop: '-8px', marginBottom: '12px', display: 'block'}}>Uploading Layout...</span>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', marginBottom: '40px' }}>
              <button type="button" onClick={handleCancel} style={{ flex: 1, padding: '12px', backgroundColor: '#f44336', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={isSaving} style={{ flex: 1, padding: '12px', backgroundColor: '#4caf50', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>{isSaving ? 'Saving...' : 'Save Event'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Events;
