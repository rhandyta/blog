import '../styles/base.css'
import '../styles/admin.css'

document.addEventListener('submit', (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null
  const message = submitter?.dataset.confirm ?? form.dataset.confirm
  if (message && !window.confirm(message)) {
    event.preventDefault()
    return
  }
  // Form posts cannot carry a fragment; keep it when switching language.
  if (form.matches('[data-lang-switch]') && window.location.hash) {
    const input = form.querySelector<HTMLInputElement>('input[name="next"]')
    if (input && !input.value.includes('#')) input.value = `${input.value}${window.location.hash}`
  }
})
