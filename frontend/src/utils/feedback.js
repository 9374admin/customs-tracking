let audioCtx = null

export function playClick() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08)
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + 0.08)
  } catch (e) {}
}

export function playSuccess() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.frequency.value = 1200
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12)
    osc.start(audioCtx.currentTime)
    osc.stop(audioCtx.currentTime + 0.12)
  } catch (e) {}
}

export function haptic(duration = 10) {
  try {
    if (navigator.vibrate) navigator.vibrate(duration)
  } catch (e) {}
}

export function feedback() {
  playClick()
  haptic(10)
}

export function successFeedback() {
  playSuccess()
  haptic(15)
}