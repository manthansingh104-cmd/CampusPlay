import { useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, ShieldCheck, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Shell'
import { useApp } from '../app/AppContext'
import type { Role, User } from '../types'

function AuthFrame({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="relative min-h-screen bg-cover bg-center"
    style={{backgroundImage : "url('/login image.png')"}}>
      <div className="absolute inset-0 bg-black/50" />
      <header className="relative mx-auto flex max-w-7xl items-center justify-between px-5 pt-5 sm:px-10">
        <Brand />
        <Link to="/" className="text-white/70 flex items-center gap-2 text-lg font-semibold transition hover:text-white">
          <ArrowLeft size={14} /> Back home
        </Link>
      </header>
      <main className="relative mx-auto max-w-6xl items-start gap-8 px-5 sm:px-10 py-14 md:py-5">
        {/* <aside className="hidden h-[400px] rounded-[26px] md:block bg-black">
          <div>
            <p className="text-[14px] font-bold text-black uppercase tracking-[.2em] text-lime">Campus sports, together</p>
            <h2 className="mt-5 max-w-sm text-4xl font-extrabold leading-[1.04] tracking-[-.055em]">More time for the game.</h2>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
              Find tournaments, organise fixtures and keep match results in one place.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-white/15 pt-5 text-[10px] font-semibold uppercase tracking-[.12em] text-white/65">
            <span>Tournaments</span>
            <span>Fixtures</span>
            <span>Results</span>
          </div>
        </aside> */}

        <div className="mx-auto w-full max-w-[500px]">
          <p className="eyebrow">{title === 'Welcome back!' ? 'Good to see you again' : 'Join the campus lineup'}</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-[-.06em]">{title}</h1>
          <p className="text-black mt-2 text-sm">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  )
}

export function Login() {
  const { signInDemo } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [role, setRole] = useState<Role>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const next = new URLSearchParams(location.search).get('next')

  const continueAs = (selectedRole: Role) => {
    signInDemo(selectedRole)
    navigate(selectedRole === 'organizer' ? '/organizer' : next || '/app')
  }

  return (
    <AuthFrame title="Welcome back!" subtitle="Choose your account type to continue.">
      <fieldset>
        <p className="mb-2 text-xs font-bold text-black">Sign in as</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            role="radio"
            aria-checked={role === 'student'}
            onClick={() => { setRole('student'); setError('') }}
            className={`flex min-h-[84px] items-center gap-3 rounded-2xl border p-3 text-left transition ${role === 'student' ? 'border-[#9bc34e] bg-lime/50' : 'border-[var(--line)] bg-white/70 hover:bg-surface-2'}`}
          >
            <UserRound size={18} aria-hidden="true" />
            <span>
              <span className="block text-sm font-bold text-black">Student</span>
              <span className="font-semibold mt-1 block text-[10px] leading-snug">Join teams and find matches</span>
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={role === 'organizer'}
            onClick={() => { setRole('organizer'); setError('') }}
            className={`flex min-h-[84px] items-center gap-3 rounded-2xl border p-3 text-left transition ${role === 'organizer' ? 'border-[#9bc34e] bg-lime/50' : 'border-[var(--line)] bg-white/70 hover:bg-surface-2'}`}
          >
            <ShieldCheck size={18} aria-hidden="true" />
            <span>
              <span className="block text-sm font-bold text-black">Organiser</span>
              <span className="font-semibold mt-1 block text-[10px] leading-snug">Manage events and fixtures</span>
            </span>
          </button>
        </div>
      </fieldset>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!email.includes('@') || password.length < 4) {
            setError('Enter a valid campus email and a password of at least 4 characters.')
            return
          }
          continueAs(role)
        }}
        className="mt-5 space-y-4"
      >
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-black">Email address</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={role === 'student' ? 'student@campus.edu' : 'organiser@campus.edu'}
            className="input-field"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold text-black">Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            className="input-field mb-3"
          />
        </label>
        {error && <p role="alert" className="rounded-xl bg-rose-100 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <button className="flex justify-center gap-3 items-center font-semibold bg-white/70 hover:bg-surface-2 transition hover:-translate-y-[1px] w-full !rounded-xl !py-3">
          Continue as {role === 'student' ? 'Student' : 'Organiser'} <ArrowRight size={16} />
        </button>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--line)]" />
        <span className="muted text-[14px] font-semibold text-black uppercase tracking-widest mt-1">or skip to a demo</span>
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-6">
        <button onClick={() => continueAs('student')} className="surface-flat flex items-center justify-center gap-2 rounded-xl p-3 text-md font-bold text-black bg-white/70 transition hover:bg-surface-2">
          <UserRound size={15} /> Student demo
        </button>
        <button onClick={() => continueAs('organizer')} className="surface-flat flex items-center justify-center gap-2 rounded-xl p-3 text-md font-bold text-black bg-white/70 transition hover:bg-surface-2">
          <ShieldCheck size={15} /> Organiser demo
        </button>
      </div>
    </AuthFrame>
  )
}

