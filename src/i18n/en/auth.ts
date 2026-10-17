import { PASSWORD_MIN_LENGTH } from "@/lib/validation"

/*
 * Sign in, sign up and password pages. `errors` rewrites Supabase error
 * codes for the visitor (see auth/authErrors.ts); unknown codes use
 * `general`.
 */
export default {
  intros: {
    signIn: {
      eyebrow: "Private Client Area",
      title: "Welcome back.",
      lead: "Sign in to access your orders, saved fragrances and account details.",
    },
    signUp: {
      eyebrow: "Private Client Area",
      title: "Create your private space.",
      lead: "Create an account to save fragrances, manage your details and view your order requests.",
    },
    forgotPassword: {
      eyebrow: "My Perfumeria",
      title: "Forgot password",
      lead: "Enter the email address for your account and we’ll send you a link to choose a new password.",
    },
    resetPassword: {
      eyebrow: "My Perfumeria",
      title: "New password",
      lead: "Choose a new password for your Perfumeria account.",
    },
  },
  /** Serif notes beside the forms. */
  notes: {
    signIn: "Welcome back to your private fragrance wardrobe.",
    signUp: "Keep your orders, addresses and saved fragrances in one place.",
    forgotPassword: "It happens. A new password is only an email away.",
    resetPassword:
      "Choose something memorable, at least eight characters long.",
  },
  fields: {
    email: "Email Address",
    password: "Password",
    firstName: "First Name",
    lastName: "Last Name",
    confirmPassword: "Confirm Password",
    newPassword: "New Password",
    confirmNewPassword: "Confirm New Password",
  },
  placeholders: {
    email: "you@example.com",
    password: "Enter your password",
  },
  password: {
    show: "Show",
    hide: "Hide",
    /** Visually hidden, after Show / Hide. */
    suffix: " password",
    hint: `At least ${PASSWORD_MIN_LENGTH} characters.`,
  },
  resend: "Resend confirmation email",
  checkInbox: "Check your inbox",
  signIn: {
    newHere: "New to Perfumeria?",
    createAccount: "Create an Account",
    forgot: "Forgot your password?",
    submit: "Sign In",
    submitting: "Signing In",
    resent: (email: string) =>
      `A new confirmation link has been sent to ${email}.`,
  },
  signUp: {
    haveAccount: "Already have an account?",
    signIn: "Sign In",
    submit: "Create Account",
    submitting: "Creating Account",
    sentBefore: "We’ve sent a confirmation link to ",
    sentAfter: ". Your account becomes active once you follow it.",
    resent: "A new confirmation link is on its way.",
  },
  forgotPassword: {
    remembered: "Remembered it?",
    backToSignIn: "Back to Sign In",
    submit: "Send Reset Link",
    submitting: "Sending Link",
    sentBefore: "If an account exists for ",
    sentAfter:
      ", a link to choose a new password is on its way. It may take a few minutes to arrive.",
    differentEmail: "Use a different email",
  },
  resetPassword: {
    checking: "Checking your link",
    updatedTitle: "Password updated",
    updatedText: "Your new password is set and you are signed in.",
    goToAccount: "Go to My Account",
    invalidTitle: "This link can’t be used",
    invalidDefault: "This password reset link is invalid or has expired.",
    invalidNote: "Reset links work once and expire after a short time.",
    requestNew: "Request a New Link",
    submit: "Save Password",
    submitting: "Saving",
  },
  /** Shown while a protected page waits for the stored session. */
  opening: "Opening your account",
  errors: {
    invalid_credentials: "The email or password is incorrect.",
    email_not_confirmed:
      "Please confirm your email address first. Check your inbox for the confirmation link.",
    user_already_exists:
      "An account with this email already exists. Sign in or reset your password.",
    weak_password:
      "Please choose a stronger password: at least 8 characters, avoiding common words.",
    same_password: "Your new password must be different from the current one.",
    over_email_send_rate_limit:
      "Too many emails have been requested. Please wait a few minutes and try again.",
    over_request_rate_limit:
      "Too many attempts. Please wait a few minutes and try again.",
    email_address_invalid: "Please enter a valid email address.",
    signup_disabled: "New accounts cannot be created at the moment.",
    email_provider_disabled: "Email sign-in is not available at the moment.",
    user_banned: "This account is not able to sign in.",
    session_expired: "Your session has ended. Please sign in again.",
    otp_expired: "This link has expired or has already been used.",
    request_timeout: "The request took too long. Please try again.",
    network: "We could not reach the server. Please check your connection.",
    link_invalid: "This link is invalid or has expired.",
    not_configured: "Sign-in is not available yet. Please try again later.",
    general: "Something went wrong. Please try again.",
  },
}
