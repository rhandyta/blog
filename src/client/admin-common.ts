import '../styles/base.css'
import '../styles/admin.css'

document.addEventListener('submit', (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null
  const message = submitter?.dataset.confirm ?? form.dataset.confirm
  if (message && !window.confirm(message)) {
    event.preventDefault()
  }
})
