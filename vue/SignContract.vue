<!-- Vue 3: show the PenlyDoc signing page for one contract.  npm install penlydoc-embed -->
<template><div ref="box" /></template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { mount } from 'penlydoc-embed';

const props = defineProps({ contractId: { type: String, required: true } });
const emit = defineEmits(['signed', 'declined']);
const box = ref(null);
let signing;

onMounted(async () => {
  const { url } = await (await fetch(`/api/contracts/${props.contractId}/sign-link`, { method: 'POST' })).json();
  signing = await mount(box.value, {
    url, height: '80vh',
    onCompleted: e => emit('signed', e.envelopeStatus),
    onDeclined: () => emit('declined')
  });
});
onBeforeUnmount(() => signing?.destroy());
</script>
