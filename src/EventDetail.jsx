import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from './firebase';
import Modal, { modalOverlayStyle, modalCardStyle } from './Modal';
import { useTranslation } from 'react-i18next';
import EventForm from './EventForm';
import BackToTopButton from './BackToTopButton';
import { uploadEventImageAndUpdate, uploadKeyviewImageAndUpdate, updateEventInFirestore, deleteEventFromFirestore, uploadImageToImgBB, INITIAL_EVENT_FORM } from './Event';
import QRCode from 'qrcode';
import { getBrandsForEvent, removeAssignment, updateAssignment, setTreasureHolder, getOrCreateStampTicket } from './Brand';
import AssignBrandModal, { downloadBrandAssignmentTemplate } from './AssignBrandModal';
import { useBrands } from './hooks/useBrands';
import StampTicket from './StampTicket';
import { getCachedEventDetail, cacheEventDetail, getCachedUserRegistration, cacheUserRegistration, cacheStampTicket, getCachedTreasureHuntOptIn, cacheTreasureHuntOptIn } from './storage';
import { canManage } from './utils/auth';
import { handleFirebaseError } from './utils/firebaseErrors';
import { stampKey } from './utils/keys';
import BrandLogo from './components/BrandLogo';
import EmptyState from './components/EmptyState';

import Logo from './Logo.png';

const pinImages = {
  default: 'https://cdn-icons-png.flaticon.com/512/149/149059.png', // Red pin
  star: 'https://cdn-icons-png.flaticon.com/512/1828/1828884.png',   // Gold star
  logo: Logo,
};

