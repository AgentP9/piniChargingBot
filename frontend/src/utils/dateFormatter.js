/**
 * Format a date to German locale format: dd.mm.yyyy HH:mm:ss
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string or empty string if invalid
 */
export function formatDateTime(date) {
  const d = new Date(date);
  
  // Validate date
  if (isNaN(d.getTime())) {
    console.error('Invalid date provided to formatDateTime:', date);
    return '';
  }
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}
