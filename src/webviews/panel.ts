import { createApp } from "vue";
import App from "./App.vue";
import "./panel.scss";

const app = createApp(App);

// 监听从 extension.ts 发送的消息
window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.command === "init") {
    app.config.globalProperties.$extensionData = message.data;
  }
});

app.mount("#app");
