import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, arrayUnion, arrayRemove, increment, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import Modal from './Modal';
import { useTranslation } from 'react-i18next';
import EventForm from './EventForm';
import BackToTopButton from './BackToTopButton';
import { uploadEventImageAndUpdate, uploadKeyviewImageAndUpdate, updateEventInFirestore, deleteEventFromFirestore, uploadImageToImgBB, INITIAL_EVENT_FORM } from './Event';
import QRCode from 'qrcode';
import { subscribeBrandsForEvent, removeAssignment, updateAssignment, setTreasureHolder, getOrCreateStampTicket } from './Brand';
// Admin/manager-only: loaded on demand (pulls in xlsx only when actually used)
const AssignBrandModal = lazy(() => import('./AssignBrandModal'));
import { useBrands } from './hooks/useBrands';
import { usePinEditor } from './hooks/usePinEditor';
import StampTicket from './StampTicket';
import {
  getCachedEventDetail,
  cacheEventDetail,
  getCachedUserRegistration,
  cacheUserRegistration,
  cacheStampTicket,
  getCachedTreasureHuntOptIn,
  cacheTreasureHuntOptIn,
  cacheAttendedLayoutImages,
  removeAttendedLayoutImages,
} from './storage';
import { canManage } from './utils/auth';
import { handleFirebaseError } from './utils/firebaseErrors';
import { stampKey } from './utils/keys';
import { toast } from './utils/toast';
import { confirmDialog } from './utils/confirm';
import FullscreenLayoutViewer from './components/eventDetail/FullscreenLayoutViewer';
import BrandDetailModal from './components/eventDetail/BrandDetailModal';
import RegistrationModal from './components/eventDetail/RegistrationModal';
import LayoutGallery from './components/eventDetail/LayoutGallery';
import AttendingBrandsSection from './components/eventDetail/AttendingBrandsSection';
import EventInfoHeader from './components/eventDetail/EventInfoHeader';