function EventDetail({ user }) {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const keyviewFileInputRef = useRef(null);
  const hasDraggedRef = useRef(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingKeyview, setIsUploadingKeyview] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(null);
  const [selectedPinType, setSelectedPinType] = useState('default');
  const [pinSize, setPinSize] = useState(30);
  const [draggingPinIndex, setDraggingPinIndex] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUploadingKeyviewModal, setIsUploadingKeyviewModal] = useState(false);
  const [isUploadingLayoutModal, setIsUploadingLayoutModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [assignedBrands, setAssignedBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [showAllBrands, setShowAllBrands] = useState(false);
  const BRAND_COLLAPSE_LIMIT = 5;
  const [showAssignBrandModal, setShowAssignBrandModal] = useState(false);
  const [assignModalTab, setAssignModalTab] = useState('single');
  const { brands: globalBrands } = useBrands();
  const [userRegState, setUserRegState] = useState(null);
  const [showRegModal, setShowRegModal] = useState(false);
  const [joinTreasureHunt, setJoinTreasureHunt] = useState(true);
  const [userJoinedHunt, setUserJoinedHunt] = useState(false);
  const [selectedBrandDetail, setSelectedBrandDetail] = useState(null);
  const [editBrandPosition, setEditBrandPosition] = useState('');
  const [savingBrandPosition, setSavingBrandPosition] = useState(false);
  const [brandPositionSavedMsg, setBrandPositionSavedMsg] = useState(false);

  useEffect(() => {
    if (selectedBrandDetail) {
      setEditBrandPosition(selectedBrandDetail.position || '');
      setBrandPositionSavedMsg(false);
    }
  }, [selectedBrandDetail?.combinedId]);

  // QR canvas refs: keyed by combinedId
  const qrCanvasRefs = useRef({});

  // Find the event locally first, or initialize to null
  const [event, setEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(!event);
  const [currentLayoutImages, setCurrentLayoutImages] = useState([]);
  const [currentKeyviewImage, setCurrentKeyviewImage] = useState('');
  const [formData, setFormData] = useState(INITIAL_EVENT_FORM);

  const canEdit = canManage(user);
  const treasureBrands = assignedBrands.filter((b) => b.isTreasureHolder);
  const displayedBrands = showAllBrands ? assignedBrands : assignedBrands.slice(0, BRAND_COLLAPSE_LIMIT);
  
  const isRegistered = user ? (userRegState ?? event?.registeredUsers?.includes(user?.uid)) : false;

  // Display registered count starting at 100+ minimum, updating in blocks of 100 once registered count exceeds 100
  const rawCount = event?.registeredCount ?? (event?.registeredUsers?.length || 0);
  const baseCount = Math.max(100, Math.floor(rawCount / 100) * 100);
  const displayRegisteredCount = `${baseCount}+`;

  const imageContainerRef = useRef(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const fetchEvent = async () => {
      // 1. Check IndexedDB device storage first (0ms load time, 0 server reads)
      try {
        const cached = await getCachedEventDetail(id);
        if (cached) {
          setEvent(cached);
          setCurrentLayoutImages(cached.layoutImages || []);
          setCurrentKeyviewImage(cached.imageLink || '');
          setLoadingEvent(false);
        }
      } catch {
        /* ignore cache read error */
      }

      if (user) {
        getCachedUserRegistration(id, user.uid).then((res) => {
          if (res !== null) setUserRegState(res);
        }).catch(() => {});
        getCachedTreasureHuntOptIn(id, user.uid).then((res) => {
          if (res !== null) setUserJoinedHunt(res);
        }).catch(() => {});
      }

      try {
        const docRef = doc(db, 'event', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEvent(data);
          cacheEventDetail(id, data);
          setCurrentLayoutImages(data.layoutImages || []);
          setCurrentKeyviewImage(data.imageLink || '');
          setFormData({
            eventName: data.eventName || '', eventHostest: data.eventHostest || '',
            setUpDate: data.setUpDate || '', eventDateStart: data.eventDateStart || '',
            eventDateEnd: data.eventDateEnd || '', CleanUpDate: data.CleanUpDate || '',
            eventLocation: data.eventLocation || '', PIC: data.PIC || '',
            note: data.note || '', attendees: data.attendees || 0,
            imageLink: data.imageLink || '', layoutImages: data.layoutImages || []
          });
        }
      } catch (error) {
        console.error("Error fetching event:", error);
      } finally {
        setLoadingEvent(false);
      }
    };
    fetchEvent();
  }, [id, user]);

  // Load assignments for this event (moved above early return to satisfy Rules of Hooks)
  useEffect(() => {
    if (!id) return;
    getBrandsForEvent(id)
      .then((data) => setAssignedBrands(data))
      .catch((err) => console.error('Error loading brand assignments:', err))
      .finally(() => setLoadingBrands(false));
  }, [id]);

  // Render QR codes into canvas elements whenever treasure holders change (moved above early return to satisfy Rules of Hooks)
  useEffect(() => {
    const treasureHolders = assignedBrands.filter((a) => a.isTreasureHolder);
    treasureHolders.forEach((a) => {
      const canvas = qrCanvasRefs.current[a.combinedId];
      if (canvas) {
        QRCode.toCanvas(canvas, a.combinedId, { width: 180, margin: 1 }, (err) => {
          if (err) console.error('QR generation error:', err);
        });
      }
    });
  }, [assignedBrands]);

  if (loadingEvent) {
    return <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>{t('loading')}</div>;
  }

  if (!event) {
    return (
      <section id="center">
        <h2>Event not found</h2>
        <button onClick={() => navigate(-1)} className="counter">{t('back')}</button>
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
    } catch {
      alert("Image upload failed. See console for details.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRegister = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (isRegistered) {
      // Un-register directly
      const eventRef = doc(db, 'event', id);
      try {
        await updateDoc(eventRef, {
          registeredUsers: arrayRemove(user.uid),
          registeredCount: increment(-1)
        });
        setEvent(prev => {
          const currentCount = prev.registeredCount ?? (prev.registeredUsers?.length || 0);
          return {
            ...prev,
            registeredCount: Math.max(0, currentCount - 1),
            registeredUsers: (prev.registeredUsers || []).filter(uid => uid !== user.uid)
          };
        });
        setUserRegState(false);
        setUserJoinedHunt(false);
        cacheUserRegistration(id, user.uid, false);
        cacheTreasureHuntOptIn(id, user.uid, false);
        alert('You have unregistered from the event.');
      } catch (error) {
        console.error("Error unregistering:", error);
        alert("There was an issue. Please try again.");
      }
    } else {
      // Show registration modal with treasure hunt option
      setJoinTreasureHunt(treasureBrands.length > 0);
      setShowRegModal(true);
    }
  };

  const handleConfirmRegister = async () => {
    const eventRef = doc(db, 'event', id);
    setShowRegModal(false);

    try {
      await updateDoc(eventRef, {
        registeredUsers: arrayUnion(user.uid),
        registeredCount: increment(1)
      });
      setEvent(prev => {
        const currentCount = prev.registeredCount ?? (prev.registeredUsers?.length || 0);
        return {
          ...prev,
          registeredCount: currentCount + 1,
          registeredUsers: [...(prev.registeredUsers || []), user.uid]
        };
      });
      setUserRegState(true);
      cacheUserRegistration(id, user.uid, true);

      // Create treasure hunt ticket if opted in and there are brands
      if (joinTreasureHunt && treasureBrands.length > 0) {
        setUserJoinedHunt(true);
        cacheTreasureHuntOptIn(id, user.uid, true);
        try {
          const ticketData = await getOrCreateStampTicket(id, user.uid, event.eventName, treasureBrands);
          const ticketId = stampKey(id, user.uid);
          cacheStampTicket(ticketId, ticketData);
        } catch (err) {
          console.error('Error creating stamp ticket:', err);
        }
      } else {
        cacheTreasureHuntOptIn(id, user.uid, false);
      }

      alert(joinTreasureHunt && treasureBrands.length > 0
        ? 'Registered! Your Treasure Hunt card is ready below.'
        : 'You have successfully registered for the event!');
    } catch (error) {
      console.error("Error registering:", error);
      alert("There was an issue. Please try again.");
    }
  };

  const handleJoinTreasureHuntDirectly = async () => {
    if (!user) return;
    setUserJoinedHunt(true);
    cacheTreasureHuntOptIn(id, user.uid, true);
    try {
      const ticketData = await getOrCreateStampTicket(id, user.uid, event.eventName, treasureBrands);
      const ticketId = stampKey(id, user.uid);
      cacheStampTicket(ticketId, ticketData);
      alert('Joined! Your Treasure Hunt card is ready below.');
    } catch (err) {
      console.error('Error creating stamp ticket:', err);
      alert('Failed to start Treasure Hunt. Please try again.');
      setUserJoinedHunt(false);
      cacheTreasureHuntOptIn(id, user.uid, false);
    }
  };

  const handleKeyviewImageUpload = async (e) => {
    if (!canEdit) {
      alert('Unauthorized: Only Admin and Manager roles can update keyview image.');
      return;
    }
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploadingKeyview(true);
      const newImageUrl = await uploadKeyviewImageAndUpdate(file, id);
      setCurrentKeyviewImage(newImageUrl);
    } catch {
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
    if (!canEdit) {
      alert('Unauthorized: Only Admin and Manager roles can update keyview image.');
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingKeyviewModal(true);
    try {
      const url = await uploadImageToImgBB(file);
      setFormData(prev => ({ ...prev, imageLink: url }));
    } catch {
      alert("Keyview image upload failed.");
    } finally {
      setIsUploadingKeyviewModal(false);
      e.target.value = ''; // reset input
    }
  };
  
  const handleLayoutUploadModal = async (e) => {
    if (!canEdit) {
      alert('Unauthorized: Only Admin and Manager roles can upload layout images.');
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingLayoutModal(true);
    try {
      const url = await uploadImageToImgBB(file);
      setFormData(prev => ({ ...prev, layoutImages: [...prev.layoutImages, url] }));
    } catch {
      alert("Layout image upload failed.");
    } finally {
      setIsUploadingLayoutModal(false);
      e.target.value = ''; // reset input
    }
  };

  const removeLayoutImageModal = (indexToRemove) => {
    if (!canEdit) return;
    setFormData(prev => ({ ...prev, layoutImages: prev.layoutImages.filter((_, index) => index !== indexToRemove) }));
  };

  const handleDeleteLayoutImage = async (indexToDelete) => {
    if (!canEdit) {
      alert('Unauthorized: Only Admin and Manager roles can delete layout images.');
      return;
    }
    if (!window.confirm("Are you sure you want to delete this layout picture?")) return;
    const updatedImages = currentLayoutImages.filter((_, idx) => idx !== indexToDelete);
    try {
      const eventRef = doc(db, 'event', id);
      await updateDoc(eventRef, { layoutImages: updatedImages });
      setCurrentLayoutImages(updatedImages);
      setEvent(prev => ({ ...prev, layoutImages: updatedImages }));
      setFormData(prev => ({ ...prev, layoutImages: updatedImages }));
      if (fullscreenImageIndex === indexToDelete) {
        setFullscreenImage(null);
        setFullscreenImageIndex(null);
      }
      alert('Layout image deleted successfully.');
    } catch (error) {
      console.error('Failed to delete layout image:', error);
      alert('Failed to delete layout image.');
    }
  };

  const handleReplaceLayoutImage = async (indexToReplace, file) => {
    if (!canEdit) {
      alert('Unauthorized: Only Admin and Manager roles can update layout images.');
      return;
    }
    if (!file) return;
    try {
      setIsUploading(true);
      const newUrl = await uploadImageToImgBB(file);
      const updatedImages = [...currentLayoutImages];
      const oldItem = updatedImages[indexToReplace];
      if (typeof oldItem === 'object' && oldItem !== null) {
        updatedImages[indexToReplace] = { ...oldItem, url: newUrl };
      } else {
        updatedImages[indexToReplace] = newUrl;
      }
      const eventRef = doc(db, 'event', id);
      await updateDoc(eventRef, { layoutImages: updatedImages });
      setCurrentLayoutImages(updatedImages);
      setEvent(prev => ({ ...prev, layoutImages: updatedImages }));
      setFormData(prev => ({ ...prev, layoutImages: updatedImages }));
      alert('Layout image updated successfully!');
    } catch (error) {
      console.error('Failed to replace layout image:', error);
      alert('Failed to update layout image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      alert('Unauthorized: Only Admin and Manager roles can update event details.');
      return;
    }
    
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
      setShowUpdateModal(false);
    } catch (error) {
      handleFirebaseError(error, 'update event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteEventFromFirestore(id);
      alert('Event deleted successfully!');
      navigate('/events');
    } catch (error) {
      handleFirebaseError(error, 'delete event');
    }
  };



  const handleBrandAssigned = (assignmentOrArray) => {
    if (Array.isArray(assignmentOrArray)) {
      setAssignedBrands((prev) => [...prev, ...assignmentOrArray]);
    } else {
      setAssignedBrands((prev) => [...prev, assignmentOrArray]);
    }
  };

  const handleExportAssignedBrands = async () => {
    if (assignedBrands.length === 0) {
      alert('No brands assigned to this event yet.');
      return;
    }
    const XLSX = await import('xlsx');
    const rows = assignedBrands.map((a) => ({
      'Brand ID': a.brandId,
      'Brand Name': a.brandName,
      'Rank': a.rank,
      'Booth Position': a.position || '',
      'Treasure Holder': a.isTreasureHolder ? 'Yes' : 'No',
      'Field of Work': a.fieldOfWork || '',
      'Assigned At': a.assignedAt ? new Date(a.assignedAt).toLocaleString() : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 15 },
      { wch: 18 },
      { wch: 18 },
      { wch: 25 },
      { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assigned Brands');
    const safeEventName = (event?.eventName || 'Event').replace(/[/\\?%*:|"<>]/g, '_');
    XLSX.writeFile(wb, `${safeEventName}_Assigned_Brands.xlsx`);
  };

  const handleRemoveAssignment = async (combinedId) => {
    if (!window.confirm('Remove this brand from the event?')) return;
    try {
      await removeAssignment(combinedId);
      setAssignedBrands((prev) => prev.filter((a) => a.combinedId !== combinedId));
    } catch (err) {
      alert('Failed to remove brand: ' + err.message);
    }
  };

  const handleUpdateAssignmentRank = async (combinedId, newRank) => {
    try {
      await updateAssignment(combinedId, { rank: newRank });
      setAssignedBrands((prev) =>
        prev.map((a) => a.combinedId === combinedId ? { ...a, rank: newRank } : a)
      );
    } catch (err) {
      console.error('Failed to update rank:', err);
    }
  };

  const handleUpdateAssignmentPosition = async (combinedId, newPosition) => {
    try {
      await updateAssignment(combinedId, { position: newPosition });
      setAssignedBrands((prev) =>
        prev.map((a) => a.combinedId === combinedId ? { ...a, position: newPosition } : a)
      );
      setSelectedBrandDetail((prev) =>
        prev && prev.combinedId === combinedId ? { ...prev, position: newPosition } : prev
      );
      return true;
    } catch (err) {
      console.error('Failed to update position:', err);
      alert('Failed to update position: ' + err.message);
      return false;
    }
  };

  const handleToggleTreasureHolder = async (combinedId, current) => {
    const next = !current;
    try {
      await setTreasureHolder(combinedId, next);
      setAssignedBrands((prev) =>
        prev.map((a) => a.combinedId === combinedId ? { ...a, isTreasureHolder: next } : a)
      );
    } catch (err) {
      alert('Failed to update Treasure Holder status: ' + err.message);
    }
  };



  const handleDownloadQR = (combinedId, brandName) => {
    const canvas = qrCanvasRefs.current[combinedId];
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'QR-' + brandName.replace(/\s+/g, '_') + '-' + combinedId + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleReloadQR = (combinedId) => {
    const canvas = qrCanvasRefs.current[combinedId];
    if (canvas) {
      QRCode.toCanvas(canvas, combinedId, { width: 180, margin: 1 }, (err) => {
        if (err) {
          console.error('QR generation error:', err);
          alert('Failed to generate QR code.');
        }
      });
    }
  };

  const handleFullscreenClick = async (e) => {
    if (!canEdit || !imageContainerRef.current) return;
    if (draggingPinIndex !== null || hasDraggedRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Strictly constrain percentage between 0% and 100% of the image
    const xPercent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (y / rect.height) * 100));

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
    } catch (error) {
      console.error("Failed to delete pin:", error);
      alert("Could not delete the pin. Please try again.");
    }
  };

  const handlePinMouseDown = (e, index) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    hasDraggedRef.current = false;
    setDraggingPinIndex(index);
  };

  const handlePinTouchStart = (e, index) => {
    if (!canEdit) return;
    e.stopPropagation();
    hasDraggedRef.current = false;
    setDraggingPinIndex(index);
  };

  const handleMouseUp = async () => {
    if (draggingPinIndex === null) return;
    
    setDraggingPinIndex(null);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 120);

    // Persist the final position to Firestore
    try {
      const eventRef = doc(db, 'event', id);
      await updateDoc(eventRef, { layoutImages: currentLayoutImages });
    } catch (error) {
      console.error("Failed to save pin position:", error);
      alert("Could not save the new pin position. Please try again.");
    }
  };

  const handleMouseMove = (e) => {
    if (draggingPinIndex === null || !imageContainerRef.current) return;
    hasDraggedRef.current = true;

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

  const handleTouchMove = (e) => {
    if (draggingPinIndex === null || !imageContainerRef.current) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    hasDraggedRef.current = true;

    const rect = imageContainerRef.current.getBoundingClientRect();
    let x = touch.clientX - rect.left;
    let y = touch.clientY - rect.top;

    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));

    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

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
            backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            padding: '16px', boxSizing: 'border-box', overflow: 'hidden'
          }}
          onClick={() => { 
            if (draggingPinIndex === null && !hasDraggedRef.current) {
              setFullscreenImage(null); setFullscreenImageIndex(null); 
            }
          }}
        >
          {canEdit && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute', top: '16px', left: '16px', zIndex: 10,
                background: 'rgba(0,0,0,0.75)', borderRadius: '8px', padding: '8px 12px',
                display: 'flex', flexDirection: 'column', gap: '8px',
                backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.15)',
                maxWidth: 'calc(100vw - 120px)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 600 }}>Pin:</span>
                <button
                  type="button"
                  onClick={() => setSelectedPinType('default')}
                  style={{
                    background: selectedPinType === 'default' ? 'var(--accent)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', padding: '3px', cursor: 'pointer'
                  }}
                  title="Default Pin"
                >
                  <img src={pinImages.default} alt="Default Pin" style={{ width: '22px', height: '22px', display: 'block' }} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPinType('star')}
                  style={{
                    background: selectedPinType === 'star' ? 'var(--accent)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', padding: '3px', cursor: 'pointer'
                  }}
                  title="Star Pin"
                >
                  <img src={pinImages.star} alt="Star Pin" style={{ width: '22px', height: '22px', display: 'block' }} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPinType('logo')}
                  style={{
                    background: selectedPinType === 'logo' ? 'var(--accent)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', padding: '3px', cursor: 'pointer'
                  }}
                  title="Logo Pin"
                >
                  <img src={pinImages.logo} alt="Logo Pin" style={{ width: '22px', height: '22px', display: 'block' }} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', fontWeight: '500' }}>Size:</label>
                <input 
                  type="range" 
                  min="16" max="50" 
                  value={pinSize} 
                  onChange={(e) => setPinSize(Number(e.target.value))}
                  style={{ width: '80px', cursor: 'pointer' }}
                />
              </div>
            </div>
          )}

          <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', alignItems: 'center', zIndex: 10 }}>
            {canEdit && fullscreenImageIndex !== null && (
              <button
                style={{
                  background: 'rgba(220, 38, 38, 0.85)', color: '#fff',
                  border: 'none', borderRadius: '8px', padding: '6px 12px',
                  fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  backdropFilter: 'blur(4px)'
                }}
                onClick={(e) => { e.stopPropagation(); handleDeleteLayoutImage(fullscreenImageIndex); }}
              >
                🗑️ Delete
              </button>
            )}
            <button 
              style={{
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                fontSize: '18px', cursor: 'pointer', display: 'flex',
                justifyContent: 'center', alignItems: 'center',
                backdropFilter: 'blur(4px)'
              }}
              onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); setFullscreenImageIndex(null); }}
              aria-label="Close"
            > 
              ✕
            </button>
          </div>

          {/* Tight Image Wrapper — ensures pins are mapped 100% to visible image on all screen sizes */}
          <div
            ref={imageContainerRef}
            onClick={(e) => {
              e.stopPropagation();
              if (draggingPinIndex === null && !hasDraggedRef.current) {
                handleFullscreenClick(e);
              }
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '94vw',
              maxHeight: '82vh',
              lineHeight: 0,
              userSelect: 'none',
              touchAction: 'none',
              cursor: canEdit && draggingPinIndex === null ? 'crosshair' : (draggingPinIndex !== null ? 'grabbing' : 'default'),
            }}
          >
            <img 
              src={fullscreenImage.url} 
              alt="Fullscreen Layout" 
              draggable={false}
              style={{
                display: 'block',
                maxWidth: '94vw',
                maxHeight: '82vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '6px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                pointerEvents: 'none',
              }} 
            />
            {fullscreenImage.pins?.map((pin, index) => {
              const style = {
                position: 'absolute',
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                transform: 'translate(-50%, -50%)',
                width: `${pinSize}px`,
                height: `${pinSize}px`,
                cursor: canEdit ? (draggingPinIndex === index ? 'grabbing' : 'grab') : 'default',
                pointerEvents: 'auto',
                touchAction: 'none',
              };
              if (pin.type === 'star') {
                style.filter = 'drop-shadow(0px 0px 3px rgba(0, 0, 0, 0.9))';
              }
              return (
                <img 
                  key={index}
                  src={pinImages[pin.type] || pinImages.default}
                  alt="Pin"
                  draggable={false}
                  onMouseDown={canEdit ? (e) => handlePinMouseDown(e, index) : undefined}
                  onTouchStart={canEdit ? (e) => handlePinTouchStart(e, index) : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasDraggedRef.current) return;
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

      <button 
        onClick={() => navigate(-1)} 
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: 'flex-start', marginBottom: 'var(--space-3)' }}
      >
        &larr; {t('back')}
      </button>
      <div className="scroll-view" ref={scrollViewRef}>
        {/* Main Event Keyview Image */}
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
          <img 
            src={currentKeyviewImage} 
            alt={event.eventName} 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
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
                  position: 'absolute', bottom: 'var(--space-3)', right: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(0,0,0,0.7)', color: 'white',
                  border: '1px solid rgba(255,255,255,0.4)', cursor: 'pointer',
                  fontSize: 'var(--font-sm)', fontWeight: '500', backdropFilter: 'blur(8px)'
                }}
              >
                {isUploadingKeyview ? 'Uploading...' : 'Change Keyview'}
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 'var(--space-4)', textAlign: 'left' }}>
          <h1 style={{ fontSize: 'var(--font-3xl)', margin: '0 0 var(--space-2) 0' }}>{event.eventName}</h1>
          <p style={{ fontSize: 'var(--font-lg)', marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>Hosted by: {event.eventHostest}</p>
          <p style={{ fontSize: 'var(--font-md)', color: 'var(--accent)', fontWeight: '600', marginBottom: 'var(--space-3)' }}>
            {event.eventDateStart} to {event.eventDateEnd}
          </p>
          <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-1)' }}><strong>Location:</strong> {event.eventLocation}</p>
          <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-1)' }}><strong>Setup:</strong> {event.setUpDate} | <strong>Cleanup:</strong> {event.CleanUpDate}</p>
          <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-1)' }}><strong>PIC:</strong> {event.PIC}</p>
          <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-1)' }}><strong>Registered:</strong> {displayRegisteredCount} / {event.attendees > 0 ? event.attendees : '∞'}</p>
          <p style={{ fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}><strong>Note:</strong> {event.note}</p>
          
          <button 
            onClick={handleRegister} 
            className={`btn ${isRegistered ? 'btn-danger' : 'btn-primary'}`}
            style={{ width: '100%', padding: 'var(--space-3)', fontSize: 'var(--font-md)' }}
          >
            {user ? (isRegistered ? t('unregisterFromEvent') : t('registerForEvent')) : t('loginToRegister')}
          </button>

          {/* Admin Action Buttons */}
          {canEdit && (
            <div className="btn-group" style={{ marginTop: 'var(--space-3)', marginBottom: 0 }}>
              <button onClick={() => setShowUpdateModal(true)} className="btn btn-warning btn-flex">Update Event</button>
              <button onClick={handleDeleteEvent} className="btn btn-danger btn-flex">Delete Event</button>
            </div>
          )}
        </div>


        {/* Brand Detail Modal */}
        {selectedBrandDetail && (
          <div style={modalOverlayStyle({ zIndex: 9999, background: 'rgba(0, 0, 0, 0.75)', blur: 'blur(8px)' })}>
            <div className="modal-container" style={{ ...modalCardStyle({ maxWidth: '440px', shadow: 'var(--shadow-glow)' }), display: 'flex', flexDirection: 'column' }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <BrandLogo url={selectedBrandDetail.logoUrl} name={selectedBrandDetail.brandName} size={48} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 'var(--font-lg)' }}>{selectedBrandDetail.brandName}</h3>
                    <p style={{ margin: 0, fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>{selectedBrandDetail.fieldOfWork}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBrandDetail(null)}
                  className="btn btn-ghost"
                  style={{ padding: '4px 8px', fontSize: 'var(--font-lg)', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Details Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontWeight: '500' }}>Rank</span>
                  {canEdit ? (
                    <select
                      aria-label="Edit brand rank"
                      value={selectedBrandDetail.rank}
                      onChange={async (e) => {
                        const newRank = e.target.value;
                        await handleUpdateAssignmentRank(selectedBrandDetail.combinedId, newRank);
                        setSelectedBrandDetail(prev => ({ ...prev, rank: newRank }));
                      }}
                      style={{
                        fontSize: 'var(--font-sm)', padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', cursor: 'pointer'
                      }}
                    >
                      {['gold','silver','bronze','standard'].map((r) => (
                        <option key={r} value={r} style={{ background: 'var(--bg-card-solid)', color: 'var(--text-primary)' }}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {selectedBrandDetail.rank}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontWeight: '500', flexShrink: 0 }}>Position</span>
                  {canEdit ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="text"
                        aria-label="Edit brand booth position"
                        placeholder="e.g. A-12, Booth 3"
                        value={editBrandPosition}
                        onChange={(e) => {
                          setEditBrandPosition(e.target.value);
                          setBrandPositionSavedMsg(false);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            setSavingBrandPosition(true);
                            const ok = await handleUpdateAssignmentPosition(selectedBrandDetail.combinedId, editBrandPosition.trim());
                            setSavingBrandPosition(false);
                            if (ok) {
                              setBrandPositionSavedMsg(true);
                              setTimeout(() => setBrandPositionSavedMsg(false), 2000);
                            }
                          }
                        }}
                        style={{
                          fontSize: 'var(--font-sm)',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-input)',
                          color: 'var(--text-primary)',
                          width: '120px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          setSavingBrandPosition(true);
                          const ok = await handleUpdateAssignmentPosition(selectedBrandDetail.combinedId, editBrandPosition.trim());
                          setSavingBrandPosition(false);
                          if (ok) {
                            setBrandPositionSavedMsg(true);
                            setTimeout(() => setBrandPositionSavedMsg(false), 2000);
                          }
                        }}
                        disabled={savingBrandPosition || editBrandPosition.trim() === (selectedBrandDetail.position || '')}
                        className="btn btn-primary btn-sm"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          minWidth: '46px',
                          opacity: editBrandPosition.trim() === (selectedBrandDetail.position || '') ? 0.5 : 1,
                        }}
                      >
                        {savingBrandPosition ? '...' : (brandPositionSavedMsg ? '✓' : 'Save')}
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {selectedBrandDetail.position || '—'}
                    </span>
                  )}
                </div>

                {canEdit && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontWeight: '500' }}>Brand ID</span>
                      <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {selectedBrandDetail.brandId}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', fontWeight: '500' }}>Assignment ID</span>
                      <span style={{ fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        {selectedBrandDetail.combinedId}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* QR code section — ONLY for admin/manager */}
              {canEdit && selectedBrandDetail.isTreasureHolder && (
                <div style={{
                  padding: 'var(--space-4)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)'
                }}>
                  <canvas
                    ref={(el) => {
                      if (el) {
                        qrCanvasRefs.current[selectedBrandDetail.combinedId] = el;
                        QRCode.toCanvas(el, selectedBrandDetail.combinedId, { width: 160, margin: 1 }, (err) => {
                          if (err) console.error('QR modal draw error:', err);
                        });
                      }
                    }}
                    style={{ borderRadius: 'var(--radius-md)', background: '#fff', padding: '6px' }}
                  />
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 'var(--font-xs)', fontWeight: '600' }}>QR Code — Treasure Holder</p>
                    <p style={{ margin: '0 0 var(--space-2)', fontSize: '10px', color: 'var(--text-muted)' }}>Encodes: <code>{selectedBrandDetail.combinedId}</code></p>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleDownloadQR(selectedBrandDetail.combinedId, selectedBrandDetail.brandName)}
                        className="btn btn-info btn-sm"
                        style={{ fontSize: '10px', padding: '4px 8px' }}
                      >
                        ⬇ Download PNG
                      </button>
                      <button
                        onClick={() => handleReloadQR(selectedBrandDetail.combinedId)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '10px', padding: '4px 8px' }}
                      >
                        🔄 Reload QR
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Management Actions */}
              {canEdit && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-3)', marginTop: 'auto' }}>
                  <button
                    onClick={async () => {
                      const next = !selectedBrandDetail.isTreasureHolder;
                      await handleToggleTreasureHolder(selectedBrandDetail.combinedId, selectedBrandDetail.isTreasureHolder);
                      setSelectedBrandDetail(prev => ({ ...prev, isTreasureHolder: next }));
                    }}
                    className={`btn btn-sm ${selectedBrandDetail.isTreasureHolder ? 'btn-warning' : 'btn-ghost'}`}
                    style={{ flex: 1 }}
                  >
                    {selectedBrandDetail.isTreasureHolder ? '☆ Remove Treasure' : '⭐ Set Treasure'}
                  </button>
                  <button
                    onClick={async () => {
                      if (window.confirm(`Remove ${selectedBrandDetail.brandName} from this event?`)) {
                        await handleRemoveAssignment(selectedBrandDetail.combinedId);
                        setSelectedBrandDetail(null);
                      }
                    }}
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1 }}
                  >
                    🗑️ Remove Brand
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* If registered but not joined treasure hunt, show a join button */}
        {user && isRegistered && !userJoinedHunt && treasureBrands.length > 0 && (
          <div className="stamp-ticket" style={{ textAlign: 'center', padding: 'var(--space-5)' }}>
            <h3 style={{ margin: '0 0 var(--space-2)' }}>🎫 Treasure Hunt Available</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>
              Join the Treasure Hunt to collect stamps from brand booths and win prizes!
            </p>
            <button
              onClick={handleJoinTreasureHuntDirectly}
              className="btn btn-primary"
              style={{ width: '100%', padding: 'var(--space-3)' }}
            >
              Start Treasure Hunt
            </button>
          </div>
        )}

        {/* Stamp Ticket — shown to registered users who joined treasure hunt */}
        {user && isRegistered && userJoinedHunt && treasureBrands.length > 0 && (
          <StampTicket
            eventId={id}
            eventName={event.eventName}
            user={user}
            currentUser={user}
            brands={treasureBrands}
          />
        )}

        {/* Layout Images Section at the bottom */}
        <div style={{ marginTop: 'var(--space-6)', textAlign: 'left' }}>
          <h2 style={{ fontSize: 'var(--font-xl)', marginBottom: 'var(--space-4)' }}>{t('eventLayouts')}</h2>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            {currentLayoutImages.length > 0 ? (
              currentLayoutImages.map((img, index) => (
                <div key={index} style={{ position: 'relative', width: 'calc(50% - 6px)', paddingTop: 'calc((50% - 6px) * 9 / 16)', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <img 
                    src={typeof img === 'string' ? img : img.url} 
                    alt={`Event Layout ${index + 1}`} 
                    onClick={() => {
                      const imageObject = typeof img === 'string' ? { url: img, pins: [] } : img;
                      setFullscreenImage(imageObject);
                      setFullscreenImageIndex(index);
                    }}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' }}
                    loading="lazy"
                    decoding="async"
                  />
                  {canEdit && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px', zIndex: 5 }}>
                      <label 
                        onClick={(e) => e.stopPropagation()} 
                        style={{
                          background: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(255, 255, 255, 0.3)',
                          borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px',
                          fontWeight: '600', cursor: 'pointer', backdropFilter: 'blur(4px)'
                        }}
                      >
                        ✏️ Replace
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleReplaceLayoutImage(index, e.target.files[0])}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteLayoutImage(index); }}
                        style={{
                          background: 'rgba(220, 38, 38, 0.85)', border: 'none',
                          borderRadius: '6px', padding: '4px 8px', color: '#fff', fontSize: '11px',
                          fontWeight: '600', cursor: 'pointer', backdropFilter: 'blur(4px)'
                        }}
                        title="Delete layout picture"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ width: '100%', padding: 'var(--space-6) 0', textAlign: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
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
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                {isUploading ? 'Uploading...' : 'Add New Layout'}
              </button>
            </>
          )}
        </div>

        {/* Attending Brands Section — pushed to the bottom with shorten/expand support */}
        <div style={{ marginTop: 'var(--space-6)', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <h2 style={{ fontSize: 'var(--font-xl)', margin: 0 }}>{t('attendingBrands')}</h2>
              {assignedBrands.length > 0 && (
                <span className="badge badge-solid" style={{ fontSize: 'var(--font-xs)', padding: '2px 8px' }}>
                  {assignedBrands.length}
                </span>
              )}
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => downloadBrandAssignmentTemplate(globalBrands)}
                  className="btn btn-secondary btn-sm"
                  title="Download Excel template for importing brands"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>📄 Download Template</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignModalTab('excel');
                    setShowAssignBrandModal(true);
                  }}
                  className="btn btn-secondary btn-sm"
                  title="Import brands using Excel"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span>📥 Import Excel</span>
                </button>
                {assignedBrands.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportAssignedBrands}
                    className="btn btn-secondary btn-sm"
                    title="Export currently assigned brands to Excel"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>📤 Export Brands</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAssignModalTab('single');
                    setShowAssignBrandModal(true);
                  }}
                  className="btn btn-primary btn-sm"
                >
                  + Assign Brand
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {loadingBrands && <p style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>}
            {!loadingBrands && assignedBrands.length === 0 && (
              <EmptyState icon="🏢" message={t('noBrandsFound', 'No brands assigned to this event yet.')} />
            )}
            {displayedBrands.map((assignment) => (
              <div
                key={assignment.combinedId}
                onClick={() => setSelectedBrandDetail(assignment)}
                className="touchable-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0, flex: 1 }}>
                  {/* Logo */}
                  <BrandLogo url={assignment.logoUrl} name={assignment.brandName} size={36} />
                  {/* Name and Badges */}
                  <div style={{ minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <h4 style={{ margin: 0, fontSize: 'var(--font-sm)', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {assignment.brandName}
                    </h4>
                    <span className="badge badge-solid" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                      {assignment.rank}
                    </span>
                    {assignment.isTreasureHolder && (
                      <span className="badge badge-warning" style={{ fontSize: '10px' }}>⭐ Treasure</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                  {assignment.position ? (
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>Pos: {assignment.position}</span>
                  ) : (
                    canEdit && <span style={{ fontSize: '10px', color: 'var(--text-muted)', border: '1px dashed var(--border)', padding: '1px 5px', borderRadius: '4px' }}>+ Position</span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-md)' }}>›</span>
                </div>
              </div>
            ))}

            {/* Expand / Collapse toggle if total brands exceed limit */}
            {assignedBrands.length > BRAND_COLLAPSE_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAllBrands(prev => !prev)}
                className="btn btn-secondary"
                style={{
                  marginTop: 'var(--space-2)',
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: 'var(--font-sm)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                {showAllBrands ? (
                  <>▲ {t('showLessBrands', 'Show fewer brands')}</>
                ) : (
                  <>
                    ▼ {t('showAllBrands', {
                      count: assignedBrands.length,
                      defaultValue: `Show all ${assignedBrands.length} brands (${assignedBrands.length - BRAND_COLLAPSE_LIMIT} more)`
                    })}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <BackToTopButton scrollableRef={scrollViewRef} />

      {/* Assign Brand Modal */}
      {showAssignBrandModal && event && (
        <AssignBrandModal
          event={event}
          assignedBrandIds={assignedBrands.map((a) => a.combinedId)}
          onClose={() => setShowAssignBrandModal(false)}
          onAssigned={handleBrandAssigned}
          user={user}
          initialTab={assignModalTab}
        />
      )}

      {/* Update Event Modal */}
      {showUpdateModal && (
        <Modal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} title="Update Event"> {/* Modal itself can be memoized */}
          <EventForm
            formData={formData}
            onFormChange={handleFormChange}
            onKeyviewUpload={handleKeyviewUploadModal}
            onLayoutUpload={handleLayoutUploadModal}
            removeLayoutImage={removeLayoutImageModal}
            isUploadingKeyview={isUploadingKeyviewModal}
            isUploadingLayout={isUploadingLayoutModal}
            onSubmit={handleUpdateSubmit}
            onCancel={() => setShowUpdateModal(false)}
            isSaving={isSaving}
            submitText="Save Changes"
          />
        </Modal>
      )}

      {/* Registration Modal — treasure hunt opt-in */}
      {showRegModal && (
        <div className="reg-modal-overlay" onClick={() => setShowRegModal(false)}>
          <div className="reg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reg-modal__header">
              <h2 className="reg-modal__title">Join Event</h2>
              <button onClick={() => setShowRegModal(false)} className="reg-modal__close" aria-label="Close">✕</button>
            </div>

            <div className="reg-modal__body">
              <div className="reg-modal__event-info">
                <h3 style={{ margin: '0 0 4px', fontSize: 'var(--font-lg)' }}>{event.eventName}</h3>
                <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                  {event.eventDateStart} · {event.eventLocation}
                </p>
              </div>

              {/* Treasure Hunt toggle */}
              {treasureBrands.length > 0 && (
                <div
                  className="reg-modal__hunt-toggle"
                  onClick={() => setJoinTreasureHunt(!joinTreasureHunt)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setJoinTreasureHunt(!joinTreasureHunt); }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="reg-modal__hunt-label">🎫 Join Treasure Hunt</div>
                    <p className="reg-modal__hunt-desc">
                      Visit {treasureBrands.length} brand booth{treasureBrands.length !== 1 ? 's' : ''}, scan QR codes, and collect stamps to win prizes!
                    </p>
                  </div>
                  <div className={`reg-modal__switch ${joinTreasureHunt ? 'reg-modal__switch--on' : ''}`}>
                    <div className="reg-modal__switch-thumb" />
                  </div>
                </div>
              )}

              {/* Preview brand slots */}
              {joinTreasureHunt && treasureBrands.length > 0 && (
                <div className="reg-modal__preview">
                  <p style={{ margin: '0 0 8px', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Your stamp card will have {treasureBrands.length} slot{treasureBrands.length !== 1 ? 's' : ''}:
                  </p>
                  <div className="reg-modal__brands-row">
                    {treasureBrands.slice(0, 6).map((b) => (
                      <div key={b.combinedId} className="reg-modal__brand-chip">
                        {b.logoUrl ? (
                          <img src={b.logoUrl} alt={b.brandName} className="reg-modal__brand-logo" loading="lazy" />
                        ) : (
                          <span style={{ fontSize: '14px' }}>🏢</span>
                        )}
                      </div>
                    ))}
                    {treasureBrands.length > 6 && (
                      <div className="reg-modal__brand-chip reg-modal__brand-more">
                        +{treasureBrands.length - 6}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="reg-modal__footer">
              <button onClick={() => setShowRegModal(false)} className="btn btn-secondary btn-flex">Cancel</button>
              <button onClick={handleConfirmRegister} className="btn btn-primary btn-flex">
                {joinTreasureHunt && treasureBrands.length > 0 ? '🎫 Register & Join Hunt' : 'Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventDetail;
