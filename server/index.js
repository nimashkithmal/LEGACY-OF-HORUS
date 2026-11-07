import { promisify } from 'node:util'
import { randomBytes, randomUUID, scrypt as scryptCallback, createHmac, timingSafeEqual } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import { MongoClient } from 'mongodb'

const serverDirectory = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: process.env.ENV_FILE ?? resolve(serverDirectory, '.env.local') })

const app = express()
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001)
const cookieName = 'horus_admin_session'
const sessionDurationSeconds = 60 * 60 * 8
const cookieSameSite = process.env.COOKIE_SAME_SITE?.toLowerCase() === 'none' ? 'None' : 'Lax'
const secureCookie = process.env.NODE_ENV === 'production' || cookieSameSite === 'None'
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? '').split(',').map((origin) => origin.trim()).filter(Boolean)
const scrypt = promisify(scryptCallback)
const demoBankDetails = {
  bankName: 'DEMO BANK (SAMPLE)',
  accountName: 'LEGACY OF HORUS DEMO ACCOUNT',
  accountNumber: '0000000000',
  branch: 'DEMO BRANCH',
  transferNote: 'These are dummy details for testing only. Do not transfer money.',
}
const sampleDonations = [
  { id: 'HOR-2401', name: 'Sample Supporter', nic: '•••••••482V', reference: 'WALK-DEMO-001', amount: 50000, phone: '077 000 0001', email: 'supporter@example.com', receiptName: 'Sample receipt', receiptData: '', status: 'approved', showPublicly: true, createdAt: new Date('2026-10-28T09:30:00.000Z'), isSample: true },
  { id: 'HOR-2402', name: 'Sample Supporter', nic: '•••••••731V', reference: 'WALK-DEMO-002', amount: 25000, phone: '077 000 0002', email: 'friend@example.com', receiptName: 'Sample receipt', receiptData: '', status: 'approved', showPublicly: true, createdAt: new Date('2026-10-29T11:15:00.000Z'), isSample: true },
  { id: 'HOR-2403', name: 'Sample Supporter', nic: '•••••••105V', reference: 'WALK-DEMO-003', amount: 10000, phone: '077 000 0003', email: 'donor@example.com', receiptName: 'Sample receipt', receiptData: '', status: 'pending', showPublicly: true, createdAt: new Date('2026-10-30T14:10:00.000Z'), isSample: true },
]

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required. Add it to .env.local.')
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters. Add it to .env.local.')
}
if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12)) {
  throw new Error('Production requires ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.')
}

const mongo = new MongoClient(process.env.MONGODB_URI)
await mongo.connect()
const db = mongo.db(process.env.MONGODB_DB ?? 'legacy_of_horus')
const donations = db.collection('donations')
const admins = db.collection('admins')
const settings = db.collection('settings')

await Promise.all([
  donations.createIndexes([
    { key: { createdAt: -1 }, name: 'createdAt_desc' },
    { key: { status: 1, showPublicly: 1 }, name: 'status_public' },
  ]),
  admins.createIndex({ email: 1 }, { unique: true }),
])
await settings.updateOne(
  { _id: 'campaign' },
  { $setOnInsert: { bankDetails: demoBankDetails, showCampaignSection: true, updatedAt: new Date() } },
  { upsert: true },
)

if (await donations.estimatedDocumentCount() === 0) {
  await donations.insertMany(sampleDonations)
}

const adminCount = await admins.countDocuments()
if (adminCount === 0) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  const password = process.env.ADMIN_PASSWORD ?? ''
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
    throw new Error('An empty database requires ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in .env.local.')
  }
  await admins.insertOne({
    id: randomUUID(),
    name: 'Campaign Admin',
    email,
    passwordHash: await hashPassword(password),
    role: 'Admin',
    status: 'active',
    createdAt: new Date(),
  })
  console.log(`Seeded initial admin account: ${email}`)
}

app.disable('x-powered-by')
app.use(express.json({ limit: '8mb' }))
app.use((request, response, next) => {
  const origin = request.headers.origin
  if (origin && allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Credentials', 'true')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    response.setHeader('Vary', 'Origin')
  }
  if (request.method === 'OPTIONS') return response.status(204).end()
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', process.env.SESSION_SECRET).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function verifySession(token) {
  if (!token) return null
  const [encoded, suppliedSignature] = token.split('.')
  if (!encoded || !suppliedSignature) return null
  const expectedSignature = createHmac('sha256', process.env.SESSION_SECRET).update(encoded).digest()
  let receivedSignature
  try {
    receivedSignature = Buffer.from(suppliedSignature, 'base64url')
  } catch {
    return null
  }
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null
  } catch {
    return null
  }
}

function setSessionCookie(response, token) {
  const attributes = [
    `${cookieName}=${token}`,
    'HttpOnly',
    `SameSite=${cookieSameSite}`,
    'Path=/api',
    `Max-Age=${sessionDurationSeconds}`,
  ]
  if (secureCookie) attributes.push('Secure')
  response.setHeader('Set-Cookie', attributes.join('; '))
}

