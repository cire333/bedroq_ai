// src/utils/uuid.utils.ts
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert a UUID string to a binary buffer for MySQL
 * @param uuid UUID in string format
 * @returns Binary buffer for MySQL
 */
export const uuidToBinary = (uuid: string): Buffer => {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
};

/**
 * Convert a binary buffer from MySQL to a UUID string
 * @param binary Binary buffer from MySQL
 * @returns UUID in string format
 */
export const binaryToUuid = (binary: Buffer | null): string | null => {
  if (!binary) return null;
  
  const hex = binary.toString('hex');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
};

/**
 * Generate a new UUID and return it in binary format
 * @returns Binary UUID for MySQL
 */
export const generateBinaryUuid = (): Buffer => {
  return uuidToBinary(uuidv4());
};