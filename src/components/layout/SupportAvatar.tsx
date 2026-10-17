/*
 * The support agent shown on the contact launcher. The artwork is one file,
 * public/images/support/support-agent.svg (a temporary illustration): replace
 * that file, or point `src` at another square image, to change it. The
 * launcher crops it to a circle and sizes it; nothing else depends on it.
 */
const src = `${import.meta.env.BASE_URL}images/support/support-agent.svg`

/** Decorative: the launcher's own text says what the button does. */
export default function SupportAvatar({ className }: { className?: string }) {
  return (
    <img
      className={className}
      src={src}
      alt=""
      width={160}
      height={160}
      decoding="async"
      draggable={false}
    />
  )
}
