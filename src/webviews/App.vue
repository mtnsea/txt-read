<template>
  <div class="page">
    <div class="title">Title: <span>{{ title }}</span></div>
    <div class="text">
      <div v-html="text"></div>
    </div>
    <div class="btn-box">
      <div class="btn" @click="previousPage">上一页</div>
      <div>{{ pageNumber }}/{{ total }}</div>
      <div class="btn" @click="nextPage">下一页</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};
const vscode = acquireVsCodeApi();

const title = ref('');
const text = ref('');
const total = ref(0);
const pageNumber = ref(0);

const handleMessage = (event: any) => {
  const data = event.data;
  if (data.command === 'send') {
    const { message } = data;
    text.value = message.text;
    title.value = message.title;
    total.value = message.total;
    pageNumber.value = message.pageNumber;
  }
  console.log(title.value);
}

const postMessage = (command: string, data: any) => {
  vscode.postMessage({ command, data });
};

// 下一页
const nextPage = () => {
  postMessage('fromVue_nextPage', {pageNumber: pageNumber.value});

};
// 上一页
const previousPage = () => {
  postMessage('fromVue_previousPage', { pageNumber: pageNumber.value });
};


// 在组件挂载时设置消息监听器
onMounted(() => {
  window.addEventListener('message', handleMessage);
  postMessage('fromVue_mounted', { pageNumber: pageNumber.value });
});
onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage);
})
</script>

<style lang="scss">
.page {
  padding: 10px;

  .title {
    span {
      padding: 0 10px;
    }
  }

  .text {
    width: 100%;
    text-wrap: wrap;
  }

  .btn-box {
    display: flex;
    align-items: center;

    .btn {
      cursor: pointer;
      margin: 10px;

      &:hover {
        opacity: 0.8;
      }
    }
  }
}
</style>
