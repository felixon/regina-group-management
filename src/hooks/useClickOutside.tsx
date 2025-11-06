import { useEffect, RefObject } from 'react'

interface UseClickOutsideOptions {
  onClickOutside?: () => void
  onClickInside?: () => void
}

export function useClickOutside(
  ref: RefObject<HTMLElement>,
  options: UseClickOutsideOptions = {}
) {
  const { onClickOutside, onClickInside } = options

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (ref.current && !ref.current.contains(target)) {
        onClickOutside?.()
      } else if (ref.current && ref.current.contains(target)) {
        onClickInside?.()
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [ref, onClickOutside, onClickInside])
}