import { doc, setDoc, updateDoc, arrayUnion, deleteDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Helper function to generate a random alphanumeric ID
 */
export const generateId = (length = 9) => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export class Event {
  constructor(eventName, eventHostest, setUpDate, eventDateStart, eventDateEnd, CleanUpDate, eventLocation, PIC, note, imageLink, layoutImages, attendees) {
    // Auto-generate a 9-character alphanumeric ID
    this.eventId = generateId(9);
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
    this.brands = []; // Initialize with empty brands array
    this.attendees = attendees || 0;
  }
}

export const createEvent = (eventName, eventHostest, setUpDate, eventDateStart, eventDateEnd, CleanUpDate, eventLocation, PIC, note, imageLink, layoutImages, attendees) => {
  return new Event(eventName, eventHostest, setUpDate, eventDateStart, eventDateEnd, CleanUpDate, eventLocation, PIC, note, imageLink, layoutImages, attendees);
};

export const saveEventToFirestore = async (eventObj) => {
  try {
    // Let firestore generate the ID
    const newEventRef = doc(collection(db, 'event'));
    // Save the document with the new ID included in its data
    await setDoc(newEventRef, { ...eventObj, eventId: newEventRef.id });
    console.log("Document successfully written with ID:", newEventRef.id);
    return newEventRef.id;
  } catch (error) {
    console.error("Error writing document:", error);
    throw error;
  }
};

export const updateEventInFirestore = async (eventId, updateData) => {
  try {
    const eventRef = doc(db, 'event', eventId);
    await updateDoc(eventRef, updateData);
    console.log("Event successfully updated for ID:", eventId);
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
};

export const deleteEventFromFirestore = async (eventId) => {
  try {
    await deleteDoc(doc(db, 'event', eventId));
    console.log("Event successfully deleted for ID:", eventId);
  } catch (error) {
    console.error("Error deleting event:", error);
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

        // Calculate new dimensions preserving the aspect ratio
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

        // Convert canvas back to a Blob suitable for uploading
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.7);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Uploads an image file to ImgBB and returns the URL
 */
export const uploadImageToImgBB = async (file) => {
  try {
    const imgbbApiKey = import.meta.env.VITE_IMGBB_API_KEY;
    const resizedBlob = await resizeImageToFullHD(file);
    
    const formData = new FormData();
    formData.append('image', resizedBlob);
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Failed to upload image to ImgBB');

    const data = await response.json();
    return data.data.url;
  } catch (error) {
    console.error("Error uploading image to ImgBB:", error);
    throw error;
  }
};

/**
 * Uploads an image file to ImgBB and updates the event's layoutImages in Firestore
 */
export const uploadEventImageAndUpdate = async (file, eventId) => {
  try {
    const imageLink = await uploadImageToImgBB(file);

    // Update the existing event document to append the new layout image URL
    const eventRef = doc(db, 'event', eventId);
    await updateDoc(eventRef, { layoutImages: arrayUnion(imageLink) });
    
    console.log("Event layout image successfully added for ID:", eventId);
    return imageLink;
  } catch (error) {
    console.error("Error uploading and updating event image:", error);
    throw error;
  }
};

/**
 * Uploads a keyview image file to ImgBB and updates the event's imageLink in Firestore
 */
export const uploadKeyviewImageAndUpdate = async (file, eventId) => {
  try {
    const imageLink = await uploadImageToImgBB(file);

    // Update the existing event document with the new keyview image URL
    const eventRef = doc(db, 'event', eventId);
    await updateDoc(eventRef, { imageLink });
    
    console.log("Event keyview image successfully updated for ID:", eventId);
    return imageLink;
  } catch (error) {
    console.error("Error uploading and updating keyview image:", error);
    throw error;
  }
};
