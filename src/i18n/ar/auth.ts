import { PASSWORD_MIN_LENGTH } from "@/lib/validation"
import type { Messages } from "../messages"

export default {
  intros: {
    signIn: {
      eyebrow: "منطقة العملاء الخاصة",
      title: "مرحباً بعودتك.",
      lead: "سجّل الدخول للوصول إلى طلباتك وعطورك المحفوظة وبيانات حسابك.",
    },
    signUp: {
      eyebrow: "منطقة العملاء الخاصة",
      title: "أنشئ مساحتك الخاصة.",
      lead: "أنشئ حساباً لحفظ العطور وإدارة بياناتك وعرض طلباتك.",
    },
    forgotPassword: {
      eyebrow: "حسابي في Perfumeria",
      title: "نسيت كلمة المرور",
      lead: "أدخل البريد الإلكتروني المرتبط بحسابك، وسنرسل إليك رابطًا لاختيار كلمة مرور جديدة.",
    },
    resetPassword: {
      eyebrow: "حسابي في Perfumeria",
      title: "كلمة مرور جديدة",
      lead: "اختر كلمة مرور جديدة لحسابك في Perfumeria.",
    },
  },
  notes: {
    signIn: "أهلًا بعودتك إلى خزانة عطورك الخاصة.",
    signUp: "احتفظ بطلباتك وعناوينك وعطورك المحفوظة في مكان واحد.",
    forgotPassword: "يحدث ذلك أحيانًا. كلمة مرور جديدة على بُعد رسالة واحدة.",
    resetPassword: "اختر كلمة يسهل تذكّرها، من ثمانية أحرف على الأقل.",
  },
  fields: {
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    confirmPassword: "تأكيد كلمة المرور",
    newPassword: "كلمة المرور الجديدة",
    confirmNewPassword: "تأكيد كلمة المرور الجديدة",
  },
  placeholders: {
    email: "you@example.com",
    password: "أدخل كلمة المرور",
  },
  password: {
    show: "إظهار",
    hide: "إخفاء",
    suffix: " كلمة المرور",
    hint: `${PASSWORD_MIN_LENGTH} أحرف على الأقل.`,
  },
  resend: "إعادة إرسال رسالة التأكيد",
  checkInbox: "تحقّق من بريدك الوارد",
  signIn: {
    newHere: "جديد في Perfumeria؟",
    createAccount: "إنشاء حساب",
    forgot: "نسيت كلمة المرور؟",
    submit: "تسجيل الدخول",
    submitting: "جارٍ تسجيل الدخول",
    resent: (email: string) => `أرسلنا رابط تأكيد جديدًا إلى ${email}.`,
  },
  signUp: {
    haveAccount: "لديك حساب بالفعل؟",
    signIn: "تسجيل الدخول",
    submit: "إنشاء الحساب",
    submitting: "جارٍ إنشاء الحساب",
    sentBefore: "أرسلنا رابط تأكيد إلى ",
    sentAfter: ". سيُفعَّل حسابك بمجرد فتح الرابط.",
    resent: "رابط تأكيد جديد في طريقه إليك.",
  },
  forgotPassword: {
    remembered: "تذكّرتها؟",
    backToSignIn: "العودة إلى تسجيل الدخول",
    submit: "إرسال رابط إعادة التعيين",
    submitting: "جارٍ إرسال الرابط",
    sentBefore: "إذا كان هناك حساب مرتبط بالبريد ",
    sentAfter:
      "، فرابط اختيار كلمة مرور جديدة في طريقه إليك. قد يستغرق وصوله بضع دقائق.",
    differentEmail: "استخدام بريد إلكتروني آخر",
  },
  resetPassword: {
    checking: "جارٍ التحقق من الرابط",
    updatedTitle: "تم تحديث كلمة المرور",
    updatedText: "تم تعيين كلمة المرور الجديدة وتسجيل دخولك.",
    goToAccount: "الانتقال إلى حسابي",
    invalidTitle: "لا يمكن استخدام هذا الرابط",
    invalidDefault: "رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته.",
    invalidNote:
      "تعمل روابط إعادة التعيين مرة واحدة فقط، وتنتهي صلاحيتها بعد وقت قصير.",
    requestNew: "طلب رابط جديد",
    submit: "حفظ كلمة المرور",
    submitting: "جارٍ الحفظ",
  },
  opening: "جارٍ فتح حسابك",
  errors: {
    invalid_credentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    email_not_confirmed:
      "يُرجى تأكيد بريدك الإلكتروني أولًا. ستجد رابط التأكيد في بريدك الوارد.",
    user_already_exists:
      "يوجد حساب مسجّل بهذا البريد الإلكتروني. سجّل الدخول أو أعد تعيين كلمة المرور.",
    weak_password:
      "يُرجى اختيار كلمة مرور أقوى: 8 أحرف على الأقل، مع تجنّب الكلمات الشائعة.",
    same_password: "يجب أن تختلف كلمة المرور الجديدة عن الحالية.",
    over_email_send_rate_limit:
      "طُلب عدد كبير من الرسائل. يُرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.",
    over_request_rate_limit:
      "محاولات كثيرة. يُرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.",
    email_address_invalid: "يُرجى إدخال بريد إلكتروني صحيح.",
    signup_disabled: "لا يمكن إنشاء حسابات جديدة في الوقت الحالي.",
    email_provider_disabled: "تسجيل الدخول بالبريد الإلكتروني غير متاح حاليًا.",
    user_banned: "لا يمكن لهذا الحساب تسجيل الدخول.",
    session_expired: "انتهت جلستك. يُرجى تسجيل الدخول مرة أخرى.",
    otp_expired: "انتهت صلاحية هذا الرابط أو سبق استخدامه.",
    request_timeout:
      "استغرق الطلب وقتًا أطول من المعتاد. يُرجى المحاولة مرة أخرى.",
    network: "تعذّر الاتصال بالخادم. يُرجى التحقق من اتصالك بالإنترنت.",
    link_invalid: "هذا الرابط غير صالح أو انتهت صلاحيته.",
    not_configured: "تسجيل الدخول غير متاح بعد. يُرجى المحاولة لاحقًا.",
    general: "حدث خطأ ما. يُرجى المحاولة مرة أخرى.",
  },
} satisfies Messages["auth"]
