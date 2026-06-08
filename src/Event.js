/**
 * Helper function to generate a random alphanumeric ID
 */
export const generateId = (length = 9) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export class Event {
  constructor(eventName, dateStart, dateEnd, customer, imageLink) {
    // Auto-generate a 9-character alphanumeric ID
    this.id = generateId(9);
    this.eventName = eventName;
    this.dateStart = dateStart;
    this.dateEnd = dateEnd;
    this.customer = customer;
    this.imageLink = imageLink;
  }
}

export const createEvent = (eventName, dateStart, dateEnd, customer, imageLink) => {
  return new Event(eventName, dateStart, dateEnd, customer, imageLink);
};
