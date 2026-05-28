import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

type AnimatedNumberProps = {
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
}

export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
}: AnimatedNumberProps) {
  const elementRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const state = { value: 0 }

    const tween = gsap.to(state, {
      value,
      duration: 1.2,
      ease: 'power2.out',
      onUpdate: () => {
        if (!elementRef.current) {
          return
        }

        elementRef.current.textContent = `${prefix}${state.value.toFixed(decimals)}${suffix}`
      },
    })

    return () => {
      tween.kill()
    }
  }, [decimals, prefix, suffix, value])

  return (
    <span ref={elementRef}>
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  )
}
