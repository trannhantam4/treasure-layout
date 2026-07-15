import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, limit, orderBy, where, startAfter } from 'firebase/firestore';
import { db } from './firebase';
import { saveEventToFirestore, uploadImageToImgBB } from './Event';
import SearchInput from './SearchInput';
import EventCard from './EventCard';
import EventCardSkeleton from './EventCardSkeleton';
import Modal from './Modal';
import EventForm from './EventForm';
import BackToTopButton from './BackToTopButton';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';

function Events({ user }) {
  const [eventsList, setEventsList] = useState([]);
  const { t } = useTranslation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingKeyview, setIsUploadingKeyview] = useState(false);
  const [isUploadingLayout, setIsUploadingLayout] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef(null);
  const scrollViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
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

  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const clearDateFilters = () => {
    setStartDateFilter('');
    setEndDateFilter('');
  };

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        let q = query(
          collection(db, 'event'),
          orderBy('eventDateStart', 'desc')
        );

        if (startDateFilter) {
          q = query(q, where('eventDateStart', '>=', startDateFilter));
        }
        if (endDateFilter) {
          q = query(q, where('eventDateStart', '<=', endDateFilter));
        }

        q = query(q, limit(10));

        const querySnapshot = await getDocs(q);
        const fetchedEvents = querySnapshot.docs.map(doc => doc.data());
        
        if (querySnapshot.docs.length > 0) {
          setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
          setEventsList(fetchedEvents);
          if (!startDateFilter && !endDateFilter) {
            sessionStorage.setItem('events_cache', JSON.stringify(fetchedEvents));
          }
          setHasMore(querySnapshot.docs.length === 10);
        } else {
          setEventsList([]);
          setHasMore(false);
          setLastDoc(null);
        }
      } catch (error) {
        console.error("Failed to fetch events from Firestore:", error);
        setEventsList([]);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [startDateFilter, endDateFilter]);

  const loadMoreEvents = async () => {
    if (!lastDoc || loadingMore) return;
    
    setLoadingMore(true);
    try {
      let q = query(
        collection(db, 'event'),
        orderBy('eventDateStart', 'desc')
      );

      if (startDateFilter) {
        q = query(q, where('eventDateStart', '>=', startDateFilter));
      }
      if (endDateFilter) {
        q = query(q, where('eventDateStart', '<=', endDateFilter));
      }

      q = query(q, startAfter(lastDoc), limit(10));

      const querySnapshot = await getDocs(q);
      const fetchedEvents = querySnapshot.docs.map(doc => doc.data());
      
      if (querySnapshot.docs.length > 0) {
        setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
        setEventsList(prev => {
          const newList = [...prev, ...fetchedEvents];
          if (!startDateFilter && !endDateFilter) {
            sessionStorage.setItem('events_cache', JSON.stringify(newList));
          }
          return newList;
        });
        setHasMore(querySnapshot.docs.length === 10);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to load more events:", error);
    } finally {
      setLoadingMore(false);
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

  const handleExport = async () => {
    // Fetch all events for a complete export
    const allEvents = [];
    const querySnapshot = await getDocs(query(collection(db, 'event'), orderBy('eventDateStart', 'desc')));
    querySnapshot.forEach((doc) => {
      allEvents.push(doc.data());
    });

    const worksheet = XLSX.utils.json_to_sheet(allEvents.map(event => ({
      'Event Name': event.eventName,
      'Host': event.eventHostest,
      'Setup Date': event.setUpDate,
      'Start Date': event.eventDateStart,
      'End Date': event.eventDateEnd,
      'Cleanup Date': event.CleanUpDate,
      'Location': event.eventLocation,
      'PIC': event.PIC,
      'Attendees': event.attendees,
      'Note': event.note,
      'Keyview Image URL': event.imageLink,
      'Layout Images (comma-separated)': event.layoutImages.join(', '),
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Events');
    XLSX.writeFile(workbook, 'TreasureLayout_Events_Export.xlsx');
  };

  const handleDownloadTemplate = () => {
    const headers = [['Event Name', 'Host', 'Setup Date', 'Start Date', 'End Date', 'Cleanup Date', 'Location', 'PIC', 'Attendees', 'Note', 'Keyview Image URL', 'Layout Images (comma-separated)']];
    const worksheet = XLSX.utils.aoa_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, 'Event_Import_Template.xlsx');
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          alert("The Excel file is empty or in the wrong format.");
          return;
        }

        const importPromises = json.map(row => {
          const newEventData = {
            eventName: row['Event Name'] || '',
            eventHostest: row['Host'] || '',
            setUpDate: row['Setup Date'] || '',
            eventDateStart: row['Start Date'] || '',
            eventDateEnd: row['End Date'] || '',
            CleanUpDate: row['Cleanup Date'] || '',
            eventLocation: row['Location'] || '',
            PIC: row['PIC'] || '',
            note: row['Note'] || '',
            attendees: Number(row['Attendees']) || 0,
            imageLink: row['Keyview Image URL'] || '',
            layoutImages: row['Layout Images (comma-separated)'] ? row['Layout Images (comma-separated)'].split(',').map(url => url.trim()) : [],
          };
          return saveEventToFirestore(newEventData);
        });

        await Promise.all(importPromises);
        alert(`Successfully imported ${json.length} events! The event list will refresh.`);
        sessionStorage.removeItem('events_cache'); // Clear cache to force a refresh
        window.location.reload(); // Easiest way to show the new data
      } catch (error) {
        console.error("Error during import:", error);
        alert("An error occurred during the import process. Please check the console for details.");
      } finally {
        setIsImporting(false);
        e.target.value = ''; // Reset file input
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredEvents = eventsList.filter(event =>
    event.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.eventHostest.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mobile-container">
      <div className="scroll-view" ref={scrollViewRef}>
        <div className="slider-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <h2 className="slider-title">{t('allEvents')}</h2>
            {canEdit && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input type="file" ref={importFileRef} onChange={handleImport} style={{ display: 'none' }} accept=".xlsx, .xls" />
                <button onClick={() => importFileRef.current.click()} disabled={isImporting} className="btn btn-info btn-sm">
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
                <button onClick={handleExport} className="btn btn-warning btn-sm">
                  Export
                </button>
                 <button onClick={handleDownloadTemplate} className="btn btn-secondary btn-sm">
                  Template
                </button>
                <button onClick={() => setShowAddModal(true)} className="btn btn-success btn-sm">{t('addEvent')}</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
                <label className="form-label" style={{marginBottom: '4px', display: 'block'}}>Start Date</label>
                <input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} className="input-style" style={{ marginBottom: 0 }}/>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
                <label className="form-label" style={{marginBottom: '4px', display: 'block'}}>End Date</label>
                <input type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} className="input-style" style={{ marginBottom: 0 }}/>
            </div>
            {(startDateFilter || endDateFilter) && (
              <button onClick={clearDateFilters} className="btn btn-secondary">
                Clear
              </button>
            )}
          </div>
          <SearchInput searchTerm={searchTerm} setSearchTerm={setSearchTerm} placeholder={t('searchEventsPlaceholder')} />
          
          <div className="events-scroll-view" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <EventCardSkeleton key={index} />
                ))
              : filteredEvents.map((event) => (
                  <EventCard key={event.eventId} event={event} />
                ))}
          </div>

          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px', marginBottom: '16px' }}>
              <button onClick={loadMoreEvents} disabled={loadingMore} className="btn btn-primary" style={{padding: '10px 20px'}}>
                {loadingMore ? 'Loading...' : 'Load Next 10 Events'}
              </button>
            </div>
          )}
        </div>
      </div>

      <BackToTopButton scrollableRef={scrollViewRef} />

      {/* Add Event Modal */}
      {showAddModal && (
        <Modal isOpen={showAddModal} onClose={handleCancel} title="Add New Event">
          <EventForm
            formData={formData}
            onFormChange={handleChange}
            onKeyviewUpload={handleKeyviewUpload}
            onLayoutUpload={handleLayoutUpload}
            removeLayoutImage={removeLayoutImage}
            isUploadingKeyview={isUploadingKeyview}
            isUploadingLayout={isUploadingLayout}
            onSubmit={handleAddSubmit}
            onCancel={handleCancel}
            isSaving={isSaving}
            submitText="Save Event"
          />
        </Modal>
      )}
    </div>
  );
}

export default Events;
