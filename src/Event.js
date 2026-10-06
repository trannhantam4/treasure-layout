import { doc, setDoc, updateDoc, arrayUnion, deleteDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Default event form state object.
 * Shared between Events.jsx (create) and EventDetail.jsx (update).
 */
export const INITIAL_EVENT_FORM = {
  eventName: '', eventHostest: '', setUpDate: '', eventDateStart: '',
  eventDateEnd: '', CleanUpDate: '', eventLocation: '', PIC: '',
  note: '', attendees: 0, imageLink: '', layoutImages: [],
};

export class Event {
  constructor(eventName, eventHostest, setUpDate, eventDateStart, eventDateEnd, CleanUpDate, eventLocation, PIC, note, imageLink, layoutImages, attendees) {
    this.eventName = eventName;
    this.eventHostest = eventHostest;
    this.setUpDate = setUpDate;
    this.eventDateStart = eventDateStart;
    this.eventDateEnd = eventDateEnd;
    this.CleanUpDate = CleanUpDate;
    this.eventLocation = eventLocation;
    this.PIC = PIC;
    this.note = note;
    this.imageLink = imageLink || '';
    this.layoutImages = layoutImages || [];
    this.brands = [];
    this.attendees = attendees || 0;
  }
}

export const createEvent = (eventName, eventHostest, setUpDate, eventDateStart, eventDateEnd, CleanUpDate, eventLocation, PIC, note, imageLink, layoutImages, attendees) => {
  return new Event(eventName, eventHostest, setUpDate, eventDateStart, eventDateEnd, CleanUpDate, eventLocation, PIC, note, imageLink, layoutImages, attendees);
};

export const saveEventToFirestore = async (eventObj) => {
  try {
    const newEventRef = doc(collection(db, 'event'));
    await setDoc(newEventRef, { ...eventObj, eventId: newEventRef.id });
    return newEventRef.id;
  } catch (error) {
    console.error('Error writing document:', error);
    throw error;
  }
};

export const updateEventInFirestore = async (eventId, updateData) => {
  try {
    const eventRef = doc(db, 'event', eventId);
    await updateDoc(eventRef, updateData);
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
};

export const deleteEventFromFirestore = async (eventId) => {
  try {
    await deleteDoc(doc(db, 'event', eventId));
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

/**
 * Resize an image file to max FullHD (1920x1080)
 */
export const resizeImageToFullHD = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Uploads an image file to ImgBB and returns the URL.
 * Uses VITE_IMGBB_API_KEY from env — this is exposed in the browser bundle.
 *
 * TO MIGRATE TO SECURE CLOUD FUNCTION (recommended for production):
 *   1. Run: npx -y firebase-tools@latest functions:secrets:set IMGBB_API_KEY
 *   2. Run: npx -y firebase-tools@latest deploy --only functions
 *   3. Uncomment the Cloud Function version below and remove the direct fetch version.
 */
export const uploadImageToImgBB = async (file) => {
  // Input validation
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
  const MAX_SIZE_MB = 50;

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type "${file.type}". Only JPEG, PNG, GIF, WEBP, and AVIF images are allowed.`);
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed size is ${MAX_SIZE_MB}MB.`);
  }

  const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;
  if (!imgbbApiKey) {
    throw new Error('ImgBB API key is not configured. Please set VITE_IMGBB_API_KEY in your .env file.');
  }

  const resizedBlob = await resizeImageToFullHD(file);
  const formData = new FormData();
  formData.append('image', resizedBlob);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload image to ImgBB');
  }

  const data = await response.json();
  return data.data.url;

  // ---- SECURE Cloud Function version (requires Blaze plan) ----
  // const { httpsCallable } = await import('firebase/functions');
  // const { functions } = await import('./firebase');
  // const resizedBlob = await resizeImageToFullHD(file);
  // const base64String = await new Promise((resolve, reject) => {
  //   const reader = new FileReader();
  //   reader.onload = () => resolve(reader.result);
  //   reader.onerror = reject;
  //   reader.readAsDataURL(resizedBlob);
  // });
  // const uploadToImgBB = httpsCallable(functions, 'uploadToImgBB');
  // const result = await uploadToImgBB({ imageBase64: base64String });
  // return result.data.url;
};

/**
 * Uploads an image file to ImgBB and updates the event's layoutImages in Firestore
 */
export const uploadEventImageAndUpdate = async (file, eventId) => {
  const imageLink = await uploadImageToImgBB(file);
  const eventRef = doc(db, 'event', eventId);
  await updateDoc(eventRef, { layoutImages: arrayUnion(imageLink) });
  return imageLink;
};

/**
 * Uploads a keyview image file to ImgBB and updates the event's imageLink in Firestore
 */
export const uploadKeyviewImageAndUpdate = async (file, eventId) => {
  const imageLink = await uploadImageToImgBB(file);
  const eventRef = doc(db, 'event', eventId);
  await updateDoc(eventRef, { imageLink });
  return imageLink;
};
