import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Check,
  Clock3,
  Eye,
  FileImage,
  Heart,
  Info,
  Landmark,
  LogOut,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import './App.css'

type DonationStatus = 'pending' | 'approved' | 'rejected'
type View = 'home' | 'login' | 'admin'
type AdminRole = 'Admin' | 'Reviewer'
type AccountStatus = 'active' | 'inactive'
type AdminTab = 'contributions' | 'users' | 'visibility' | 'bank'

interface Donation {
  id: string
  name: string
  nic: string
  reference: string
  amount: number
  phone: string
  email: string
  receiptName: string
  receiptData: string
  donorPhotoName?: string
  donorPhotoData?: string
  status: DonationStatus
  createdAt: string
  showPublicly?: boolean
  isSample?: boolean
}

interface AdminUser {
  id: string
  name: string
  email: string
  role: AdminRole
  status: AccountStatus
  createdAt: string
}

interface PublicSupporter {
  id: string
  name: string
  amount: number
  createdAt: string
  donorPhotoData?: string
  isSample?: boolean
}

type SubmittedDonation = Pick<Donation, 'id' | 'name' | 'amount' | 'status' | 'createdAt' | 'showPublicly'>

interface PublicBootstrap {
  bankDetails: BankDetails
  showCampaignSection: boolean
  raised: number
  approvedCount: number
  supporters: PublicSupporter[]
}

interface BankDetails {
  bankName: string
  accountName: string
  accountNumber: string
  branch: string
  transferNote: string
}

const FUNDRAISING_GOAL = 1_000_000
const MAX_IMAGE_INPUT_BYTES = 10 * 1024 * 1024
const WALK_DATE = new Date('2027-01-23T00:00:00+05:30')
const initialBankDetails: BankDetails = {
  bankName: 'DEMO BANK (SAMPLE)',
  accountName: 'LEGACY OF HORUS DEMO ACCOUNT',
  accountNumber: '0000000000',
  branch: 'DEMO BRANCH',
  transferNote: 'These are dummy details for testing only. Do not transfer money.',
}

const organizers = [
  { name: 'IMASHA DESHAN', role: 'Walk contact', phone: '0777447517', photo: '/organizer-01.jpg' },
  { name: 'Nimash Kithmal', role: 'Walk contact', phone: '0760579023', photo: '/organizer-02.jpg' },
  { name: 'Prabodha Rathnayaka', role: 'Walk contact', phone: '0779283450', photo: '/organizer-03.jpg' },
]

const currency = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 0,
})
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `Request failed (${response.status}).`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-LK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function optimizeImage(file: File, maxDimension: number, maxDataUrlBytes: number) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Image processing is not available in this browser.')
        context.drawImage(image, 0, 0, canvas.width, canvas.height)

        let quality = 0.9
        let dataUrl = canvas.toDataURL('image/webp', quality)
        while (dataUrl.length > maxDataUrlBytes && quality > 0.5) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/webp', quality)
        }
        if (dataUrl.length > maxDataUrlBytes) throw new Error('The optimized image is still too large. Please choose a smaller image.')
        resolve(dataUrl)
      } catch (error) {
        reject(error)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read this image. Please choose a JPG, PNG, or WebP file.'))
    }
    image.src = objectUrl
  })
}

function WalkCountdown() {
  const [clock, setClock] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const remaining = Math.max(0, WALK_DATE.getTime() - clock)
  const units = [
    { label: 'DAYS', value: Math.floor(remaining / 86_400_000) },
    { label: 'HRS', value: Math.floor((remaining % 86_400_000) / 3_600_000) },
    { label: 'MINS', value: Math.floor((remaining % 3_600_000) / 60_000) },
    { label: 'SECS', value: Math.floor((remaining % 60_000) / 1_000) },
  ]

  return (
    <div className="hero-countdown" role="timer" aria-label="Countdown to the walk on January 23, 2027">
      <span className="countdown-title">THE WALK BEGINS IN</span>
      <div className="countdown-units">
        {units.map((unit) => <span className="countdown-unit" key={unit.label}><strong>{String(unit.value).padStart(2, '0')}</strong><small>{unit.label}</small></span>)}
      </div>
      <span className="countdown-date">23 JANUARY 2027</span>
    </div>
  )
}

