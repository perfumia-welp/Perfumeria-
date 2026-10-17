import { PASSWORD_MIN_LENGTH } from "@/lib/validation"
import type { Messages } from "../messages"

export default {
  checkFields: "يُرجى مراجعة الحقول المحدّدة.",
  fullNameRequired: "يُرجى إدخال اسمك الكامل.",
  firstNameRequired: "يُرجى إدخال اسمك الأول.",
  lastNameRequired: "يُرجى إدخال اسم العائلة.",
  emailRequired: "يُرجى إدخال بريدك الإلكتروني.",
  emailInvalid: "يُرجى إدخال بريد إلكتروني صحيح.",
  phoneRequired: "يُرجى إدخال رقم هاتفك.",
  phoneInvalid: "يُرجى إدخال رقم هاتف صحيح.",
  addressRequired: "يُرجى إدخال عنوان التوصيل.",
  cityAreaRequired: "يُرجى إدخال المدينة أو المنطقة.",
  subjectRequired: "يُرجى إضافة موضوع.",
  messageRequired: "يُرجى كتابة رسالتك.",
  passwordRequired: "يُرجى إدخال كلمة المرور.",
  passwordChoose: "يُرجى اختيار كلمة مرور.",
  passwordChooseNew: "يُرجى اختيار كلمة مرور جديدة.",
  passwordTooShort: `يجب أن تتكوّن كلمة المرور من ${PASSWORD_MIN_LENGTH} أحرف على الأقل.`,
  confirmPasswordRequired: "يُرجى تأكيد كلمة المرور.",
  confirmNewPasswordRequired: "يُرجى تأكيد كلمة المرور الجديدة.",
  passwordsMismatch: "كلمتا المرور غير متطابقتين.",
} satisfies Messages["validation"]
