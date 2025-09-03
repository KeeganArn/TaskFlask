import crypto from 'crypto';

/**
 * Generate a random organization invite code
 * Format: ABC-1234 (3 letters, dash, 4 numbers)
 */
export const generateInviteCode = (): string => {
  // Generate 3 random uppercase letters
  const letters = crypto.randomBytes(3)
    .toString('hex')
    .substring(0, 3)
    .toUpperCase()
    .split('')
    .map(char => String.fromCharCode(65 + (parseInt(char, 16) % 26)))
    .join('');

  // Generate 4 random numbers
  const numbers = crypto.randomInt(1000, 9999).toString();

  return `${letters}-${numbers}`;
};

/**
 * Validate invite code format
 */
export const isValidInviteCodeFormat = (code: string): boolean => {
  const inviteCodeRegex = /^[A-Z]{3}-[0-9]{4}$/;
  return inviteCodeRegex.test(code);
};

/**
 * Generate a unique invite code that doesn't exist in the database
 */
export const generateUniqueInviteCode = async (checkExistsFn: (code: string) => Promise<boolean>): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const code = generateInviteCode();
    const exists = await checkExistsFn(code);
    
    if (!exists) {
      return code;
    }
    
    attempts++;
  }

  // Fallback: use timestamp if we can't generate unique code
  const timestamp = Date.now().toString().slice(-4);
  const letters = crypto.randomBytes(2)
    .toString('hex')
    .substring(0, 2)
    .toUpperCase()
    .split('')
    .map(char => String.fromCharCode(65 + (parseInt(char, 16) % 26)))
    .join('');
  
  return `${letters}T-${timestamp}`;
};

/**
 * Clean and format invite code (remove spaces, convert to uppercase)
 */
export const formatInviteCode = (code: string): string => {
  return code.replace(/\s+/g, '').toUpperCase();
};