export function Register() {
  const { addUser, showToast } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', collegeId: '', department: '', sport: '', year: '1st Year', section: 'A', role: 'student' as Role })
  const [error, setError] = useState('')
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  
  return (
    <AuthFrame title="Join the lineup." subtitle="A few details and you're ready to play.">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (form.password.length < 4) {
            setError('Choose a password with at least 4 characters.')
            return
          }
          const user: User = {
            id: `local-${Date.now()}`,
            name: form.name,
            email: form.email,
            collegeId: form.collegeId,
            department: form.department,
            sport: form.sport,
            year: form.year,
            section: form.section,
            role: form.role,
            avatarColor: '#d5f28d',
          }
          addUser(user)
          showToast('Your CampusPlay profile is ready')
          navigate(form.role === 'organizer' ? '/organizer' : '/app')
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className="sm:col-span-2">
          <span className="mb-1.5 block text-[14px] font-bold text-black">Full name</span>
          <input required value={form.name} onChange={(event) => set('name', event.target.value)} placeholder="Your name" className="input-field !py-2.5 text-sm" />
        </label>
        <label>
          <span className="mb-1.5 block text-[14px] font-bold text-black">Email</span>
          <input type="email" required value={form.email} onChange={(event) => set('email', event.target.value)} placeholder="you@campus.edu" className="input-field !py-2.5 text-sm" />
        </label>
        <label>
          <span className="mb-1.5 block text-[14px] font-bold text-black">Password</span>
          <input type="password" required value={form.password} onChange={(event) => set('password', event.target.value)} placeholder="At least 4 characters" className="input-field !py-2.5 text-sm" />
        </label>
        <label>
          <span className="mb-1.5 block text-[14px] font-bold text-black">College ID</span>
          <input required value={form.collegeId} onChange={(event) => set('collegeId', event.target.value)} placeholder="CP240186" className="input-field !py-2.5 text-sm" />
        </label>
        {form.role === 'student' ? 
          <label>
            <span className="mb-1.5 block text-[14px] font-bold text-black">Department</span>
            <select required value={form.department} onChange={(event) => set('department', event.target.value)} className="input-field !py-2.5 text-sm">
              <option value="">Choose department</option>
              {['Computer Science', 'Mechanical', 'Electrical', 'Civil', 'Business'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label> :
          <label>
            <span className="mb-1.5 block text-[14px] font-bold text-black">Sport</span>
            <select required value={form.sport} onChange={(event) => set('sport', event.target.value)} className="input-field !py-2.5 text-sm">
              <option value="">Choose sport</option>
              {['Cricket', 'Football', 'Basketball', 'Volleyball', 'Badminton', 'Table Tennis', 'Chess', 'Carrom', 'Athletics'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label> }
        
        <label>
          <span className="mb-1.5 block text-[14px] font-bold text-black">Year</span>
          <select value={form.year} onChange={(event) => set('year', event.target.value)} className="input-field !py-2.5 text-sm">
            {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-[14px] font-bold text-black">Section</span>
          <select value={form.section} onChange={(event) => set('section', event.target.value)} className="input-field !py-2.5 text-sm">
            {['A', 'B', 'C'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[14px] font-bold text-black">I’m joining as</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['student', 'organizer'] as const).map((role) => (
              <button
                type="button"
                onClick={() => set('role', role)}
                key={role}
                className={`flex items-center justify-between rounded-xl border p-3 text-[14px] font-bold text-black ${form.role === role ? 'border-[#9bc34e] bg-lime/25' : 'border-[var(--line)]'}`}
              >
                {role === 'student' ? 'Student / player' : 'Sports organiser'}
                {form.role === role && <Check size={14} />}
              </button>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="rounded-xl bg-rose-100 px-3 py-2 text-xs text-rose-700 sm:col-span-2">{error}</p>}
        <button className="flex justify-center gap-3 items-center font-semibold bg-white/70 hover:bg-white transition-transform hover:-translate-y-[1px] mt-3 w-full !rounded-xl !py-3 sm:col-span-2">Create your profile <ArrowRight size={16} /></button>
      </form>
      <p className="muted mt-5 text-center text-xs">
        Already on the team? <Link to="/login" className="font-bold text-white/70 underline decoration-lime decoration-2 underline-offset-4">Log in</Link>
      </p>
    </AuthFrame>
  )
}
