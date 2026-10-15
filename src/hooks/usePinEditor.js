import { useState, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from '../utils/toast';
import { confirmDialog } from '../utils/confirm';

/**
 * Owns all state and handlers for the fullscreen layout viewer / pin editor.
 * Extracted from EventDetail.jsx.
 *
 * @param {object}   params
 * @param {string}   params.eventId
 * @param {boolean}  params.canEdit
 * @param {Array}    params.layoutImages        current layout images (strings or {url, pins})
 * @param {Function} params.setLayoutImages     state setter for layoutImages
 */
export function usePinEditor({ eventId, canEdit, layoutImages, setLayoutImages }) {
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(null);
  const [selectedPinType, setSelectedPinType] = useState('default');
  const [pinSize, setPinSize] = useState(30);
  const [draggingPinIndex, setDraggingPinIndex] = useState(null);

  const hasDraggedRef = useRef(false);
  const imageContainerRef = useRef(null);

  const openViewer = (img, index) => {
    const imageObject = typeof img === 'string' ? { url: img, pins: [] } : img;
    setFullscreenImage(imageObject);
    setFullscreenImageIndex(index);
  };

  const closeViewer = () => {
    setFullscreenImage(null);
    setFullscreenImageIndex(null);
  };

  const persistLayoutImages = async (images) => {
    const eventRef = doc(db, 'event', eventId);
    await updateDoc(eventRef, { layoutImages: images });
  };

  /** Click on the image → add a new pin at that position. */
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
    const updatedLayoutImages = [...layoutImages];
    const currentImageObject = updatedLayoutImages[fullscreenImageIndex] || fullscreenImage;
    let newImageObject;

    if (typeof currentImageObject === 'string') {
      newImageObject = { url: currentImageObject, pins: [newPin] };
    } else {
      const existingPins = currentImageObject.pins || [];
      newImageObject = { ...currentImageObject, url: currentImageObject.url, pins: [...existingPins, newPin] };
    }
    updatedLayoutImages[fullscreenImageIndex] = newImageObject;

    setFullscreenImage(newImageObject);
    setLayoutImages(updatedLayoutImages);

    try {
      await persistLayoutImages(updatedLayoutImages);
    } catch (error) {
      console.error('Failed to save pin:', error);
      toast.error('Could not save the new pin. Please try again.');
    }
  };

  /** Delete a pin (asks for confirmation once). */
  const handlePinDelete = async (e, pinIndexToDelete) => {
    e.stopPropagation(); // Prevent handleFullscreenClick from firing

    if (!canEdit) return;
    const ok = await confirmDialog({
      title: 'DELETE PIN',
      message: 'Are you sure you want to delete this pin?',
      confirmText: 'Delete Pin',
      confirmVariant: 'danger',
      icon: '📍',
    });
    if (!ok) return;

    const updatedLayoutImages = [...layoutImages];
    const imageObject = { ...updatedLayoutImages[fullscreenImageIndex] };

    if (!imageObject.pins) return;

    imageObject.pins = imageObject.pins.filter((_, index) => index !== pinIndexToDelete);
    updatedLayoutImages[fullscreenImageIndex] = imageObject;

    setLayoutImages(updatedLayoutImages);
    setFullscreenImage(imageObject);

    try {
      await persistLayoutImages(updatedLayoutImages);
      toast.success('Pin deleted successfully.');
    } catch (error) {
      console.error('Failed to delete pin:', error);
      toast.error('Could not delete the pin. Please try again.');
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

  /** End of drag → persist final pin position. */
  const handleMouseUp = async () => {
    if (draggingPinIndex === null) return;

    setDraggingPinIndex(null);
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 120);

    try {
      await persistLayoutImages(layoutImages);
    } catch (error) {
      console.error('Failed to save pin position:', error);
      toast.error('Could not save the new pin position. Please try again.');
    }
  };

  const movePinTo = (clientX, clientY) => {
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));

    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    const updatedLayoutImages = [...layoutImages];
    const imageObject = { ...updatedLayoutImages[fullscreenImageIndex] };

    if (imageObject.pins && imageObject.pins[draggingPinIndex]) {
      const updatedPins = [...imageObject.pins];
      updatedPins[draggingPinIndex] = { ...updatedPins[draggingPinIndex], x: xPercent, y: yPercent };
      imageObject.pins = updatedPins;

      updatedLayoutImages[fullscreenImageIndex] = imageObject;
      setLayoutImages(updatedLayoutImages);
      setFullscreenImage(imageObject);
    }
  };

  const handleMouseMove = (e) => {
    if (draggingPinIndex === null || !imageContainerRef.current) return;
    hasDraggedRef.current = true;
    movePinTo(e.clientX, e.clientY);
  };

  const handleTouchMove = (e) => {
    if (draggingPinIndex === null || !imageContainerRef.current) return;
    const touch = e.touches?.[0];
    if (!touch) return;
    hasDraggedRef.current = true;
    movePinTo(touch.clientX, touch.clientY);
  };

  return {
    // state
    fullscreenImage,
    fullscreenImageIndex,
    selectedPinType,
    setSelectedPinType,
    pinSize,
    setPinSize,
    draggingPinIndex,
    // refs
    hasDraggedRef,
    imageContainerRef,
    // actions
    openViewer,
    closeViewer,
    handleFullscreenClick,
    handlePinDelete,
    handlePinMouseDown,
    handlePinTouchStart,
    handleMouseUp,
    handleMouseMove,
    handleTouchMove,
  };
}
