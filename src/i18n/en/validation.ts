import { PASSWORD_MIN_LENGTH } from "@/lib/validation"

/*
 * Form field errors. Validators return these keys rather than text, so an
 * error shown before a language switch is re-read in the new language.
 */
export default {
  checkFields: "Please check the highlighted fields.",
  fullNameRequired: "Please enter your full name.",
  firstNameRequired: "Please enter your first name.",
  lastNameRequired: "Please enter your last name.",
  emailRequired: "Please enter your email address.",
  emailInvalid: "Please enter a valid email address.",
  phoneRequired: "Please enter your phone number.",
  phoneInvalid: "Please enter a valid phone number.",
  addressRequired: "Please enter your delivery address.",
  cityAreaRequired: "Please enter your city or area.",
  subjectRequired: "Please add a subject.",
  messageRequired: "Please write your message.",
  passwordRequired: "Please enter your password.",
  passwordChoose: "Please choose a password.",
  passwordChooseNew: "Please choose a new password.",
  passwordTooShort: `Your password needs at least ${PASSWORD_MIN_LENGTH} characters.`,
  confirmPasswordRequired: "Please confirm your password.",
  confirmNewPasswordRequired: "Please confirm your new password.",
  passwordsMismatch: "The passwords do not match.",
}
