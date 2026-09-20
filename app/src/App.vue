<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useScaffoldCheckStore } from './stores/scaffoldCheck'
import type { SolverWorkerRequest, SolverWorkerResponse } from './wasm/solver.worker'

// E01 scaffolding checks only (Human Verification #4/#5) — this whole
// component is replaced once E02+ build real screens.

const wasmStatus = ref<'carregando' | 'ok' | 'erro'>('carregando')
const wasmMessage = ref('')

let worker: Worker | undefined

onMounted(() => {
  worker = new Worker(new URL('./wasm/solver.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker.onmessage = (event: MessageEvent<SolverWorkerResponse>) => {
    if (event.data.type === 'pong') {
      wasmStatus.value = 'ok'
      wasmMessage.value = event.data.message
    }
  }
  worker.onerror = () => {
    wasmStatus.value = 'erro'
  }
  const request: SolverWorkerRequest = { type: 'ping' }
  worker.postMessage(request)
})

onUnmounted(() => {
  worker?.terminate()
})

const scaffoldCheck = useScaffoldCheckStore()
</script>

<template>
  <main>
    <h1>Saturno</h1>
    <p>Gerador de horários escolares.</p>

    <section>
      <h2>Verificação: Rust → WASM → Worker</h2>
      <p v-if="wasmStatus === 'carregando'">Carregando módulo WASM…</p>
      <p v-else-if="wasmStatus === 'ok'">Resposta do solver: {{ wasmMessage }}</p>
      <p v-else>Falha ao carregar o módulo WASM.</p>
    </section>

    <section>
      <h2>Verificação: persistência (IndexedDB)</h2>
      <p>
        Último salvamento:
        {{ scaffoldCheck.lastSavedAt ?? 'nenhum ainda' }}
      </p>
      <button type="button" @click="scaffoldCheck.touch()">Salvar valor de teste</button>
      <p>Recarregue a página para confirmar que o valor persistiu.</p>
    </section>
  </main>
</template>
