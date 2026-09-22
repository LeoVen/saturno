import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { persistencePlugin } from './persistence/persistencePlugin'
import { initProfilePersistence } from './persistence/profilesPersistence'

const pinia = createPinia()
pinia.use(persistencePlugin)

// INTERLUDE-2: must finish before mount — every screen's first read of
// `entities`/`scheduleVersions` needs to already see the active Profile's
// data (D-42).
await initProfilePersistence(pinia)

createApp(App).use(pinia).mount('#app')
