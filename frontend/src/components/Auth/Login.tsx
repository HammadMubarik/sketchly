import { useState } from 'react'
import { useAuth } from '../../../Contexts/AuthContext'
import { Mail, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { SparklesCore } from '../ui/sparkles'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = isSignUp
        ? await signUp(email, password)
        : await signIn(email, password)

      if (error) {
        setError(error.message)
      } else if (isSignUp) {
        setError('Check your email to confirm your account!')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Left panel - animated gradient branding */}
      <div
        className="hidden md:flex md:w-1/2 items-center justify-center p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(-45deg, #0a0a0a, #1a1a1a, #111111, #0d0d0d)',
          backgroundSize: '400% 400%',
          animation: 'gradient-shift 8s ease infinite',
        }}
      >
        {/* Sparkles particle overlay */}
        <div className="absolute inset-0">
          <SparklesCore
            id="loginSparkles"
            background="transparent"
            minSize={0.6}
            maxSize={1.4}
            particleDensity={100}
            className="w-full h-full"
            particleColor="#ffffff"
          />
        </div>

        {/* Floating decorative shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-[15%] left-[10%] w-32 h-32 rounded-full opacity-10 bg-white"
            style={{ animation: 'float 6s ease-in-out infinite' }}
          />
          <div
            className="absolute top-[60%] right-[15%] w-24 h-24 rounded-2xl opacity-10 bg-white rotate-12"
            style={{ animation: 'float 8s ease-in-out infinite 1s' }}
          />
          <div
            className="absolute bottom-[20%] left-[25%] w-16 h-16 rounded-lg opacity-10 bg-white -rotate-12"
            style={{ animation: 'float 7s ease-in-out infinite 0.5s' }}
          />
        </div>

        <div className="max-w-md text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <div
              className="h-16 w-20 bg-white/90 rounded-br-xl rounded-tr-sm rounded-tl-xl rounded-bl-sm mx-auto mb-8 backdrop-blur-sm"
              style={{ animation: 'float 4s ease-in-out infinite' }}
            />
            <h1 className="text-5xl font-extrabold text-white mb-4 tracking-tight">Sketchly</h1>
            <p className="text-neutral-400 text-lg leading-relaxed">
              Collaborative UML diagramming with AI-powered shape recognition
            </p>
            <div className="mt-8 flex items-center justify-center gap-6 text-neutral-500 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                Real-time sync
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                AI recognition
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                Auto-save
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-8">
            <div className="h-10 w-12 bg-neutral-900 rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-neutral-800 dark:text-white">Sketchly</h1>
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl shadow-neutral-200/50 dark:shadow-none border border-neutral-200/80 dark:border-neutral-700 p-8">
            <h2 className="text-2xl font-bold text-neutral-800 dark:text-white mb-1 text-center">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6 text-center">
              {isSignUp ? 'Sign up to start collaborating' : 'Sign in to your account'}
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 mb-4 rounded-xl text-sm ${
                  error.includes('Check your email')
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                }`}
              >
                {error}
              </motion.div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-neutral-900 transition-colors pointer-events-none z-10" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full py-3 pl-11 pr-4 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-400 focus:ring-4 focus:ring-neutral-900/10 bg-neutral-50 dark:bg-neutral-700/50 text-neutral-800 dark:text-neutral-200 transition-all placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-neutral-900 transition-colors pointer-events-none z-10" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="w-full py-3 pl-11 pr-4 border-2 border-neutral-200 dark:border-neutral-600 rounded-xl text-sm outline-none focus:border-neutral-900 dark:focus:border-neutral-400 focus:ring-4 focus:ring-neutral-900/10 bg-neutral-50 dark:bg-neutral-700/50 text-neutral-800 dark:text-neutral-200 transition-all placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 active:bg-black disabled:bg-neutral-400 text-white py-3 px-6 rounded-xl text-sm font-semibold transition-all cursor-pointer disabled:cursor-not-allowed hover:shadow-lg hover:shadow-neutral-900/25 active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSignUp ? (
                  <><UserPlus className="h-4 w-4" /> Sign Up</>
                ) : (
                  <><LogIn className="h-4 w-4" /> Sign In</>
                )}
              </button>
            </form>

            {/* Toggle sign in/up */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                }}
                className="text-sm text-neutral-900 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 bg-transparent border-none cursor-pointer transition-colors font-medium"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
