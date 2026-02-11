import { useState } from 'react'
import { useAuth } from '../../../Contexts/AuthContext'
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react'
import { motion } from 'framer-motion'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp, signInWithGoogle } = useAuth()

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

  const handleGoogleSignIn = async () => {
    setError(null)
    setLoading(true)

    try {
      const { error } = await signInWithGoogle()
      if (error) {
        setError(error.message)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-neutral-800">
      {/* Left panel - branding */}
      <div className="hidden md:flex md:w-1/2 bg-indigo-600 items-center justify-center p-12">
        <div className="max-w-md text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-12 w-14 bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm mx-auto mb-6" />
            <h1 className="text-4xl font-bold text-white mb-4">Sketchly</h1>
            <p className="text-indigo-200 text-lg">
              Collaborative UML diagramming with AI-powered shape recognition
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-8">
            <div className="h-8 w-10 bg-black dark:bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-neutral-800 dark:text-white">Sketchly</h1>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-700 p-8">
            <h2 className="text-2xl font-bold text-neutral-800 dark:text-white mb-1 text-center">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mb-6 text-center">
              {isSignUp ? 'Sign up to start collaborating' : 'Sign in to your account'}
            </p>

            {error && (
              <div className={`p-3 mb-4 rounded-lg text-sm ${
                error.includes('Check your email')
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              }`}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full py-3 pl-10 pr-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="w-full py-3 pl-10 pr-4 border-2 border-neutral-200 dark:border-neutral-700 rounded-xl text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-400 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3 px-6 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  'Loading...'
                ) : isSignUp ? (
                  <><UserPlus className="h-4 w-4" /> Sign Up</>
                ) : (
                  <><LogIn className="h-4 w-4" /> Sign In</>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
              <span className="px-4 text-neutral-400 text-xs uppercase">or</span>
              <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* Google button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 py-3 px-6 rounded-xl text-sm font-medium border-2 border-neutral-200 dark:border-neutral-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            {/* Toggle sign in/up */}
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                }}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-transparent border-none cursor-pointer transition-colors"
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
