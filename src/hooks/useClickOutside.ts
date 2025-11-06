import { useEffect } from 'react'

interface UseClickOutsideOptions {
  onClickOutside: () => void
}

export function useClickOutside(ref: React.RefObject<HTMLElement>, { onClickOutside }: UseClickOutsideOptions) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside()
      }
    }

    // Add event listeners
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      // Clean up event listeners
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [ref, onClickOutside])
}