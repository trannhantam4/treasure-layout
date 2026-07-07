import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { uploadEventImageAndUpdate, uploadKeyviewImageAndUpdate, updateEventInFirestore, deleteEventFromFirestore, uploadImageToImgBB } from './Event';

import Logo from './Logo.png';

const pinImages = {
  default: 'https://cdn-icons-png.flaticon.com/512/149/149059.png', // Red pin
  star: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png',   // Gold star
  logo: Logo,
};

function EventDetail({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingKeyview, setIsUploadingKeyview] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(null);
  const [selectedPinType, setSelectedPinType] = useState('default');
  const [pinSize, setPinSize] = useState(30); // Default pin size
  const [draggingPinIndex, setDraggingPinIndex] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingKeyviewModal, setIsUploadingKeyviewModal] = useState(false);
  const [isUploadingLayoutModal, setIsUploadingLayoutModal] = useState(false);
  const fileInputRef = useRef(null);
  const keyviewFileInputRef = useRef(null);

  // Find the event locally first, or initialize to null
  const [event, setEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(!event);

  const userRole = user?.role?.toLowerCase();
  const canEdit = userRole === 'admin' || userRole === 'manager';
  const imageContainerRef = useRef(null);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!event) {
        try {
          const docRef = doc(db, 'event', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setEvent(docSnap.data());
          }
        } catch (error) {
          console.error("Error fetching event:", error);
        } finally {
          setLoadingEvent(false);
        }
      }
    };
    fetchEvent();
  }, [id, event]);

  // Keep a local state for the images to show updates immediately
  const [currentLayoutImages, setCurrentLayoutImages] = useState(event?.layoutImages || []);
  const [currentKeyviewImage, setCurrentKeyviewImage] = useState(event?.imageLink || '');

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

  useEffect(() => {
    if (event) {
      setCurrentLayoutImages(event.layoutImages || []);
      setCurrentKeyviewImage(event.imageLink || '');
      setFormData({
        eventName: event.eventName || '', eventHostest: event.eventHostest || '',
        setUpDate: event.setUpDate || '', eventDateStart: event.eventDateStart || '',
        eventDateEnd: event.eventDateEnd || '', CleanUpDate: event.CleanUpDate || '',
        eventLocation: event.eventLocation || '', PIC: event.PIC || '',
        note: event.note || '', attendees: event.attendees || 0,
        imageLink: event.imageLink || '', layoutImages: event.layoutImages || []
      });
    }
  }, [event]);

  if (loadingEvent) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>Loading event...</div>;
  }

  if (!event) {
    return (
      <section id="center">
        <h2>Event not found</h2>
        <button onClick={() => navigate(-1)} className="counter">Go Back</button>
      </section>
    );
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const newImageUrl = await uploadEventImageAndUpdate(file, id);
      setCurrentLayoutImages(prev => [...prev, newImageUrl]);
    } catch (error) {
      alert("Image upload failed. See console for details.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyviewImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploadingKeyview(true);
      const newImageUrl = await uploadKeyviewImageAndUpdate(file, id);
      setCurrentKeyviewImage(newImageUrl);
    } catch (error) {
      alert("Keyview image upload failed. See console for details.");
    } finally {
      setIsUploadingKeyview(false);
      if (keyviewFileInputRef.current) keyviewFileInputRef.current.value = '';
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleKeyviewUploadModal = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingKeyviewModal(true);
    try {
      const url = await uploadImageToImgBB(file);
      setFormData(prev => ({ ...prev, imageLink: url }));
    } catch (err) {
      alert("Keyview image upload failed.");
    } finally {
      setIsUploadingKeyviewModal(false);
      e.target.value = ''; // reset input
    }
  };

  const handleLayoutUploadModal = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingLayoutModal(true);
    try {
      const url = await uploadImageToImgBB(file);
      setFormData(prev => ({ ...prev, layoutImages: [...prev.layoutImages, url] }));
    } catch (err) {
      alert("Layout image upload failed.");
    } finally {
      setIsUploadingLayoutModal(false);
      e.target.value = ''; // reset input
    }
  };

  const removeLayoutImageModal = (indexToRemove) => {
    setFormData(prev => ({ ...prev, layoutImages: prev.layoutImages.filter((_, index) => index !== indexToRemove) }));
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    
    // Manual validation to ensure the form doesn't fail silently
    if (!formData.eventName || !formData.eventHostest || !formData.eventDateStart || !formData.eventLocation) {
      alert("Please fill out the Event Name, Host, Start Date, and Location.");
      return;
    }

    setIsSaving(true);
    try {
      await updateEventInFirestore(id, formData);
      alert('Event successfully updated in Firestore! Check console for details.');
      setCurrentKeyviewImage(formData.imageLink);
      setCurrentLayoutImages(formData.layoutImages);
      setEvent(prev => ({ ...prev, ...formData }));
      sessionStorage.removeItem('events_cache');
      setShowUpdateModal(false);
    } catch (error) {
      if (error.code === 'unavailable' || error.message.includes('offline')) {
        alert('Failed to connect to Firebase. You appear to be offline or a browser extension is blocking the connection.');
      } else {
        alert('Failed to update event: ' + error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    try {
      await deleteEventFromFirestore(id);
      sessionStorage.removeItem('events_cache');
      alert('Event deleted successfully!');
      navigate('/events');
    } catch (error) {
      if (error.code === 'unavailable' || error.message.includes('offline')) {
        alert('Failed to connect to Firebase. You appear to be offline or a browser extension is blocking the connection.');
      } else {
        alert('Failed to delete event: ' + error.message);
      }
    }
  };

  const inputStyle = {
    padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', 
    backgroundColor: 'transparent', color: 'inherit', fontSize: '1rem', marginBottom: '12px', width: '100%', boxSizing: 'border-box'
  };

  const handleFullscreenClick = async (e) => {
    if (!canEdit || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    const newPin = { x: xPercent, y: yPercent, type: selectedPinType };

    // Update local state immediately for responsiveness
    const updatedLayoutImages = [...currentLayoutImages];
    const currentImageObject = updatedLayoutImages[fullscreenImageIndex] || fullscreenImage;
    let newImageObject;

    if (typeof currentImageObject === 'string') {
      newImageObject = { url: currentImageObject, pins: [newPin] };
    } else {
      const existingPins = currentImageObject.pins || [];
      newImageObject = { ...currentImageObject, url: currentImageObject.url, pins: [...existingPins, newPin] };
    }
    updatedLayoutImages[fullscreenImageIndex] = newImageObject;

    setFullscreenImage(newImageObject); // Instantly update the fullscreen view with the new pin
    setCurrentLayoutImages(updatedLayoutImages);

    // Persist to Firestore
    try {
      const eventRef = doc(db, 'event', id);
      await updateDoc(eventRef, { layoutImages: updatedLayoutImages });
      sessionStorage.removeItem('events_cache');
    } catch (error) {
      console.error("Failed to save pin:", error);
      alert("Could not save the new pin. Please try again.");
    }
  };

  const handlePinDelete = async (e, pinIndexToDelete) => {
    e.stopPropagation(); // Prevent handleFullscreenClick from firing

    if (!canEdit) return;

    // Confirmation before deleting
    if (!window.confirm("Are you sure you want to delete this pin?")) {
      return;
    }

    // Update local state for immediate feedback
    const updatedLayoutImages = [...currentLayoutImages];
    const imageObject = { ...updatedLayoutImages[fullscreenImageIndex] };

    if (!imageObject.pins) return;

    const updatedPins = imageObject.pins.filter((_, index) => index !== pinIndexToDelete);
    imageObject.pins = updatedPins;
    updatedLayoutImages[fullscreenImageIndex] = imageObject;
    
    setCurrentLayoutImages(updatedLayoutImages);
    setFullscreenImage(imageObject); // Update the fullscreen view instantly

    // Persist to Firestore
    try {
      const eventRef = doc(db, 'event', id);
      await updateDoc(eventRef, { layoutImages: updatedLayoutImages });
      sessionStorage.removeItem('events_cache');
    } catch (error) {
      console.error("Failed to delete pin:", error);
      alert("Could not delete the pin. Please try again.");
    }
  };

  const handlePinMouseDown = (e, index) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingPinIndex(index);
  };

  const handleMouseUp = async (e) => {
    if (draggingPinIndex === null) return;
    
    setDraggingPinIndex(null);

    // Persist the final position to Firestore
    try {
      const eventRef = doc(db, 'event', id);
      await updateDoc(eventRef, { layoutImages: currentLayoutImages });
      sessionStorage.removeItem('events_cache');
    } catch (error) {
      console.error("Failed to save pin position:", error);
      alert("Could not save the new pin position. Please try again.");
    }
  };

  const handleMouseMove = (e) => {
    if (draggingPinIndex === null || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    // Constrain the pin within the image container
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    // Create a new state to avoid direct mutation
    const updatedLayoutImages = [...currentLayoutImages];
    const imageObject = { ...updatedLayoutImages[fullscreenImageIndex] };
    
    if (imageObject.pins && imageObject.pins[draggingPinIndex]) {
      const updatedPins = [...imageObject.pins];
      updatedPins[draggingPinIndex] = {
        ...updatedPins[draggingPinIndex],
        x: xPercent,
        y: yPercent,
      };
      imageObject.pins = updatedPins;
      
      // Update the state for both the detail view and the fullscreen modal
      updatedLayoutImages[fullscreenImageIndex] = imageObject;
      setCurrentLayoutImages(updatedLayoutImages);
      setFullscreenImage(imageObject);
    }
  };


  return (
    <div className="mobile-container">
      {/* Fullscreen Modal Overlay */}
      {fullscreenImage && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}
          onClick={() => { 
            if (draggingPinIndex === null) {
              setFullscreenImage(null); setFullscreenImageIndex(null); 
            }
          }}
        >
          {canEdit && (
            <div style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 1, background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={(e) => { e.stopPropagation(); setSelectedPinType('default'); }} style={{ background: selectedPinType === 'default' ? 'var(--accent)' : 'transparent', border: '1px solid white', borderRadius: '4px', padding: '4px' }}>
                  <img src={pinImages.default} alt="Default Pin" style={{ width: '24px', height: '24px', display: 'block' }} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setSelectedPinType('star'); }} style={{ background: selectedPinType === 'star' ? 'var(--accent)' : 'transparent', border: '1px solid white', borderRadius: '4px', padding: '4px' }}>
                  <img src={pinImages.star} alt="Star Pin" style={{ width: '24px', height: '24px', display: 'block' }} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setSelectedPinType('logo'); }} style={{ background: selectedPinType === 'logo' ? 'var(--accent)' : 'transparent', border: '1px solid white', borderRadius: '4px', padding: '4px' }}>
                  <img src={pinImages.logo} alt="Logo Pin" style={{ width: '24px', height: '24px', display: 'block' }} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <label style={{ color: 'white', fontSize: '12px', fontWeight: '500' }}>Pin Size</label>
                <input 
                  type="range" 
                  min="15" max="60" 
                  value={pinSize} 
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => { e.stopPropagation(); setPinSize(Number(e.target.value)); }}
                />
              </div>
            </div>
          )}
          <button 
            style={{
              position: 'absolute', top: '20px', right: '20px',
              background: 'rgba(255,255,255,0.2)', color: '#fff',
              border: 'none', borderRadius: '50%', width: '40px', height: '40px',
              fontSize: '20px', cursor: 'pointer', display: 'flex',
              justifyContent: 'center', alignItems: 'center'
            }}
            onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); setFullscreenImageIndex(null); }}
          > 
            ✕
          </button>
          <div
            ref={imageContainerRef}
            onClick={(e) => { if (draggingPinIndex === null) handleFullscreenClick(e); }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} // End drag if mouse leaves container
            style={{
              position: 'relative',
              width: '95vw',
              height: '95vh',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: canEdit && draggingPinIndex === null ? 'crosshair' : (draggingPinIndex !== null ? 'grabbing' : 'default'),
            }}
          >
            <img 
              src={fullscreenImage.url} 
              alt="Fullscreen Layout" 
              style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
            />
            {fullscreenImage.pins?.map((pin, index) => {
              const style = {
                position: 'absolute',
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: 'translate(-50%, -50%)',
                width: `${pinSize}px`, height: `${pinSize}px`, 
                cursor: canEdit ? (draggingPinIndex === index ? 'grabbing' : 'grab') : 'default',
              };
              if (pin.type === 'star') {
                style.filter = 'drop-shadow(0px 0px 2px rgba(0, 0, 0, 0.9))';
              }
              return (
                <img 
                  key={index}
                  src={pinImages[pin.type] || pinImages.default}
                  alt="Pin"
                  onMouseDown={canEdit ? (e) => handlePinMouseDown(e, index) : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canEdit && window.confirm("Are you sure you want to delete this pin?")) {
                      handlePinDelete(e, index);
                    }
                  }}
                  style={style}
                />
              );
            })}
          </div>
        </div>
      )}

      <button onClick={() => navigate(-1)} className="counter" style={{ alignSelf: 'flex-start', marginBottom: '16px' }}>
        &larr; Back
      </button>
      <div className="scroll-view">
        {/* Main Event Keyview Image */}
        <div style={{ position: 'relative', width: '100%', height: '250px' }}>
          <img 
            src={currentKeyviewImage} 
            alt={event.eventName} 
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} 
          />
          {canEdit && (
            <>
              <input 
                type="file" 
                accept="image/*" 
                ref={keyviewFileInputRef} 
                onChange={handleKeyviewImageUpload} 
                style={{ display: 'none' }} 
              />
              <button 
                onClick={() => keyviewFileInputRef.current.click()}
                disabled={isUploadingKeyview}
                style={{
                  position: 'absolute', bottom: '12px', right: '12px',
                  padding: '8px 16px', borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.7)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.4)', cursor: 'pointer',
                  fontSize: '0.9rem', fontWeight: '500', backdropFilter: 'blur(4px)'
                }}
              >
                {isUploadingKeyview ? 'Uploading...' : 'Change Keyview'}
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: '16px', textAlign: 'left' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 8px 0' }}>{event.eventName}</h1>
          <p style={{ fontSize: '1.1rem', marginBottom: '8px', opacity: 0.8 }}>Hosted by: {event.eventHostest}</p>
          <p style={{ fontSize: '1rem', color: 'var(--accent)', fontWeight: '500', marginBottom: '8px' }}>
            {event.eventDateStart} to {event.eventDateEnd}
          </p>
          <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}><strong>Location:</strong> {event.eventLocation}</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}><strong>Setup:</strong> {event.setUpDate} | <strong>Cleanup:</strong> {event.CleanUpDate}</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}><strong>PIC:</strong> {event.PIC}</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}><strong>Attendees:</strong> {event.attendees}</p>
          <p style={{ fontSize: '0.9rem', marginBottom: '24px' }}><strong>Note:</strong> {event.note}</p>
          <button className="counter" style={{ width: '100%' }}>Register for Event</button>

          {/* Admin Action Buttons */}
          {canEdit && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setShowUpdateModal(true)} style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#ff9800', color: 'white', border: 'none', cursor: 'pointer' }}>Update Event</button>
              <button onClick={handleDeleteEvent} style={{ flex: 1, padding: '10px', borderRadius: '8px', backgroundColor: '#f44336', color: 'white', border: 'none', cursor: 'pointer' }}>Delete Event</button>
            </div>
          )}
        </div>

        {/* Layout Images Section at the bottom */}
        <div style={{ marginTop: '24px', textAlign: 'left' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>Event Layouts</h2>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            {currentLayoutImages.length > 0 ? (
              currentLayoutImages.map((img, index) => (
                <div key={index} style={{ position: 'relative', width: 'calc(50% - 6px)', height: '150px', backgroundColor: 'var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <img 
                    src={typeof img === 'string' ? img : img.url} 
                    alt={`Event Layout ${index + 1}`} 
                    onClick={() => {
                      const imageObject = typeof img === 'string' ? { url: img, pins: [] } : img;
                      setFullscreenImage(imageObject);
                      setFullscreenImageIndex(index);
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }} 
                  />
                </div>
              ))
            ) : (
              <div style={{ width: '100%', padding: '32px 0', textAlign: 'center', color: 'var(--text-h)', backgroundColor: 'var(--border)', borderRadius: '12px' }}>
                No layout images available
              </div>
            )}
          </div>

          {canEdit && (
            <>
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                style={{ display: 'none' }} 
              />
              <button 
                onClick={() => fileInputRef.current.click()}
                disabled={isUploading}
                style={{
                  padding: '8px 16px', borderRadius: '8px',
                  backgroundColor: 'var(--accent)', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  fontSize: '0.9rem', fontWeight: '500', width: '100%'
                }}
              >
                {isUploading ? 'Uploading...' : 'Add New Layout'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Update Event Modal */}
      {showUpdateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'var(--bg)', zIndex: 1000, overflowY: 'auto', padding: '20px', boxSizing: 'border-box' }}>
          <h2 style={{ marginTop: '20px', marginBottom: '20px' }}>Update Event</h2>
          <form onSubmit={handleUpdateSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            <input name="eventName" placeholder="Event Name" value={formData.eventName} onChange={handleFormChange} style={inputStyle} />
            <input name="eventHostest" placeholder="Host" value={formData.eventHostest} onChange={handleFormChange} style={inputStyle} />
            <label style={{ marginBottom: '4px', fontSize: '0.9rem' }}>Setup Date</label>
            <input name="setUpDate" type="date" value={formData.setUpDate} onChange={handleFormChange} style={inputStyle} />
            <label style={{ marginBottom: '4px', fontSize: '0.9rem' }}>Start Date</label>
            <input name="eventDateStart" type="date" value={formData.eventDateStart} onChange={handleFormChange} style={inputStyle} />
            <label style={{ marginBottom: '4px', fontSize: '0.9rem' }}>End Date</label>
            <input name="eventDateEnd" type="date" value={formData.eventDateEnd} onChange={handleFormChange} style={inputStyle} />
            <label style={{ marginBottom: '4px', fontSize: '0.9rem' }}>Cleanup Date</label>
            <input name="CleanUpDate" type="date" value={formData.CleanUpDate} onChange={handleFormChange} style={inputStyle} />
            <input name="eventLocation" placeholder="Location" value={formData.eventLocation} onChange={handleFormChange} style={inputStyle} />
            <input name="PIC" placeholder="PIC (Person in Charge)" value={formData.PIC} onChange={handleFormChange} style={inputStyle} />
            <input name="attendees" type="number" placeholder="Attendees" value={formData.attendees} onChange={handleFormChange} style={inputStyle} />
            <textarea name="note" placeholder="Notes" value={formData.note} onChange={handleFormChange} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} />

            <label style={{ marginBottom: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>Keyview Image</label>
            {formData.imageLink && <img src={formData.imageLink} alt="Keyview Preview" style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />}
            <input type="file" accept="image/*" onChange={handleKeyviewUploadModal} style={inputStyle} disabled={isUploadingKeyviewModal} />
            {isUploadingKeyviewModal && <span style={{fontSize: '0.8rem', color: 'var(--accent)', marginTop: '-8px', marginBottom: '12px', display: 'block'}}>Uploading Keyview...</span>}

            <label style={{ marginBottom: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>Layout Images</label>
            {formData.layoutImages && formData.layoutImages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {formData.layoutImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', width: 'calc(50% - 4px)', height: '100px' }}>
                    <img src={img} alt={`Layout Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                    <button type="button" onClick={() => removeLayoutImageModal(idx)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,0,0,0.8)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" accept="image/*" onChange={handleLayoutUploadModal} style={inputStyle} disabled={isUploadingLayoutModal} />
            {isUploadingLayoutModal && <span style={{fontSize: '0.8rem', color: 'var(--accent)', marginTop: '-8px', marginBottom: '12px', display: 'block'}}>Uploading Layout...</span>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', marginBottom: '40px' }}>
              <button type="button" onClick={() => setShowUpdateModal(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#f44336', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={isSaving} style={{ flex: 1, padding: '12px', backgroundColor: '#4caf50', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }}>{isSaving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default EventDetail;
