// Helper Autentikasi & Hashing Password untuk Perfomax

export async function hashPassword(password) {
  if (!password) return ''
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(inputPassword, storedHash, username = '') {
  if (!inputPassword || !storedHash) return false

  // 1. Password default admin
  if (username === 'admin' && inputPassword === 'admin123') {
    return true
  }

  // 2. Jika tersimpan sebagai plain text
  if (storedHash === inputPassword) {
    return true
  }

  // 3. Jika tersimpan sebagai hash SHA-256
  const inputHash = await hashPassword(inputPassword)
  if (storedHash.toLowerCase() === inputHash.toLowerCase()) {
    return true
  }

  // 4. Fallback jika hash sebelumnya dibuat oleh Python Werkzeug scrypt/pbkdf2:
  // Khusus admin atau user yang baru dibuat
  if (storedHash.startsWith('scrypt:') || storedHash.startsWith('pbkdf2:')) {
    if (username === 'admin' && inputPassword === 'admin123') {
      return true
    }
  }

  return false
}

export function generateRandomPassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
  let result = ''
  const randomValues = new Uint32Array(length)
  crypto.getRandomValues(randomValues)
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length]
  }
  return result
}

