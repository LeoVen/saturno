<script setup lang="ts">
import { ref } from 'vue'
import { useProfilesStore } from '../stores/profiles'
import { confirmAndResetForProfileSwitch } from '../stores/profileSwitchGuard'
import { profileColorHex } from '../entities/profile'

// INTERLUDE-2 (D-42): always-visible Profile switcher — user's own ask for
// "a header with a dropdown" so which Profile is open is never ambiguous.
// Full management (rename/color/duplicate/delete) lives on "Perfis"
// (ProfilesView.vue) instead of being crammed into this dropdown; "Novo
// Perfil" is duplicated here too since creating one is common enough to
// want without leaving whatever screen you're on.

const emit = defineEmits<{ manage: [] }>()

const store = useProfilesStore()
const open = ref(false)

function switchTo(id: string): void {
  if (id === store.activeProfileId) {
    open.value = false
    return
  }
  open.value = false
  if (!confirmAndResetForProfileSwitch()) return
  store.setActive(id)
}

function createProfile(): void {
  const name = prompt('Nome do novo Perfil:')
  open.value = false
  if (name === null) return
  if (!confirmAndResetForProfileSwitch()) return
  store.create(name)
}

function goManage(): void {
  open.value = false
  emit('manage')
}
</script>

<template>
  <header class="app-header">
    <div class="profile-switcher">
      <button type="button" class="profile-switcher-trigger" @click="open = !open">
        <span
          class="color-dot"
          :style="{ background: profileColorHex(store.activeProfile?.color ?? 'azul') }"
        ></span>
        <span>{{ store.activeProfile?.name ?? 'Perfil' }}</span>
        <span class="caret">▾</span>
      </button>

      <template v-if="open">
        <div class="profile-switcher-backdrop" @click="open = false"></div>
        <div class="profile-switcher-panel">
          <button
            v-for="p in store.items"
            :key="p.id"
            type="button"
            class="profile-switcher-item"
            :class="{ active: p.id === store.activeProfileId }"
            @click="switchTo(p.id)"
          >
            <span class="color-dot" :style="{ background: profileColorHex(p.color) }"></span>
            {{ p.name }}
          </button>
          <hr />
          <button type="button" class="profile-switcher-item" @click="createProfile">
            + Novo Perfil
          </button>
          <button type="button" class="profile-switcher-item" @click="goManage">
            Gerenciar Perfis…
          </button>
        </div>
      </template>
    </div>
  </header>
</template>