function App() {
  const [view, setView] = useState<View>(() => window.location.pathname === '/admin' ? 'login' : 'home')
  const [donations, setDonations] = useState<Donation[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null)
  const [publicData, setPublicData] = useState<PublicBootstrap>({ bankDetails: initialBankDetails, showCampaignSection: true, raised: 0, approvedCount: 0, supporters: [] })
  const [apiError, setApiError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [donorPhoto, setDonorPhoto] = useState<{ name: string; size: number; dataUrl: string } | null>(null)
  const [formError, setFormError] = useState('')
  const [adminError, setAdminError] = useState('')
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')
  const [adminTab, setAdminTab] = useState<AdminTab>('contributions')
  const [showCampaignSection, setShowCampaignSection] = useState(true)
  const [bankDetails, setBankDetails] = useState<BankDetails>(initialBankDetails)
  const [bankSaveMessage, setBankSaveMessage] = useState('')
  const [success, setSuccess] = useState<SubmittedDonation | null>(null)
  const [posterUnavailable, setPosterUnavailable] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [receipt, setReceipt] = useState<Donation | null>(null)

  async function refreshPublicData() {
    const data = await apiRequest<PublicBootstrap>('/public/bootstrap')
    setPublicData(data)
    setBankDetails(data.bankDetails)
    setShowCampaignSection(data.showCampaignSection)
  }

  async function refreshAdminData(role: AdminRole) {
    const rows = await apiRequest<Donation[]>('/admin/donations')
    setDonations(rows)
    if (role === 'Admin') setAdminUsers(await apiRequest<AdminUser[]>('/admin/users'))
    else setAdminUsers([])
  }

  useEffect(() => {
    let active = true
    async function initialize() {
      try {
        const data = await apiRequest<PublicBootstrap>('/public/bootstrap')
        if (!active) return
        setPublicData(data)
        setBankDetails(data.bankDetails)
        setShowCampaignSection(data.showCampaignSection)
        setApiError('')
      } catch (error) {
        if (active) setApiError(error instanceof Error ? error.message : 'Could not load campaign data.')
      }
      if (window.location.pathname === '/admin') {
        try {
          const session = await apiRequest<{ user: AdminUser }>('/admin/session')
          if (!active) return
          setCurrentUser(session.user)
          setCurrentUserEmail(session.user.email)
          setView('admin')
          await refreshAdminData(session.user.role)
        } catch {
          if (active) setView('login')
        }
      }
    }
    void initialize()
    function syncRoute() {
      if (window.location.pathname !== '/admin') {
        setView('home')
        return
      }
      void apiRequest<{ user: AdminUser }>('/admin/session')
        .then(async ({ user }) => {
          setCurrentUser(user)
          setCurrentUserEmail(user.email)
          setView('admin')
          await refreshAdminData(user.role)
        })
        .catch(() => setView('login'))
    }
    window.addEventListener('popstate', syncRoute)
    return () => {
      active = false
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  const adminRaised = useMemo(
    () => donations.reduce((total, donation) => donation.status === 'approved' ? total + donation.amount : total, 0),
    [donations],
  )
  const raised = view === 'admin' ? adminRaised : publicData.raised
  const approvedCount = view === 'admin' ? donations.filter((donation) => donation.status === 'approved').length : publicData.approvedCount
  const publicSupporters = publicData.supporters
  const activeAdmins = adminUsers.filter((user) => user.role === 'Admin' && user.status === 'active')
  const progress = Math.min((raised / FUNDRAISING_GOAL) * 100, 100)
  const visibleDonations = useMemo(() => donations.filter((donation) => {
    const matchesStatus = statusFilter === 'all' || donation.status === statusFilter
    const searchText = `${donation.name} ${donation.nic} ${donation.reference} ${donation.phone}`.toLowerCase()
    return matchesStatus && searchText.includes(search.toLowerCase())
  }).sort((left, right) => right.createdAt.localeCompare(left.createdAt)), [donations, search, statusFilter])

  function navigate(nextView: View) {
    const nextPath = nextView === 'home' ? '/' : '/admin'
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath)
    setView(nextView)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const password = String(formData.get('password') ?? '')
    setAdminError('')
    try {
      const { user } = await apiRequest<{ user: AdminUser }>('/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      setCurrentUser(user)
      setCurrentUserEmail(user.email)
      await refreshAdminData(user.role)
      navigate('admin')
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not sign in.')
    }
  }

  async function handleAdminLogout() {
    await apiRequest('/admin/logout', { method: 'POST' }).catch(() => undefined)
    setCurrentUserEmail('')
    setCurrentUser(null)
    setAdminUsers([])
    setDonations([])
    setAdminError('')
    navigate('login')
  }

  async function handleSaveBankDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const values: BankDetails = {
      bankName: String(formData.get('bankName') ?? '').trim(),
      accountName: String(formData.get('accountName') ?? '').trim(),
      accountNumber: String(formData.get('accountNumber') ?? '').trim(),
      branch: String(formData.get('branch') ?? '').trim(),
      transferNote: String(formData.get('transferNote') ?? '').trim(),
    }
    try {
      const result = await apiRequest<{ bankDetails: BankDetails }>('/admin/settings/bank', { method: 'PUT', body: JSON.stringify(values) })
      setBankDetails(result.bankDetails)
      setBankSaveMessage('Bank details saved to MongoDB and updated on the public donation page.')
    } catch (error) {
      setBankSaveMessage(error instanceof Error ? error.message : 'Could not save bank details.')
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const formData = new FormData(formElement)
    const email = String(formData.get('userEmail') ?? '').trim().toLowerCase()
    const password = String(formData.get('userPassword') ?? '')
    setUserError('')
    setUserSuccess('')

    if (password.length < 12) {
      setUserError('Password must be at least 12 characters.')
      return
    }

    try {
      const result = await apiRequest<{ user: AdminUser }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: String(formData.get('userName') ?? '').trim(),
          email,
          password,
          role: formData.get('userRole') === 'Reviewer' ? 'Reviewer' : 'Admin',
        }),
      })
      setAdminUsers((current) => [...current, result.user])
      setUserSuccess(`Account created for ${result.user.name}.`)
      formElement.reset()
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Could not create account.')
    }
  }

  async function toggleUserStatus(user: AdminUser) {
    if (user.email === currentUserEmail && user.status === 'active') {
      setUserError('You cannot deactivate the account you are currently using.')
      return
    }
    setUserError('')
    setUserSuccess('')
    try {
      const status = user.status === 'active' ? 'inactive' : 'active'
      await apiRequest(`/admin/users/${encodeURIComponent(user.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      setAdminUsers((current) => current.map((account) => account.id === user.id ? { ...account, status } : account))
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Could not update account.')
    }
  }

  async function deleteUser(user: AdminUser) {
    if (user.email === currentUserEmail) {
      setUserError('You cannot delete the account you are currently using.')
      return
    }
    setUserError('')
    setUserSuccess('')
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
      setAdminUsers((current) => current.filter((account) => account.id !== user.id))
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'Could not delete account.')
    }
  }

  async function handleDonationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setFormError('')
    const formData = new FormData(formElement)
    const nic = String(formData.get('nic') ?? '').trim()

    if (!/^(?:\d{9}[vVxX]|\d{12})$/.test(nic)) {
      setFormError('Enter a valid NIC: 9 digits followed by V/X, or 12 digits.')
      return
    }
    if (!selectedFile) {
      setFormError('Please attach your payment receipt to continue.')
      return
    }
    if (selectedFile.size > MAX_IMAGE_INPUT_BYTES) {
      setFormError('The receipt must be 10 MB or smaller.')
      return
    }

    try {
      const donationPayload = {
        name: String(formData.get('name') ?? '').trim(),
        nic,
        reference: String(formData.get('reference') ?? '').trim(),
        amount: Number(formData.get('amount')),
        phone: String(formData.get('phone') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        receiptName: selectedFile.name,
        receiptData: await optimizeImage(selectedFile, 2200, 4_000_000),
        donorPhotoName: donorPhoto?.name ?? '',
        donorPhotoData: donorPhoto?.dataUrl ?? '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        showPublicly: formData.get('publicConsent') === 'yes',
      }
      const { donation } = await apiRequest<{ donation: SubmittedDonation }>('/public/donations', { method: 'POST', body: JSON.stringify(donationPayload) })
      setSuccess(donation)
      setSelectedFile(null)
      setDonorPhoto(null)
      formElement.reset()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not submit the contribution. Please try again.')
    }
  }

  async function updateStatus(id: string, status: DonationStatus) {
    await apiRequest(`/admin/donations/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setDonations((current) => current.map((donation) => donation.id === id ? { ...donation, status } : donation))
    await refreshPublicData()
  }

  async function updateCampaignVisibility(show: boolean) {
    const result = await apiRequest<{ showCampaignSection: boolean }>('/admin/settings/campaign-visibility', { method: 'PUT', body: JSON.stringify({ showCampaignSection: show }) })
    setShowCampaignSection(result.showCampaignSection)
    setPublicData((current) => ({ ...current, showCampaignSection: result.showCampaignSection }))
  }

  function handleReceiptFile(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormError('Please upload a receipt image in JPG, PNG, or WebP format.')
      return
    }
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      setFormError('The receipt must be 10 MB or smaller.')
      return
    }
    setFormError('')
    setSelectedFile(file)
  }

  async function handleDonorPhoto(file?: File) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormError('Please choose a supporter photo in JPG, PNG, or WebP format.')
      return
    }
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      setFormError('The supporter photo must be 10 MB or smaller.')
      return
    }
    try {
      setDonorPhoto({ name: file.name, size: file.size, dataUrl: await optimizeImage(file, 1200, 2_600_000) })
      setFormError('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not read the supporter photo.')
    }
  }

  return (
    <div className="site-shell">
      <div className="ticker" aria-label="Fundraising campaign announcement">
        <div className="ticker-track">
          {Array.from({ length: 4 }, (_, index) => (
            <span className="ticker-copy" key={index}>
              <span className="ticker-dot" /> LEGACY OF HORUS WALK 2027 <span>·</span> EVERY STEP BUILDS A BETTER TOMORROW <span>·</span> DONATIONS OPEN <span>·</span>
            </span>
          ))}
        </div>
      </div>

      <header className="site-header">
        <button className="brand-mark" onClick={() => navigate('home')} aria-label="Legacy of Horus home">
          <span className="brand-seal">H</span>
          <span className="brand-name">LEGACY <span>OF HORUS</span></span>
        </button>
        {view === 'home' ? (
          <nav className="desktop-nav" aria-label="Main navigation">
            <button className="nav-link active" onClick={() => navigate('home')}>The walk</button>
            <a className="nav-link" href="#legacy-story">Our story</a>
            <a className="nav-link" href="#donate">Donate</a>
            <a className="nav-link" href="#organizers">Contact</a>
          </nav>
        ) : null}
        {view !== 'home' ? (
          <button className="admin-nav" onClick={view === 'admin' ? handleAdminLogout : () => navigate('home')}>
            {view === 'admin' ? <LogOut size={15} /> : <ArrowLeft size={15} />}
            {view === 'admin' ? 'Sign out' : 'Back to site'}
          </button>
        ) : null}
      </header>
      {apiError ? <p className="api-error" role="alert">{apiError}</p> : null}

      {view === 'home' ? (
        <main>
          <section className={`hero ${posterUnavailable ? 'poster-missing' : ''}`} aria-labelledby="hero-title">
            <img className="hero-poster" src="/horus-poster.jpg" alt="Egyptian skull and golden pharaoh artwork for the Legacy of Horus walk" onError={() => setPosterUnavailable(true)} />
            <div className="hero-scrim" />
            <div className="hero-atmosphere" aria-hidden="true" />
            <div className="hero-fire" aria-hidden="true">
              <div className="fire-embers">
                {Array.from({ length: 24 }, (_, index) => <span className="fire-ember" key={`ember-${index}`} />)}
              </div>
            </div>
            <div className="hero-frame" aria-hidden="true" />
            <div className="hero-content">
              <p className="eyebrow"><span className="eyebrow-rule" /> 2003 BORN BATCH · WALK FUNDRAISING <span className="eyebrow-rule" /></p>
              <h1 id="hero-title">One Walk.<br /><em>One Legacy.</em></h1>
              <p className="hero-intro">Together, we make it happen. One journey, countless memories, and a legacy we build as one.</p>
              <div className="hero-actions">
                <a className="button button-gold" href="#donate">Make a contribution <ArrowUpRight size={17} /></a>
                <a className="text-link" href="#campaign">Explore the campaign <ArrowDownRight size={15} /></a>
              </div>
            </div>
            <div className="hero-caption"><span>01 / 03</span><span>THE WALK · JAN 23, 2027</span><span className="caption-line" /></div>
            <div className="hero-note"><span className="note-mark">✳</span><span>SMALL STEPS.<br />LASTING IMPACT.</span></div>
            <WalkCountdown />
            <a className="scroll-cue" href="#campaign" aria-label="Scroll to campaign"><span /> SCROLL TO EXPLORE</a>
          </section>

          <section className="campaign-band" id="campaign" aria-label="Campaign fundraising summary">
            <div className="campaign-label"><span className="section-index">01</span><span>THE CAMPAIGN</span></div>
            <div className={`campaign-main ${showCampaignSection ? '' : 'progress-hidden'}`}>
              <div className="campaign-copy">
                <p className="eyebrow eyebrow-dark">2003 BORN BATCH · WALK FUNDRAISING</p>
                <h2>Every step builds<br /><em>our legacy.</em></h2>
                <p className="body-copy">A shared goal powered by one batch, one bond, and every contribution.</p>
              </div>
              {showCampaignSection ? <div className="progress-panel">
                <div className="progress-heading"><span>FUNDRAISING PROGRESS</span><span className="live-dot">LIVE</span></div>
                <strong className="raised-amount">{currency.format(raised)}</strong>
                <div className="progress-track" role="progressbar" aria-label="Fundraising progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-meta"><span>{Math.round(progress)}% reached</span><span>GOAL {currency.format(FUNDRAISING_GOAL)}</span></div>
              </div> : null}
            </div>
          </section>

          <section className="legacy-story-section" id="legacy-story" aria-labelledby="legacy-story-title">
            <div className="legacy-story-inner">
              <figure className="legacy-story-visual">
                <img src="/presidents-college-embilipitiya.jpg" alt="President's College, Embilipitiya school building illuminated at night" loading="lazy" />
                <span className="story-image-number" aria-hidden="true">2003</span>
                <figcaption><span>WHERE OUR STORY BEGAN</span><strong>President's College · Embilipitiya</strong></figcaption>
              </figure>

              <article className="legacy-story-copy">
                <p className="eyebrow"><span className="eyebrow-rule" /> OUR STORY · ONE GENERATION</p>
                <h2 id="legacy-story-title">Bound by memories.<br /><em>United by legacy.</em></h2>
                <div className="story-language story-english">
                  <span className="story-language-label">EN · OUR PURPOSE</span>
                  <p>Born in 2003, connected by countless memories, and united by a friendship that time can never fade. Now, it's our turn to come together once again and make our upcoming Walk an unforgettable experience.</p>
                  <p>Your support and contributions will help us bring this vision to life, creating something truly special that represents our unity, friendship, and batch spirit.</p>
                  <strong>Every contribution matters. Every effort counts. Let's create a legacy worth remembering!</strong>
                </div>

                <div className="story-divider" aria-hidden="true"><span /><i>✦</i><span /></div>

                <div className="story-language story-sinhala" lang="si">
                  <span className="story-language-label">සිං · අපේ කතාව</span>
                  <p>2003 වසරේ උපත ලබා, පාසල් ජීවිතයේ සුන්දර මතකයන්ගෙන් බැඳුණු අපි, කාලයත් සමඟ විවිධ මංමාවත් ඔස්සේ ගමන් කළත් අපේ මිතුදම තවමත් නොවෙනස්ව පවතී.</p>
                  <p>ඒ නොමැකෙන මිතුදමත්, සහෝදරත්වයත්, එකමුතුකමත් යළි එක්තැන් කරමින් සංවිධානය කරන අපේ Walk එක සාර්ථක කරගැනීමට ඔබ සැමගේ සහයෝගය අපි බලාපොරොත්තු වෙමු.</p>
                  <p>මේ සුවිශේෂී අවස්ථාව යථාර්ථයක් බවට පත් කිරීමට අවශ්‍ය අරමුදල් රැස් කිරීම සඳහා ඔබ ලබාදෙන සෑම දායකත්වයක්ම අපට මහත් ශක්තියක් වේ.</p>
                  <strong>එකම පරපුරක්. නොමැකෙන මිතුදමක්. අමතක නොවන ගමනක්!</strong>
                </div>

                <div className="story-closing">
                  <em>Your Support. Our Strength. Our Legacy.</em>
                  <a className="button button-gold" href="#donate">Support the walk <ArrowUpRight size={17} /></a>
                </div>
              </article>
            </div>
          </section>

          <section className="donation-section" id="donate">
            <div className="donation-intro">
              <p className="eyebrow"><span className="eyebrow-rule" /> YOUR STEP MATTERS</p>
              <h2>Give what<br /><em>you can.</em></h2>
              <p className="body-copy">Make a bank transfer, then send us your details and receipt. Our team will verify it and update the campaign total.</p>
              <div className="payment-note">
                <Landmark size={17} />
                <div className="public-bank-details">
                  <div className="public-bank-title"><strong>Bank transfer details</strong><span>DEMO DATA</span></div>
                  <dl>
                    <div><dt>Bank</dt><dd>{bankDetails.bankName}</dd></div>
                    <div><dt>Account name</dt><dd>{bankDetails.accountName}</dd></div>
                    <div><dt>Account number</dt><dd>{bankDetails.accountNumber}</dd></div>
                    <div><dt>Branch</dt><dd>{bankDetails.branch}</dd></div>
                  </dl>
                  <p>{bankDetails.transferNote}</p>
                </div>
              </div>
              <p className="demo-note"><Clock3 size={14} /> Demo website: payments are not processed here.</p>
            </div>
            <form className="donation-form" onSubmit={handleDonationSubmit}>
              <div className="form-heading"><div><span className="form-kicker">CONTRIBUTION FORM</span><h3>Send your contribution</h3></div><Heart size={20} /></div>
              {success ? (
                <div className="success-message" role="status">
                  <span className="success-icon"><Check size={21} /></span>
                  <div><strong>Details received</strong><p>Thank you, {success.name}. Your reference is <b>{success.id}</b>. Your receipt is waiting for review. {success.showPublicly ? 'Your name and amount will appear in the public supporters list after approval.' : 'Your name and amount will stay off the public supporters list.'}</p></div>
                  <button type="button" className="icon-button" onClick={() => setSuccess(null)} aria-label="Close confirmation"><X size={17} /></button>
                </div>
              ) : null}
              <div className="form-grid">
                <label className="field field-wide">Full name<input name="name" type="text" placeholder="Name on your bank transfer" autoComplete="name" required /></label>
                <div className="donor-photo-field field-wide">
                  <span className="upload-label">Supporter photo <span className="required-note">OPTIONAL · UP TO 10 MB</span></span>
                  <label className={`donor-photo-upload ${donorPhoto ? 'has-photo' : ''}`}>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { void handleDonorPhoto(event.target.files?.[0]) }} />
                    <span className="donor-photo-preview">{donorPhoto ? <img src={donorPhoto.dataUrl} alt="Selected supporter" /> : <UserRound size={22} />}</span>
                    <span className="donor-photo-copy"><strong>{donorPhoto ? donorPhoto.name : 'Add a photo of yourself'}</strong><small>{donorPhoto ? `${(donorPhoto.size / 1024).toFixed(0)} KB · Ready to share` : 'A square portrait works best · JPG, PNG or WebP'}</small></span>
                    {donorPhoto ? <button className="remove-file" type="button" aria-label="Remove supporter photo" onClick={(event) => { event.preventDefault(); setDonorPhoto(null); const input = event.currentTarget.parentElement?.querySelector('input[type=file]') as HTMLInputElement | null; if (input) input.value = '' }}><X size={15} /></button> : <span className="upload-action">CHOOSE PHOTO</span>}
                  </label>
                  <p className="donor-photo-note">Your photo appears only after approval and only when you choose to join the public supporters list.</p>
                </div>
                <label className="field">NIC number<input name="nic" type="text" placeholder="e.g. 200012345678" autoComplete="off" required /></label>
                <label className="field">Payment reference<input name="reference" type="text" placeholder="Bank transfer reference" required /></label>
                <label className="field">Amount (LKR)<input name="amount" type="number" min="100" step="1" placeholder="5000" required /></label>
                <label className="field">Phone number<input name="phone" type="tel" placeholder="07X XXX XXXX" autoComplete="tel" required /></label>
                <label className="field field-wide">Email address <span className="optional">OPTIONAL</span><input name="email" type="email" placeholder="you@example.com" autoComplete="email" /></label>
                <label className="public-consent"><input name="publicConsent" type="checkbox" value="yes" /><span>I agree to display my name, contribution amount, and uploaded photo (if provided) in the public supporters list after payment approval. <small>OPTIONAL</small></span></label>
                <div className="field field-wide">
                  <span className="upload-label">Payment receipt <span className="required-note">REQUIRED · IMAGE UP TO 10 MB</span></span>
                  <label className={`upload-box ${selectedFile ? 'has-file' : ''}`}>
                    <input type="file" accept="image/*" onChange={(event) => handleReceiptFile(event.target.files?.[0])} />
                    {selectedFile ? <FileImage size={20} /> : <Upload size={20} />}
                    <span><strong>{selectedFile ? selectedFile.name : 'Choose receipt image'}</strong><small>{selectedFile ? `${(selectedFile.size / 1024).toFixed(0)} KB · Ready to optimize and submit` : 'JPG, PNG or WebP'}</small></span>
                    {selectedFile ? <button className="remove-file" type="button" aria-label="Remove receipt" onClick={(event) => { event.preventDefault(); setSelectedFile(null) }}><X size={15} /></button> : <span className="upload-action">BROWSE</span>}
                  </label>
                </div>
              </div>
              {formError ? <p className="form-error" role="alert">{formError}</p> : null}
              <button className="button button-gold submit-button" type="submit">Submit for verification <ArrowUpRight size={17} /></button>
              <p className="privacy-note"><ShieldCheck size={14} /> Your details are only used to verify this contribution.</p>
            </form>
          </section>

          <section className="supporters-section" id="supporters" aria-labelledby="supporters-title">
            <div className="supporters-heading"><div><p className="eyebrow"><span className="eyebrow-rule" /> WITH THANKS</p><h2 id="supporters-title">Our supporters.</h2><p>Verified contributions from people who agreed to be listed publicly.</p></div><span className="supporter-count"><Users size={15} /> {publicSupporters.length} LISTED</span></div>
            {publicSupporters.length > 0 ? (
              <ol className="supporter-list">
                {publicSupporters.map((donation, index) => (
                  <li className="supporter-row" key={donation.id}>
                    <span className="supporter-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="supporter-avatar">{donation.donorPhotoData ? <img src={donation.donorPhotoData} alt={`${donation.name} supporter portrait`} /> : <span>{donation.name.trim().charAt(0).toUpperCase()}</span>}</span>
                    <span className="supporter-name">{donation.name}{donation.isSample ? <small>DEMO</small> : null}</span>
                    <span className="supporter-date">{formatDate(donation.createdAt)}</span>
                    <strong className="supporter-amount">{currency.format(donation.amount)}</strong>
                  </li>
                ))}
              </ol>
            ) : <p className="supporters-empty">No verified public contributions yet. Be the first to support the walk.</p>}
            <p className="supporters-privacy"><ShieldCheck size={14} /> Only names, approved amounts, and optional photos are shown with consent. Contact, NIC, bank reference, and receipt stay private.</p>
          </section>

          <section className="organizers-section" id="organizers">
            <div className="organizers-heading"><div><p className="eyebrow"><span className="eyebrow-rule" /> EVENT SUPPORT</p><h2>We're here to help.</h2></div><p>Questions about the walk or contributions? Contact the organizing team directly.</p></div>
            <div className="organizer-list">
              {organizers.map((organizer, index) => (
                <article className="organizer-support-card" key={organizer.name}>
                  <div className="contact-card-top"><span className="contact-category">EVENT SUPPORT</span><span className="contact-top-note">WE'RE HERE TO HELP</span></div>
                  <div className="contact-card-main">
                    <div className="organizer-photo" aria-hidden="true"><img src={organizer.photo} alt="" onError={(event) => { event.currentTarget.hidden = true }} /><span>0{index + 1}</span></div>
                    <div className="contact-card-details">
                      <span className="contact-team-label">LEGACY OF HORUS · ORGANIZING TEAM</span>
                      <h3>{organizer.name}</h3>
                      <p>Questions about the walk or contributions? Our {organizer.role.toLowerCase()} is ready to help.</p>
                      <div className="contact-quick-links">
                        <a href={`tel:${organizer.phone}`}><Phone size={13} /> {organizer.phone}</a>
                        <a href={`https://wa.me/${organizer.phone.replace(/^0/, '94')}?text=${encodeURIComponent(`Hello ${organizer.name}, I would like to ask about the Legacy of Horus walk.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp Support</a>
                      </div>
                    </div>
                  </div>
                  <div className="contact-card-actions">
                    <a className="contact-more-button" href="#campaign"><Info size={16} /> More Details</a>
                    <a className="contact-direct-button" href={`https://wa.me/${organizer.phone.replace(/^0/, '94')}?text=${encodeURIComponent(`Hello ${organizer.name}, I would like to ask about the Legacy of Horus walk.`)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Contact</a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="developer-showcase" aria-label="Website developer credit">
            <div className="developer-heading"><span>DEVELOPED BY</span></div>
            <p className="developer-subtitle">Crafted with care for Legacy of Horus Walk 2027</p>
            <div className="developer-brands" aria-label="Legacy of Horus campaign brands">
              <div className="developer-brand-card">
                <span className="developer-brand-seal">H</span>
                <span className="developer-brand-copy"><strong>LEGACY OF HORUS</strong><small>WALK WITH PURPOSE</small></span>
              </div>
              <div className="developer-brand-card developer-walk-card">
                <span className="developer-year">2027</span>
                <span className="developer-brand-copy"><strong>COMMUNITY WALK</strong><small>EVERY STEP BUILDS A BETTER TOMORROW</small></span>
              </div>
            </div>
            <div className="developer-divider" aria-hidden="true"><span /><i>✦</i><span /></div>
            <div className="developer-signature">
              <span className="developer-kicker">DESIGNED &amp; DEVELOPED BY</span>
              <div className="developer-contact">
                <strong>NIMASH KITHMAL</strong>
                <a href="https://wa.me/94760579023?text=Hello%20Nimash%2C%20I%20saw%20the%20Legacy%20of%20Horus%20website." target="_blank" rel="noreferrer" aria-label="WhatsApp Nimash Kithmal"><MessageCircle size={19} /></a>
              </div>
            </div>
          </section>
          <footer className="site-footer"><span className="footer-brand">LEGACY <em>OF HORUS</em></span><span>WALK WITH PURPOSE · 2027</span><span>BUILT BY COMMUNITY, FOR COMMUNITY</span></footer>
        </main>
      ) : view === 'login' ? (
        <main className="admin-login-page">
          <section className="admin-login-panel">
            <div className="login-emblem"><ShieldCheck size={23} /></div>
            <p className="eyebrow"><span className="eyebrow-rule" /> PRIVATE AREA</p>
            <h1>Admin<br /><em>sign in.</em></h1>
            <p className="login-description">Sign in to review contributions and verify payment receipts.</p>
            <form className="admin-login-form" onSubmit={handleAdminLogin}>
              <label className="field">Email address<input name="email" type="email" placeholder="admin@example.com" autoComplete="username" required /></label>
              <label className="field">Password<input name="password" type="password" placeholder="Enter password" autoComplete="current-password" required /></label>
              {adminError ? <p className="form-error" role="alert">{adminError}</p> : null}
              <button className="button button-gold submit-button" type="submit">Sign in <ArrowUpRight size={17} /></button>
            </form>
            <p className="login-warning"><ShieldCheck size={14} /> Secure server session. Access is limited to active campaign accounts.</p>
          </section>
        </main>
      ) : (
        <main className="admin-page">
          <div className="admin-topline"><p className="eyebrow"><span className="eyebrow-rule" /> LEGACY OF HORUS · ADMIN</p><span className="demo-admin"><span /> SECURE ADMIN PANEL</span></div>
          <div className="admin-title-row"><div><h1>{adminTab === 'users' ? <>User<br /><em>management.</em></> : adminTab === 'visibility' ? <>Campaign<br /><em>visibility.</em></> : adminTab === 'bank' ? <>Bank<br /><em>details.</em></> : <>Contribution<br /><em>ledger.</em></>}</h1><p>{adminTab === 'users' ? 'Manage team accounts and their access to the campaign.' : adminTab === 'visibility' ? 'Choose whether the campaign progress section appears on the public homepage.' : adminTab === 'bank' ? 'Set the transfer details shown to people making a contribution.' : 'Review submitted receipts and keep the walk total up to date.'}</p></div><div className="admin-mark"><UserRound size={23} /><span>{currentUser?.name}<br />{currentUser?.role.toUpperCase()} ACCOUNT</span></div></div>
          <div className="admin-stats">
            <article><span>CONFIRMED TOTAL</span><strong>{currency.format(raised)}</strong><small>Approved contributions only</small></article>
            <article><span>CONTRIBUTIONS</span><strong>{donations.length.toString().padStart(2, '0')}</strong><small>{approvedCount} approved</small></article>
            <article><span>AWAITING REVIEW</span><strong>{donations.filter((donation) => donation.status === 'pending').length.toString().padStart(2, '0')}</strong><small>Receipt verification needed</small></article>
          </div>
          <div className="admin-tabs" role="tablist" aria-label="Admin sections">
            <button role="tab" aria-selected={adminTab === 'contributions'} className={adminTab === 'contributions' ? 'admin-tab active' : 'admin-tab'} onClick={() => { setAdminTab('contributions'); setUserError(''); setUserSuccess('') }}><FileImage size={15} /> Contributions</button>
            {currentUser?.role === 'Admin' ? <button role="tab" aria-selected={adminTab === 'users'} className={adminTab === 'users' ? 'admin-tab active' : 'admin-tab'} onClick={() => { setAdminTab('users'); setUserError(''); setUserSuccess('') }}><Users size={15} /> User management <span>{adminUsers.length}</span></button> : null}
            {currentUser?.role === 'Admin' ? <button role="tab" aria-selected={adminTab === 'visibility'} className={adminTab === 'visibility' ? 'admin-tab active' : 'admin-tab'} onClick={() => setAdminTab('visibility')}><Eye size={15} /> Campaign visibility</button> : null}
            {currentUser?.role === 'Admin' ? <button role="tab" aria-selected={adminTab === 'bank'} className={adminTab === 'bank' ? 'admin-tab active' : 'admin-tab'} onClick={() => { setAdminTab('bank'); setBankSaveMessage('') }}><Landmark size={15} /> Bank details</button> : null}
          </div>
          {adminTab === 'contributions' || currentUser?.role !== 'Admin' ? <section className="ledger-section">
            <div className="ledger-heading"><div><span className="form-kicker">DONOR RECORDS</span><h2>Recent contributions</h2></div><div className="ledger-tools"><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or reference" aria-label="Search donor records" /></label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div></div>
            <div className="table-wrap"><table><thead><tr><th>DONOR</th><th>REFERENCE / NIC</th><th>AMOUNT</th><th>PUBLIC LIST</th><th>RECEIPT</th><th>DATE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
              {visibleDonations.map((donation) => (
                <tr key={donation.id}>
                  <td><div className="admin-donor"><span className="admin-donor-avatar">{donation.donorPhotoData ? <img src={donation.donorPhotoData} alt="" /> : <UserRound size={15} />}</span><span><strong>{donation.name}</strong><small>{donation.phone}</small>{donation.isSample ? <span className="sample-tag table-sample">SAMPLE</span> : null}</span></div></td>
                  <td><strong>{donation.reference}</strong><small>{donation.nic}</small></td>
                  <td className="amount-cell">{currency.format(donation.amount)}</td>
                  <td><span className={`public-consent-status ${donation.showPublicly ? 'consent-public' : 'consent-private'}`}>{donation.showPublicly ? 'Public' : 'Private'}</span></td>
                  <td>{donation.receiptData ? <button className="receipt-link" onClick={() => setReceipt(donation)}><FileImage size={15} /> View</button> : <span className="muted">Sample</span>}</td>
                  <td>{formatDate(donation.createdAt)}</td>
                  <td><span className={`status-pill status-${donation.status}`}><span />{donation.status}</span></td>
                  <td><div className="row-actions">{donation.status === 'pending' && currentUser?.role === 'Admin' ? <><button className="approve-action" onClick={() => { void updateStatus(donation.id, 'approved').catch((error: unknown) => setApiError(error instanceof Error ? error.message : 'Could not approve contribution.')) }} aria-label={`Approve ${donation.name}`} title="Approve"><Check size={15} /></button><button className="reject-action" onClick={() => { void updateStatus(donation.id, 'rejected').catch((error: unknown) => setApiError(error instanceof Error ? error.message : 'Could not reject contribution.')) }} aria-label={`Reject ${donation.name}`} title="Reject"><X size={15} /></button></> : <span className="muted">{donation.status === 'pending' ? 'Review only' : donation.status === 'approved' ? 'Counted' : 'Closed'}</span>}</div></td>
                </tr>
              ))}
              {visibleDonations.length === 0 ? <tr><td className="empty-row" colSpan={8}>No contributions match this search.</td></tr> : null}
            </tbody></table></div>
            <p className="ledger-footnote"><BadgeCheck size={15} /> The total includes approved entries only. Demo data is marked and should be cleared before launch.</p>
          </section> : adminTab === 'users' ? (
            <section className="user-management-section">
              <div className="user-management-heading"><div><span className="form-kicker">TEAM ACCESS</span><h2>Manage user accounts</h2><p>Create admin accounts or reviewer accounts for receipt review.</p></div><span className="user-count"><Users size={16} /> {adminUsers.length} ACCOUNTS</span></div>
              <form className="user-create-form" onSubmit={handleCreateUser}>
                <label className="field">Full name<input name="userName" type="text" placeholder="Team member name" autoComplete="name" required /></label>
                <label className="field">Email address<input name="userEmail" type="email" placeholder="name@example.com" autoComplete="off" required /></label>
                <label className="field">Initial password<input name="userPassword" type="password" placeholder="At least 12 characters" minLength={12} autoComplete="new-password" required /></label>
                <label className="field">Access role<select name="userRole" className="user-role-select"><option value="Reviewer">Reviewer</option><option value="Admin">Admin</option></select></label>
                <button className="button button-gold create-user-button" type="submit"><UserPlus size={16} /> Add user</button>
                {userError ? <p className="form-error user-form-message" role="alert">{userError}</p> : null}
                {userSuccess ? <p className="user-success user-form-message" role="status">{userSuccess}</p> : null}
              </form>
              <div className="user-table-wrap"><table className="user-table"><thead><tr><th>USER</th><th>ROLE</th><th>STATUS</th><th>ADDED</th><th>ACCOUNT ACTIONS</th></tr></thead><tbody>
                {adminUsers.map((user) => {
                  const signedInUser = user.email === currentUserEmail
                  const lastActiveAdmin = user.role === 'Admin' && user.status === 'active' && activeAdmins.length <= 1
                  return <tr key={user.id}>
                    <td><strong>{user.name}{signedInUser ? <span className="signed-in-badge">YOU</span> : null}</strong><small>{user.email}</small></td>
                    <td><span className={`role-label role-${user.role.toLowerCase()}`}>{user.role}</span></td>
                    <td><span className={`account-status account-${user.status}`}><span />{user.status}</span></td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td><div className="user-actions"><button className="account-toggle" disabled={signedInUser || lastActiveAdmin} title={signedInUser ? 'You cannot deactivate your signed-in account' : lastActiveAdmin ? 'Keep at least one active admin' : ''} onClick={() => toggleUserStatus(user)}>{user.status === 'active' ? 'Deactivate' : 'Activate'}</button><button className="account-delete" disabled={signedInUser || lastActiveAdmin} title={signedInUser ? 'You cannot delete your signed-in account' : lastActiveAdmin ? 'Keep at least one active admin' : ''} onClick={() => { if (window.confirm(`Delete ${user.name}'s account?`)) deleteUser(user) }} aria-label={`Delete ${user.name}`}><Trash2 size={15} /></button></div></td>
                  </tr>
                })}
              </tbody></table></div>
              <p className="user-storage-note"><ShieldCheck size={14} /> Accounts are stored in MongoDB. Passwords are hashed on the server and are never returned to the browser.</p>
            </section>
          ) : adminTab === 'visibility' ? (
            <section className="campaign-visibility-section">
              <div className="visibility-card">
                <div className="visibility-copy">
                  <span className="form-kicker">PUBLIC HOMEPAGE</span>
                  <h2>Fundraising progress card</h2>
                  <p>Controls only the live amount, percentage reached, goal, progress bar, and confirmed contribution count.</p>
                </div>
                <label className="visibility-control">
                  <input type="checkbox" checked={showCampaignSection} onChange={(event) => { void updateCampaignVisibility(event.target.checked).catch((error: unknown) => setApiError(error instanceof Error ? error.message : 'Could not save campaign visibility.')) }} />
                  <span className="visibility-switch" aria-hidden="true"><span /></span>
                  <span className="visibility-state">{showCampaignSection ? 'VISIBLE' : 'HIDDEN'}</span>
                </label>
              </div>
              <p className="visibility-note" role="status">{showCampaignSection ? 'The fundraising progress card is currently visible to visitors.' : 'The fundraising progress card is hidden. The campaign story and walk details remain visible.'}</p>
            </section>
          ) : (
            <section className="bank-settings-section">
              <div className="bank-settings-heading"><div><span className="form-kicker">PUBLIC DONATION PAGE</span><h2>Bank transfer details</h2><p>Saved values appear in the contribution section immediately.</p></div><span className="demo-bank-badge"><span /> DUMMY VALUES</span></div>
              <form className="bank-details-form" onSubmit={handleSaveBankDetails}>
                <label className="field">Bank name<input name="bankName" type="text" defaultValue={bankDetails.bankName} required /></label>
                <label className="field">Account holder name<input name="accountName" type="text" defaultValue={bankDetails.accountName} required /></label>
                <label className="field">Account number<input name="accountNumber" type="text" inputMode="numeric" defaultValue={bankDetails.accountNumber} required /></label>
                <label className="field">Branch<input name="branch" type="text" defaultValue={bankDetails.branch} required /></label>
                <label className="field bank-note-field">Transfer note<textarea name="transferNote" defaultValue={bankDetails.transferNote} rows={3} required /></label>
                <p className="bank-demo-warning"><ShieldCheck size={15} /> Dummy data only. Replace with verified account information before accepting real transfers.</p>
                {bankSaveMessage ? <p className="user-success bank-save-message" role="status">{bankSaveMessage}</p> : null}
                <button className="button button-gold save-bank-button" type="submit"><Check size={16} /> Save bank details</button>
              </form>
            </section>
          )}
          <div className="admin-bottom"><span>MONGODB PERSISTENCE · NOT A LIVE PAYMENT SYSTEM</span><button onClick={() => navigate('home')}>Return to campaign <ArrowUpRight size={15} /></button></div>
        </main>
      )}

      {view === 'home' ? (
        <nav className="mobile-dock" aria-label="Quick navigation">
          <button className="dock-active" onClick={() => navigate('home')}><span>H</span>Campaign</button>
          <a href="#legacy-story"><Landmark size={17} />Story</a>
          <a href="#donate"><Heart size={17} />Donate</a>
        </nav>
      ) : null}

      {receipt ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setReceipt(null)}>
          <section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title" onClick={(event) => event.stopPropagation()}>
            <div className="receipt-modal-head"><div><span className="form-kicker">{receipt.reference}</span><h2 id="receipt-title">Payment receipt</h2></div><button className="icon-button" onClick={() => setReceipt(null)} aria-label="Close receipt"><X size={19} /></button></div>
            <p>{receipt.name} · {currency.format(receipt.amount)}</p>
            <img src={receipt.receiptData} alt={`Receipt uploaded by ${receipt.name}`} />
          </section>
        </div>
      ) : null}
    </div>
  )
}

export default App
