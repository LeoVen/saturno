import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { persistencePlugin } from './persistence/persistencePlugin'

const pinia = createPinia()
pinia.use(persistencePlugin)

createApp(App).use(pinia).mount('#app')