function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=${cookieSameSite}; Path=/api; Max-Age=0${secureCookie ? '; Secure' : ''}`)
}

async function requireUser(request, response, next) {
  const token = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  const payload = verifySession(token)
  if (!payload) return response.status(401).json({ error: 'Please sign in again.' })
  const user = await admins.findOne({ email: payload.email, status: 'active' })
  if (!user) return response.status(401).json({ error: 'This account is inactive.' })
  request.user = user
  return next()
}

function requireAdmin(request, response, next) {
  if (request.user.role !== 'Admin') return response.status(403).json({ error: 'Admin access required.' })
  return next()
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, createdAt: user.createdAt }
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await scrypt(password, salt, 64)
  return `${salt}:${Buffer.from(hash).toString('hex')}`
}

async function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = storedHash.split(':')
  if (!salt || !expectedHex) return false
  const actual = Buffer.from(await scrypt(password, salt, 64))
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function validBankDetails(value) {
  return value && ['bankName', 'accountName', 'accountNumber', 'branch', 'transferNote'].every((key) => typeof value[key] === 'string' && value[key].trim().length > 0)
}

app.get('/api/health', async (_request, response) => {
  await db.command({ ping: 1 })
  response.json({ ok: true })
})

app.get('/api/public/bootstrap', async (_request, response) => {
  const [campaign, approvedTotal, supporters, approvedCount] = await Promise.all([
    settings.findOne({ _id: 'campaign' }),
    donations.aggregate([{ $match: { status: 'approved' } }, { $group: { _id: null, amount: { $sum: '$amount' } } }]).next(),
    donations.find({ status: 'approved', showPublicly: true }, { projection: { name: 1, amount: 1, createdAt: 1, donorPhotoData: 1, isSample: 1 } }).sort({ createdAt: -1 }).toArray(),
    donations.countDocuments({ status: 'approved' }),
  ])
  response.json({
    bankDetails: campaign.bankDetails,
    showCampaignSection: campaign.showCampaignSection,
    raised: approvedTotal?.amount ?? 0,
    approvedCount,
    supporters: supporters.map(({ _id, name, amount, createdAt, donorPhotoData, isSample }) => ({ id: String(_id), name, amount, createdAt, donorPhotoData: donorPhotoData ?? '', isSample: Boolean(isSample) })),
  })
})

app.post('/api/public/donations', async (request, response) => {
  const { name, nic, reference, amount, phone, email = '', receiptName, receiptData, donorPhotoName = '', donorPhotoData = '', showPublicly = false } = request.body ?? {}
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const cleanNic = typeof nic === 'string' ? nic.trim() : ''
  const cleanReference = typeof reference === 'string' ? reference.trim() : ''
  const cleanPhone = typeof phone === 'string' ? phone.trim() : ''
  const numericAmount = Number(amount)
  const validNic = /^(?:\d{9}[vVxX]|\d{12})$/.test(cleanNic)
  const validReceipt = typeof receiptData === 'string' && /^data:image\/(?:png|jpeg|webp|gif);base64,/.test(receiptData)
  const validDonorPhoto = donorPhotoData === '' || (typeof donorPhotoData === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/.test(donorPhotoData))
  if (!cleanName || !validNic || !cleanReference || !cleanPhone || !Number.isSafeInteger(numericAmount) || numericAmount < 100 || !validReceipt || !validDonorPhoto) {
    return response.status(400).json({ error: 'Please check the required donation details and receipt image.' })
  }
  if (Buffer.byteLength(receiptData, 'utf8') > 4_200_000) return response.status(413).json({ error: 'Receipt image exceeds the upload limit.' })
  if (Buffer.byteLength(donorPhotoData, 'utf8') > 2_800_000) return response.status(413).json({ error: 'Supporter photo exceeds the upload limit.' })

  const donation = {
    id: `HOR-${randomBytes(3).toString('hex').toUpperCase()}`,
    name: cleanName.slice(0, 100),
    nic: cleanNic,
    reference: cleanReference.slice(0, 120),
    amount: numericAmount,
    phone: cleanPhone.slice(0, 32),
    email: typeof email === 'string' ? email.trim().slice(0, 160) : '',
    receiptName: typeof receiptName === 'string' ? receiptName.slice(0, 180) : 'receipt',
    receiptData,
    donorPhotoName: donorPhotoData && typeof donorPhotoName === 'string' ? donorPhotoName.slice(0, 180) : '',
    donorPhotoData,
    status: 'pending',
    showPublicly: showPublicly === true,
    createdAt: new Date(),
  }
  await donations.insertOne(donation)
  response.status(201).json({
    donation: {
      id: donation.id,
      name: donation.name,
      amount: donation.amount,
      status: donation.status,
      showPublicly: donation.showPublicly,
      createdAt: donation.createdAt,
    },
  })
})

app.post('/api/admin/login', async (request, response) => {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body?.password === 'string' ? request.body.password : ''
  const user = await admins.findOne({ email, status: 'active' })
  if (!user || !(await verifyPassword(password, user.passwordHash))) return response.status(401).json({ error: 'Email or password is incorrect.' })
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationSeconds
  setSessionCookie(response, signSession({ email: user.email, exp: expiresAt }))
  response.json({ user: publicUser(user) })
})

app.post('/api/admin/logout', (_request, response) => {
  clearSessionCookie(response)
  response.status(204).end()
})

app.get('/api/admin/session', requireUser, (request, response) => {
  response.json({ user: publicUser(request.user) })
})

app.get('/api/admin/donations', requireUser, async (_request, response) => {
  const rows = await donations.find({}).sort({ createdAt: -1 }).toArray()
  response.json(rows.map(({ _id, ...donation }) => donation))
})

app.patch('/api/admin/donations/:id/status', requireUser, requireAdmin, async (request, response) => {
  const { status } = request.body ?? {}
  if (!['approved', 'rejected'].includes(status)) return response.status(400).json({ error: 'Invalid contribution status.' })
  const result = await donations.updateOne({ id: request.params.id }, { $set: { status, reviewedAt: new Date(), reviewedBy: request.user.email } })
  if (!result.matchedCount) return response.status(404).json({ error: 'Contribution not found.' })
  response.json({ ok: true })
})

app.get('/api/admin/users', requireUser, requireAdmin, async (_request, response) => {
  const users = await admins.find({}).sort({ createdAt: 1 }).toArray()
  response.json(users.map(publicUser))
})

app.post('/api/admin/users', requireUser, requireAdmin, async (request, response) => {
  const { name, email, password, role } = request.body ?? {}
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const cleanName = typeof name === 'string' ? name.trim() : ''
  if (!cleanName || !/^\S+@\S+\.\S+$/.test(cleanEmail) || typeof password !== 'string' || password.length < 12 || !['Admin', 'Reviewer'].includes(role)) {
    return response.status(400).json({ error: 'Enter a name, valid email, role, and password with at least 12 characters.' })
  }
  if (await admins.findOne({ email: cleanEmail })) return response.status(409).json({ error: 'An account with this email already exists.' })
  const user = { id: randomUUID(), name: cleanName.slice(0, 100), email: cleanEmail, passwordHash: await hashPassword(password), role, status: 'active', createdAt: new Date() }
  await admins.insertOne(user)
  response.status(201).json({ user: publicUser(user) })
})

app.patch('/api/admin/users/:id/status', requireUser, requireAdmin, async (request, response) => {
  const { status } = request.body ?? {}
  if (!['active', 'inactive'].includes(status)) return response.status(400).json({ error: 'Invalid account status.' })
  const target = await admins.findOne({ id: request.params.id })
  if (!target) return response.status(404).json({ error: 'Account not found.' })
  if (target.email === request.user.email && status === 'inactive') return response.status(400).json({ error: 'You cannot deactivate the account you are using.' })
  if (target.role === 'Admin' && target.status === 'active' && status === 'inactive' && await admins.countDocuments({ role: 'Admin', status: 'active' }) <= 1) {
    return response.status(400).json({ error: 'At least one active admin must remain.' })
  }
  await admins.updateOne({ id: target.id }, { $set: { status } })
  response.json({ ok: true })
})

app.delete('/api/admin/users/:id', requireUser, requireAdmin, async (request, response) => {
  const target = await admins.findOne({ id: request.params.id })
  if (!target) return response.status(404).json({ error: 'Account not found.' })
  if (target.email === request.user.email) return response.status(400).json({ error: 'You cannot delete the account you are using.' })
  if (target.role === 'Admin' && target.status === 'active' && await admins.countDocuments({ role: 'Admin', status: 'active' }) <= 1) {
    return response.status(400).json({ error: 'At least one active admin must remain.' })
  }
  await admins.deleteOne({ id: target.id })
  response.status(204).end()
})

app.put('/api/admin/settings/bank', requireUser, requireAdmin, async (request, response) => {
  if (!validBankDetails(request.body)) return response.status(400).json({ error: 'All bank detail fields are required.' })
  const bankDetails = Object.fromEntries(['bankName', 'accountName', 'accountNumber', 'branch', 'transferNote'].map((key) => [key, request.body[key].trim().slice(0, 300)]))
  await settings.updateOne({ _id: 'campaign' }, { $set: { bankDetails, updatedAt: new Date() } }, { upsert: true })
  response.json({ bankDetails })
})

app.put('/api/admin/settings/campaign-visibility', requireUser, requireAdmin, async (request, response) => {
  if (typeof request.body?.showCampaignSection !== 'boolean') return response.status(400).json({ error: 'Expected a boolean visibility value.' })
  await settings.updateOne({ _id: 'campaign' }, { $set: { showCampaignSection: request.body.showCampaignSection, updatedAt: new Date() } }, { upsert: true })
  response.json({ showCampaignSection: request.body.showCampaignSection })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Server error. Please try again.' })
})

app.listen(port, () => console.log(`Legacy of Horus API listening on http://localhost:${port}`))

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await mongo.close()
    process.exit(0)
  })
}