function EventDetail({ user }) {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingKeyview, setIsUploadingKeyview] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUploadingKeyviewModal, setIsUploadingKeyviewModal] = useState(false);
  const [isUploadingLayoutModal, setIsUploadingLayoutModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [assignedBrands, setAssignedBrands] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [showAssignBrandModal, setShowAssignBrandModal] = useState(false);
  const [assignModalTab, setAssignModalTab] = useState('single');
  const { brands: globalBrands } = useBrands();
  const [userRegState, setUserRegState] = useState(null);
  const [showRegModal, setShowRegModal] = useState(false);
  const [joinTreasureHunt, setJoinTreasureHunt] = useState(true);
  const [userJoinedHunt, setUserJoinedHunt] = useState(false);
  const [selectedBrandDetail, setSelectedBrandDetail] = useState(null);

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

  const isRegistered = user ? (userRegState ?? event?.registeredUsers?.includes(user?.uid)) : false;

  // Display registered count starting at 100+ minimum, updating in blocks of 100 once registered count exceeds 100
  const rawCount = event?.registeredCount ?? (event?.registeredUsers?.length || 0);
  const baseCount = Math.max(100, Math.floor(rawCount / 100) * 100);
  const displayRegisteredCount = `${baseCount}+`;

  const scrollViewRef = useRef(null);

  const editor = usePinEditor({
    eventId: id,
    canEdit,
    layoutImages: currentLayoutImages,
    setLayoutImages: setCurrentLayoutImages,
  });

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

      let unsubDoc = () => {};
      try {
        const docRef = doc(db, 'event', id);
        unsubDoc = onSnapshot(docRef, (docSnap) => {
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

            // Cache layout images for offline & instant access if user attends this event
            const isUserAttending = user && (userRegState ?? data.registeredUsers?.includes(user.uid));
            if (isUserAttending && data.layoutImages?.length > 0) {
              cacheAttendedLayoutImages(id, data.layoutImages);
            }
          }
          setLoadingEvent(false);
        }, (error) => {
          console.error("Error listening to event:", error);
          setLoadingEvent(false);
        });
      } catch (error) {
        console.error("Error setting up event listener:", error);
        setLoadingEvent(false);
      }

      return unsubDoc;
    };
    const unsub = fetchEvent();
    return () => {
      unsub.then?.((fn) => fn?.()).catch?.(() => {});
    };
  }, [id, user]);

  // Real-time synchronization of assignments for this event via onSnapshot
  useEffect(() => {
    if (!id) return;
    const unsub = subscribeBrandsForEvent(
      id,
      (data) => {
        setAssignedBrands(data);
        setLoadingBrands(false);
      },
      (err) => {
        console.error('Error listening to brand assignments:', err);
        setLoadingBrands(false);
      }
    );
    return () => unsub();
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
      toast.success("Layout image uploaded successfully!");
    } catch {
      toast.error("Image upload failed. See console for details.");
    } finally {
      setIsUploading(false);
      e.target.value = '';
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
        removeAttendedLayoutImages(id);
        toast.info(t('unregisteredToast'));
      } catch (error) {
        console.error("Error unregistering:", error);
        toast.error("There was an issue. Please try again.");
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

      // Pre-cache all layout images on device storage for instant offline viewing
      if (currentLayoutImages?.length > 0) {
        cacheAttendedLayoutImages(id, currentLayoutImages);
      }

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

      toast.success(joinTreasureHunt && treasureBrands.length > 0
        ? t('registeredHuntToast')
        : t('registeredEventToast'));
    } catch (error) {
      console.error("Error registering:", error);
      toast.error("There was an issue. Please try again.");
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
      toast.success('Joined! Your Treasure Hunt card is ready below.');
    } catch (err) {
      console.error('Error creating stamp ticket:', err);
      toast.error('Failed to start Treasure Hunt. Please try again.');
      setUserJoinedHunt(false);
      cacheTreasureHuntOptIn(id, user.uid, false);
    }
  };

  const handleKeyviewImageUpload = async (e) => {
    if (!canEdit) {
      toast.warning('Unauthorized: Only Admin and Manager roles can update keyview image.');
      return;
    }
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploadingKeyview(true);
      const newImageUrl = await uploadKeyviewImageAndUpdate(file, id);
      setCurrentKeyviewImage(newImageUrl);
      toast.success("Keyview image uploaded successfully!");
    } catch {
      toast.error("Keyview image upload failed. See console for details.");
    } finally {
      setIsUploadingKeyview(false);
      e.target.value = '';
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleKeyviewUploadModal = async (e) => {
    if (!canEdit) {
      toast.warning('Unauthorized: Only Admin and Manager roles can update keyview image.');
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingKeyviewModal(true);
    try {
      const url = await uploadImageToImgBB(file);
      setFormData(prev => ({ ...prev, imageLink: url }));
      toast.success("Keyview image uploaded successfully!");
    } catch {
      toast.error("Keyview image upload failed.");
    } finally {
      setIsUploadingKeyviewModal(false);
      e.target.value = ''; // reset input
    }
  };

  const handleLayoutUploadModal = async (e) => {
    if (!canEdit) {
      toast.warning('Unauthorized: Only Admin and Manager roles can upload layout images.');
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    setIsUploadingLayoutModal(true);
    try {
      const url = await uploadImageToImgBB(file);
      setFormData(prev => ({ ...prev, layoutImages: [...prev.layoutImages, url] }));
      toast.success("Layout image uploaded successfully!");
    } catch {
      toast.error("Layout image upload failed.");
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
      toast.warning('Unauthorized: Only Admin and Manager roles can delete layout images.');
      return;
    }
    const ok = await confirmDialog({
      title: t('deleteLayoutConfirmTitle'),
      message: t('deleteLayoutConfirmMsg'),
      confirmText: t('delete'),
      confirmVariant: 'danger',
      icon: '🖼️',
    });
    if (!ok) return;
    const updatedImages = currentLayoutImages.filter((_, idx) => idx !== indexToDelete);
    try {
      const eventRef = doc(db, 'event', id);
      await updateDoc(eventRef, { layoutImages: updatedImages });
      setCurrentLayoutImages(updatedImages);
      setEvent(prev => ({ ...prev, layoutImages: updatedImages }));
      setFormData(prev => ({ ...prev, layoutImages: updatedImages }));
      if (editor.fullscreenImageIndex === indexToDelete) {
        editor.closeViewer();
      }
      toast.success('Layout image deleted successfully.');
    } catch (error) {
      console.error('Failed to delete layout image:', error);
      toast.error('Failed to delete layout image.');
    }
  };

  const handleReplaceLayoutImage = async (indexToReplace, file) => {
    if (!canEdit) {
      toast.warning('Unauthorized: Only Admin and Manager roles can update layout images.');
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
      toast.success('Layout image updated successfully!');
    } catch (error) {
      console.error('Failed to replace layout image:', error);
      toast.error('Failed to update layout image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      toast.warning('Unauthorized: Only Admin and Manager roles can update event details.');
      return;
    }

    // Manual validation to ensure the form doesn't fail silently
    if (!formData.eventName || !formData.eventHostest || !formData.eventDateStart || !formData.eventLocation) {
      toast.warning(t('fillRequiredEventFields'));
      return;
    }

    setIsSaving(true);
    try {
      await updateEventInFirestore(id, formData);
      toast.success('Event successfully updated in Firestore!');
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
    const ok = await confirmDialog({
      title: t('deleteEventConfirmTitle'),
      message: t('deleteEventConfirmMsg'),
      confirmText: t('deleteEvent'),
      confirmVariant: 'danger',
      icon: '🗑️',
    });
    if (!ok) return;
    try {
      await deleteEventFromFirestore(id);
      toast.success('Event deleted successfully!');
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
      toast.warning('No brands assigned to this event yet.');
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

  // Resolves true when the assignment was removed, false on cancel/failure.
  const handleRemoveAssignment = async (combinedId) => {
    const ok = await confirmDialog({
      title: t('removeBrandConfirmTitle'),
      message: t('removeBrandConfirmMsg'),
      confirmText: t('removeBrandBtn'),
      confirmVariant: 'danger',
      icon: '🏢',
    });
    if (!ok) return false;
    try {
      await removeAssignment(combinedId);
      setAssignedBrands((prev) => prev.filter((a) => a.combinedId !== combinedId));
      toast.success('Brand removed from event successfully.');
      return true;
    } catch (err) {
      toast.error('Failed to remove brand: ' + err.message);
      return false;
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
      toast.error('Failed to update position: ' + err.message);
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
      toast.success(next ? 'Marked as Treasure Holder!' : 'Removed Treasure Holder status.');
    } catch (err) {
      toast.error('Failed to update Treasure Holder status: ' + err.message);
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
          toast.error('Failed to generate QR code.');
        }
      });
    }
  };

  const openAssignModal = (tab) => {
    setAssignModalTab(tab);
    setShowAssignBrandModal(true);
  };

  return (
    <div className="mobile-container">
      <FullscreenLayoutViewer
        editor={editor}
        canEdit={canEdit}
        onDeleteImage={handleDeleteLayoutImage}
      />

      <button
        onClick={() => navigate(-1)}
        className="btn btn-ghost btn-sm"
        style={{ alignSelf: 'flex-start', marginBottom: 'var(--space-3)' }}
      >
        &larr; {t('back')}
      </button>
      <div className="scroll-view" ref={scrollViewRef}>
        <EventInfoHeader
          event={event}
          keyviewImage={currentKeyviewImage}
          canEdit={canEdit}
          user={user}
          isRegistered={isRegistered}
          displayRegisteredCount={displayRegisteredCount}
          isUploadingKeyview={isUploadingKeyview}
          onKeyviewUpload={handleKeyviewImageUpload}
          onRegister={handleRegister}
          onUpdate={() => setShowUpdateModal(true)}
          onDelete={handleDeleteEvent}
        />

        {selectedBrandDetail && (
          <BrandDetailModal
            key={selectedBrandDetail.combinedId}
            brand={selectedBrandDetail}
            canEdit={canEdit}
            onRegisterQrCanvas={(combinedId, el) => {
              qrCanvasRefs.current[combinedId] = el;
            }}
            onClose={() => setSelectedBrandDetail(null)}
            onBrandChange={setSelectedBrandDetail}
            onUpdateRank={handleUpdateAssignmentRank}
            onUpdatePosition={handleUpdateAssignmentPosition}
            onToggleTreasure={handleToggleTreasureHolder}
            onRemove={handleRemoveAssignment}
            onDownloadQR={handleDownloadQR}
            onReloadQR={handleReloadQR}
          />
        )}

        {/* If registered but not joined treasure hunt, show a join button */}
        {user && isRegistered && !userJoinedHunt && treasureBrands.length > 0 && (
          <div className="stamp-ticket" style={{ textAlign: 'center', padding: 'var(--space-5)' }}>
            <h3 style={{ margin: '0 0 var(--space-2)' }}>🎫 {t('treasureHuntAvailable')}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)', marginBottom: 'var(--space-4)' }}>
              {t('treasureHuntDesc')}
            </p>
            <button
              onClick={handleJoinTreasureHuntDirectly}
              className="btn btn-primary"
              style={{ width: '100%', padding: 'var(--space-3)' }}
            >
              {t('startTreasureHunt')}
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

        <LayoutGallery
          images={currentLayoutImages}
          canEdit={canEdit}
          isUploading={isUploading}
          onOpen={editor.openViewer}
          onAdd={handleImageUpload}
          onReplace={handleReplaceLayoutImage}
          onDelete={handleDeleteLayoutImage}
        />

        <AttendingBrandsSection
          brands={assignedBrands}
          loading={loadingBrands}
          canEdit={canEdit}
          onSelect={setSelectedBrandDetail}
          onDownloadTemplate={async () => (await import('./utils/brandExcel')).downloadBrandAssignmentTemplate(globalBrands)}
          onImport={() => openAssignModal('excel')}
          onExport={handleExportAssignedBrands}
          onAssign={() => openAssignModal('single')}
        />
      </div>

      <BackToTopButton scrollableRef={scrollViewRef} />

      {/* Assign Brand Modal */}
      {showAssignBrandModal && event && (
        <Suspense fallback={null}>
          <AssignBrandModal
            event={event}
            assignedBrandIds={assignedBrands.map((a) => a.combinedId)}
            onClose={() => setShowAssignBrandModal(false)}
            onAssigned={handleBrandAssigned}
            user={user}
            initialTab={assignModalTab}
          />
        </Suspense>
      )}

      {/* Update Event Modal */}
      {showUpdateModal && (
        <Modal isOpen={showUpdateModal} onClose={() => setShowUpdateModal(false)} title={t('updateEvent')}> {/* Modal itself can be memoized */}
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
            submitText={t('saveChanges')}
          />
        </Modal>
      )}

      {/* Registration Modal — treasure hunt opt-in */}
      {showRegModal && (
        <RegistrationModal
          event={event}
          treasureBrands={treasureBrands}
          joinTreasureHunt={joinTreasureHunt}
          onToggleJoinHunt={() => setJoinTreasureHunt((v) => !v)}
          onConfirm={handleConfirmRegister}
          onClose={() => setShowRegModal(false)}
        />
      )}
    </div>
  );
}

export default EventDetail;
